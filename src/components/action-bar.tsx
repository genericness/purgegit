import { LockIcon, ArchiveIcon, Trash2Icon, XIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { Repo, RepoAction } from "@/lib/types"

export function ActionBar({
  selectedRepos,
  onAction,
  onClear,
}: {
  selectedRepos: Repo[]
  onAction: (action: RepoAction, repos: Repo[]) => void
  onClear: () => void
}) {
  if (selectedRepos.length === 0) return null

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center px-4 pb-4">
      <div className="pointer-events-auto flex flex-wrap items-center gap-2 rounded-xl border border-border bg-popover/95 p-2 pl-3 shadow-lg ring-1 ring-foreground/10 backdrop-blur-sm">
        <span className="text-sm font-medium text-foreground">{selectedRepos.length} selected</span>
        <div className="h-5 w-px bg-border" />
        <Button variant="outline" size="sm" onClick={() => onAction("private", selectedRepos)}>
          <LockIcon />
          Make private
        </Button>
        <Button variant="outline" size="sm" onClick={() => onAction("archive", selectedRepos)}>
          <ArchiveIcon />
          Archive
        </Button>
        <Button variant="destructive" size="sm" onClick={() => onAction("delete", selectedRepos)}>
          <Trash2Icon />
          Delete
        </Button>
        <Button variant="ghost" size="icon-sm" aria-label="Clear selection" onClick={onClear}>
          <XIcon />
        </Button>
      </div>
    </div>
  )
}
