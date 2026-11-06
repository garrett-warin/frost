# Current Grove deployment

Production runs on OVH, not Fly or Lambda. CloudFront provides public entry links; PostgreSQL is authoritative. A GitHub push updates source only.

## Build

```sh
git submodule update --init --recursive
npm ci
npm run verify:release
npm run build:ovh
```

Requires Node.js 22.9+, Python 3 and Git. Python must be available as `python`, or set `PYTHON`. Move any old `.project-memory/ovh-release` aside before building. Output contains `app/` and `browser/`, adapted account/admin bundles and the pinned engine. Run `npm ci --omit=dev` within both staged runtime directories when installing on a new host.

The assembler excludes production credentials, environment files, database contents and gateway configuration. Preserve live Caddy routing and origin keys; historical migration templates do not replace them.

## Release and rollback

Record deployed hashes and back up code before changing it. Compare staged output with live files and stop on unexpected drift. Upload only reviewed code/assets and update dependencies if their lockfiles changed. Preserve production environment files, Caddyfile, compose.yaml, gate, PostgreSQL volumes and secrets.

Replace intended files atomically beneath `/opt/frost/production/app` and `/opt/frost/production/browser`. Restart affected services from `/opt/frost/production` using `docker compose restart accounts admin browser`.

Run `node smoke.mjs` inside accounts/admin containers and `python migration/verify-live.py` locally. Also verify authenticated sign-in, Open Grove, restrictions, support, notifications and changed UI. Health routes alone do not prove authenticated workflows. Existing pages may need a reload.

Rollback restores the exact pre-release code backup and restarts affected services. Do not roll back account data with code or reactivate AWS as another database writer.

The November 6 repository sync does not deploy or modify the running site.
