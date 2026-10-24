# Current state

Last updated: 2026-10-20.

Frost now has a modular local browser shell, independent tab state, address suggestions, bookmarks/history, settings, command palette, direct-URL downloads, loading/error recovery, and an isolated transport layer. The latest user direction replaces the polished wordmark/theme with an informal handmade winter look: slightly uneven legible lettering with tiny icicle tails, cold charcoal/navy, flat squared controls, monospace utility text, and horizontal quick links. Centered functional search remains; corner cracks, gradients, ambient glow, and marketing footer stay absent. The handmade theme has been inspected in dark and Light desktop views and a narrow mobile view; exact evidence and limits follow. The standalone f was removed from the toolbar and empty tabs; the favicon/fallback icon is a neutral globe. This supersedes the earlier supplied wordmark; no Bonfire, Kin, or Proxy labels remain in the ordinary browser UI. Legal/source attribution is retained.

Search remains DuckDuckGo, Bing, and Brave only. Preferences, bookmarks, and history persist locally. Open/closed tabs and download records are session-only. The server binds loopback and validates Host, relay Origin, and public destination addresses.

## Verified checkpoints

- All seven Node regression tests passed after the handmade-theme changes; `node --check public/app.mjs` passed.
- Engine JavaScript asset build succeeded; provenance manifest records the upstream commit and asset hashes.
- Browser at 1920×1080 loaded example.com through the network-enabled local relay.
- Browser checks exercised tab creation/switching, bookmark selection, settings/search controls, Light theme, and the bookmarks bar.
- Both wordmark SVG variants parsed and rendered at 300px.
- An isolated browser preview was inspected at 1280×720 in dark and Light themes, including settings/theme toggles. The dark capture is .project-memory/evidence/frost-indie.png.
- At 390×844, the mobile screenshot showed two-column shortcuts and no horizontal overflow; DOM scrollWidth was 390px.
- Independent review found Light-theme primary/danger contrast and About-wordmark filtering issues. Theme tokens and the Light About-wordmark filter were corrected and checked in the browser: on-accent was #fff, danger was #a6323c, panel font was correct, and the About wordmark was visibly darkened. The preview was returned to Dark and its screenshot refreshed.
- Required project documents, local Markdown links, and ignored evidence boundary passed the documentation audit.

Earlier local checks rebuilt the engine successfully. The prior 1920×1080 browser checkpoint established the navigation/tab/bookmark evidence above; the newer handmade-theme inspection used the sizes listed above. A stale navigation timeout during connection changes was also cleared. This checkpoint does not claim every acceptance criterion passed: GitHub stalled a prior smoke-test tab and a user tab browsing Brave timed out; the separate preview succeeded and unblocked theme validation. Remote adapter behavior is untested because no endpoint was supplied, and direct-URL downloads have not had an end-to-end browser check. Download handling cannot inspect host-browser downloads or reveal filesystem locations. The host browser may intercept keyboard shortcuts.

Release target: local http://localhost:3100 only; no public deployment or repository push. `npm run package:source` creates the corresponding-source archive at `public/source.zip`; rerun it after final edits. Rollback is stopping Frost. The prior Bonfire folder remains independent, and no database migration or external resource change is required.

## Engine and hosting update, 2026-10-20

The active source is upstream/ (garrett-warin/engine, pinned in engine-source.json). scripts/build.mjs copies its matching committed bundle; public/transport.mjs uses HttpEngineClient and sw.js uses controller.worker.js. server.mjs now supports an explicit HTTPS public origin and /health; Dockerfile and .dockerignore package only runtime files. fly.toml specifies the two always-on 1 GB iad Machines. Nine Node tests pass and Fly configuration validates. Local browser smoke test loaded Example Domain with the new engine. Deployment verification is pending. This supersedes the earlier local-only release scope. Prior source archive retained locally under .project-memory/releases for rollback.

## Hosted release verified

