# Frost

Frost is a handmade winter browser workspace with tabs, bookmarks, history and DuckDuckGo/Bing/Brave search. Google is excluded. Browser data stays in local browser storage.

## Run and build

Clone with `git clone --recurse-submodules https://github.com/garrett-warin/frost.git`. For an existing clone, run `git submodule update --init --recursive` first.

Requires Node 22+. Run `npm ci`, `npm run build`, then `npm start`. Open http://localhost:3100. Local mode binds loopback and validates localhost Host/Origin.

The engine is https://github.com/garrett-warin/engine pinned at 23f410dd46d6bfc66cef5cf51e98bb550251d265. `upstream/app/vendor` contains the matching committed runtime, WASM, controller and HTTP transport. The build copies this bundle and records hashes in public/vendor/manifest.json. Upstream sources and build instructions remain under upstream/. No mixed artifacts from the previous engine are used.

`npm run package:source` packages Frost and tracked upstream sources, including the matching runtime bundle, into public/source.zip. It excludes credentials, dependencies, Git metadata, local evidence and the old engine checkout. AGPL-3.0-only; upstream attribution remains in corresponding source/license records.

## Fly deployment

`fly deploy --remote-only --ha=true` uses fly.toml for frost-browsing. Target: exactly two Machines in iad (Ashburn), shared CPU, 1 GB RAM each. Autostop is off, minimum running is two, restart policy is always. Fly balances new connections by concurrency with soft 50/hard 100 limits; connected WebSockets remain on their Machine. Thresholds are not load-tested performance guarantees.

Production requires PUBLIC_ORIGIN=https://frost-browsing.fly.dev, HOST=0.0.0.0 and PORT=8080. Host and WebSocket Origin validation and public-only DNS destination checks remain enabled. /health supplies the Fly health check. Docker includes only runtime files and runs as an unprivileged user.

## Checks and limits

`npm test`: sixteen tests pass, including production origins, destination restrictions, browser state and address handling. Local engine browsing loaded Example Domain; production verification is recorded in docs/CURRENT.md. Website compatibility varies and rewriting is not a browser isolation boundary. Downloads supports explicit file URLs up to 100 MB; host-browser download enumeration and OS reveal are unavailable.

Rollback: retain the prior image reference after each release and redeploy it with `fly deploy --image <previous-image>`. This first hosted release has no prior hosted image; the previous local source archive is retained in .project-memory/releases. See docs/decisions/002-fly-engine-migration.md for recovery details.


## Announcements and saved tabs

Frost uses light mode only and restores tabs on reopening. History remains saved locally. Use the Site fullscreen button to expand a website and Escape to exit. Data stays within the same browser and origin.

Owner publishing: open Admin Console in the three-dot menu and enter your authenticator code. One-time enrollment is required first. The console runs on a separate CloudFront origin; see docs/ANNOUNCEMENTS.md. No production announcement is published by default.
