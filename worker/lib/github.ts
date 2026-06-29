const GITHUB_API = "https://api.github.com"

interface GitHubRepo {
  id: number
  name: string
  full_name: string
  owner: { login: string }
  description: string | null
  html_url: string
  pushed_at: string
  created_at: string
  stargazers_count: number
  forks_count: number
  fork: boolean
  archived: boolean
  private: boolean
  language: string | null
}

export interface RepoDTO {
  id: number
  name: string
  fullName: string
  owner: string
  description: string | null
  htmlUrl: string
  pushedAt: string
  createdAt: string
  stargazersCount: number
  forksCount: number
  fork: boolean
  archived: boolean
  private: boolean
  language: string | null
}

export interface GitHubUser {
  login: string
  name: string | null
  avatarUrl: string
  htmlUrl: string
}

export class GitHubError extends Error {
  status: number
  rateLimited: boolean
  retryAfter?: number

  constructor(status: number, message: string, rateLimited = false, retryAfter?: number) {
    super(message)
    this.name = "GitHubError"
    this.status = status
    this.rateLimited = rateLimited
    this.retryAfter = retryAfter
  }
}

function baseHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "purgegit",
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isSecondaryLimit(res: Response): boolean {
  const remaining = res.headers.get("x-ratelimit-remaining")
  const retryAfter = res.headers.get("retry-after")
  return (res.status === 403 || res.status === 429) && (retryAfter !== null || remaining === "0")
}

async function githubFetch(token: string, path: string, init?: RequestInit): Promise<Response> {
  const url = path.startsWith("http") ? path : `${GITHUB_API}${path}`
  let attempt = 0
  for (;;) {
    const res = await fetch(url, {
      ...init,
      headers: { ...baseHeaders(token), ...(init?.headers as Record<string, string>) },
    })
    if (isSecondaryLimit(res) && attempt < 1) {
      const retryAfterHeader = res.headers.get("retry-after")
      const retryAfter = retryAfterHeader ? parseInt(retryAfterHeader, 10) : 2
      await sleep(Math.min(retryAfter, 5) * 1000)
      attempt++
      continue
    }
    return res
  }
}

async function toError(res: Response): Promise<GitHubError> {
  let message = res.statusText
  try {
    const body = (await res.json()) as { message?: string }
    if (body?.message) message = body.message
  } catch {
    /* body is not json */
  }
  const retryAfterHeader = res.headers.get("retry-after")
  const retryAfter = retryAfterHeader ? parseInt(retryAfterHeader, 10) : undefined
  return new GitHubError(res.status, message, isSecondaryLimit(res), retryAfter)
}

function toDTO(r: GitHubRepo): RepoDTO {
  return {
    id: r.id,
    name: r.name,
    fullName: r.full_name,
    owner: r.owner.login,
    description: r.description,
    htmlUrl: r.html_url,
    pushedAt: r.pushed_at,
    createdAt: r.created_at,
    stargazersCount: r.stargazers_count,
    forksCount: r.forks_count,
    fork: r.fork,
    archived: r.archived,
    private: r.private,
    language: r.language,
  }
}

export async function getUser(token: string): Promise<GitHubUser> {
  const res = await githubFetch(token, "/user")
  if (!res.ok) throw await toError(res)
  const u = (await res.json()) as {
    login: string
    name: string | null
    avatar_url: string
    html_url: string
  }
  return { login: u.login, name: u.name, avatarUrl: u.avatar_url, htmlUrl: u.html_url }
}

export async function listPublicRepos(token: string): Promise<RepoDTO[]> {
  const repos: RepoDTO[] = []
  const maxPages = 20
  for (let page = 1; page <= maxPages; page++) {
    const res = await githubFetch(
      token,
      `/user/repos?visibility=public&affiliation=owner&sort=pushed&direction=desc&per_page=100&page=${page}`
    )
    if (!res.ok) throw await toError(res)
    const batch = (await res.json()) as GitHubRepo[]
    for (const r of batch) repos.push(toDTO(r))
    const link = res.headers.get("link") ?? ""
    if (!link.includes('rel="next"')) break
  }
  return repos
}

async function patchRepo(token: string, owner: string, repo: string, body: Record<string, boolean>): Promise<void> {
  const res = await githubFetch(token, `/repos/${owner}/${repo}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw await toError(res)
}

export function setRepoPrivate(token: string, owner: string, repo: string): Promise<void> {
  return patchRepo(token, owner, repo, { private: true })
}

export function setRepoArchived(token: string, owner: string, repo: string): Promise<void> {
  return patchRepo(token, owner, repo, { archived: true })
}

export async function deleteRepo(token: string, owner: string, repo: string): Promise<void> {
  const res = await githubFetch(token, `/repos/${owner}/${repo}`, { method: "DELETE" })
  if (res.status === 404) return
  if (!res.ok) throw await toError(res)
}

export async function revokeToken(clientId: string, clientSecret: string, token: string): Promise<void> {
  await fetch(`${GITHUB_API}/applications/${clientId}/token`, {
    method: "DELETE",
    headers: {
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "purgegit",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ access_token: token }),
  }).catch(() => undefined)
}
