export interface Bindings {
  ASSETS: Fetcher
  GITHUB_CLIENT_ID: string
  GITHUB_CLIENT_SECRET: string
  COOKIE_SECRET: string
  APP_BASE_URL: string
}

export interface Variables {
  token: string
}

export type AppEnv = { Bindings: Bindings; Variables: Variables }
