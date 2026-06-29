import {
  StarIcon,
  GitForkIcon,
  LockIcon,
  ArchiveIcon,
  Trash2Icon,
  Loader2Icon,
  ExternalLinkIcon,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { ForkBadge } from "@/components/fork-badge"
import { cn } from "@/lib/utils"
import { relativeTime, languageColor } from "@/lib/format"
import type { Repo, RepoAction } from "@/lib/types"

export function RepoRow({
  repo,
  selected,
  status,
  onToggle,
  onAction,
}: {
  repo: Repo
  selected: boolean
  status?: "running" | "error"
  onToggle: () => void
  onAction: (action: RepoAction) => void
}) {
  const running = status === "running"

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-lg border border-border/70 bg-card/40 px-3 py-3 transition-colors",
        selected && "border-primary/50 bg-accent/40",
        status === "error" && "border-destructive/50"
      )}
    >
      <Checkbox checked={selected} onCheckedChange={onToggle} className="mt-1" aria-label={`Select ${repo.name}`} />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <a
            href={repo.htmlUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex min-w-0 items-center gap-1 text-sm font-medium text-foreground hover:text-primary hover:underline"
          >
            <span className="truncate">{repo.name}</span>
            <ExternalLinkIcon className="size-3 shrink-0 opacity-60" />
          </a>
          {repo.fork && <ForkBadge repo={repo} />}
          {repo.archived && <Badge variant="secondary">archived</Badge>}
        </div>

        {repo.description && (
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{repo.description}</p>
        )}

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {repo.language && (
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full" style={{ backgroundColor: languageColor(repo.language) }} />
              {repo.language}
            </span>
          )}
          {repo.stargazersCount > 0 && (
            <span className="flex items-center gap-1">
              <StarIcon className="size-3" />
              {repo.stargazersCount}
            </span>
          )}
          {repo.forksCount > 0 && (
            <span className="flex items-center gap-1">
              <GitForkIcon className="size-3" />
              {repo.forksCount}
            </span>
          )}
          <span>updated {relativeTime(repo.pushedAt)}</span>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {running ? (
          <Loader2Icon className="m-1 size-4 animate-spin text-muted-foreground" />
        ) : (
          <>
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={repo.archived}
              title="Make private"
              aria-label="Make private"
              onClick={() => onAction("private")}
            >
              <LockIcon />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={repo.archived}
              title="Archive"
              aria-label="Archive"
              onClick={() => onAction("archive")}
            >
              <ArchiveIcon />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              title="Delete"
              aria-label="Delete"
              className="text-muted-foreground hover:text-destructive"
              onClick={() => onAction("delete")}
            >
              <Trash2Icon />
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
