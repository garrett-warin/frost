# Acceptance

Status: seven regression tests and JavaScript syntax check passed after the handmade theme; browser acceptance remains scoped and partial. Last updated: 2026-10-20.

| Requirements | Observable acceptance |
| --- | --- |
| REQ-01 | Engine build succeeds; manifest records repository/commit/hashes; local relay fetches a public page through Bonfire. |
| REQ-02, REQ-10 | Inspect rendered desktop/narrow layouts: legible handmade wordmark with tiny icicle tails, no standalone f, neutral globe fallback, cold charcoal/navy chrome, flat squared controls, monospace utility text, centered search/horizontal quick links, no gradients/corner cracks/ambient glow/marketing footer, no overlap, keyboard focus, reduced motion. |
| REQ-03 | Fresh launch opens one New Tab and focuses search; domain/URL/query routing works; all three engines work and preference survives reload; no Google option. |
| REQ-04 | Navigate two tabs, switch without losing their pages, close active/inactive/last tab, reopen a closed tab, verify adjacent selection and title/URL updates. |
| REQ-05 | Test back/forward/reload/stop, autocomplete keyboard selection, supported shortcuts, and progress completion/error termination. |
| REQ-06 | Bookmark/unbookmark a page, revisit from manager/bar, search local history, use menu zoom and keyboard command palette. |
| REQ-07 | Change theme, compact tabs, animations, accent and search; reload to verify settings persistence; clear only the stated local data; reject invalid proxy endpoints. |
| REQ-08 | Download a small public file, observe actual completion/error/progress, exercise supported open/cancel/remove, and state host-browser/OS limitations. |
| REQ-09 | Trigger invalid input, unavailable destination, and offline state; confirm readable recovery UI, retry/back/search actions, and no false success. |

Automated checks cover input normalization, engine URLs, private/mapped IP filtering, HTTP static paths/methods/Host validation, plus state/transport regressions added for the expanded brief. Report commands and results rather than inferring runtime success from a build.

Owner acceptance method: open the local app, complete a two-tab browse/search/bookmark cycle, choose the preferred appearance and search engine, and confirm the original Frost branding and compact layout match the intended product. Machine checks do not replace that judgment.

## Previous verified checkpoint

Seven Node tests passed and the engine build succeeded before the latest handmade visual pass. Browser checks at 1920×1080 loaded example.com, created/switched tabs, selected a bookmark, and verified settings/search controls, Light theme, and the bookmarks bar. The refreshed dark page was visually checked with no standalone f or old branding. These establish partial coverage of REQ-01 through REQ-07 and REQ-10; they do not certify all rows above. GitHub stalled a separate browser test tab. Remote endpoints and end-to-end downloads remain untested; remaining recovery and shortcut cases are not certified.



## Handmade-theme verification

All seven Node tests and `node --check public/app.mjs` passed after the theme change. Both SVG wordmarks parsed/rendered at 300px. An isolated preview verified dark desktop at 1280×720, the Light main page, and settings/theme toggles. A 390×844 mobile capture showed two-column shortcuts and scrollWidth 390px, with no horizontal overflow. Dark evidence: .project-memory/evidence/frost-indie.png.

Independent review prompted Light primary/danger contrast tokens and an About-wordmark filter correction. The final Light correction was checked in the browser: on-accent #fff, danger #a6323c, correct panel font, and visibly darkened About wordmark. The preview was returned to Dark and the final dark capture refreshed. A separate user tab on Brave timed out, but the isolated preview succeeded; this does not broaden website compatibility claims or certify untested functional rows above.

## Fly release acceptance

Verify matching engine assets, production Host and WebSocket Origin checks, nine Node tests, real browsing over HTTPS, and health checks on exactly two started iad Machines with 1024 MB each. Confirm autostop off and restart always. No maximum throughput claim without load testing. Rollback details: decisions/002-fly-engine-migration.md.

## Latest feature acceptance

