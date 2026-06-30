import { TriangleAlertIcon, ExternalLinkIcon } from "lucide-react"
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
import type { Repo } from "@/lib/types"

export function ForkDetachDialog({
  forks,
  others,
  onPrivateOthers,
  onClose,
}: {
  forks: Repo[]
  others: Repo[]
  onPrivateOthers: () => void
  onClose: () => void
}) {
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TriangleAlertIcon className="size-4 text-destructive" />
            {forks.length === 1 ? "This fork can't be made private" : "Forks can't be made private"}
          </DialogTitle>
          <DialogDescription>
            GitHub won't make a fork private while it's part of a fork network. Detach each one below
            (Settings → Danger Zone → "Leave fork network"), then refresh and make it private.
          </DialogDescription>
        </DialogHeader>

        <ul className="max-h-48 overflow-y-auto rounded-lg border border-border bg-muted/40 p-1.5 text-sm">
          {forks.map((f) => (
            <li key={f.id} className="flex items-center justify-between gap-2 px-1.5 py-1">
              <span className="min-w-0 truncate text-foreground">{f.name}</span>
              <a
                href={`https://github.com/${f.owner}/${f.name}/settings`}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex shrink-0 items-center gap-1 text-primary hover:underline"
              >
                detach
                <ExternalLinkIcon className="size-3" />
              </a>
            </li>
          ))}
        </ul>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" onClick={onClose} />}>Close</DialogClose>
          {others.length > 0 && (
            <Button onClick={onPrivateOthers}>
              Make {others.length} other{others.length === 1 ? "" : "s"} private
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
