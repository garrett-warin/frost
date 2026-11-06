# Frost OVH runtime

The migration preserves the actual live browser archive and AWS account/admin bundles. The repository's older source tree is **not** a drop-in replacement for those artifacts. `build-live.py` and `build-browser.py` enforce captured hashes and adapt only the infrastructure boundaries. Private artifacts and credentials are outside Git.

## Production

- VPS: `vps-273aa89f.vps.ovh.ca`, Debian 13, one server in Beauharnois.
- Runtime: `/opt/frost/production`, Docker Compose project `frost-production`.
- Caddy accepts only CloudFront requests carrying the appropriate service key and public hostname. Accounts and admin remain separate public origins.
- PostgreSQL is authoritative for accounts and admin. No public database port or private bridge port is published.
- A file at `/opt/frost/production/gate/paused` closes the gateway for maintenance.
- `FROST_JOBS_ENABLED=true` on the account service enables minute samples, five-minute monitors and hourly expiry cleanup.
- Existing CloudFront addresses remain usable; the Google Form webhook address is unchanged.

## Operations

Run commands over the owner's dedicated SSH key; never paste keys or environment files into chat or commits.

```sh
sudo docker compose -f /opt/frost/production/compose.yaml ps
sudo systemctl status frost-backup.timer
sudo /opt/frost/backup.sh
```

Backups are encrypted with an age public recipient under `/opt/frost/backups`. The recovery private key is on the owner's PC, outside the repository. Daily backups stay on the VPS; copy them to an independent destination for disaster recovery. Initial database and configuration snapshots were also copied to the owner's PC. Do not delete recovery keys. Check disk usage and backup success regularly.

## Deployment and rollback

Do not run the repository's Fly deployment as an OVH deployment. Build and test replacement artifacts against the current OVH runtime, preserve the current version, then replace only intended files and recreate affected services. Preserve secrets, database volume and signing/encryption settings.

`cutover-aws.py` has explicit stages rather than an automatic full switch. It rejects code/environment drift, drains in-flight writers, exports fresh state, compares CloudFront configs, and marks the boundary before OVH accepts writes. After `opened.marker` exists, the old AWS state is stale: freeze OVH and reconcile new writes before any rollback. Never enable two independent authoritative databases.

One VPS has no host failover. The retained Fly machines do not automatically replace the OVH database or account services.

## Verification

`postgres.test.mjs` requires a disposable real PostgreSQL database. `rehearsal-flow.mjs` refuses production and exercises synthetic accounts only. `verify-live.py` checks all 18 public routes; `--paused` verifies the maintenance gate. `check-gateway.py` temporarily opens the gate and is **pre-cutover only**, never run it against live production to test maintenance.

## November 4 account/admin update
Account/admin now use current tested repository source, built with scripts/build-platform.mjs and scripts/build-admin.mjs then adapted by build-source-update.py. The browser engine still uses the pinned migrated artifact with reviewed file overlays. Do not rerun the original migration build to replace newer deployed features.

## Replacement dispenser
New dispenser: https://d3mwcpxtmhbydi.cloudfront.net/ (EQH6FTYCK3TNP). Keep https://d3mbml114oiqni.cloudfront.net/ as a compatibility alias for existing host-only sessions and the Google Form callback. Account state is shared; sessions/CSRF origins remain separate. New-host visitors verify once. Rollback files: /opt/frost/releases/before-dispenser-20261104. Restore the canonical deployment-config and browser environment without rolling back user records. Validate Caddy in an isolated container before replacing the live configuration.
