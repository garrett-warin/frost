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

Frosty image upload: one PNG/JPEG/WebP up to2MiB per send, local preview/remove, explicit Send before transmission, auto-select an available image-capable model with visible notice. Server validates declared MIME against bytes and bounds request size; text-only models reject image payloads. Image bytes are not written to session history or server files; reattach for follow-ups. Verify valid images, mismatched/unsupported/oversized input, selection gating, removal and provider failures.

## Groq provider acceptance — pending, 2026-10-23

- Verify the Groq adapter uses its fixed official endpoint and only `GROQ_API_KEY`; reject unsupported/duplicate models and never expose keys in public configuration or errors.
- Verify GPT-OSS options reject images; Qwen preview accepts validated PNG/JPEG/WebP up to 2 MiB and attachment auto-selection remains visible.
- Exercise the 5,440-byte text-only and 3,392-byte image prompt boundaries, including multibyte UTF-8, system instruction, history and page context. Over-budget input must fail before provider access, without silent truncation.
- Verify 2,048 output-token cap, provider-specific payload fields, real streaming/cancellation, 429 recovery and 413 guidance. Organization quota can still be exhausted within Frost's per-process caps.
- Verify explicitly selecting OpenRouter retains its separate key, `:free` allowlist, zero prompt/completion price guard and data-collection restriction. No automatic fallback or account upgrade.
- After the user supplies a Groq key for a Free organization, record each harmless text/image smoke result independently; confirm both existing Fly Machines remain healthy after the authorized rollout. Until then, provider tests, live Groq responses and deployment are pending. Existing image tests are not new-provider evidence.

## Account platform acceptance — pending release, 2026-10-25

- Verified-email registration rejects mismatches, replay, expiration and concurrent claims; failed attempts consume durable rate limits.
- Sessions renew after long inactivity; logout, per-device revocation, epoch revocation and bans deny access. Verified recovery works at the device limit.
- Ciphertext contains no plaintext cookies/tabs; cross-account substitution fails authentication; stale revisions fail without overwriting newer saves. Invalid URLs and malformed/expired cookies are rejected or pruned appropriately.
- Main-site handoff binds destination and browser, consumes once and removes the code from the address bar. Restricted access returns the configured dispenser appeal destination, not an arbitrary request URL. Service failures stay failures, not successful or banned states.
- Public API changes require exact origin and CSRF; internal calls require body-bound signatures, short timestamps and single-use nonces. Direct Lambda access must remain denied; CloudFront must supply trusted viewer metadata.
- Restricted account deletion and adopting a deleted banned email cannot bypass the restriction. Owner clearing is explicit and audited. Account deletion removes vault, identity mappings and indexed refresh credentials.
- Required before enabling: browser-content origin isolation and hostile-page tests; actual shell synchronization; revoke/ban enforcement on active relays; account-switch local-state clearing; browser inspection at mobile/desktop sizes; real Google Form registration/reverification; deployed DynamoDB races and recovery; admin TOTP authorization for new owner controls; live monitoring and rollback checks.

Local automated tests and bundling cover backend foundations only. They do not establish deployed account functionality or runtime isolation.


## Email-only sign-in revision — 2026-10-25

The owner requested site-generated codes with no outgoing email and no visitor OAuth. Frost displays a one-time code which the user manually pastes into the Google Form. A signed Apps Script event must match both this code and the pending Google-verified email. The original dispenser browser completes using its separate private HttpOnly polling cookie. Requests expire after fifteen minutes and complete once; returning verification preserves the Frost ID. Restricted accounts remain appeals-only. Forwarding a code to another person can still authorize the initiating browser: this social-engineering limitation is not solved by the polling cookie. Live integration and deployment remain pending.

## Unified entry / expanded admin release acceptance

