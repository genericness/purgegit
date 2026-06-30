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
  id: number
  login: string
  name: string | null
  email: string | null
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
    id: number
    login: string
    name: string | null
    email: string | null
    avatar_url: string
    html_url: string
  }
  return {
    id: u.id,
    login: u.login,
    name: u.name,
    email: u.email,
    avatarUrl: u.avatar_url,
    htmlUrl: u.html_url,
  }
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

export interface RepoParent {
  fullName: string
  owner: string
  htmlUrl: string
}

export async function getRepoParent(token: string, owner: string, repo: string): Promise<RepoParent | null> {
  const res = await githubFetch(token, `/repos/${owner}/${repo}`)
  if (!res.ok) throw await toError(res)
  const data = (await res.json()) as {
    parent?: { full_name: string; owner: { login: string }; html_url: string } | null
  }
  if (!data.parent) return null
  return { fullName: data.parent.full_name, owner: data.parent.owner.login, htmlUrl: data.parent.html_url }
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

export interface CommitIdentity {
  name: string
  email: string
  date: string
}

export interface CommitNode {
  sha: string
  tree: string
  parents: string[]
  author: CommitIdentity
  committer: CommitIdentity
  authorLogin: string | null
  committerLogin: string | null
  message: string
}

export interface PeekIdentity {
  name: string
  email: string
  login: string | null
}

export interface RefInfo {
  name: string
  sha: string
}

export interface ScanResult {
  branches: RefInfo[]
  tags: RefInfo[]
  commits: CommitNode[]
  truncated: boolean
}

async function listRefs(token: string, owner: string, repo: string, kind: "branches" | "tags"): Promise<RefInfo[]> {
  const out: RefInfo[] = []
  for (let page = 1; page <= 10; page++) {
    const res = await githubFetch(token, `/repos/${owner}/${repo}/${kind}?per_page=100&page=${page}`)
    if (!res.ok) throw await toError(res)
    const batch = (await res.json()) as { name: string; commit: { sha: string } }[]
    for (const r of batch) out.push({ name: r.name, sha: r.commit.sha })
    if (batch.length < 100) break
  }
  return out
}

export type ScanProgress = (commits: number, label: string) => void | Promise<void>

async function collectCommitsFrom(
  token: string,
  owner: string,
  repo: string,
  startSha: string,
  into: Map<string, CommitNode>,
  cap: number,
  label: string,
  onProgress?: ScanProgress
): Promise<boolean> {
  let url: string | null = `/repos/${owner}/${repo}/commits?sha=${startSha}&per_page=100`
  while (url) {
    const res = await githubFetch(token, url)
    if (res.status === 409) return true
    if (!res.ok) throw await toError(res)
    const batch = (await res.json()) as Array<{
      sha: string
      commit: {
        tree: { sha: string }
        message: string
        author: CommitIdentity
        committer: CommitIdentity
      }
      author: { login: string } | null
      committer: { login: string } | null
      parents: { sha: string }[]
    }>
    for (const c of batch) {
      if (into.has(c.sha)) continue
      into.set(c.sha, {
        sha: c.sha,
        tree: c.commit.tree.sha,
        parents: c.parents.map((p) => p.sha),
        author: c.commit.author,
        committer: c.commit.committer,
        authorLogin: c.author?.login ?? null,
        committerLogin: c.committer?.login ?? null,
        message: c.commit.message,
      })
      if (into.size > cap) return false
    }
    if (onProgress) await onProgress(into.size, label)
    const link = res.headers.get("link") ?? ""
    const match = link.match(/<([^>]+)>;\s*rel="next"/)
    url = match ? match[1] : null
  }
  return true
}

export async function scanHistory(
  token: string,
  owner: string,
  repo: string,
  cap = 4000,
  onProgress?: ScanProgress
): Promise<ScanResult> {
  if (onProgress) await onProgress(0, "reading refs")
  const branches = (await listRefs(token, owner, repo, "branches")).slice(0, 40)
  const tags = (await listRefs(token, owner, repo, "tags")).slice(0, 100)
  const commits = new Map<string, CommitNode>()
  let ok = true
  for (const b of branches) {
    ok = await collectCommitsFrom(token, owner, repo, b.sha, commits, cap, b.name, onProgress)
    if (!ok) break
  }
  if (ok) {
    for (const t of tags) {
      if (commits.has(t.sha)) continue
      ok = await collectCommitsFrom(token, owner, repo, t.sha, commits, cap, t.name, onProgress)
      if (!ok) break
    }
  }
  return { branches, tags, commits: [...commits.values()], truncated: !ok }
}

export async function peekIdentities(token: string, owner: string, repo: string): Promise<PeekIdentity[]> {
  const res = await githubFetch(token, `/repos/${owner}/${repo}/commits?per_page=100`)
  if (res.status === 409) return []
  if (!res.ok) throw await toError(res)
  const batch = (await res.json()) as Array<{
    author: { login: string } | null
    committer: { login: string } | null
    commit: { author: CommitIdentity | null; committer: CommitIdentity | null }
  }>
  const seen = new Map<string, PeekIdentity>()
  const add = (id: CommitIdentity | null, login: string | null) => {
    if (!id?.email) return
    const key = `${id.name} ${id.email}`
    const existing = seen.get(key)
    if (!existing) seen.set(key, { name: id.name, email: id.email, login })
    else if (login && !existing.login) existing.login = login
  }
  for (const c of batch) {
    add(c.commit.author, c.author?.login ?? null)
    add(c.commit.committer, c.committer?.login ?? null)
  }
  return [...seen.values()]
}

export async function createCommit(
  token: string,
  owner: string,
  repo: string,
  body: {
    message: string
    tree: string
    parents: string[]
    author: CommitIdentity
    committer: CommitIdentity
  }
): Promise<string> {
  const res = await githubFetch(token, `/repos/${owner}/${repo}/git/commits`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw await toError(res)
  const data = (await res.json()) as { sha: string }
  return data.sha
}

export async function createRef(token: string, owner: string, repo: string, ref: string, sha: string): Promise<void> {
  const res = await githubFetch(token, `/repos/${owner}/${repo}/git/refs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ref, sha }),
  })
  if (!res.ok && res.status !== 422) throw await toError(res)
}

export async function updateRef(
  token: string,
  owner: string,
  repo: string,
  ref: string,
  sha: string,
  force: boolean
): Promise<void> {
  const res = await githubFetch(token, `/repos/${owner}/${repo}/git/refs/${ref}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sha, force }),
  })
  if (!res.ok) throw await toError(res)
}
