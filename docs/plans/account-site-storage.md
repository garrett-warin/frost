# Account site-data sync

Status: garretts.space selected; scoped credential installed, DNS provisioned and wildcard certificate issued on OVH. Isolated runtime and sync implementation not yet complete. Requested 2026-11-05: website data follows each Frost account across devices.

## Findings

The encrypted platform vault currently validates tabs and cookies only, with a 200 KiB aggregate limit. The current main browser does not invoke the vault. account-access.mjs deliberately excludes account-storage APIs; platform/internal.mjs does not grant the browsing server key vault access. Website frames use allow-scripts plus allow-same-origin and share the browsing origin. Engine local/session storage is host-prefixed; IndexedDB is origin-prefixed. These names are not an access-control boundary. Do not expose the whole vault to the shared browsing origin.

## Implementation order

1. Confirm usable wildcard domain/origin provisioning; keep current CloudFront entry addresses. Separate trusted Frost account/shell operations from website frames, and separate website storage origins. Verify frame, worker, redirect, postMessage and navigation behavior with the existing pinned engine before any cutover.
2. Define a versioned snapshot contract for cookies, local storage, per-tab session storage, IndexedDB schemas/records and eligible Cache Storage entries. Preserve structured-clone values through a maintained serializer after compatibility/license review. Browser-managed permissions, DRM material, non-exportable keys and installed service-worker registrations are not portable; do not promise literal all-data restoration.
3. Use authenticated account-bound encrypted snapshots with bounded per-site/total quotas, revision checks and previous-snapshot recovery. Never log storage contents. Do not merge two live database snapshots blindly. Reject unsupported values/oversize snapshots visibly without replacing the previous working snapshot.
4. Restore before loading the target site. Serialize saves per origin, detect concurrent-device updates, isolate accounts on shared devices and clear only correctly scoped local data when changing accounts. Provide sync status, retry, conflict resolution and delete controls.
5. Test synthetic cookies, local/session storage, IndexedDB indexes/binary/blob/date/key paths, cache response restore, deletes, quotas, conflicts, interrupted uploads, account isolation and hostile cross-site/frame access. Verify mirror reassignment and two-device restore in browser. Deploy only after isolation and recovery checks pass.

No data migration, new vault endpoint or application deployment performed. Domain preparation progressed separately as recorded below. Owner explicitly selected garretts.space and completed Cloudflare sign-in. DNS dashboard access verified on 2026-11-05.

## Domain preparation

Use frost-sites.garretts.space and *.frost-sites.garretts.space for the isolated runtime namespace, with DNS-only records targeting the existing OVH server. Keep CloudFront shell/account/admin addresses. The existing frost.garretts.space record serves a Form redirect and the root wildcard serves other applications; neither may be replaced. Existing mail records remain untouched.

A certificate for *.frost-sites.garretts.space requires DNS validation. Proposed renewable certificate uses a Cloudflare token restricted to Zone DNS Edit and Zone Read for garretts.space, held root-only on OVH; this necessarily permits DNS changes across that zone, not just the Frost labels. Creating that security-sensitive credential needs action-time confirmation. Owner approved token creation and private OVH installation on 2026-11-05; completed with active-token and root-only permission verification. Do not switch live clients before isolated engine and storage tests pass.

References: https://caddyserver.com/docs/automatic-https and https://developers.cloudflare.com/dns/manage-dns-records/reference/wildcard-dns-records/.

## Domain preparation checkpoint — 2026-11-05

Created Cloudflare user token `Frost isolated sites TLS`, limited to DNS Edit and Zone Read for garretts.space, without expiry, after explicit owner approval. Installed under /etc/frost/secrets on OVH with root owner and mode0600; directory0700. Temporary local transfer removed. No credential content is in this repository.

Added only DNS-only A records frost-sites.garretts.space and *.frost-sites.garretts.space to 148.113.156.154, TTL300. Both base and synthetic wildcard hostname resolve through public resolver1.1.1.1. Existing DNS untouched.

Reused Debian Certbot4.0 and official Cloudflare DNS plugin, avoiding a custom Caddy build. Certificate frost-isolated-sites issued for both names, expires2027-02-03. Root-owned credential INI stays outside source; certbot systemd timer handles renewal. Gateway has NOT been changed to mount or serve this certificate. A deployment/reload hook is still needed when the runtime gateway is activated.

All18existing public routes passed after provisioning. No application tests rerun because no application source changed. Isolated engine, authenticated per-site capabilities, snapshot synchronization, restore/conflict tests and production cutover remain unfinished.

Rollback for this preparation only: remove the two exact newly-created A records and revoke only the named TLS token; retain existing domain records and application containers. Certificate artifacts may remain unused. Do not revoke until no active renewal/deployment depends on it.

Independent preparation review: no blocker for inactive DNS/certificate milestone. Per-site subdomains remain same-site under garretts.space; before activation preserve host-only auth cookies, reject parent-domain cookie contamination and verify hostile-frame isolation.

Renewal verification: certbot renew --cert-name frost-isolated-sites --dry-run --non-interactive --no-random-sleep-on-renew exited0; all simulated renewals succeeded. Timer enabled and active. Both secret files root600 and parent directory root700 verified. Initial dry-run was stopped during its randomized delay and restarted without delay; no live services stopped.
