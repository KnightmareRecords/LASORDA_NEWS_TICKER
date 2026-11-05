# Pre-stream audit — November 5, 2026

**Assessment: substantially more resilient after the local fixes, but not an unconditional production sign-off.** Publish a tested final version and rehearse in OBS before the November 6 stream. This audit did not deploy changes, modify live settings, or exercise destructive operations against production.

The live `/ticker`, settings, headlines, scores, promos, and advance endpoints returned HTTP 200. News and scores were populated, and two text promos were present. The notes saying rotation/promos/skip were not deployed were outdated. Actual Cloudflare account usage and billing were not inspected.

## Fixed locally

| Priority | Finding and effect | Fix |
| --- | --- | --- |
| High | Startup waited for all requests; one hung request could leave OBS completely transparent indefinitely. | Display available content or a branded fallback after 2.5 seconds. Bound requests to 30 seconds and share overlapping requests per source. |
| High | An old timeout from a manually skipped scene could clear the skip callback belonging to a later scene. | Cancel completed timers and only clear the hook belonging to that wait. Clean up outstanding waits on unmount. |
| High | Each news segment restarted at the beginning. With the live 30-second setting, later stories could repeatedly miss airtime. | Save each strip's scroll position and resume after promo/score breaks. |
| High | Rotation announcements vanished when there were fewer than four feed stories, or more announcements than available insertion slots. | Include every enabled rotation announcement, including leftovers after the feed. |
| High | The React server package was 19.2.6, affected by a published denial-of-service advisory. | Update React, React DOM, and React server DOM together to 19.2.9. The advisory's patched threshold is 19.2.8. [Advisory](https://github.com/advisories/GHSA-wx67-qw84-cm4g). |
| Medium | A short list could leave much of the scrolling window empty. | Repeat short content until each scrolling copy spans the viewport; checked at 1080 and 1920 pixels. |
| Medium | A promo image failing during its entrance fade had no completion callback yet, leaving the hidden ticker under failed media. | Remember failures during entrance, end the promo, hide the broken image, and mark its URL unavailable for retry. Release preload timers/media resources. |
| Medium | Long text promos could be clipped. | Fit the complete text within the available width. |
| Medium | Missing/busy AI cache could fail the entire headline response, including custom announcements. | Fall back to eligible original stories and preserve custom announcements. Also deduplicate simultaneous feed refreshes within an isolate. |
| Medium | A promo DB failure returned a successful empty list, erasing the browser's last good list. | Return 503 so the browser retains the previous list. |
| Medium | Invalid video ranges were treated as missing files; suffix ranges were not supported. | Support bounded, open-ended, and suffix ranges; return 416 with the total size for invalid ranges. |
| Medium | Failed custom-headline toggles could appear saved, with uncaught network errors. | Only update the control after a successful save; show failures and time out hung saves. Reject failed settings loads. |
| Medium | Frozen scores could remain indefinitely during a browser network outage; a previously successful league still appeared healthy after upstream failures. | Expire browser-held scores after 20 minutes of failed requests and report league health from the latest fetch attempt. |
| Low | Malformed/null JSON and non-string custom text produced HTTP 500. | Normalize malformed bodies and validate text types; tested bad create/settings bodies returning 400. |
| Low | Windows deploy script printed success even after deployment failed. | Stop with a clear failure message and nonzero exit status. |

Also replaced direct React-owned image-node removal with hiding and added the favicon metadata.

## Remaining risks and limitations

1. **Dependency security is not clean.** `npm audit` now reports 34 affected package entries: 3 critical, 14 high, 16 moderate, 1 low, down from 35. These are package findings, not 34 demonstrated exploits. The critical entries trace to the formatter (`oxfmt`/`tinypool`) and the shadcn CLI's Express dependency (`proxy-addr`); the runtime framework also has transitive advisories. Broad framework/toolchain upgrades were not forced immediately before the stream. Do not use `npm audit fix --force`; it proposes incompatible/downgrade changes here. Review and test those upgrades separately.
2. **“Play next” is not a reliable live one-shot queue.** Consumption currently happens only on the ticker's first successful load. A queued item added while OBS is already running can remain marked “next.” The public `GET /api/headlines?consumeNext=1` also changes placement without the admin key. This legacy behavior remains; use normal rotation announcements for the rehearsal/stream until the queue is redesigned around confirmed playback and authorized acknowledgement.
3. **AI wording is not fact-proof.** `checkLine()` checks number/name presence, not whether a result, attribution, or negation is correct. It exempts the first word from the name check. A rewritten line can still change meaning while passing. If exact source wording is required, turn AI short lines off; the existing 120-character original-text filter means fewer feed items may air. No editorial behavior was silently changed.
4. **Cloudflare free-plan headroom is narrow if previews stay open all day.** *(Updated after review: the Skip-ahead check now runs every 5 seconds instead of 3.)* Current polling generates about 1,560 API requests per hour per ticker instance: 720 advance + 720 headlines/settings/promos + 120 scores. Every open view is an instance: OBS, the control panel's Live preview, and the `/phone` view. All three open for 24 hours ≈ 112,000 requests (over the limit); OBS plus one preview for 24 hours ≈ 75,000. During normal stream hours usage is far below the limit. The free account limit is 100,000/day and resets at midnight UTC, which is 4 PM Pacific in November. Close unused previews/phone views. Account usage, D1/AI budgets, and CPU limits still need checking. [Cloudflare limits](https://developers.cloudflare.com/workers/platform/limits/).
5. **An online overlay cannot guarantee startup during a hosting/network outage.** Feed fallback caches are per Worker isolate and browser memory, not durable offline copies; reloading can lose them. A service worker is not a complete offline ticker. The new `STREAM BACKUP.html` embeds its logo and font and was tested with the browser offline. Load it as a separate local OBS source before the stream.
6. **RSS URL validation is incomplete hardening.** The current authenticated feed setting uses a hostname denylist, with incomplete IPv6 handling and no redirect/DNS revalidation. Use the known ESPN feed for the stream; do not treat the existing validator as a general SSRF defense.
7. **Quality checks are not all green.** TypeScript and the production build pass. Full-project lint still reports 39 pre-existing findings, primarily UI accessibility/compiler/type rules. Focused checks for the new runtime helpers, ticker, API helpers, and audit scripts pass. This was a functional and failure-mode audit, not an exhaustive penetration test.
8. **OBS and real media remain acceptance checks.** Automated browser tests used Chromium, local Cloudflare emulation, fixtures, and accelerated time. They do not prove hours-long OBS stability, GPU behavior, every video codec, or cloud quotas. The media API test uses synthetic bytes to verify ranges; play each actual uploaded video in OBS.

