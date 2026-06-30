import { Hono } from "hono"
import type { AppEnv } from "../types"
import { requireAuth } from "../middleware/require-auth"
import { handleGitHubError } from "../lib/http"
import {
  scanHistory,
  peekIdentities,
  createCommit,
  createRef,
  updateRef,
  type CommitIdentity,
} from "../lib/github"

const history = new Hono<AppEnv>()

history.use("*", requireAuth)

history.get("/:owner/:name/scan", async (c) => {
  try {
    const result = await scanHistory(c.get("token"), c.req.param("owner"), c.req.param("name"))
    return c.json(result)
  } catch (err) {
    return handleGitHubError(c, err)
  }
})

history.get("/:owner/:name/peek", async (c) => {
  try {
    const identities = await peekIdentities(c.get("token"), c.req.param("owner"), c.req.param("name"))
    return c.json({ identities })
  } catch (err) {
    return handleGitHubError(c, err)
  }
})

history.post("/:owner/:name/commit", async (c) => {
  try {
    const body = (await c.req.json()) as {
      message: string
      tree: string
      parents: string[]
      author: CommitIdentity
      committer: CommitIdentity
    }
    const sha = await createCommit(c.get("token"), c.req.param("owner"), c.req.param("name"), body)
    return c.json({ sha })
  } catch (err) {
    return handleGitHubError(c, err)
  }
})

history.post("/:owner/:name/ref", async (c) => {
  try {
    const body = (await c.req.json()) as { ref: string; sha: string }
    await createRef(c.get("token"), c.req.param("owner"), c.req.param("name"), body.ref, body.sha)
    return c.json({ ok: true })
  } catch (err) {
    return handleGitHubError(c, err)
  }
})

history.patch("/:owner/:name/ref", async (c) => {
  try {
    const body = (await c.req.json()) as { ref: string; sha: string; force?: boolean }
    await updateRef(
      c.get("token"),
      c.req.param("owner"),
      c.req.param("name"),
      body.ref,
      body.sha,
      body.force ?? true
    )
    return c.json({ ok: true })
  } catch (err) {
    return handleGitHubError(c, err)
  }
})

export default history
