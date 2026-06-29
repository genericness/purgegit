import type { Me, Repo } from "./types"

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
  makePrivate: (owner: string, name: string) =>
    request<{ ok: true }>(`/api/repos/${e(owner)}/${e(name)}/private`, { method: "POST" }),
  archive: (owner: string, name: string) =>
    request<{ ok: true }>(`/api/repos/${e(owner)}/${e(name)}/archive`, { method: "POST" }),
  remove: (owner: string, name: string) =>
    request<{ ok: true }>(`/api/repos/${e(owner)}/${e(name)}`, { method: "DELETE" }),
  logout: () => request<void>("/api/auth/logout", { method: "POST" }),
}
