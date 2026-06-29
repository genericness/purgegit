import type { Context } from "hono"
import { getCookie, setCookie, deleteCookie } from "hono/cookie"
import type { AppEnv } from "../types"
import { encryptToken, decryptToken } from "./crypto"

const SESSION_COOKIE = "pg_session"
const STATE_COOKIE = "pg_oauth_state"

function isSecure(c: Context<AppEnv>): boolean {
  return new URL(c.req.url).protocol === "https:"
}

export async function setSession(c: Context<AppEnv>, token: string): Promise<void> {
  const value = await encryptToken(c.env.COOKIE_SECRET, token)
  setCookie(c, SESSION_COOKIE, value, {
    httpOnly: true,
    secure: isSecure(c),
    sameSite: "Lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  })
}

export async function getSessionToken(c: Context<AppEnv>): Promise<string | null> {
  const value = getCookie(c, SESSION_COOKIE)
  if (!value) return null
  return decryptToken(c.env.COOKIE_SECRET, value)
}

export function clearSession(c: Context<AppEnv>): void {
  deleteCookie(c, SESSION_COOKIE, { path: "/" })
}

export function setState(c: Context<AppEnv>, state: string): void {
  setCookie(c, STATE_COOKIE, state, {
    httpOnly: true,
    secure: isSecure(c),
    sameSite: "Lax",
    path: "/",
    maxAge: 600,
  })
}

export function getState(c: Context<AppEnv>): string | undefined {
  return getCookie(c, STATE_COOKIE)
}

export function clearState(c: Context<AppEnv>): void {
  deleteCookie(c, STATE_COOKIE, { path: "/" })
}
