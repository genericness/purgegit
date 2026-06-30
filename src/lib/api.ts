import type { CommitIdentity, ForkParent, Me, Repo, ScanResult } from "./types"

export class ApiError extends Error {
  status: number
  code?: string
  retryAfter?: number

  constructor(status: number, message: string, code?: string, retryAfter?: number) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.code = code
    this.retryAfter = retryAfter
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    credentials: "same-origin",
    headers: { Accept: "application/json", ...(init?.headers ?? {}) },
  })
  if (res.status === 204) return undefined as T
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok) {
    throw new ApiError(
      res.status,
      typeof data.message === "string" ? data.message : res.statusText,
      typeof data.error === "string" ? data.error : undefined,
      typeof data.retryAfter === "number" ? data.retryAfter : undefined
    )
  }
  return data as T
}

const e = encodeURIComponent

export const api = {
  me: () => request<Me>("/api/me"),
  repos: () => request<{ repos: Repo[]; total: number }>("/api/repos"),
  parent: (owner: string, name: string) =>
    request<ForkParent | null>(`/api/repos/${e(owner)}/${e(name)}/parent`),
  makePrivate: (owner: string, name: string) =>
    request<{ ok: true }>(`/api/repos/${e(owner)}/${e(name)}/private`, { method: "POST" }),
  archive: (owner: string, name: string) =>
    request<{ ok: true }>(`/api/repos/${e(owner)}/${e(name)}/archive`, { method: "POST" }),
  remove: (owner: string, name: string) =>
    request<{ ok: true }>(`/api/repos/${e(owner)}/${e(name)}`, { method: "DELETE" }),
  logout: () => request<void>("/api/auth/logout", { method: "POST" }),
  scanHistory: async (
    owner: string,
    name: string,
    onProgress: (p: { commits: number; label: string }) => void
  ): Promise<ScanResult> => {
    const res = await fetch(`/api/history/${e(owner)}/${e(name)}/scan`, {
      credentials: "same-origin",
      headers: { Accept: "application/x-ndjson" },
    })
    if (!res.ok || !res.body) {
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
      throw new ApiError(
        res.status,
        typeof data.message === "string" ? data.message : res.statusText,
        typeof data.error === "string" ? data.error : undefined
      )
    }
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ""
    let result: ScanResult | null = null
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      let newline: number
      while ((newline = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, newline).trim()
        buffer = buffer.slice(newline + 1)
        if (!line) continue
        const msg = JSON.parse(line) as
          | { type: "progress"; commits: number; label: string }
          | { type: "result"; result: ScanResult }
          | { type: "error"; status?: number; message?: string }
        if (msg.type === "progress") onProgress({ commits: msg.commits, label: msg.label })
        else if (msg.type === "result") result = msg.result
        else if (msg.type === "error") throw new ApiError(msg.status ?? 500, msg.message ?? "Scan failed")
      }
    }
    if (!result) throw new ApiError(500, "Scan did not complete")
    return result
  },
  peekIdentities: (owner: string, name: string) =>
    request<{ identities: { name: string; email: string }[] }>(
      `/api/history/${e(owner)}/${e(name)}/peek`
    ),
  createCommit: (
    owner: string,
    name: string,
    body: {
      message: string
      tree: string
      parents: string[]
      author: CommitIdentity
      committer: CommitIdentity
    }
  ) =>
    request<{ sha: string }>(`/api/history/${e(owner)}/${e(name)}/commit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  createBackupRef: (owner: string, name: string, ref: string, sha: string) =>
    request<{ ok: true }>(`/api/history/${e(owner)}/${e(name)}/ref`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ref, sha }),
    }),
  forceRef: (owner: string, name: string, ref: string, sha: string) =>
    request<{ ok: true }>(`/api/history/${e(owner)}/${e(name)}/ref`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ref, sha, force: true }),
    }),
}
