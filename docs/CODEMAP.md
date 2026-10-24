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
