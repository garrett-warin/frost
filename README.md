# Frost

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

Local secrets belong in `.env`, never Git. Production keys remain in Fly/AWS.

## Releases

Read [the deployment guide](docs/DEPLOYMENT.md) before publishing. A GitHub push does not deploy production.

- `npm run verify:release` checks a clean checkout, builds browser and AWS artifacts, runs tests, and packages source.
- Docker builds the browser assets and runs tests itself. It no longer relies on ignored local build outputs.
- After adding/removing files: stage them, run `npm run sync:context`, and commit the generated `.dockerignore` too. Only named source files enter the remote build context.
- Fly updates do not update the AWS account/admin services. Coordinate authentication and terms releases across both.

History collection is disabled in production configuration; normal browsing does not report visits. Existing local history remains local. Dormant collection code is not an enabled feature or permission to activate monitoring.

## Source map

- `public/`: browser UI, Frosty, editor, terms.
- `server.mjs` and `account-access.mjs`: Fly app and access enforcement.
- `platform/`: account/dispenser backend.
- `admin/`: isolated TOTP console.
- `scripts/` and `test/`: builds and automated checks.
- `docs/INDEX.md`: project records.
- `upstream/`: pinned engine submodule.

Frost is AGPL-3.0-only. Preserve upstream and third-party notices. `npm run package:source` creates a source archive from tracked files and excludes private runtime files and untracked work.
