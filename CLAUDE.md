# LASORDA News Ticker (ESPN-style OBS ticker)

Owner: Jay. Works on this from two computers (home + office), one at a time.

## Session rules (always)
1. **Start of every session:** `git pull` before touching anything. If there are local uncommitted changes, ask Jay before pulling.
2. **End of every session** (or when Jay says "sync"/"done"): commit with a clear message and `git push`.
3. GitHub is the source of truth: https://github.com/KnightmareRecords/LASORDA_NEWS_TICKER (private, branch `main`).
4. Keep this file current: update "Status" and "Change log" below when something meaningful changes, and push it.

## What it is
Two-page web app on Cloudflare Workers + D1 (SQLite). Jay wants **no ChatGPT/OpenAI involvement** — all OpenAI Sites tooling was removed on 2026-11-04; don't reintroduce it.
- `/` — **Control panel** (`app/control-panel.tsx`): add / enable / delete custom headlines ("rotation" or "play next"), RSS feed URL + label, colors, font, font size, scroll speed, OBS setup info, installable as an app (PWA, `public/sw.js`, `app/manifest.ts`).
- `/ticker` — **The ticker** (`app/ticker/ticker.tsx`, styles in `app/globals.css`): the OBS browser source. "LIVE WIRE" badge + scrolling strip, polls `/api/headlines` and `/api/settings` every 15s.
- `/ticker?preview=1` — **Preview mode** of the same ticker. Never consumes "play next" headlines. When framed by the control panel it takes unsaved settings via `postMessage` (`ticker-preview:settings`, `ticker-preview:refresh`; it sends `ticker-preview:ready`, same-origin only). The control panel's Live preview (`PreviewStage`) shows it as a scaled 1920×1080 stream frame (bottom crop) with an "unsaved changes" badge.

## API (`app/api/`)
- `headlines/route.ts` — fetches up to 24 RSS/Atom items (default Google News Sports). "Play next" custom headlines go first and are flipped to "rotation" once the ticker loads them (`?consumeNext=1`). One rotation custom headline is inserted after every 4 feed items. If the feed fails, only custom items show.
- `settings/route.ts` — GET/PATCH appearance + feed settings (validated: hex colors, font whitelist, size 18–36, speed 30–180, public feed URL only).
- `custom/route.ts`, `custom/[id]/route.ts` — list/add/update/delete custom headlines.
- Writes require header `X-Admin-Key` == secret `ADMIN_TOKEN`. With no secret set, the key `local` works **only on localhost**; a deployed site without the secret is locked. See `lib/admin-auth.ts`.

## Data
- D1 binding `DB` (configured in `wrangler.jsonc`, database `lasorda-ticker-db`). Tables: `custom_headlines`, `ticker_settings` (single row id=1).
- Schema in `db/schema.ts`; migrations in `drizzle/` (0000–0003). `npm run db:generate` after schema changes, then `npm run db:migrate:local` / `db:migrate:remote`.

## Stack & commands
vinext (Next.js-style app router on Vite) · React 19 · Tailwind 4 · shadcn UI (`components/ui`) · drizzle · wrangler. Node >= 22.13.
- `npm install` (first time on a machine — `node_modules` is not in git)
- `npm run db:migrate:local` (first time on a machine — creates the local test database)
- `npm run dev` — local dev server at http://localhost:5173 (admin key `local`)
- `npm run deploy` — build + deploy to Cloudflare
- `npm run build`, `npm run lint`, `npm run format`

## Hosting (Jay's own Cloudflare account, free plan)
One-time setup (on Jay's PC, in the project folder):
1. `npx wrangler login` (opens the browser to sign in to Cloudflare).
2. `npx wrangler d1 create lasorda-ticker-db`, then paste the printed `database_id` into `wrangler.jsonc`.
3. `npm run db:migrate:remote`
4. `npx wrangler secret put ADMIN_TOKEN` (choose the editing password).
5. `npm run deploy` → prints the URL, e.g. `https://lasorda-news-ticker.<account>.workers.dev`. Control panel at `/`, OBS source at `/ticker`.
Note: `compatibility_date` must not be newer than what the installed wrangler supports.

## Remotes
- `origin` = GitHub (the only remote).
- `live-ticker-control*.tar.gz` are local-only snapshot archives on the home PC; gitignored.

## Status / open decisions
- Hosting: LIVE on Jay's Cloudflare (subdomain `newsticker`): control panel https://lasorda-news-ticker.newsticker.workers.dev, OBS source `/ticker`. Publish updates with `DEPLOY.cmd` (Windows) / `npm run deploy`; first-time setup with `SETUP CLOUDFLARE.cmd` / `node scripts/setup-cloudflare.mjs`. Deploys run on Jay's computer. Old ChatGPT Sites data abandoned.
- Google News feed failed on first Cloudflare deploy; 2bacf36 adds browser headers, 8s timeout and a feed-status message in the control panel — check it after deploying; switch feeds if Google keeps refusing.
- Next feature work: not chosen yet — ask Jay.

## Change log
- 2026-11-04: Site live on Cloudflare (newsticker.workers.dev); added SETUP CLOUDFLARE.cmd, DEPLOY.cmd, feed error reporting + timeout.
- 2026-11-04: Removed all ChatGPT/OpenAI Sites tooling (`@openai/sites-vite-plugin`, `.openai/`, `wrangler.local.jsonc`, `sites-origin` remote); added `wrangler.jsonc` + deploy/migrate scripts for Jay's own Cloudflare; admin key `local` now only works on localhost.
- 2026-11-04: Working live preview: control panel preview updates instantly with unsaved appearance changes, no longer eats "play next" headlines, shown as a scaled 1080p stream frame; Arial/sans fallback for the ticker font.
- 2026-11-04: Moved repo to GitHub, gitignored snapshot archives, added this CLAUDE.md.
