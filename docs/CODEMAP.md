# Code map

Last updated: 2026-10-20.

| Location | Responsibility |
| --- | --- |
| `public/index.html`, `public/style.css` | Compact handmade winter shell: charcoal/navy, flat controls, monospace utility text, centered search/horizontal quick links, and focus/loading/error/responsive styling. |
| `public/wordmark.svg`, `public/wordmark-still.svg`, `public/icon.svg` | Hand-lettered Frost vector wordmark with tiny icicle tails, static variant, and neutral globe favicon/fallback (no standalone f). |
| `public/app.mjs` | Application coordination, active tab and navigation lifecycle. |
| `public/state.mjs` | Structured tab navigation history, validated preferences and persisted lists. |
| `public/transport.mjs` | Bonfire and external adapters; endpoint validation and URL transformation. |
| `public/browser-controls.mjs` | Tab strip, omnibox suggestions and browser controls. |
| `public/panels.mjs`, `public/panels.css` | Settings, history, bookmarks, downloads, command palette and about views. |
| `public/downloads.mjs` | Direct-URL transfer state, progress, cancellation and browser file handoff. |
| `public/navigation.mjs` | URL/search normalization and three-engine registry. |
| `public/reset.mjs` | Origin-local data clearing and recovery guidance. |
| `public/sw.js` | Engine routing, controller-revival wait and Frost error response. |
| `server.mjs`, `relay-policy.mjs` | Loopback server, Wisp relay, Host/Origin checks and public-address policy. |
| `scripts/build.mjs` | Engine build/copy and provenance manifest. |
| `scripts/package-source.mjs`, `public/source.zip` | Corresponding-source packaging script and generated archive. |
| `public/vendor/` | Generated engine/transport assets; excluded from Git. |
| `engine/` | Independent pinned upstream engine clone with Frost build config. |
| `test/`, `docs/`, `.project-memory/` | Regression checks, curated project knowledge, and ignored raw evidence. |





- upstream/: pinned new engine sources and matching prebuilt app/vendor bundle.
- Dockerfile, .dockerignore, fly.toml: minimal production image, two always-on Ashburn Machines, 1 GB each, connection balancing.
- test/deployment.test.mjs: production Host/Origin and configuration rejection tests.

- scripts/announce.mjs: owner-only Fly CLI announcement publishing/removal.
- state.mjs loadSession/saveSession: validated local tab restoration.
- GET /api/announcement: read-only public text, sourced from deployment environment.

- admin/: isolated CloudFront/Lambda console, TOTP service, DynamoDB adapter, static admin UI, CloudFormation template and CloudShell deploy script.
- scripts/build-admin.mjs, package-admin.mjs, admin-template.mjs: reproducible Lambda bundling and infrastructure generation.
- test/admin.test.mjs: enrollment, TOTP replay, expiry, logout, mutation/origin rejection and rate limits.

- presence.mjs: bounded anonymous activity tracker (75-second expiry); server /api/presence aggregates via the designated Fly machine, returning count and answering-machine label. public/app.mjs polls every20seconds. test/presence.test.mjs covers deduplication, expiry, capacity, invalid IDs, and HTTP HEAD behavior.

- public/link-routing.mjs: engine page-init routing for new-window links and popups into shell tabs; test/link-routing.test.mjs covers resolution, gestures, popup guard, and form containment.

- device-access.mjs: browser cookie parsing/issuance and bounded10-second status cache; server relay authorization and15-second active-connection checks. public/device-access.mjs: code display and banned screen. admin/service.mjs: owner ban/unban/status and public boolean status; DynamoDB ban:UUID records. test/device-access.test.mjs and deployment/admin tests cover enforcement, privacy and recovery.

Frosty UI: public/frosty/assistant.mjs owns chat and full-page composition, route.mjs handles the /#frosty route, style.css matches browser tokens, companion.mjs owns the minimal snowman and small intact hop. The separate preview files and entry link have been removed. test/frosty-route.test.mjs and test/companion.test.mjs cover route and movement invariants.

## Account platform (in progress)

