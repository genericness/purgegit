import { Hono } from "hono"
import type { AppEnv } from "../types"
import { randomToken } from "../lib/crypto"
import { revokeToken } from "../lib/github"
import {
  setSession,
  getSessionToken,
  clearSession,
  setState,
  getState,
  clearState,
} from "../lib/cookies"

const auth = new Hono<AppEnv>()

auth.get("/login", (c) => {
  const state = randomToken(16)
  setState(c, state)
  const params = new URLSearchParams({
    client_id: c.env.GITHUB_CLIENT_ID,
    redirect_uri: `${c.env.APP_BASE_URL}/api/auth/callback`,
    scope: "repo delete_repo read:org",
    state,
    allow_signup: "false",
  })
  return c.redirect(`https://github.com/login/oauth/authorize?${params.toString()}`)
})

auth.get("/callback", async (c) => {
  const code = c.req.query("code")
  const state = c.req.query("state")
  const expected = getState(c)
  clearState(c)
  if (!code || !state || !expected || state !== expected) {
    return c.redirect("/?auth=error")
  }
  const res = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_id: c.env.GITHUB_CLIENT_ID,
      client_secret: c.env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: `${c.env.APP_BASE_URL}/api/auth/callback`,
    }),
  })
  const data = (await res.json()) as { access_token?: string; error?: string }
  if (!data.access_token) return c.redirect("/?auth=error")
  await setSession(c, data.access_token)
  return c.redirect("/")
})

auth.post("/logout", async (c) => {
  const token = await getSessionToken(c)
  clearSession(c)
  if (token) {
    await revokeToken(c.env.GITHUB_CLIENT_ID, c.env.GITHUB_CLIENT_SECRET, token)
  }
  return c.body(null, 204)
})

export default auth