2026-10-20: https://frost-browsing.fly.dev is live on image registry.fly.io/frost-browsing:deployment-01M5DVJ568C9YJ2P97R9GERM8C. Exactly two Machines (683e3d9ae17238, 839496c774d638) inspected as started in iad, shared-cpu-1x, memory_mb=1024. Both report autostop=false, minimum running=2, restart always, concurrency connections soft=50/hard=100. Both HTTP health checks pass. Public health returns 200; HTTPS browsing rendered Example Domain using the new engine. Hosted transport contains the reviewed initialization fix.

Independent review found a download-before-navigation initialization issue; fixed by one shared awaited transport initialization. Ten application tests and the upstream WASM/glue test pass (the latter rerun from its required upstream working directory). Review and release checks do not establish maximum throughput or universal website compatibility. The packaged source represents the deployment source; this post-release observation is local documentation.

## Light UI, persistence, fullscreen and announcements

Light-only settings replace dark/system choices. Tabs and active selection now persist alongside history. Announcement publishing uses an authenticated owner Fly CLI command; public API is read-only. Banner uses a custom SVG claw hammer, not emoji. No live announcement text was supplied, so production banner remains hidden until publishing.

Fourteen tests pass, including unauthorized announcement mutation rejection, corrupt session recovery and long back/forward history restoration. Browser verified a fresh page restores two tabs with active selection. Native fullscreen was blocked in browser automation; added site-fill fallback with an exit button/Escape, preserving the user's requested site fullscreen within the app. Home/error states clear fullscreen. Deployment pending.

Rollback image before this change: registry.fly.io/frost-browsing:deployment-01M5DVJ568C9YJ2P97R9GERM8C. No backend database migration; new frost.tabs.v1 key is ignored by the previous release. Announcements use app-level environment settings on both Machines; clearing with the owner command removes the banner.

## Isolated TOTP admin console (supersedes CLI-only publishing)

User requested a console in the three-dot menu, TOTP login, access from other devices, and a new CloudFront distribution. Implemented admin/ with an isolated HTTPS origin, IAM/OAC-protected Lambda, and shared encrypted DynamoDB state. Enrollment is gated by a private random setup link and confirmed TOTP; no public enrollment, no frontend secret, no proxy-origin admin authentication. Attempts and replay protection are atomic. Sessions are 15-minute opaque random tokens held in memory. Both Fly Machines read the same public announcement and retain their existing always-on configuration.

Independent review corrected deployment-region consistency and offline logout locking. Sixteen tests pass including enrollment rejection, invalid codes, reused codes, sessions, expiry, logout, unauthorized publication, origin rejection, limits, tab restoration and long-history positions. Browser verified site-fill fullscreen entry and exit. AWS template validates; CloudFront rollout and owner enrollment remain pending.


## CloudFront main-site correction
The existing d29bikvk0kgibf.cloudfront.net address must serve Frost from Fly, including the WebSocket relay. Move the isolated admin frontend to a second distribution while preserving its DynamoDB table and enrolled authenticator. Keep HTTPS origin connections and caching disabled. Only the configured Fly Host and exact browser origins are accepted. Verify the main homepage, real browsing, unauthorized admin rejection, and both Fly health checks. Rollback uses the previous template and Fly image; enrollment state remains retained. Deployment in progress.


## CloudFront routing release, 2026-10-20
Main site: https://d29bikvk0kgibf.cloudfront.net (E2KKFB4JYC2B14), backed by the existing two Fly machines. Admin: https://d2ftxdtd3x015d.cloudfront.net (E1MZU59EXXQJYS). CloudFormation frost-admin reports UPDATE_COMPLETE; DynamoDB and Lambda identities unchanged. Owner confirmed Console unlocked before migration; enrolled=true independently verified. Same authenticator remains valid, but the new admin origin requires a fresh login. Admin menu opens the new address. No live announcement published.

Sixteen tests pass, including exact allowed CloudFront relay origin and rejection of other origins. Browser loaded Example Domain through main CloudFront. Admin public announcement GET200, unauthenticated publish401, direct Lambda403. Both Fly health checks passed after routing rollout. No universal site compatibility or load-performance claim.

