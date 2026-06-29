import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { GitForkIcon } from "lucide-react"
import { api } from "@/lib/api"
import { badgeVariants } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import type { Repo } from "@/lib/types"

export function ForkBadge({ repo }: { repo: Repo }) {
  const [active, setActive] = useState(false)
  const parentQuery = useQuery({
    queryKey: ["parent", repo.id],
    queryFn: () => api.parent(repo.owner, repo.name),
    enabled: active,
    staleTime: Infinity,
    retry: false,
  })
  const parent = parentQuery.data

  return (
    <Tooltip onOpenChange={(open) => open && setActive(true)}>
      <TooltipTrigger
        render={
          <a
            href={parent?.htmlUrl}
            target="_blank"
            rel="noreferrer noopener"
            tabIndex={0}
            onMouseEnter={() => setActive(true)}
            onFocus={() => setActive(true)}
            onClick={(event) => event.stopPropagation()}
            aria-label="Open the repository this was forked from"
            className={cn(
              badgeVariants({ variant: "outline" }),
              "cursor-pointer gap-1 hover:border-primary/50 hover:bg-muted hover:text-foreground"
            )}
          />
        }
      >
        <GitForkIcon className="size-3" />
        fork
      </TooltipTrigger>
      <TooltipContent side="top">
        {parentQuery.isError ? (
          "couldn't load source repository"
        ) : parent ? (
          <span>
            forked from <span className="font-semibold">{parent.fullName}</span>
          </span>
        ) : active && parentQuery.isFetching ? (
          "finding source…"
        ) : (
          "open the source repository"
        )}
      </TooltipContent>
    </Tooltip>
  )
}
