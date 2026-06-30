import { Hono } from "hono"
import { stream } from "hono/streaming"
import type { AppEnv } from "../types"
import { requireAuth } from "../middleware/require-auth"
import { handleGitHubError } from "../lib/http"
import {
  scanHistory,
  peekIdentities,
  createCommit,
  createRef,
  updateRef,
  GitHubError,
  type CommitIdentity,
} from "../lib/github"

const history = new Hono<AppEnv>()

history.use("*", requireAuth)

history.get("/:owner/:name/scan", async (c) => {
  const token = c.get("token")
  const owner = c.req.param("owner")
  const name = c.req.param("name")
  c.header("Content-Type", "application/x-ndjson")
  c.header("Cache-Control", "no-store")
  return stream(c, async (s) => {
    try {
      const result = await scanHistory(token, owner, name, 4000, async (commits, label) => {
        await s.write(JSON.stringify({ type: "progress", commits, label }) + "\n")
      })
      await s.write(JSON.stringify({ type: "result", result }) + "\n")
    } catch (err) {
      const status = err instanceof GitHubError ? err.status : 500
      const message = err instanceof Error ? err.message : "Scan failed"
      await s.write(JSON.stringify({ type: "error", status, message }) + "\n")
    }
  })
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
