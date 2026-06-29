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
  login: string
  name: string | null
  avatarUrl: string
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
