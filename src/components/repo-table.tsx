import { Checkbox } from "@/components/ui/checkbox"
import { RepoRow } from "@/components/repo-row"
import type { Repo, RepoAction } from "@/lib/types"

export function RepoTable({
  repos,
  selected,
  busy,
  onToggle,
  onToggleAll,
  onAction,
}: {
  repos: Repo[]
  selected: Set<number>
  busy: Record<number, "running" | "error">
  onToggle: (id: number) => void
  onToggleAll: () => void
  onAction: (action: RepoAction, repos: Repo[]) => void
}) {
  const allSelected = repos.length > 0 && repos.every((r) => selected.has(r.id))
  const someSelected = repos.some((r) => selected.has(r.id))

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3 px-3 py-1 text-xs text-muted-foreground">
        <Checkbox
          checked={allSelected}
          indeterminate={!allSelected && someSelected}
          onCheckedChange={onToggleAll}
          aria-label="Select all"
        />
        <span>
          {repos.length} {repos.length === 1 ? "repository" : "repositories"}
        </span>
      </div>

      {repos.map((repo) => (
        <RepoRow
          key={repo.id}
          repo={repo}
          selected={selected.has(repo.id)}
          status={busy[repo.id]}
          onToggle={() => onToggle(repo.id)}
          onAction={(action) => onAction(action, [repo])}
        />
      ))}
    </div>
  )
}