Verify light-only settings and migration, session restoration with active tab and long back/forward history, saved visit history, read-only announcement API rejecting all mutations, SVG hammer banner wrapping, and site fullscreen enter/exit. Independent review findings on long-history slicing and fullscreen error visibility were corrected. Fourteen automated tests pass. Browser preview confirmed banner appearance and restoration of two tabs including active selection. Fullscreen and hosted checks recorded in CURRENT.md after completion.

Admin acceptance: valid owner enrollment, reject public enrollment and wrong/reused codes, enforce session expiry/logout, reject cross-origin writes, public read-only announcements, exact CloudFront distribution origin access, no browsed websites served on admin origin. Sixteen automated tests pass; AWS deployment and human authenticator enrollment are tracked in CURRENT.md. No claim of live TOTP success before the owner confirms enrollment.

CloudFront migration verified: homepage and real proxied browsing on original URL; menu opens new admin address; preserved enrolled authenticator; unauthenticated publication401 and direct Lambda403. All16 tests passed. Exact outer title and provided P favicon require final live browser inspection after the latest rollout.

Final live identity check: Home | Schoology remained exact after a proxied page loaded and after returning Home. Favicon GET200 image/png; SHA256 matches supplied PNG exactly (24,946 bytes). Latest Fly rollout completed with both machines healthy. Temporary setup files removed after enrolled=true verification. Main and relocated admin tabs retained as deliverables. Evidence: .project-memory/evidence/frost-cloudfront-home.png and frost-cloudfront-browsing.png.

Additional distribution and presence acceptance: five new main-site resources only, each homepage/health200 and relay101 with exact Origin, unrelated origins403. Verify shared counts when requests are forced to each Fly machine, current responding-machine labels, browser footer display,18 automated tests, and unavailable state rather than false zero. Activity count is an estimate; different origins/devices count separately and server restarts rebuild it.

Final verification: all five additional distributions report Deployed. Each returned homepage200, health200, relay101. Real Example Domain browsing succeeded on additional1; live footer showed2online and Server: Ashburn1. Shared-counter checks returned1online from each machine with the same visitor ID. All18 tests passed. Evidence: .project-memory/evidence/frost-online-server.png. Files changed: presence.mjs, server.mjs, public/app.mjs, public/index.html, public/style.css, fly.toml, Dockerfile, .dockerignore, scripts/admin-template.mjs, admin/stack.json, test/deployment.test.mjs, test/presence.test.mjs, public/source.zip, and docs. Main/admin origins and enrollment retained.

Link containment: browser verified Ctrl-click and middle-click each create a background Frost tab while retaining the source page. Independent review has no remaining release blockers; programmatic form.submit regression added. Native context-menu actions and blank-popup WindowProxy/OAuth compatibility are not claimed.

Release passed: 21 automated tests; both Fly machines healthy; main CloudFront internal-tab Ctrl-click verified. Screenshot frost-internal-tabs.png.

Browser bans acceptance: reject unauthenticated/wrong-origin mutations and malformed device codes; preserve TOTP enrollment; show owner status/note only after login; ban/unban record persists; public status excludes private note; relay rejects missing/banned cookie and terminates open banned connections; service failure denies access. Cookie reset/other browser/origin bypass explicitly disclosed.

Frosty: verify real stream parsing/cancellation, invalid inputs, rate caps, disabled config, provider errors, sanitized links/Markdown, context opt-in, conversation persistence/clear, keyboard/reduced-motion/mobile, interrupted motion and navigation regression. Real provider smoke test requires configured credentials; report missing setup honestly.

Frosty page acceptance: sparkle opens /#frosty; Back to Frost/Escape/browser back restore browsing; direct-route reload retains the page; chat/model selection survives view changes. The model has two outline snowballs, dot eyes and a small nose, without arms, buttons, mouth or shadow. Verify a small intact hop with no head separation or rotation, plus a still reduced-motion state. The preview link and controls must be absent and the former preview URL must no longer serve a preview. Provider smoke test is a harmless synthetic message; report each model result independently.

Frosty mascot follows the latest assistant reply; only the empty chat displays it centrally. Restore and clear operations must keep exactly one mascot.
