# Account platform and private browsing state

Status: implementation in progress; not enabled in production. 2026-10-25.

The user approved both account specifications and keeping TOTP isolated while exposing `/admin` on main sites. Later requirements add persistent sign-in, account tabs/cookies and dispenser appeals after bans.

Reuse AWS Lambda/CloudFront and DynamoDB transactions/TTL already used by the owner console; one new account table is authoritative across Fly Machines. Use the signed Google Form verification flow for both registration and returning users. The user explicitly rejected OAuth login. Reuse the engine's cookie serialization rather than a second browser cookie implementation. Use Node crypto AES-256-GCM for a small bounded account vault. Maintain app-specific identity/device/assignment logic locally because the requested verified Google Form registration, existing TOTP owner and assigned-link semantics need a shared application state machine. A separate hosted identity service would add another account authority and would not itself implement those workflows. Maintenance belongs to Frost; release acceptance requires real registration, device recovery, revoke/ban and isolation tests.

Dispenser owns account management sessions. Main origins receive only scoped browsing grants through one-use destination/browser-bound handoff. Owner TOTP sessions never cross into a main browsing origin. Internal requests are authenticated with timestamped body-bound HMACs and consumed nonces. Account-changing requests need exact origin plus CSRF and HttpOnly host-only cookies.

Device grants have no server inactivity expiration. Access tokens last fifteen minutes; refresh credentials rotate and are hashed at rest. Used refresh hashes expire after thirty days, while explicit revocation/account epochs block active grants. Browser cookies renew on use but browser eviction/clearing can require login. Verified login retires the least active device at the twenty-device cap; obsolete account epochs cannot prevent recovery.

Vault saves only current tab URLs/titles and engine website cookies, never navigation history/page text. Encryption authenticates Frost ID as associated data so ciphertext cannot be substituted between accounts. Writes require the current revision to avoid silent cross-device overwrites. Website expiration rules remain effective. The server can decrypt this vault; it is encryption at rest, not end-to-end encryption.

Restriction checks block browsing/vault access and return the isolated dispenser's `/appeal` destination. Banned users may authenticate for support. A keyed identity restriction survives restricted-account deletion to prevent immediate re-registration; owner clearing is explicit and audited. No raw email is retained in that tombstone.

Release blocker: the existing engine injects hooks by accessing same-origin parent controller objects. Simply embedding the current engine on a second domain is insufficient. Finish a verified cross-origin controller/runtime bridge and isolate untrusted content before enabling account sync. Do not treat existing engine rewriting as a security boundary.

Rollback retains the current Fly image and isolated admin resources; account rows and the vault key must survive rollback. No mandatory authentication or new deployment has happened yet.

## Narrow ban-only release —2026-10-26
Independent review permits server-side browsing authentication before full engine isolation: only scoped HttpOnly grants and minimal allowed/redirect status; no identity/CSRF/storage APIs. WebSocket upgrades and server-side model calls cannot be authorized by a forged service-worker response. A hostile proxied page can falsify local UI or act within its currently authorized browser, but cannot override the server ban. Periodic server-only connection permits recheck account/family/epoch/assignment without rotating cookies on a WebSocket. Fly receives a derived key limited to redeem/refresh/check/connection, not the existing storage signing key. Full cookie sync remains blocked pending isolation.
