import type { Context } from "hono"
import type { ContentfulStatusCode } from "hono/utils/http-status"
import type { AppEnv } from "../types"
import { clearSession } from "./cookies"
import { GitHubError } from "./github"

export function handleGitHubError(c: Context<AppEnv>, err: unknown): Response {
  if (err instanceof GitHubError) {
    if (err.status === 401) {
      clearSession(c)
      return c.json({ error: "unauthorized" }, 401)
    }
    if (err.rateLimited) {
      return c.json(
        { error: "rate_limited", retryAfter: err.retryAfter ?? 5, message: err.message },
        429
      )
    }
    return c.json({ error: "github_error", message: err.message }, err.status as ContentfulStatusCode)
  }
  return c.json({ error: "internal_error" }, 500)
}
