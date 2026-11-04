# LASORDA News Ticker (ESPN-style OBS ticker)

Owner: Jay. Works on this from two computers (home + office), one at a time.

## Session rules (always)
1. **Start of every session:** `git pull` before touching anything. If there are local uncommitted changes, ask Jay before pulling.
2. **End of every session** (or when Jay says "sync"/"done"): commit with a clear message and `git push`.
3. GitHub is the source of truth: https://github.com/KnightmareRecords/LASORDA_NEWS_TICKER (private, branch `main`).
4. Keep this file current: update "Status" and "Change log" below when something meaningful changes, and push it.

## What it is
Two-page web app, currently hosted on OpenAI ChatGPT Sites (Cloudflare Workers + D1 SQLite under the hood). Originally built with OpenAI Codex.
- `/` — **Control panel** (`app/control-panel.tsx`): add / enable / delete custom headlines ("rotation" or "play next"), RSS feed URL + label, colors, font, font size, scroll speed, OBS setup info, installable as an app (PWA, `public/sw.js`, `app/manifest.ts`).
- `/ticker` — **The ticker** (`app/ticker/ticker.tsx`, styles in `app/globals.css`): the OBS browser source. "LIVE WIRE" badge + scrolling strip, polls `/api/headlines` and `/api/settings` every 15s.

## API (`app/api/`)
- `headlines/route.ts` — fetches up to 24 RSS/Atom items (default Google News Sports). "Play next" custom headlines go first and are flipped to "rotation" once the ticker loads them (`?consumeNext=1`). One rotation custom headline is inserted after every 4 feed items. If the feed fails, only custom items show.
- `settings/route.ts` — GET/PATCH appearance + feed settings (validated: hex colors, font whitelist, size 18–36, speed 30–180, public feed URL only).
- `custom/route.ts`, `custom/[id]/route.ts` — list/add/update/delete custom headlines.
- Writes require header `X-Admin-Key` == env `ADMIN_TOKEN` (falls back to `local` in dev). See `lib/admin-auth.ts`.

## Data
- D1 binding `DB` (see `.openai/hosting.json`, `db/`). Tables: `custom_headlines`, `ticker_settings` (single row id=1).
- Schema in `db/schema.ts`; migrations in `drizzle/` (0000–0003). `npm run db:generate` after schema changes.
- Live production data lives on the ChatGPT Sites hosting, not locally.

## Stack & commands
vinext (Next.js-style app router on Vite) · React 19 · Tailwind 4 · shadcn UI (`components/ui`) · drizzle · wrangler. Node >= 22.13.
- `npm install` (first time on a machine — `node_modules` is not in git)
- `npm run dev` — local dev server
- `npm run build`, `npm run lint`, `npm run format`

## Remotes
- `origin` = GitHub (use this).
- `sites-origin` = ChatGPT Sites git (old hosting remote; may not exist on every machine).
- `live-ticker-control*.tar.gz` are local-only snapshot archives on the home PC; gitignored.

## Status / open decisions
- Hosting: keep on ChatGPT Sites, or move to Jay's own Cloudflare account (already Workers + D1, so a fairly small move). Undecided.
- Next feature work: not chosen yet — ask Jay.

## Change log
- 2026-11-04: Moved repo to GitHub, gitignored snapshot archives, added this CLAUDE.md.