Verify new/returning entry, verified-only profile creation, concurrent single-use, stale proof after revoke rejection, durable profile attempt budget. Verify owner data/actions reject unauthenticated, wrong-origin and expired sessions; HTTP payloads cannot trigger IAM owner dispatch. Verify chart day/week boundaries, missing versus zero samples, account search pagination, bans/revocation and existing announcements/browser bans. Inspect desktop/narrow admin states using synthetic records and real live locked shell. Preserve TOTP state and capture both stack rollback code before deploy. Historical activity starts at rollout; registration totals exclude deleted accounts.

2026-10-26 release:82 automated tests passed; desktop/390px synthetic admin preview checked; owner TOTP unlock, live day/week aggregates and account listing verified. Live signed-in dispenser handles a null assignment with entry hidden. Main/dispenser health200, matching scrollbar assets, and both Fly Machines started/healthy at1024MB in iad. Production moderation was not exercised against the owner account.

Mirror management: verify ten new distributions preserve existing resources; every new homepage/health/relay works. Test blocked-target rejection, all-blocked recovery, counts, pagination and concurrent block/job races. Confirm new admin endpoints reject unauthenticated requests. Verify owner Links UI and manual assignment with synthetic records. Preserve rollback templates/code and existing TOTP enrollment.

Ban enforcement release: prove missing/forged/revoked/restricted/wrong-origin grants denied at relay and Frosty; active relay and AI interrupted; outage fails closed; HTTP polling redirects to configured appeals; valid refresh works; direct Fly and all mirrors require authorization. Verify derived browse signing key cannot invoke vault or preferences. Complete handoff browser test, record safe live ban test/rollback, preserve existing TOTP and account data.


Browser refresh acceptance: reject anonymous/wrong-origin owner operations; validate account/all scope and confirmation; isolated account vs global revisions, no session revocation, throttle and audit; device poll carries only own revision; first observation/stale/duplicate/invalid signals never loop; fresh commands reload once after saving tabs. Verify both Fly Machines and AWS deployment, preserving ban enforcement.


Response sheet checks: reject unsigned/wrong-source/wrong-path/oversized snapshots; ignore stale replay; strip unknown fields/full codes; deny anonymous reads; preserve existing Form verification. Confirm owner read-only scope, successful initial sync and scheduled trigger before claiming connected.

## Account admin acceptance

112 full-suite tests passed before rollout, including owner grant/revoke, denial immediately after removal, admin self-escalation/owner protection, wrong CSRF, banned/revoked/browsing-scope credentials, and public forged owner requests. Verify exact real owner account shows Admin in dispenser and can open dashboard without TOTP. Only owner sees membership controls. No real additional admin or moderation action is needed for verification.


Online account viewer: existing protected Accounts search supports Online now with username, Frost ID and last browsing check. Presence is approximate, refreshed by successful scoped browsing checks, written at most every30seconds and expires after75seconds. Revocation epoch and restriction invalidate presence. No URLs collected. Verify zero/fresh/expired/revoked/banned and owner-only access. Viewer-facing timestamps use local timezone; new-tab page has a quiet local clock.

Viewer timezone correction: client sends its IANA timezone through both TOTP and account-admin routes. Today/7-day local calendar boundaries drive registrations, daily peaks and chart bins; UTC remains storage only. Test spring/fall DST, fractional offsets, invalid zones, and staff-route forwarding.


Forced username change: authorized admins select category and explanation for an active account, with existing owner/peer protections. Preserve account sessions/data; block handoff, redemption, new browsing and active connection checks until atomic unique rename clears the flag. Previously flagged names cannot be reused on that account. Dispenser shows mandatory form and reason; deletion cannot bypass pending change. Bans take priority and retain appeals. Test old/in-flight grants, same/invalid/taken names, audit, protected targets and successful recovery.

Outage banner: six focused tests passed for classification, stale reports, recovery, fetch failure, visibility pause, overlapping requests and teardown plus existing backend probe behavior. Synthetic desktop and390px browser renders inspected; simulated recovery removed the banner without reload. No production outage induced.

