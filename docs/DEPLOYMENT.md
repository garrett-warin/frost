# Deployment from a clean checkout

October 31, 2026: GitHub now includes the account backend and newer browser features. The previous missing-code warning described an older revision. This repair does not deploy the site.

Observed live baseline: both existing iad machines were healthy on v37, image `registry.fly.io/frost-browsing:deployment-01M654X1EYZ404QR06E503P4WZ`. Check fresh status before deploying; do not treat this record as current forever.

## Preparation

Run one command at a time and stop on failure:

```powershell
git status
git pull --ff-only
git submodule update --init --recursive
npm ci
npm run verify:release
```

The checkout must be clean. Do not force-push or discard work to bypass that check. When adding/removing source files, stage them, run `npm run sync:context`, then commit the updated context allowlist. Build-generated assets need not be manually uploaded to GitHub.

## Fly browser updates

Record the current image and configuration before deployment:

```powershell
flyctl status --app frost-browsing
flyctl releases --app frost-browsing
```

Test the actual container build without changing production:

```powershell
flyctl deploy --app frost-browsing --remote-only --build-only
```

For a browser-only release:

```powershell
flyctl deploy --app frost-browsing --remote-only --strategy rolling
flyctl status --app frost-browsing
flyctl checks list --app frost-browsing
```

Both managed machines should use the new image and pass checks. Also verify Open Frost, account restrictions, and the changed UI: health checks alone do not prove these work. Existing tabs may need refresh; cached CloudFront files may need invalidation. Do not recreate machines or rotate secrets for routine code updates.

## AWS account/admin changes

Fly does not deploy AWS. Terms, authentication and cross-service API changes require coordinated releases from the same commit. `verify:release` builds the existing account and admin Lambda packages under `.project-memory/`; check build output for exact archive paths.

Before changing AWS, save each current Lambda code ZIP and record function names/code hashes. Preserve environment, IAM and CloudFront settings. Use existing Lambda code uploads or `update-function-code`, wait for success, and verify the served assets. Provisioning scripts and stack replacement are not the routine code-update path.

Release the compatible account service before a dependent Fly adapter, and update the TOTP admin service if changed. Keep terms prose, hash and acceptance UI aligned. Test acceptance, browsing, restrictions and support before declaring success.

Rollback uses the exact prior Fly image with `flyctl deploy --app frost-browsing --image <recorded-image> --strategy rolling`, plus the prior fly.toml if configuration changed. Restore compatible Lambda ZIPs separately. Never guess an image or overwrite secrets while rolling back.

## Privacy boundary

Production history recording is disabled and automatic frontend reporting is removed. No environment switch enables it. Future activation requires a separate clear user consent flow and review; the generic TOS checkbox is not that opt-in.
