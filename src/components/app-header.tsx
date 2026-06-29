import { LogOutIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { Me } from "@/lib/types"

export function AppHeader({
  me,
  repoCount,
  onLogout,
}: {
  me: Me
  repoCount: number
  onLogout: () => void
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur-sm">
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-baseline gap-2.5">
          <span className="font-pixel text-lg tracking-tight text-foreground">purgegit</span>
          <span className="text-xs text-muted-foreground">
            {repoCount} public {repoCount === 1 ? "repo" : "repos"}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <img src={me.avatarUrl} alt="" className="size-6 rounded-full ring-1 ring-border" />
            <span className="hidden text-sm text-foreground/90 sm:inline">{me.login}</span>
          </div>
          <Button variant="ghost" size="sm" onClick={onLogout}>
            <LogOutIcon />
            logout
          </Button>
        </div>
      </div>
    </header>
  )
}
