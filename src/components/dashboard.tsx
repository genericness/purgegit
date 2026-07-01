import { useEffect, useMemo, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { RefreshCwIcon, HistoryIcon } from "lucide-react"
import { toast } from "sonner"
import { useRepos } from "@/hooks/use-repos"
import { useOwners } from "@/hooks/use-owners"
import { api } from "@/lib/api"
import { runBatch, type BatchItem } from "@/lib/queue"
import { monthsSince } from "@/lib/format"
import { buildCanonical } from "@/lib/history"
import { cn } from "@/lib/utils"
import type { Filters, Me, Owner, Repo, RepoAction, SortKey } from "@/lib/types"
import { AppHeader } from "@/components/app-header"
import { FiltersToolbar } from "@/components/filters-toolbar"
import { RepoTable } from "@/components/repo-table"
import { ActionBar } from "@/components/action-bar"
import { ActionConfirmDialog } from "@/components/confirm-dialog"
import { BatchProgressDialog, type BatchProgress } from "@/components/batch-progress-dialog"
import { ForkDetachDialog } from "@/components/fork-detach-dialog"
import { HistoryScrubDialog } from "@/components/history-scrub-dialog"
import { EmptyState } from "@/components/empty-state"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

const INITIAL_FILTERS: Filters = {
  search: "",
  sort: "pushed",
  forksOnly: false,
  archivedOnly: false,
  staleMonths: 0,
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

const PAST_TENSE: Record<RepoAction, string> = {
  private: "made private",
  archive: "archived",
  delete: "deleted",
}

function sortRepos(repos: Repo[], sort: SortKey): Repo[] {
  const list = [...repos]
  switch (sort) {
    case "name":
      return list.sort((a, b) => a.name.localeCompare(b.name))
    case "stars":
      return list.sort((a, b) => b.stargazersCount - a.stargazersCount)
    case "created":
      return list.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    default:
      return list.sort((a, b) => Date.parse(b.pushedAt) - Date.parse(a.pushedAt))
  }
}

function ListSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-start gap-3 rounded-lg border border-border/70 bg-card/40 px-3 py-3">
          <Skeleton className="mt-1 size-4 rounded" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-full max-w-md" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function Dashboard({ me }: { me: Me }) {
  const queryClient = useQueryClient()
  const ownersQuery = useOwners()
  const owners = useMemo(() => ownersQuery.data ?? [], [ownersQuery.data])
  const [owner, setOwner] = useState<Owner | null>(null)
  const reposQuery = useRepos(owner)
  const repos = useMemo(() => reposQuery.data ?? [], [reposQuery.data])

  const [filters, setFilters] = useState<Filters>(INITIAL_FILTERS)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [busy, setBusy] = useState<Record<number, "running" | "error">>({})
  const [pending, setPending] = useState<{ action: RepoAction; repos: Repo[] } | null>(null)
  const [progress, setProgress] = useState<BatchProgress | null>(null)
  const [forkPrompt, setForkPrompt] = useState<{ forks: Repo[]; others: Repo[] } | null>(null)
  const [scrubRepo, setScrubRepo] = useState<Repo | null>(null)
  const [flagged, setFlagged] = useState<Set<number>>(new Set())
  const [scanning, setScanning] = useState(false)
  const [running, setRunning] = useState(false)

  useEffect(() => {
    if (!owner) setOwner({ login: me.login, type: "user", avatarUrl: me.avatarUrl })
  }, [owner, me])

  useEffect(() => {
    setSelected(new Set())
    setFlagged(new Set())
    setBusy({})
  }, [owner?.login])

  const visible = useMemo(() => {
    let list = repos
    if (filters.forksOnly) list = list.filter((r) => r.fork)
    if (filters.archivedOnly) list = list.filter((r) => r.archived)
    if (filters.staleMonths > 0) list = list.filter((r) => monthsSince(r.pushedAt) >= filters.staleMonths)
    const q = filters.search.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (r) => r.name.toLowerCase().includes(q) || (r.description?.toLowerCase().includes(q) ?? false)
      )
    }
    return sortRepos(list, filters.sort)
  }, [repos, filters])

  const selectedRepos = useMemo(() => repos.filter((r) => selected.has(r.id)), [repos, selected])

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    setSelected((prev) => {
      const allSelected = visible.length > 0 && visible.every((r) => prev.has(r.id))
      const next = new Set(prev)
      for (const r of visible) {
        if (allSelected) next.delete(r.id)
        else next.add(r.id)
      }
      return next
    })
  }

  function applyOptimistic(action: RepoAction, id: number) {
    queryClient.setQueryData<Repo[]>(["repos", owner?.login], (old) => {
      if (!old) return old
      if (action === "archive") return old.map((r) => (r.id === id ? { ...r, archived: true } : r))
      return old.filter((r) => r.id !== id)
    })
  }

  function requestAction(action: RepoAction, targets: Repo[]) {
    if (running || targets.length === 0) return
    if (action === "private") {
      const forks = targets.filter((r) => r.fork)
      if (forks.length > 0) {
        setForkPrompt({ forks, others: targets.filter((r) => !r.fork) })
        return
      }
    }
    setPending({ action, repos: targets })
  }

  function confirmPending() {
    if (!pending) return
    const { action, repos: targets } = pending
    setPending(null)
    void performAction(action, targets)
  }

  async function performAction(action: RepoAction, targets: Repo[]) {
    setRunning(true)
    const idByKey = new Map(targets.map((r) => [String(r.id), r.id]))
    const nameByKey = new Map(targets.map((r) => [String(r.id), r.name]))
    if (targets.length > 1) {
      setProgress({ action, total: targets.length, completed: 0, ok: 0, failed: 0, current: null, done: false })
    }
    const items: BatchItem[] = targets.map((r) => ({
      key: String(r.id),
      run: () => {
        if (action === "private") return api.makePrivate(r.owner, r.name)
        if (action === "archive") return api.archive(r.owner, r.name)
        return api.remove(r.owner, r.name)
      },
    }))

    const outcomes = await runBatch(items, (key, status) => {
      const id = idByKey.get(key)
      if (id === undefined) return
      setBusy((prev) => {
        const next = { ...prev }
        if (status === "running") next[id] = "running"
        else if (status === "error") next[id] = "error"
        else delete next[id]
        return next
      })
      if (status === "ok") applyOptimistic(action, id)
      setProgress((p) => {
        if (!p) return p
        if (status === "running") return { ...p, current: nameByKey.get(key) ?? null }
        if (status === "ok") return { ...p, completed: p.completed + 1, ok: p.ok + 1 }
        if (status === "error") return { ...p, completed: p.completed + 1, failed: p.failed + 1 }
        return p
      })
    })

    const failed = outcomes.filter((o) => !o.ok)
    const okCount = outcomes.length - failed.length
    setSelected(new Set(failed.map((o) => idByKey.get(o.key)!)))
    setBusy({})
    setRunning(false)
    setProgress((p) => (p ? { ...p, done: true, current: null } : p))

    const noun = (n: number) => (n === 1 ? "repository" : "repositories")
    if (failed.length === 0) toast.success(`${okCount} ${noun(okCount)} ${PAST_TENSE[action]}`)
    else if (okCount === 0) toast.error(`Failed on ${failed.length} ${noun(failed.length)}`)
    else toast.warning(`${okCount} ${PAST_TENSE[action]}, ${failed.length} failed`)

    void queryClient.invalidateQueries({ queryKey: ["repos", owner?.login] })
  }

  async function handleLogout() {
    await api.logout().catch(() => undefined)
    queryClient.setQueryData(["me"], null)
    queryClient.removeQueries({ queryKey: ["repos"] })
    queryClient.removeQueries({ queryKey: ["owners"] })
  }

  async function runDiscovery() {
    if (scanning || repos.length === 0) return
    setScanning(true)
    const { keptEmails } = buildCanonical(me)
    const found = new Set<number>()
    for (const r of repos) {
      try {
        const { identities } = await api.peekIdentities(r.owner, r.name)
        const mineOld = identities.some(
          (i) =>
            i.email &&
            i.login &&
            i.login.toLowerCase() === me.login.toLowerCase() &&
            !keptEmails.has(i.email.toLowerCase())
        )
        if (mineOld) found.add(r.id)
      } catch {
        found.delete(r.id)
      }
      setFlagged(new Set(found))
      await sleep(120)
    }
    setScanning(false)
    toast(
      found.size > 0
        ? `${found.size} repo${found.size === 1 ? "" : "s"} have old commit identities`
        : "No old commit identities found"
    )
  }

  return (
    <div className="min-h-[100svh]">
      <AppHeader me={me} repoCount={repos.length} onLogout={handleLogout} />

      <main className="mx-auto max-w-4xl px-4 py-6 pb-28">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            {owners.length > 1 ? (
              <div className="flex items-center gap-2">
                {owner && (
                  <img src={owner.avatarUrl} alt="" className="size-6 shrink-0 rounded-full ring-1 ring-border" />
                )}
                <select
                  className="h-8 min-w-0 max-w-full rounded-lg border border-input bg-transparent px-2.5 text-sm font-medium text-foreground outline-none [color-scheme:dark] [&>option]:bg-popover [&>option]:text-popover-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                  value={owner?.login ?? ""}
                  onChange={(e) => setOwner(owners.find((o) => o.login === e.target.value) ?? null)}
                  aria-label="Repository owner"
                >
                  {owners.map((o) => (
                    <option key={o.login} value={o.login}>
                      {o.type === "user" ? `${o.login} (you)` : o.login}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <h1 className="text-lg font-semibold text-foreground">your public repositories</h1>
            )}
            <p className="mt-1 text-sm text-muted-foreground">
              select repos to make private, archive, or delete.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void runDiscovery()}
              disabled={scanning || repos.length === 0}
            >
              <HistoryIcon className={cn(scanning && "animate-pulse")} />
              {scanning ? "scanning…" : "find old identities"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void reposQuery.refetch()}
              disabled={reposQuery.isFetching}
            >
              <RefreshCwIcon className={cn(reposQuery.isFetching && "animate-spin")} />
              refresh
            </Button>
          </div>
        </div>

        <FiltersToolbar filters={filters} onChange={setFilters} />

        <div className="mt-5">
          {!owner || reposQuery.isLoading ? (
            <ListSkeleton />
          ) : reposQuery.isError ? (
            <EmptyState
              title="couldn't load repositories"
              description="something went wrong fetching your repos. try refreshing."
            />
          ) : repos.length === 0 ? (
            <EmptyState
              title="nothing to purge"
              description="no public repositories found for this owner."
            />
          ) : visible.length === 0 ? (
            <EmptyState title="no matches" description="no repositories match the current filters." />
          ) : (
            <RepoTable
              repos={visible}
              selected={selected}
              busy={busy}
              flagged={flagged}
              onToggle={toggle}
              onToggleAll={toggleAll}
              onAction={requestAction}
              onScrub={setScrubRepo}
            />
          )}
        </div>
      </main>

      <ActionBar selectedRepos={selectedRepos} onAction={requestAction} onClear={() => setSelected(new Set())} />

      {pending && (
        <ActionConfirmDialog
          action={pending.action}
          repos={pending.repos}
          onConfirm={confirmPending}
          onCancel={() => setPending(null)}
        />
      )}

      {progress && <BatchProgressDialog progress={progress} onClose={() => setProgress(null)} />}

      {scrubRepo && (
        <HistoryScrubDialog repo={scrubRepo} me={me} onClose={() => setScrubRepo(null)} />
      )}

      {forkPrompt && (
        <ForkDetachDialog
          forks={forkPrompt.forks}
          others={forkPrompt.others}
          onClose={() => setForkPrompt(null)}
          onPrivateOthers={() => {
            const others = forkPrompt.others
            setForkPrompt(null)
            if (others.length > 0) setPending({ action: "private", repos: others })
          }}
        />
      )}
    </div>
  )
}
