import { Hono } from "hono"
import type { AppEnv } from "./types"
import { getSessionToken, clearSession } from "./lib/cookies"
import { getUser, GitHubError } from "./lib/github"
import auth from "./routes/auth"
import repos from "./routes/repos"
import history from "./routes/history"

const app = new Hono<AppEnv>()

app.route("/api/auth", auth)

app.get("/api/me", async (c) => {
  const token = await getSessionToken(c)
  if (!token) return c.json({ error: "unauthorized" }, 401)
  try {
    const user = await getUser(token)
    return c.json(user)
  } catch (err) {
    if (err instanceof GitHubError && err.status === 401) clearSession(c)
    return c.json({ error: "unauthorized" }, 401)
  }
})

app.route("/api/repos", repos)
app.route("/api/history", history)

app.all("/api/*", (c) => c.json({ error: "not_found" }, 404))

app.all("*", (c) => c.env.ASSETS.fetch(c.req.raw))

export default app
