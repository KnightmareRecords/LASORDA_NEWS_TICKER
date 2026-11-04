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
- `/ticker` — **The ticker** (`app/ticker/ticker.tsx`, styles in `app/globals.css`): the OBS browser source. Lasorda's Card House logo block (`public/brand/lasordas-card-house.png`, light panel + accent trim) + scrolling strip. Items can have a **team panel** (team colors from `lib/teams.ts` — NFL/NBA/MLB/NHL, 124 teams; very dark primaries swap to secondary; optional team logo = a file Jay adds at `public/teams/<team key>.png`, see `public/teams/LOGO-FILE-NAMES.txt` — Claude doesn't source the official logo files) in the bundled Anton font (`public/fonts`, OFL) and an optional red **tag** pill. Feed stories get the first team they mention (`detectTeam`/`findTeams`). Nicknames shared across leagues (Jets, Rangers, Kings, Panthers, Cardinals, Giants, Bucs) resolve by city if named, else by league words in the story (`LEAGUE_HINTS`: goal/power play → NHL, touchdown/quarterback → NFL, …), else no panel. AI team answers go through `teamsNamed` + `mentionsTeam`. The strip polls `/api/headlines` and `/api/settings` every 15s.
- `/ticker?preview=1` — **Preview mode** of the same ticker. Never consumes "play next" headlines. When framed by the control panel it takes unsaved settings via `postMessage` (`ticker-preview:settings`, `ticker-preview:refresh`; it sends `ticker-preview:ready`, same-origin only). The control panel's Live preview (`PreviewStage`) shows it as a scaled 1920×1080 stream frame (bottom crop) with an "unsaved changes" badge.

