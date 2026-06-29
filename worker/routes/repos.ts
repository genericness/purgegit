import { Hono } from "hono"
import type { Context } from "hono"
import type { ContentfulStatusCode } from "hono/utils/http-status"
import type { AppEnv } from "../types"
import { requireAuth } from "../middleware/require-auth"
import { clearSession } from "../lib/cookies"
import {
  GitHubError,
  listPublicRepos,
  setRepoPrivate,
  setRepoArchived,
  deleteRepo,
} from "../lib/github"

const repos = new Hono<AppEnv>()

repos.use("*", requireAuth)

function handleError(c: Context<AppEnv>, err: unknown): Response {
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

repos.get("/", async (c) => {
  try {
    const list = await listPublicRepos(c.get("token"))
    return c.json({ repos: list, total: list.length })
  } catch (err) {
    return handleError(c, err)
  }
})

repos.post("/:owner/:name/private", async (c) => {
  try {
    await setRepoPrivate(c.get("token"), c.req.param("owner"), c.req.param("name"))
    return c.json({ ok: true })
  } catch (err) {
    return handleError(c, err)
  }
})

repos.post("/:owner/:name/archive", async (c) => {
  try {
    await setRepoArchived(c.get("token"), c.req.param("owner"), c.req.param("name"))
    return c.json({ ok: true })
  } catch (err) {
    return handleError(c, err)
  }
})

repos.delete("/:owner/:name", async (c) => {
  try {
    await deleteRepo(c.get("token"), c.req.param("owner"), c.req.param("name"))
    return c.json({ ok: true })
  } catch (err) {
    return handleError(c, err)
  }
})

export default repos
