# OVH migration plan — 2026-11-04

## Approved target
One active VPS-3 2027, vps-273aa89f.vps.ovh.ca / 148.113.156.154, Debian 13, 6 vCores, 12 GB RAM, 100 GB storage, Beauharnois. Move browsing, accounts, admin and persisted state onto OVH. Keep AWS CloudFront addresses as the public entry points. One VPS has no host failover. Do not retire Fly/AWS application resources before verified cutover and rollback retention.

## Baseline and access
Current Fly image: deployment-01M6MB4VQJQEGEMZTFEJJ93CHT, two healthy iad machines. Migration announcement and popup live; owner authorized global refresh. AWS account/admin source must be extracted from actual live bundles and compared before preparing images: repository history contains narrow overlays and stale configuration. Preserve live features and all signing/encryption/TOTP material without displaying secrets.

SSH key installation completed; dedicated key and recovery material remain outside the repository. Passwordless sudo verified on the intended OVH host.

## Stages and acceptance
1. Access and inventory: verify SSH identity, sudo, OS, disk and memory; inventory live Lambda versions, tables, CloudFront behaviors and existing encryption/signing settings. Retain exact live artifacts for rollback.
2. Prepare runtime: Docker Compose with separate browsing/account/admin processes, reverse proxy and PostgreSQL on internal networks. Only proxy/SSH exposed; origin protection and HTTPS required. Reuse official containers and existing application domain services. Adapt AWS request/response boundaries; never accept public payloads as trusted owner events.
3. Persistence adapters: transactional version checks, atomic uniqueness/session rotation, consistent reads, pagination, expiration cleanup, TOTP replay prevention and rate-limit counters. Test concurrency and rollback against real PostgreSQL. No test-only in-memory storage in production.
4. Rehearsal: encrypted export and verified import into isolated OVH services. Preserve IDs, encrypted payloads, keys, staff roles, bans, suspensions, grants, assignments, notes and notices. Compare counts and hashes without emitting personal rows. Do not allow the rehearsal copy to write to production or run monitors.
5. Cutover: bounded maintenance/write freeze, final export/import, count/hash checks, start a single authoritative database writer and update the existing CloudFront origins. Keep account/admin browsing origins isolated and retain webhook paths. No uncontrolled dual-write period.
6. Verify normal and revoked login, Google Form completion, handoff, browsing HTTP/WebSocket, Frosty, cookie/tab persistence, staff controls, TOTP replay rejection, notices, support, monitoring and restart recovery. Disable the obsolete two-Fly-machine outage probe on OVH; report the actual single-server topology.
7. Backups and rollback: restore-test independent encrypted backups; built-in same-provider backup alone is not a full recovery plan. Retain old images and AWS state. If OVH has accepted writes, pause and reconcile those writes before rollback; never blindly switch to a stale AWS database. Retire old services only after observation and explicit cutover outcome.

## Open prerequisites
- External backup destination/cost decision before final retirement.

The staged timeline below records actual execution. Do not infer completion from the plan alone.

## Verified preparation — 2026-11-04
SSH/key and sudo access verified. Docker29.9.3/Compose5.7.0 installed from Docker Debian repository; hello-world passed. Rehearsal isolated containers have no host-published ports. Active AWS tables identified from live Lambda environments: accounts State-YQU0K03JD9K4, admin State-1NOGACJ0BHP8B. Both on-demand AWS backups AVAILABLE; actual live bundles captured and ZIP hashes pinned in migration/build-live.py. No source rebuild of unrelated features.

All10227 exported account rows and6 admin rows verified field-by-field after PostgreSQL import (including versions and encrypted payloads). Four real PostgreSQL concurrency/isolation tests and two HTTP-boundary tests passed. Synthetic end-to-end test passed registration/verification, single-use handoff, browsing, saved tabs/cookies, account isolation, revision conflict, WebSocket upgrade and active ban disconnection. No real user was moderated.

Production services prepared under /opt/frost/production with a separate EMPTY database, no jobs enabled, and gateway gate CLOSED. Valid HTTPS certificate obtained for VPS hostname. Origin-key, cross-service-key and public-host rejection tests passed; browser TLS route reports ovh-bhs-1. Only80/443 gateway ports published; application containers run non-root with read-only filesystems. No CloudFront changes or AWS writer freeze performed.

Rehearsal pg_dump restored into another database with matching counts (10268 account rows after synthetic tests,6 admin). Encrypted-backup roundtrip passed; encrypted rehearsal backup and recovery key saved privately on owner's PC outside repository. Server recovery private key removed; public recipient retained. Final snapshot and post-cutover offsite backup still required.

CloudFront plan prepared for15 browser distributions plus accounts/admin. Pre-cutover steps in migration/cutover-aws.py preserve before configs/concurrency and reject changed live code/ETags. Scheduler failures now inspect returned HTTP statuses; expiration deletes share namespace locks. See migration/ for adapters and reproducible artifact preparation.

## Cutover in progress — 2026-11-04 23:24 UTC

Both old Lambda writers frozen after verifying code AND complete environment against captured configuration. Waited65seconds for in-flight work. Final exports:9827account-state records,6admin-state records. Transfer SHA256 verified and every imported record matched including versions, expiry fields and encrypted payloads. Production service smoke checks passed. All17CloudFront origin updates submitted; all17public routes return OVH maintenance. Waiting for AWS global Deployed status; OVH gate remains closed and jobs disabled.

Encrypted final database and configuration backups copied to owner's private local backup directory. Daily encrypted VPS backup timer enabled; independent automatic off-server destination remains outstanding. CloudFront comparator normalizes only header casing/order and empty OAC returned by AWS; tests reject altered credentials and routing. Independent reviewer found no blocker.

## Live verification — 2026-11-04 23:29 UTC

All17CloudFront distributions reached Deployed with intended origins; mark-open written before removing the gateway gate. Production scheduler enabled. All17public route checks passed (browser /health reports ovh-bhs-1; accounts/admin return200). Existing owner account cookie survived migration. Actual Open Frost handoff succeeded, an external website loaded inside Frost, and Frosty returned a live Groq response. Admin login remains TOTP-protected; no owner code accessed. No fresh manual Google Form submission or owner TOTP unlock performed after cutover.

Windows default file encoding caused the newly inserted server separator to display incorrectly; browser adapter now explicitly reads/writes UTF-8 and uses an ASCII server label. Rebuilt only the adapted files from the pinned archive; final route checks passed after browser restart. Old migration popup withdrawn; completion announcement published, preserving the owner's temporary sharing request. Screenshot: .project-memory/ovh-migration/live-ovh.png. No scheduler errors observed in the initial minutes. Old AWS writers remain frozen; old Fly and backups retained for observation/recovery. Follow-up: independent automatic off-server backup destination and eventual explicit retirement of old resources.
