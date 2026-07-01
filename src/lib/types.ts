export interface Repo {
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

export interface Me {
  id: number
  login: string
  name: string | null
  email: string | null
  avatarUrl: string
  htmlUrl: string
}

export interface Owner {
  login: string
  type: "user" | "org"
  avatarUrl: string
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

export interface ForkParent {
  fullName: string
  owner: string
  htmlUrl: string
}

export type RepoAction = "private" | "archive" | "delete"

export type SortKey = "pushed" | "name" | "stars" | "created"

export interface Filters {
  search: string
  sort: SortKey
  forksOnly: boolean
  archivedOnly: boolean
  staleMonths: number
}
