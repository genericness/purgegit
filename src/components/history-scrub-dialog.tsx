import { useEffect, useMemo, useRef, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Loader2Icon, TriangleAlertIcon, CircleCheckIcon } from "lucide-react"
import { api, ApiError } from "@/lib/api"
import {
  buildCanonical,
  collectIdentities,
  computeAffected,
  identityKey,
  topoSort,
} from "@/lib/history"
import type { Me, Repo } from "@/lib/types"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"

const PACE = 250

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn()
    } catch (err) {
      if (err instanceof ApiError && err.code === "rate_limited" && attempt < 5) {
        await sleep(Math.min(err.retryAfter ?? 5, 15) * 1000)
        continue
      }
      throw err
    }
  }
}

type Phase = "review" | "running" | "done" | "error"

export function HistoryScrubDialog({ repo, me, onClose }: { repo: Repo; me: Me; onClose: () => void }) {
  const queryClient = useQueryClient()
  const scanQuery = useQuery({
    queryKey: ["scan", repo.id],
    queryFn: () => api.scanHistory(repo.owner, repo.name),
    retry: false,
    staleTime: Infinity,
  })
  const scan = scanQuery.data

  const { canonical, keptEmails } = useMemo(() => buildCanonical(me), [me])
  const identities = useMemo(
    () => (scan ? collectIdentities(scan.commits, keptEmails) : []),
    [scan, keptEmails]
  )

  const [selectedScrub, setSelectedScrub] = useState<Set<string>>(new Set())
  const [canonicalName, setCanonicalName] = useState(canonical.name)
  const [canonicalEmail, setCanonicalEmail] = useState(canonical.email)
  const [confirmText, setConfirmText] = useState("")
  const [phase, setPhase] = useState<Phase>("review")
  const [runState, setRunState] = useState<{ label: string; done: number; total: number } | null>(null)
  const [result, setResult] = useState<{ rewritten: number; branches: number; backups: string[] } | null>(null)
  const [errorMsg, setErrorMsg] = useState("")

  const seeded = useRef(false)
  useEffect(() => {
    if (scan && !seeded.current) {
      seeded.current = true
      setSelectedScrub(
        new Set(identities.filter((i) => !i.isCanonical).map((i) => identityKey(i.name, i.email)))
      )
    }
  }, [scan, identities])

  const affectedCount = useMemo(
    () => (scan ? computeAffected(scan.commits, selectedScrub).size : 0),
    [scan, selectedScrub]
  )

  function toggleIdentity(key: string) {
    setSelectedScrub((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const canRewrite =
    !!scan &&
    !scan.truncated &&
    phase === "review" &&
    selectedScrub.size > 0 &&
    affectedCount > 0 &&
    canonicalName.trim().length > 0 &&
    canonicalEmail.trim().length > 0 &&
    confirmText === repo.name

  async function run() {
    if (!scan) return
    setPhase("running")
    try {
      const scrubKeys = selectedScrub
      const ordered = topoSort(scan.commits)
      const affected = computeAffected(scan.commits, scrubKeys)
      const total = affected.size
      const map = new Map<string, string>()
      let done = 0
      setRunState({ label: "Rewriting commits", done, total })

      for (const c of ordered) {
        if (!affected.has(c.sha)) {
          map.set(c.sha, c.sha)
          continue
        }
        const parents = c.parents.map((p) => map.get(p) ?? p)
        const newName = canonicalName.trim()
        const newEmail = canonicalEmail.trim()
        const author = scrubKeys.has(identityKey(c.author.name, c.author.email))
          ? { name: newName, email: newEmail, date: c.author.date }
          : c.author
        const committer = scrubKeys.has(identityKey(c.committer.name, c.committer.email))
          ? { name: newName, email: newEmail, date: c.committer.date }
          : c.committer
        const created = await withRetry(() =>
          api.createCommit(repo.owner, repo.name, {
            message: c.message,
            tree: c.tree,
            parents,
            author,
            committer,
          })
        )
        map.set(c.sha, created.sha)
        done++
        setRunState({ label: "Rewriting commits", done, total })
        await sleep(PACE)
      }

      setRunState({ label: "Updating branches", done: total, total })
      const stamp = `${total}-${ordered.length}`
      const changedBranches = scan.branches.filter((b) => affected.has(b.sha))
      const changedTags = scan.tags.filter((t) => affected.has(t.sha))
      const backups: string[] = []

      for (const b of changedBranches) {
        const ref = `refs/purgegit-backup/${stamp}/heads/${b.name}`
        await withRetry(() => api.createBackupRef(repo.owner, repo.name, ref, b.sha))
        backups.push(ref)
      }
      for (const t of changedTags) {
        const ref = `refs/purgegit-backup/${stamp}/tags/${t.name}`
        await withRetry(() => api.createBackupRef(repo.owner, repo.name, ref, t.sha))
        backups.push(ref)
      }
      for (const b of changedBranches) {
        await withRetry(() => api.forceRef(repo.owner, repo.name, `heads/${b.name}`, map.get(b.sha) as string))
        await sleep(PACE)
      }
      for (const t of changedTags) {
        await withRetry(() => api.forceRef(repo.owner, repo.name, `tags/${t.name}`, map.get(t.sha) as string))
        await sleep(PACE)
      }

      setResult({ rewritten: total, branches: changedBranches.length, backups })
      setPhase("done")
      void queryClient.invalidateQueries({ queryKey: ["repos"] })
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Rewrite failed")
      setPhase("error")
    }
  }

  const pct = runState && runState.total > 0 ? Math.round((runState.done / runState.total) * 100) : 0

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && phase !== "running") onClose()
      }}
    >
      <DialogContent showCloseButton={phase !== "running"} className="sm:max-w-lg">
        {phase === "running" ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Loader2Icon className="size-4 animate-spin text-primary" />
                {runState?.label ?? "Rewriting"}
              </DialogTitle>
              <DialogDescription>Don't close this tab until it finishes.</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-2">
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary transition-all duration-200" style={{ width: `${pct}%` }} />
              </div>
              <div className="text-xs text-muted-foreground">
                {runState?.done} of {runState?.total} commits
              </div>
            </div>
          </>
        ) : phase === "done" && result ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CircleCheckIcon className="size-4 text-primary" />
                History rewritten
              </DialogTitle>
              <DialogDescription>
                {result.rewritten} commit{result.rewritten === 1 ? "" : "s"} rewritten and force-pushed across{" "}
                {result.branches} branch{result.branches === 1 ? "" : "es"}.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-1.5 text-sm">
              <span className="text-muted-foreground">
                Backups were saved. To undo, force-push a backup ref over the branch:
              </span>
              <ul className="max-h-32 overflow-y-auto rounded-lg border border-border bg-muted/40 p-2 font-mono text-xs">
                {result.backups.map((b) => (
                  <li key={b} className="truncate">{b}</li>
                ))}
              </ul>
            </div>
            <DialogFooter>
              <DialogClose render={<Button onClick={onClose} />}>Close</DialogClose>
            </DialogFooter>
          </>
        ) : phase === "error" ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <TriangleAlertIcon className="size-4 text-destructive" />
                Rewrite failed
              </DialogTitle>
              <DialogDescription>{errorMsg}</DialogDescription>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Some commits may have been created but refs were not moved, so your branches are unchanged unless the
              error happened during the force-push step. Check the repository and any{" "}
              <span className="font-mono">refs/purgegit-backup/*</span> refs before retrying.
            </p>
            <DialogFooter>
              <DialogClose render={<Button variant="outline" onClick={onClose} />}>Close</DialogClose>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Scrub commit identities</DialogTitle>
              <DialogDescription>
                Rewrite <span className="font-medium text-foreground">{repo.name}</span>'s history to replace old
                author/committer names and emails, then force-push.
              </DialogDescription>
            </DialogHeader>

            {scanQuery.isLoading ? (
              <div className="flex flex-col gap-2">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : scanQuery.isError ? (
              <p className="text-sm text-destructive">Couldn't scan this repository's history.</p>
            ) : scan && scan.truncated ? (
              <p className="text-sm text-muted-foreground">
                This repository's history is too large to rewrite in the browser. Use{" "}
                <span className="font-mono">git filter-repo</span> locally and force-push instead.
              </p>
            ) : scan ? (
              <div className="flex flex-col gap-3">
                <p className="text-xs text-muted-foreground">
                  {scan.commits.length} commit{scan.commits.length === 1 ? "" : "s"} across {scan.branches.length}{" "}
                  branch{scan.branches.length === 1 ? "" : "es"}. Select the identities to replace:
                </p>

                <ul className="max-h-44 overflow-y-auto rounded-lg border border-border bg-muted/30 p-1.5 text-sm">
                  {identities.map((i) => {
                    const key = identityKey(i.name, i.email)
                    return (
                      <li key={key} className="flex items-center gap-2.5 px-1.5 py-1.5">
                        <Checkbox
                          checked={selectedScrub.has(key)}
                          disabled={i.isCanonical}
                          onCheckedChange={() => toggleIdentity(key)}
                          aria-label={`Replace ${i.name}`}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-foreground">
                            {i.name || "(no name)"} <span className="text-muted-foreground">&lt;{i.email}&gt;</span>
                          </div>
                        </div>
                        {i.isCanonical ? (
                          <Badge variant="secondary">you</Badge>
                        ) : (
                          <Badge variant="outline">{i.authorCount + i.committerCount}</Badge>
                        )}
                      </li>
                    )
                  })}
                </ul>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                    Replace with name
                    <Input value={canonicalName} onChange={(e) => setCanonicalName(e.target.value)} />
                  </label>
                  <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                    Replace with email
                    <Input value={canonicalEmail} onChange={(e) => setCanonicalEmail(e.target.value)} />
                  </label>
                </div>

                <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-2.5 text-xs text-muted-foreground">
                  <TriangleAlertIcon className="mt-0.5 size-3.5 shrink-0 text-destructive" />
                  <span>
                    This rewrites <span className="font-medium text-foreground">{affectedCount}</span> commit
                    {affectedCount === 1 ? "" : "s"} and force-pushes. Commit SHAs change, GPG signatures are dropped,
                    and open PRs may break. It can't be fully undone, though a backup ref is saved first. Forks and
                    GitHub's cache may still retain old commits.
                  </span>
                </div>

                <label className="flex flex-col gap-1 text-sm text-muted-foreground">
                  Type <span className="font-mono text-foreground">{repo.name}</span> to confirm
                  <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} autoComplete="off" spellCheck={false} />
                </label>
              </div>
            ) : null}

            <DialogFooter>
              <DialogClose render={<Button variant="outline" onClick={onClose} />}>Cancel</DialogClose>
              <Button variant="destructive" disabled={!canRewrite} onClick={() => void run()}>
                Rewrite &amp; force-push
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