Changed server.mjs, fly.toml, scripts/admin-template.mjs, admin/stack.json, admin/deploy.sh, test/deployment.test.mjs and project docs. Additional user-requested tab identity changes: public/index.html and public/app.mjs use fixed Home | Schoology title, public/favicon.png is the supplied P image, server.mjs serves PNG MIME. Source archive regenerated. Final favicon release image: registry.fly.io/frost-browsing:deployment-01M5DY30JDY9WA4FDPC7AP49AM. Prior working routing image: registry.fly.io/frost-browsing:deployment-01M5DXY1M3QMY7CE7QTNHCA6TQ. Roll back app changes with prior image while retaining current CloudFront/admin environment; pre-routing rollback additionally requires restoring prior stack template and config.origin.

Final live identity check: Home | Schoology remained exact after a proxied page loaded and after returning Home. Favicon GET200 image/png; SHA256 matches supplied PNG exactly (24,946 bytes). Latest Fly rollout completed with both machines healthy. Temporary setup files removed after enrolled=true verification. Main and relocated admin tabs retained as deliverables. Evidence: .project-memory/evidence/frost-cloudfront-home.png and frost-cloudfront-browsing.png.

User requested five additional main-site CloudFront distributions, sharing the existing Fly machines and isolated admin console. Clone the established main-site behavior; explicitly allow each assigned HTTPS origin for the relay. Existing addresses remain supported. Verify five homepage/health/relay endpoints. Rollback removes only the five new template resources and restores previous server image/environment. Deployment pending.

Online status: estimate active browsers with an anonymous per-origin ID, heartbeat20s/expiry75s. Deduplicate tabs per origin. A bounded in-memory collector on existing machine683e3d9ae17238 combines both machines; no browsing history collected. Restart rebuilds count, outages display unavailable rather than zero. Show machine answering latest status request (load-balancing may change it). Other origins/browsers count separately.

Five additional CloudFront addresses now return homepage200, health200, and WebSocket relay101. Presence verified with identical visitor ID on both Fly machines: both returned online1, with distinct correct server labels.18 tests passed; independent review corrected Dockerignore to include presence.mjs. Release image registry.fly.io/frost-browsing:deployment-01M5E02FZZCX9CHPHXE1SF1VGF rolled out healthy on both machines. Rollback image registry.fly.io/frost-browsing:deployment-01M5DY30JDY9WA4FDPC7AP49AM; remove extra origins if rolling back code, since old server accepts only the original address. Additional distribution deployment propagation still being checked.

Final verification: all five additional distributions report Deployed. Each returned homepage200, health200, relay101. Real Example Domain browsing succeeded on additional1; live footer showed2online and Server: Ashburn1. Shared-counter checks returned1online from each machine with the same visitor ID. All18 tests passed. Evidence: .project-memory/evidence/frost-online-server.png. Files changed: presence.mjs, server.mjs, public/app.mjs, public/index.html, public/style.css, fly.toml, Dockerfile, .dockerignore, scripts/admin-template.mjs, admin/stack.json, test/deployment.test.mjs, test/presence.test.mjs, public/source.zip, and docs. Main/admin origins and enrollment retained.

Link containment: normal links remain in the current Frost tab; target-blank/named links, modified/middle clicks and HTTP(S) window.open requests route through internal tabs. Top/parent links remain contained. Form submissions stay in their frame to preserve POST data. Downloads keep download behavior. Admin remains intentionally separate. Native context-menu commands are controlled by the host browser; blank-popup WindowProxy/OAuth flows are not fully emulated.

2026-10-21 release verified: both Fly machines healthy on deployment-01M5GMHJMFJ525PJX6KXYF28TT. Main CloudFront health and routing module HTTP200. Live Ctrl-click opened an internal background tab; local middle-click and ordinary navigation verified. All21 automated tests pass; independent review clear. Evidence: .project-memory/evidence/frost-internal-tabs.png.