## API (`app/api/`)
- `headlines/route.ts` — fetches up to 24 RSS/Atom items (default ESPN top news `https://www.espn.com/espn/rss/news`). Each item shows the story **summary** (`<description>`/`<summary>`) when usable (≥40 chars, no links, not just the title), else the headline; long ones cut to their first sentence (abbreviation-aware), then to ~150 chars at a word boundary. Google News descriptions are only links, so it falls back to headlines there. Feed is cached in memory per isolate: re-fetched at most every 15 min (Jay's choice), retried 2 min after a failure, and the last good copy is served for up to 12 h if the feed site refuses (Google returns 503 to frequent requests from Cloudflare). Response includes `feedError`, `feedStale`, `feedAgeSeconds`, `ai` stats. **AI short lines** (`lib/ai-summary.ts`, Workers AI, binding `AI`; models tried in order `AI_MODELS` = llama-3.3-70b-instruct-fp8-fast → mistral-small-3.1-24b → gemma-3-12b, auto-skipping retired ones (llama-3.1-8b-instruct was retired 2026-05-30; no OpenAI models)): each new story is rewritten once into a ≤90-char line + main team, stored in D1 `ai_lines` (key = story id + text hash, pruned after 3 days); max 3 new stories per request, 8s timeout, 5-min pause after an AI error. Safety checks (`checkLine`): ≤110 chars, every number and every capitalized name must appear in the original story, no chatbot phrasing; failures air the trimmed original. AI team only used if the story mentions it. Toggle: `ticker_settings.ai_summaries` (control panel → News feed → AI short lines). Local `npm run dev` skips the AI (remote-only binding; `TICKER_REMOTE_AI=1` to use it, needs wrangler login). "Play next" custom headlines go first and are flipped to "rotation" once the ticker loads them (`?consumeNext=1`). One rotation custom headline is inserted after every 4 feed items. If the feed fails, only custom items show.
- `settings/route.ts` — GET/PATCH appearance + feed settings (validated: hex colors, font whitelist, size 18–36, speed 30–180, public feed URL only).
- `custom/route.ts`, `custom/[id]/route.ts` — list/add/update/delete custom headlines.
- Writes require header `X-Admin-Key` == secret `ADMIN_TOKEN`. With no secret set, the key `local` works **only on localhost**; a deployed site without the secret is locked. See `lib/admin-auth.ts`.

## Data
- D1 binding `DB` (configured in `wrangler.jsonc`, database `lasorda-ticker-db`). Tables: `custom_headlines` (incl. optional `team` key + `tag`), `ticker_settings` (single row id=1, incl. `ai_summaries`), `ai_lines` (AI ticker line cache).
- Schema in `db/schema.ts`; migrations in `drizzle/` (0000–0005). `npm run db:generate` after schema changes, then `npm run db:migrate:local` / `db:migrate:remote`.

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
- Hosting: LIVE on Jay's Cloudflare (subdomain `newsticker`): control panel https://lasorda-news-ticker.newsticker.workers.dev, OBS source `/ticker`. Publish updates with `DEPLOY.cmd` (Windows; runs `db:migrate:remote` then `deploy`) / `npm run db:migrate:remote && npm run deploy`; change the admin password with `SET PASSWORD.cmd` (no deploy needed); first-time setup with `SETUP CLOUDFLARE.cmd` / `node scripts/setup-cloudflare.mjs`. Deploys run on Jay's computer. Claude can deploy remotely: double-click `DEPLOY-UNATTENDED.cmd` via computer use (File Explorer, click tier) and read `deploy-log.txt` (gitignored) with device_bash. Don't set CI=true for wrangler there — it then fails with D1 error 7403; stdin from nul makes prompts auto-answer yes. Old ChatGPT Sites data abandoned.
- Feed switched to ESPN summaries (Jay's choice — headlines were click teasers). Google News intermittently returned 503 to Cloudflare; the 15-min cache + serve-last-good remains.
- Ideas discussed, not built: filter teaser items; scores/results data section; headline/summary display toggle; editing team/tag on existing custom headlines in the UI (API already supports it); college teams.
- Next feature work: not chosen yet — ask Jay.

## Change log
- 2026-11-04: Added all 32 NHL teams (dropdown, auto-detection, logo slots). Shared nicknames resolved by city or league context words. AI prompt v3 (NHL teams, college example → NONE).
- 2026-11-04: Feed stories with a team panel are spread evenly among generic ones (`lib/mix.ts` `spreadTeamItems`, order kept within each group). Jay set the on-screen label to NEWS.
- 2026-11-04: AI prompt v2 (story key prefixed `v2:` so old lines are redone): line starts with who + what, normal capitalization, examples; team name stripped from the start when a team panel shows it (`finishLine`); all-lowercase output rejected; AI team pick goes through the same NHL filter (`mentionsTeam`).
- 2026-11-04: Deployed remotely (migrations 0004+0005 applied). Switched AI to a model list with automatic fallback after llama-3.1-8b-instruct turned out to be retired; NHL names (Winnipeg Jets, NY Rangers, LA Kings, Florida Panthers) no longer trigger NFL/NBA/MLB panels. Added DEPLOY-UNATTENDED.cmd.
- 2026-11-04: AI short lines via Cloudflare Workers AI, straight to air with safety checks (Jay's choice); on/off switch + status in the control panel. Migration 0005 (`ai_lines`, `ticker_settings.ai_summaries`).
- 2026-11-04: Team logo slot (`public/teams/<key>.png`, Jay supplies files; hidden when missing). Long summaries cut to first sentence / ~150 chars. Discussed AI one-line summaries via Cloudflare Workers AI (free 10k neurons/day ≈ ~9 per line) with a number-check guard — awaiting Jay's go-ahead.
- 2026-11-04: SportsCenter-style look: Lasorda's Card House logo block, team panels in team colors (auto-detected on feed stories, pickable on custom headlines), optional tags (DEVELOPING STORY etc.), bundled Anton font. Migration 0004 adds `team`/`tag`. DEPLOY.cmd now migrates the remote DB before deploying.
- 2026-11-04: Feed requests try an honest RSS-reader User-Agent first, then a browser one (ESPN's bot protection served HTML to the browser UA); non-feed responses reported with status/type/page title. Empty-state ticker uses the normal structure + Jay's colors (fixed white triangle by the badge).
- 2026-11-04: Ticker shows ESPN story summaries instead of teaser headlines (default feed now ESPN). Fixed deleted custom headlines staying on the ticker (duplicate React keys for repeated rotation items + empty list ignored).
- 2026-11-04: Feed cached for 15 min with last-good fallback (fixes Google 503s dropping news headlines); control panel shows amber 'saved headlines' status; corrected outdated ESPN wording.
- 2026-11-04: Admin key errors now say why (wrong key vs no password set on server); key compared trimmed; added SET PASSWORD.cmd.
- 2026-11-04: Site live on Cloudflare (newsticker.workers.dev); added SETUP CLOUDFLARE.cmd, DEPLOY.cmd, feed error reporting + timeout.
- 2026-11-04: Removed all ChatGPT/OpenAI Sites tooling (`@openai/sites-vite-plugin`, `.openai/`, `wrangler.local.jsonc`, `sites-origin` remote); added `wrangler.jsonc` + deploy/migrate scripts for Jay's own Cloudflare; admin key `local` now only works on localhost.
- 2026-11-04: Working live preview: control panel preview updates instantly with unsaved appearance changes, no longer eats "play next" headlines, shown as a scaled 1080p stream frame; Arial/sans fallback for the ticker font.
- 2026-11-04: Moved repo to GitHub, gitignored snapshot archives, added this CLAUDE.md.
