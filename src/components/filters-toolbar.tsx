import { SearchIcon, GitForkIcon, ArchiveIcon } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import type { Filters, SortKey } from "@/lib/types"

const SORTS: { value: SortKey; label: string }[] = [
  { value: "pushed", label: "Last pushed" },
  { value: "name", label: "Name" },
  { value: "stars", label: "Stars" },
  { value: "created", label: "Created" },
]

const STALE: { value: number; label: string }[] = [
  { value: 0, label: "Any time" },
  { value: 6, label: "Stale > 6 months" },
  { value: 12, label: "Stale > 1 year" },
  { value: 24, label: "Stale > 2 years" },
]

const selectClass =
  "h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground outline-none [color-scheme:dark] [&>option]:bg-popover [&>option]:text-popover-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"

export function FiltersToolbar({
  filters,
  onChange,
}: {
  filters: Filters
  onChange: (next: Filters) => void
}) {
  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch })

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
      <div className="relative flex-1 sm:min-w-56">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={filters.search}
          onChange={(e) => set({ search: e.target.value })}
          placeholder="Search repositories"
          className="pl-8"
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <select
          className={selectClass}
          value={filters.sort}
          onChange={(e) => set({ sort: e.target.value as SortKey })}
          aria-label="Sort by"
        >
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <select
          className={selectClass}
          value={filters.staleMonths}
          onChange={(e) => set({ staleMonths: Number(e.target.value) })}
          aria-label="Filter by staleness"
        >
          {STALE.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <Button
          type="button"
          variant={filters.forksOnly ? "secondary" : "outline"}
          size="sm"
          onClick={() => set({ forksOnly: !filters.forksOnly })}
        >
          <GitForkIcon />
          Forks
        </Button>
        <Button
          type="button"
          variant={filters.archivedOnly ? "secondary" : "outline"}
          size="sm"
          onClick={() => set({ archivedOnly: !filters.archivedOnly })}
        >
          <ArchiveIcon />
          Archived
        </Button>
      </div>
    </div>
  )
}
