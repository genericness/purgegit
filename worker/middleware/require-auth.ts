import type { MiddlewareHandler } from "hono"
import type { AppEnv } from "../types"
import { getSessionToken } from "../lib/cookies"

export const requireAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  const token = await getSessionToken(c)
  if (!token) return c.json({ error: "unauthorized" }, 401)
  c.set("token", token)
  await next()
}