2026-10-22 browser ban implementation: owner TOTP endpoints /device/ban,/device/unban,/device/status; public boolean /device/check/:uuid. HttpOnly host-only browser cookie; per-origin limits explicit. 26 tests passed including live WebSocket disconnection and TCP reset during pending authorization. Admin deployed first and boolean endpoint verified200. Fly pending. Rollback Fly image deployment-01M5GMHJMFJ525PJX6KXYF28TT first, then restore previous admin CodeKey if needed; retained ban records are additive, no enrollment mutation.

Browser-ban rollout: admin CloudFormation UPDATE_COMPLETE; /device/check syntheticUUID returned200 boolean only; Fly deployment-01M5HNCHZ901FC3RYJ3V205WT2 healthy on both machines. Live /api/device200 issued Secure/HttpOnly cookie through main CloudFront. Owner unlocked console; ban controls visibly present. Browser automation stalled on native confirm dialog during synthetic client test; no ban applied at last status check. Live synthetic relay opened successfully but timed out waiting for the UI confirmation. Automated disconnect and reset regression remain passed; do not count timeout as a successful live ban.

2026-10-23: created private GitHub repository https://github.com/garrett-warin/frost. Frost now has its own Git root, with upstream pinned as a submodule. Local evidence, generated archives, credentials and obsolete engine checkout excluded. Owner requests keyboard-smash commit messages.

Frosty visual revision (local, 2026-10-23): replaced shaded mascot with a two-snowball outline drawing, reused Frost wordmark paths with a hand-drawn y, flattened the panel to existing site colors/type, and removed promotional empty-state copy. Opening/thinking/success use a separating jump with spring landing and no rotation. Reduced motion resets both segments. 32 existing tests passed; additional motion regression verifies separation, settling, no rotation and reduced-motion reset. Live provider remains unconfigured. Not deployed.

2026-10-23 Frosty page revision (local only): replaced floating panel with dedicated /#frosty page and sparkle toolbar entry; browser tabs stay mounted. Added hand-driven head screw-in jump and replayable preview at /frosty/preview.html. User configured the API key locally; key presence checked without printing it. Tiny direct-provider smoke: Gemma returned429; North Mini Code returned200 with nonempty content. Independent review found reopen animation not resetting state; fixed close to reset idle. No Fly deployment or production secret change. Final browser/full-suite results follow.

Final local verification: all35 Node tests passed; JavaScript syntax and diff whitespace checks passed. Browser verified sparkle route, Back to Frost, retained chat/model, direct-route reload, unavailable page-context error, and New chat cleanup. Real North Mini Code streaming returned hello from frosty through the UI. Page and animation preview visually checked in390x844 iframe viewports (not a physical mobile device). Preview replay and scrub verified independently. Evidence: frosty-page.png, frosty-page-narrow.png, frosty-hands-preview.png under .project-memory/evidence. Local server remains on3104; not deployed.

2026-10-23 latest Frosty simplification (local, verification pending): user replaced the prior head screw-in design with a minimal two-snowball outline, dot eyes and small nose; arms, buttons, mouth and shadow are removed. Keep a small intact hop and the dedicated /#frosty page with sparkle entry. Remove the animation preview page, controls and navigation link. Earlier dated preview evidence above is historical, not the current design. Runtime verification for this revision is still pending; no deployment or provider configuration change is part of this revision.

Minimal-mascot verification: three targeted motion/route tests passed; assistant JavaScript syntax passed. Browser inspected retained chat with simplified snowman and no preview link. All three removed preview URLs return404. Evidence: .project-memory/evidence/frosty-simple.png. Local-only update; no deployment.

2026-10-23 Frosty release preparation: latest-reply mascot placement added before deployment.35 tests and production asset build passed; independent release review found no blocker. Target frost-browsing existing machines683e3d9ae17238/839496c774d638, iad,1024MB, autostop off. Rollback image registry.fly.io/frost-browsing:deployment-01M5HNCHZ901FC3RYJ3V205WT2. No database/admin migration; AI configuration is additive. Default new visitors to tested North Mini Code; retain Gemma in picker. Deploy and live verification pending.
