# Handoff — LASORDA News Ticker → Claude Code

Written 2026-11-04 to move this project from the Claude app (Cowork) to Claude Code.
Read this first, then `CLAUDE.md` (full technical reference, kept current).

## What this is

An ESPN BottomLine-style news ticker that Jay (Lasorda's Card House) runs as an OBS overlay on
his **eBay Live** card-break streams.

- **Control panel:** https://lasorda-news-ticker.newsticker.workers.dev
- **OBS Browser Source:** https://lasorda-news-ticker.newsticker.workers.dev/ticker (1920 × 60)
- **Code:** https://github.com/KnightmareRecords/LASORDA_NEWS_TICKER (private, `main`)
- **Hosting:** Jay's own Cloudflare account, free plan (Workers + D1 + Workers AI)

## Current state — 2026-11-04

**Live on Cloudflare:** commit `45f02e4` (deployed 10:20 PT).

**On GitHub but NOT deployed yet** — deploy these first:

- `1914573` Filter out non-news stories (rankings, previews, analysis)
- `8112ee2` Always open the news strip with a team story

Remote deploys from the Cowork chat were blocked because a Windows admin window covered File
Explorer. No database migrations are pending (0000–0005 are all applied remotely), so a plain
`npm run deploy` is enough.

## First session on the office Mac (checklist)

1. Clone into `/Users/lasorda-jason/Documents/PROJECTS/TICKER APP` (if not already there), then
   `npm install`. Requires Node ≥ 22.13.
2. `npx wrangler login`. This is a one-time Cloudflare sign-in per computer; Jay signs in himself
   in the browser.
3. Optionally run it locally: `npm run db:migrate:local`, then `npm run dev` →
   http://localhost:3000 (admin key `local`; the AI is skipped locally).
4. Add a Mac double-click deploy script, `DEPLOY.command`, mirroring `DEPLOY.cmd`:
   `npm run db:migrate:remote && npm run deploy`. Run `chmod +x` on it.
5. Deploy the two pending commits above, then verify:
   `curl -s https://lasorda-news-ticker.newsticker.workers.dev/api/headlines` should show:
   - `ai.skipped` > 0 (stories filtered as not news);
   - the first feed item with a non-null `team`;
   - `ai.error` = null.
6. Update `CLAUDE.md` (Status + Change log), commit, push.

## Jay's decisions and preferences (keep these)

- **No ChatGPT/OpenAI anything.** All OpenAI Sites tooling was removed. Don't use OpenAI models
  (that includes `gpt-oss` on Workers AI).
- **Explain things plainly.** Jay isn't a developer and prefers one-click files over typed
  commands. Give him things he can double-click.
- **Feed:** ESPN top news RSS, fetched from ESPN at most **every 15 minutes**. Stories use the RSS
  summary, not the teaser headline.
- **AI short lines go straight to air**, protected by safety checks: every number and name must
  appear in the source story, otherwise the original text airs. Keep the team name in the line.
- **On-screen label for generic stories:** `NEWS` (set in the control panel).
- **Look:** SportsCenter-style. Lasorda's Card House logo block on a light panel, team panels in
  team colors with the Anton font, optional red tags. The bar is **slim** (~42 px at text size 25)
  because the screen space on eBay Live is precious. The logo must never be distorted.
- **Team logos:** all 124 are in `public/teams/<team key>.png`. On 2026-11-04 Jay asked Claude to
  download them from the official league sites (see the CLAUDE.md change log for the sources).
  Only replace them when Jay asks.
- **Ordering:** team stories are spread evenly, and the strip **always opens with a team story**.
  "Put at the front once" custom headlines still go first.
- **Non-news** (rankings, previews, analysis, questions) is filtered out.
- **Admin key** protects editing. It is typed once per browser and remembered. Jay wanted it kept.
  Never write the key into files or commits.
- **Show is at 4 PM Pacific.** Cloudflare's free daily limits reset at that time (00:00 UTC).

## Two computers, one at a time

- **Home:** Windows PC "fatlizzy", folder `F:\LASORDA CARDS\ESPN OBS TICKER`. It has `DEPLOY.cmd`,
  `SET PASSWORD.cmd`, `SETUP CLOUDFLARE.cmd` and `DEPLOY-UNATTENDED.cmd`. That folder was synced
  to `8112ee2`.
- **Office:** Mac, `/Users/lasorda-jason/Documents/PROJECTS/TICKER APP` (new).
- Rule: `git pull` at the start of a session and commit + push at the end. Ask Jay before pulling
  over uncommitted local changes.
- On Windows, `npm install` rewrites `package-lock.json` (it drops `"dev": true` flags). Discard
  that churn with `git checkout -- package-lock.json`.

## Gotchas learned the hard way

- Workers AI **retired `llama-3.1-8b-instruct`** (2026-05-30) even though the pricing page still
  lists it. `AI_MODELS` in `lib/ai-summary.ts` is an ordered fallback list that skips retired
  models automatically.
- Changing the AI prompt? Bump `AI_PROMPT_VERSION` so cached lines (D1 `ai_lines`) get rewritten.
- `wrangler` with `CI=true` fails D1 calls with error **7403** under OAuth login. For unattended
  runs, use stdin from null instead: prompts then auto-answer yes.
- `compatibility_date` must not be newer than the installed wrangler supports (it is
  `2026-05-01`).
- The Workers AI binding is remote-only. `vite.config.ts` sets `remoteBindings` off in dev
  unless `TICKER_REMOTE_AI=1` is set.
- ESPN's bot protection serves HTML to fake-browser user agents, so the honest RSS-reader UA is
  tried first. Google News returns 503 to Cloudflare when polled often, which is why the feed is
  cached for 15 minutes with a last-good fallback.
- `workers.dev` and Cloudflare APIs were blocked from Claude's cloud sandbox. Deploys had to run
  on Jay's machine.
- `npm run lint` has older errors from the original Codex code (react-compiler setState-in-effect,
  label a11y, settings-route regexes). They are not regressions.

## Ideas discussed, not built

- A scores/results data section (closest to the real ESPN ticker).
- Editing the team/tag on existing custom headlines in the UI (the API already supports it).
- College teams.
- A headline/summary display toggle.
- A second, team-heavy feed, so team stories are more frequent.
