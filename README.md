# Grove

Current production runs on OVH with PostgreSQL and Caddy; CloudFront provides public entry links. This repository was reconciled with live source on November 6, 2026. The older Fly/AWS instructions below are historical. Use [the current OVH guide](docs/OVH-DEPLOYMENT.md) and `npm run build:ovh`.

Frost browser workspace, account/dispenser backend, and administrator console.

Requires Node.js 22.9+, npm, Git, and the pinned engine submodule.

```powershell
git clone --recurse-submodules https://github.com/garrett-warin/frost.git
cd frost
npm ci
npm run build
npm test
npm start
```

Local secrets belong in `.env`, never Git. Production keys remain on OVH, outside source control.

## Releases

Read [the deployment guide](docs/DEPLOYMENT.md) before publishing. A GitHub push does not deploy production.

- `npm run verify:release` checks a clean checkout, builds browser and AWS artifacts, runs tests, and packages source.
- Docker builds the browser assets and runs tests itself. It no longer relies on ignored local build outputs.
- After adding/removing files: stage them, run `npm run sync:context`, and commit the generated `.dockerignore` too. Only named source files enter the remote build context.
- `npm run build:ovh` assembles current browser/account/admin code without deploying. Follow the OVH guide above.

Browsing history is stored on the server and can be viewed by administrators. The History page displays the notice; current terms have no acceptance gate.

## Source map

- `public/`: Grove browser UI, AI and terms.
- `server.mjs` and `account-access.mjs`: browsing server and access enforcement.
- `platform/`: account/dispenser backend.
- `admin/`: isolated TOTP console.
- `scripts/` and `test/`: builds and automated checks.
- `docs/INDEX.md`: project records.
- `upstream/`: pinned engine submodule.

Frost is AGPL-3.0-only. Preserve upstream and third-party notices. `npm run package:source` creates a source archive from tracked files and excludes private runtime files and untracked work.
