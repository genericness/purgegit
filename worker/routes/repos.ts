import { Hono } from "hono"
import type { AppEnv } from "../types"
import { requireAuth } from "../middleware/require-auth"
import { handleGitHubError } from "../lib/http"
import {
  listPublicRepos,
  setRepoPrivate,
  setRepoArchived,
  deleteRepo,
  getRepoParent,
} from "../lib/github"

const repos = new Hono<AppEnv>()

repos.use("*", requireAuth)

repos.get("/", async (c) => {
  try {
    const list = await listPublicRepos(c.get("token"))
    return c.json({ repos: list, total: list.length })
  } catch (err) {
    return handleGitHubError(c, err)
  }
})

repos.get("/:owner/:name/parent", async (c) => {
  try {
    const parent = await getRepoParent(c.get("token"), c.req.param("owner"), c.req.param("name"))
    return c.json(parent)
  } catch (err) {
    return handleGitHubError(c, err)
  }
})

repos.post("/:owner/:name/private", async (c) => {
  try {
    await setRepoPrivate(c.get("token"), c.req.param("owner"), c.req.param("name"))
    return c.json({ ok: true })
  } catch (err) {
    return handleGitHubError(c, err)
  }
})

repos.post("/:owner/:name/archive", async (c) => {
  try {
    await setRepoArchived(c.get("token"), c.req.param("owner"), c.req.param("name"))
    return c.json({ ok: true })
  } catch (err) {
    return handleGitHubError(c, err)
  }
})

repos.delete("/:owner/:name", async (c) => {
  try {
    await deleteRepo(c.get("token"), c.req.param("owner"), c.req.param("name"))
    return c.json({ ok: true })
  } catch (err) {
    return handleGitHubError(c, err)
  }
})

export default repos
