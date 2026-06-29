import { Loader2Icon, CircleCheckIcon, TriangleAlertIcon } from "lucide-react"
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
import type { RepoAction } from "@/lib/types"

export interface BatchProgress {
  action: RepoAction
  total: number
  completed: number
  ok: number
  failed: number
  current: string | null
  done: boolean
}

const LABEL: Record<RepoAction, { running: string; past: string }> = {
  private: { running: "Making private", past: "made private" },
  archive: { running: "Archiving", past: "archived" },
  delete: { running: "Deleting", past: "deleted" },
}

export function BatchProgressDialog({
  progress,
  onClose,
}: {
  progress: BatchProgress
  onClose: () => void
}) {
  const { action, total, completed, ok, failed, current, done } = progress
  const pct = total === 0 ? 0 : Math.round((completed / total) * 100)
  const label = LABEL[action]
  const noun = (n: number) => (n === 1 ? "repository" : "repositories")

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && done) onClose()
      }}
    >
      <DialogContent showCloseButton={done}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {!done ? (
              <Loader2Icon className="size-4 animate-spin text-primary" />
            ) : failed > 0 ? (
              <TriangleAlertIcon className="size-4 text-destructive" />
            ) : (
              <CircleCheckIcon className="size-4 text-primary" />
            )}
            {!done ? `${label.running} repositories` : failed > 0 ? "Finished with errors" : "Done"}
          </DialogTitle>
          <DialogDescription>
            {!done
              ? (current ?? "Starting…")
              : failed > 0
                ? `${ok} ${label.past}, ${failed} failed.`
                : `${ok} ${noun(ok)} ${label.past}.`}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-200"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {completed} of {total}
            </span>
            {failed > 0 && <span className="text-destructive">{failed} failed</span>}
          </div>
        </div>

        {done && (
          <DialogFooter>
            <DialogClose render={<Button variant="outline" onClick={onClose} />}>Close</DialogClose>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
