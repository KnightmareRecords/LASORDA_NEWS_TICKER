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
- `headlines/route.ts` — fetches up to 24 RSS/Atom items (default ESPN top news `https://www.espn.com/espn/rss/news`). Each item shows the story **summary** (`<description>`/`<summary>`) when usable (≥40 chars, no links, not just the title), else the headline; trimmed to 220 chars. Google News descriptions are only links, so it falls back to headlines there. Feed is cached in memory per isolate: re-fetched at most every 15 min (Jay's choice), retried 2 min after a failure, and the last good copy is served for up to 12 h if the feed site refuses (Google returns 503 to frequent requests from Cloudflare). Response includes `feedError`, `feedStale`, `feedAgeSeconds`. "Play next" custom headlines go first and are flipped to "rotation" once the ticker loads them (`?consumeNext=1`). One rotation custom headline is inserted after every 4 feed items. If the feed fails, only custom items show.
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
- Hosting: LIVE on Jay's Cloudflare (subdomain `newsticker`): control panel https://lasorda-news-ticker.newsticker.workers.dev, OBS source `/ticker`. Publish updates with `DEPLOY.cmd` (Windows) / `npm run deploy`; change the admin password with `SET PASSWORD.cmd` (no deploy needed); first-time setup with `SETUP CLOUDFLARE.cmd` / `node scripts/setup-cloudflare.mjs`. Deploys run on Jay's computer. Old ChatGPT Sites data abandoned.
- Feed switched to ESPN summaries (Jay's choice — headlines were click teasers). Google News intermittently returned 503 to Cloudflare; the 15-min cache + serve-last-good remains.
- Ideas discussed, not built: filter teaser items; scores/results data section; AI one-line summaries with approval in the control panel; headline/summary display toggle.
- Next feature work: not chosen yet — ask Jay.

## Change log
- 2026-11-04: Feed requests try an honest RSS-reader User-Agent first, then a browser one (ESPN's bot protection served HTML to the browser UA); non-feed responses reported with status/type/page title. Empty-state ticker uses the normal structure + Jay's colors (fixed white triangle by the badge).
- 2026-11-04: Ticker shows ESPN story summaries instead of teaser headlines (default feed now ESPN). Fixed deleted custom headlines staying on the ticker (duplicate React keys for repeated rotation items + empty list ignored).
- 2026-11-04: Feed cached for 15 min with last-good fallback (fixes Google 503s dropping news headlines); control panel shows amber 'saved headlines' status; corrected outdated ESPN wording.
- 2026-11-04: Admin key errors now say why (wrong key vs no password set on server); key compared trimmed; added SET PASSWORD.cmd.
- 2026-11-04: Site live on Cloudflare (newsticker.workers.dev); added SETUP CLOUDFLARE.cmd, DEPLOY.cmd, feed error reporting + timeout.
- 2026-11-04: Removed all ChatGPT/OpenAI Sites tooling (`@openai/sites-vite-plugin`, `.openai/`, `wrangler.local.jsonc`, `sites-origin` remote); added `wrangler.jsonc` + deploy/migrate scripts for Jay's own Cloudflare; admin key `local` now only works on localhost.
- 2026-11-04: Working live preview: control panel preview updates instantly with unsaved appearance changes, no longer eats "play next" headlines, shown as a scaled 1080p stream frame; Arial/sans fallback for the ticker font.
- 2026-11-04: Moved repo to GitHub, gitignored snapshot archives, added this CLAUDE.md.
