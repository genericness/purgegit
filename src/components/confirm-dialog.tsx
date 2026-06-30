import { useState } from "react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import type { Repo, RepoAction } from "@/lib/types"

const COPY: Record<RepoAction, { button: string; destructive: boolean; description: string }> = {
  private: {
    button: "Make private",
    destructive: false,
    description: "The selected repositories will no longer be publicly visible.",
  },
  archive: {
    button: "Archive",
    destructive: false,
    description: "Archived repositories become read-only. You can unarchive them later on GitHub.",
  },
  delete: {
    button: "Delete",
    destructive: true,
    description: "This permanently deletes the selected repositories on GitHub. This cannot be undone.",
  },
}

export function ActionConfirmDialog({
  action,
  repos,
  onConfirm,
  onCancel,
}: {
  action: RepoAction
  repos: Repo[]
  onConfirm: () => void
  onCancel: () => void
}) {
  const [text, setText] = useState("")
  const copy = COPY[action]
  const count = repos.length
  const phrase = action === "delete" ? (count === 1 ? repos[0].name : `delete ${count} repositories`) : null
  const confirmDisabled = phrase !== null && text !== phrase
  const title = count === 1 ? `${copy.button} ${repos[0].name}?` : `${copy.button} ${count} repositories?`

  return (
    <AlertDialog
      open
      onOpenChange={(open) => {
        if (!open) onCancel()
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{copy.description}</AlertDialogDescription>
        </AlertDialogHeader>

        {count > 1 && (
          <ul className="max-h-40 overflow-y-auto rounded-lg border border-border bg-muted/40 p-2 text-sm">
            {repos.map((r) => (
              <li key={r.id} className="flex items-center gap-2 px-1 py-0.5">
                <span className="min-w-0 flex-1 truncate text-foreground">{r.name}</span>
                {r.fork && <Badge variant="outline" className="shrink-0">fork</Badge>}
                {r.archived && <Badge variant="secondary" className="shrink-0">archived</Badge>}
              </li>
            ))}
          </ul>
        )}

        {phrase !== null && (
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-muted-foreground">
              Type <span className="font-mono text-foreground">{phrase}</span> to confirm
            </label>
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              autoFocus
            />
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant={copy.destructive ? "destructive" : "default"}
            disabled={confirmDisabled}
            onClick={onConfirm}
          >
            {copy.button}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
