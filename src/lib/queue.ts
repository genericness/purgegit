import { ApiError } from "./api"

export interface BatchItem {
  key: string
  run: () => Promise<unknown>
}

export interface BatchOutcome {
  key: string
  ok: boolean
  message?: string
}

export type BatchStatus = "running" | "ok" | "error"

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

const SPACING_MS = 350
const MAX_RETRIES = 3
const MAX_BACKOFF_S = 10

export async function runBatch(
  items: BatchItem[],
  onProgress: (key: string, status: BatchStatus, message?: string) => void
): Promise<BatchOutcome[]> {
  const outcomes: BatchOutcome[] = []
  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    onProgress(item.key, "running")
    let attempt = 0
    for (;;) {
      try {
        await item.run()
        onProgress(item.key, "ok")
        outcomes.push({ key: item.key, ok: true })
        break
      } catch (err) {
        if (err instanceof ApiError && err.code === "rate_limited" && attempt < MAX_RETRIES) {
          attempt++
          await sleep(Math.min(err.retryAfter ?? 5, MAX_BACKOFF_S) * 1000)
          continue
        }
        const message = err instanceof Error ? err.message : "Action failed"
        onProgress(item.key, "error", message)
        outcomes.push({ key: item.key, ok: false, message })
        break
      }
    }
    if (i < items.length - 1) await sleep(SPACING_MS)
  }
  return outcomes
}
