export function relativeTime(iso: string): string {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime())
  const sec = Math.floor(diff / 1000)
  const min = Math.floor(sec / 60)
  const hr = Math.floor(min / 60)
  const day = Math.floor(hr / 24)
  const mon = Math.floor(day / 30)
  const yr = Math.floor(day / 365)
  if (yr >= 1) return yr === 1 ? "1 year ago" : `${yr} years ago`
  if (mon >= 1) return mon === 1 ? "1 month ago" : `${mon} months ago`
  if (day >= 1) return day === 1 ? "1 day ago" : `${day} days ago`
  if (hr >= 1) return hr === 1 ? "1 hour ago" : `${hr} hours ago`
  if (min >= 1) return min === 1 ? "1 minute ago" : `${min} minutes ago`
  return "just now"
}

export function monthsSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24 * 30))
}

const LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: "#3178c6",
  JavaScript: "#f1e05a",
  Python: "#3572a5",
  Go: "#00add8",
  Rust: "#dea584",
  Java: "#b07219",
  C: "#555555",
  "C++": "#f34b7d",
  "C#": "#178600",
  Ruby: "#701516",
  PHP: "#4f5d95",
  Swift: "#f05138",
  Kotlin: "#a97bff",
  Shell: "#89e051",
  HTML: "#e34c26",
  CSS: "#563d7c",
  Vue: "#41b883",
  Svelte: "#ff3e00",
  Dart: "#00b4ab",
  Elixir: "#6e4a7e",
  Lua: "#000080",
  Zig: "#ec915c",
}

export function languageColor(language: string | null): string {
  if (!language) return "var(--muted-foreground)"
  return LANGUAGE_COLORS[language] ?? "var(--muted-foreground)"
}
