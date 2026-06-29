# purgegit

A free tool to clean up your GitHub account. Sign in with GitHub, browse your public repositories, and make old ones private, archive them, or delete them — individually or in bulk.

Live at [purgegit.4x.rip](https://purgegit.4x.rip).

## Features

- Sign in with GitHub (OAuth)
- List your public, owned repositories with description, last-pushed date, stars, language, and fork/archived badges
- Sort by last pushed, name, stars, or created date
- Filter by forks, archived, staleness, and free-text search
- Make private, archive, or delete — per repo or as a bulk batch
- Type-to-confirm guard on deletes
- Rate-limit-aware batching with per-item success/failure reporting

## How it works

purgegit is a single Cloudflare Worker:

- The **React SPA** (Vite) is served from the Worker's static assets.
- The **Hono API** under `/api/*` handles the OAuth flow and proxies every GitHub call.

Your GitHub access token never reaches the browser. The Worker exchanges the OAuth code for a token, encrypts it with AES-GCM, and stores it in an `httpOnly` `Secure` cookie. All GitHub requests are made server-side with that token.

## Stack

- Cloudflare Workers + Hono
- Vite + React + TypeScript
- Tailwind CSS v4 + shadcn/ui (Base UI)
- TanStack Query

## Local development

1. Register a GitHub OAuth App for development:
   - Homepage URL: `http://localhost:5173`
   - Authorization callback URL: `http://localhost:5173/api/auth/callback`
2. Copy the example env file and fill it in:
   ```
   cp .dev.vars.example .dev.vars
   ```
   Set `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, a random `COOKIE_SECRET` (`openssl rand -base64 32`), and `APP_BASE_URL=http://localhost:5173`.
3. Install and run:
   ```
   pnpm install
   pnpm dev
   ```

The Vite dev server runs the SPA and the Worker together on one origin.

## Environment variables

Non-secret values live in `wrangler.jsonc` under `vars`:

- `GITHUB_CLIENT_ID`
- `APP_BASE_URL`

Secrets are set with `wrangler secret put` and never committed:

- `GITHUB_CLIENT_SECRET`
- `COOKIE_SECRET`

For local development all four are read from `.dev.vars` (gitignored).

## Deployment

1. Register a production GitHub OAuth App:
   - Homepage URL: `https://purgegit.4x.rip`
   - Authorization callback URL: `https://purgegit.4x.rip/api/auth/callback`
2. Set `GITHUB_CLIENT_ID` and `APP_BASE_URL` in `wrangler.jsonc`.
3. Set the secrets:
   ```
   wrangler secret put GITHUB_CLIENT_SECRET
   wrangler secret put COOKIE_SECRET
   ```
4. Build and deploy:
   ```
   pnpm deploy
   ```

The `purgegit.4x.rip` custom domain is bound via the `routes` entry in `wrangler.jsonc`.

## Scripts

- `pnpm dev` — run the SPA + Worker locally
- `pnpm build` — typecheck and build
- `pnpm deploy` — build and deploy to Cloudflare
- `pnpm cf-typegen` — regenerate Worker binding types

## Permissions

Sign-in requests the `repo` and `delete_repo` OAuth scopes, which are required to change repository visibility and to delete repositories. The token is only ever used server-side and can be revoked any time from your GitHub settings or by signing out.