Timed suspension checks: reject missing/invalid/out-of-range duration; enforce immediately and until the exact deadline across account, handoff, refresh, redemption and ongoing browsing checks; preserve newer bans, revocation epochs and forced rename; deleted identity restriction expires only at deadline; admin lists/totals reflect effective status. Inspect restricted page and duration dialog at desktop/mobile with synthetic users.

Maintenance acceptance: anonymous/wrong-origin publish rejected; date and reason bounds validated; disabled notices require no dates; announcement remains unchanged. Test scheduled/start/end transitions, literal HTML text, removal and expiry during fetch failure. Desktop and 390px banner plus admin enable/date fields inspected. Roll back using pre-release Lambda code and prior Fly image; stored maintenance record is ignored by old code.

404 acceptance: verify missing extensionless/HTML pages, explicit 404.html, HEAD without body, missing JavaScript MIME, unknown API JSON and healthy endpoint. Check desktop/390px and return-home link. Rollback to Fly deployment-01M622W979BYKCWFWNX0AM0XBF.

Editor acceptance: execute the validation, account-isolation, revision, PNG, gallery/moderation, undo/redo and desktop/mobile browser checks in docs/plans/customize.md before release. Keep incomplete editor off production.

- Wordmark color may change; centered location/visibility/shape are structural and cannot be removed through user designs or templates.

October29 layout/rotation: all143 tests passed; desktop/mobile sizing verified; all15 replacement origins returned health200 and matching renderer assets, plus synthetic authenticated account200 and WebSocket101. All16 old CloudFront browsing distributions disabled; dispenser/admin preserved.

2026-10-31 terms acceptance: 146/146 automated tests passed after updating old browsing fixtures to explicitly accept terms. New tests check matching document hash, stale/false acceptance, CSRF/origin/anonymous/GET rejection, account binding, handoff and old-grant invalidation, resumption and logout. Independent reviewer ran18 focused tests; fixed reviewer finding where required rename blocked declined-user account options. Local synthetic browser verified notice, checkbox, decline/support and acceptance; no real account consent submitted. Production and mobile-specific visual checks not performed.

## Admin browsing history — 2026-10-31

Local implementation, not deployed or pushed. Supersedes the earlier planned/local-only history statements. After current terms acceptance, newly observed visits are sent through the authenticated browsing adapter to the existing account store. No local history backfill. Authorized staff and the TOTP owner can view the latest 100 visits within 30 days from Accounts > Browsing history; reads are audited. URL credentials, queries and fragments are stripped, titles are bounded, times are server-recorded, expired entries are filtered/pruned, and account deletion removes the row. Client reporting is best effort, not a comprehensive or tamper-proof activity log.

Verification: 154/154 tests pass; admin and platform Lambda builds pass. Independent review found no remaining blockers; suggested adapter tests were added. Desktop and 390px synthetic browser dialog inspected, HTML title rendered literally, Close restores focus. No real history collected or real consent submitted. Evidence: `.project-memory/history-test-results.txt` and `.project-memory/history-mobile.png`.

Release remains pending: coordinate account Lambda, admin Lambda and browsing app deployments so terms/hash/gate and collector agree. No schema or IAM change. Preserve current deployment artifacts before rollout; rollback all three components together. New history rows are additive with DynamoDB TTL; stop the collector on rollback and preserve deletion handling or explicitly remove retained synthetic history before retiring it. Earlier deployment artifacts and unrelated pending work were not modified through a release.

Repository release acceptance: test clean-clone build and full suite, both AWS package builds, exact tracked-source archive isolation, generated context allowlist, and a remote build-only container run. No production rollout in this task.

Repository repair verified: clean dependency install (0 npm audit findings), browser/account/admin builds passed, tracked-source sentinel isolation passed, secret-pattern scan found no matches, independent20test review passed, and remote Linux Docker build-only passed all156tests plus final runtime /health,/app.mjs,/source.zip smoke checks. Initial Linux build caught a backslash-path portability bug, now explicitly rejected on both OSes. Build-only image deployment-01M69JECZ6H9J6TNTMJEVN7Q7X was not deployed.