## Verification performed

- `npx tsc --noEmit`: pass.
- `npm run build`: pass.
- `node --test scripts/audit-tests.mjs`: 8 passing regression tests.
- `node scripts/audit-api.mjs`: 26 passing checks against an isolated local D1/R2 database, including all nine editing-route authorization checks. Test rows/files removed afterward.
- Playwright `scripts/audit-browser.js`: 13 passing checks, including hung startup, short feeds at both widths, two skips across an old deadline, resume position, outage retention, empty fallback, and recovery; no uncaught page errors.
- Playwright `scripts/audit-media.js`: 5 passing checks, including failed preload avoidance and an image error injected during entrance fade.
- Offline local backup: text, embedded logo, and embedded font loaded successfully with networking disabled.
- Live site inspected read-only. No live admin password was read or stored.

Screenshots are in `output/playwright/` (ignored by Git). The final browser checks were rerun after the API validation fixes. College-team additions from another session appeared during this audit and were preserved. Their editorial/team-detection behavior is outside this audit; any subsequent source edits invalidate the corresponding test result. No commit or push was made while both sessions were editing overlapping files.

To reproduce local checks: run the build, then `npx wrangler d1 migrations apply DB --local --persist-to .wrangler/audit-state`, then `node scripts/audit-server.mjs` in a separate terminal. It serves the built app at `http://127.0.0.1:8899`, with isolated local storage and no remote AI. Run the API tests and use `playwright-cli run-code --filename=...` for the two browser scripts. The API harness closes HTTP connections to avoid local Windows workerd connection-reset behavior; no automatic mutation retries conceal failed writes.

### Review notes (added after the audit)

- Re-checked with the college-team changes included: `tsc`, `npm run build`, and `node --test scripts/audit-tests.mjs` (8/8) pass; lint unchanged at 39. College detection was tested separately against the real ESPN feed (Toney → UM, Hurts → Eagles, FSU, ND; no wrong panels) but is not covered by the browser suite — watch a few college stories in the rehearsal.
- `scripts/audit-browser.js` now waits 7 s after a simulated skip (the check interval is 5 s).
- R2 file storage is already on (the rotation is live, which requires it). Uploaded videos are still untested on the live site.

## Before going live on November 6

1. Finish the concurrent college-team edits, review the final diff, and rerun the build/tests.
2. **Commit and push everything in GitHub Desktop** — including `STREAM BACKUP.html`, `AUDIT.md`, the `scripts/` and the new `public/teams/ncaa-*.png` logos — so GitHub, the live site, and both computers match (today's lost college work came from a computer that never pushed). Only then publish that exact version with `DEPLOY.cmd`. This audit has not published it.
3. In OBS, use the production `/ticker` URL without `?preview`, at **1080 × 60** for the vertical stream.
4. Add another Browser Source using **Local file → STREAM BACKUP.html**, also 1080 × 60, in the same position. Keep it hidden and rehearse hiding the main ticker/showing the backup.
5. Run a **30-minute rehearsal in OBS**. Watch multiple news → promo → scores cycles. Confirm later news items appear, every promo fits, and each actual video plays silently. Try “Skip ahead” twice, including after waiting past the original segment deadline.
6. Add, disable, and delete a disposable normal-rotation announcement. Confirm the actual OBS source changes within a polling interval. Confirm a wrong admin key displays a failed-save message.
7. Check Cloudflare usage, close spare preview/phone tabs, and avoid deployments or refreshing a healthy OBS source during the live show.

If the main source fails during the stream, switch to the already prepared local backup first and troubleshoot off air.