- platform/accounts.mjs, security.mjs, store.mjs: identity, device grants, verified registration, one-time handoffs and conditional DynamoDB transactions.
- platform/vault.mjs: bounded encrypted current-tab/cookie saves, account binding and revision conflict control.
- platform/http.mjs, internal.mjs, config.mjs, handler.mjs: trusted dispenser API, CSRF/cookies, signed service calls, official Google Form verification and Lambda entry.
- platform/control.mjs, monitor.mjs: assignments, reports, support, owner operations, audit, retention and infrastructure health samples.
- platform/ui/: isolated dispenser UI; platform/google-form/: owner Apps Script and manifest; platform/.env.example: configuration template without secrets.
- account-access.mjs: main-site account adapter; deliberately not wired until browsing content is isolated.
- scripts/build-platform.mjs: bundles account Lambda and explicit public assets; generated output remains under .project-memory/platform-deploy.
- test/accounts.test.mjs, platform-http.test.mjs, account-access.test.mjs, admin-entry.test.mjs: account/security and redirect regression tests. test/helpers/platform-store.mjs is test-only; production requires DynamoDB.

- scripts/platform-template.mjs, platform/deploy.py, platform/deploy.sh: isolated CloudFront OAC/Lambda/DynamoDB provisioning, durable key preservation and disabled-by-default registration/monitor. test/platform-deployment.test.mjs checks deployment security invariants.

- platform/analytics.mjs: bounded account summaries and UTC online activity sampling using existing Fly presence; platform/owner.mjs: IAM-only owner dispatch, excluded from Function URL requests.
- admin/handler.mjs: authenticated owner bridge via exact-function IAM Invoke; admin UI: overview SVG charts, account moderation, announcements, browser bans, support and audit.

Ban gate: account-access.mjs handles minimal browser auth/status only; server.mjs gates relay/AI and watches active grants; public/device-access.mjs routes denials to dispenser. platform/accounts.mjs checkConnection validates current account/family/epoch/assignment. platform/config.mjs derives a restricted browse signing key; platform/internal.mjs separates browsing routes from storage routes. test/account-enforcement.test.mjs exercises real HTTP/WebSocket/AI-stream enforcement.

Browser refresh: platform/control.mjs writes audited global/account revisions; owner.mjs and admin/service.mjs retain IAM/TOTP boundaries. accounts.mjs and server.mjs attach minimal revisions to authenticated device polling. public/browser-refresh.mjs handles baseline/monotonic one-shot detection; app.mjs saves tabs before reload. admin UI provides scoped confirmation. test/browser-refresh.test.mjs plus accounts/admin/account-enforcement tests cover the path.

Prepared response sheet: platform/verification-responses.mjs validates/persists masked read-only snapshots, platform/google-form/ResponseSheet.gs reads the linked sheet via Google Sheets REST and signs imports. Owner bridge serves admin Verification responses; not deployed (owner deferred).

- `platform/staff.mjs`: account-session role authorization and admin operations; owner-only membership changes.
- `platform/ui/staff-session.mjs`: dispenser admin CSRF and cookie-session requests.
- `test/staff.test.mjs`: role and session boundary regressions.

- platform/online.mjs: throttled authenticated account presence, 75-second estimate and epoch invalidation.
- platform/analytics-time.mjs: viewer-timezone calendar boundaries, including DST.
- public/clock.mjs: local new-tab clock.

- platform/restrictions.mjs: server-time effective suspension status shared by authorization, moderation, presence and analytics. test/restrictions.test.mjs covers untouched expired rows.

Maintenance: admin/maintenance.mjs validates the shared publish payload; public/maintenance-banner.mjs handles the independent blue scheduled/in-progress banner.

Terms: public/terms.html is canonical document; scripts/build-terms.mjs generates platform/terms-document.mjs hash during platform/main builds. platform/accounts.mjs enforces acceptance; platform/http.mjs exposes POST /api/terms/accept; platform/ui/account.mjs renders review gate. Update document then rebuild; deploy account Lambda and browsing adapter together. Reverting to pre-gate code removes enforcement; accepted version/time fields are additive.

History: platform/browsing-history.mjs owns bounded account storage and audited reads; public/browsing-history.mjs sends new visits from app.mjs through account-access.mjs. platform/{http,internal,staff,owner,control}.mjs and admin/service.mjs route authenticated operations and deletion. admin/{admin.js,index.html,admin.css} render the viewer. test/browsing-history.test.mjs plus account-access.test.mjs cover boundaries.

Release tooling: scripts/verify-release.mjs enforces clean checkout/submodule/context and builds/tests/packages; scripts/build-context.mjs generates exact .dockerignore from staged source paths; scripts/package-source.mjs packages tracked files only. Docker has build/test and minimal runtime stages with a runtime HTTP smoke check.
