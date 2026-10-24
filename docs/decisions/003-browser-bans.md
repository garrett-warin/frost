# Browser ban enforcement — 2026-10-22

Reuse the existing TOTP session/origin guards and retained DynamoDB table; store one additive ban record per UUID. No new service, IAM scope, fingerprinting library, or visitor directory. A host-only HttpOnly cookie identifies a browser on one Frost address. Clearing cookies, private browsing, or another origin creates a different identity; physical-device bans are not promised.

The owner supplies a full browser code, checks status, and bans/unbans with a private note. Public checks return only a boolean. Fly checks before a WebSocket upgrade, caches results for10seconds and rechecks active sockets every15seconds. Failed checks deny relay access; a sustained admin outage therefore interrupts browsing. Retain health and admin navigation independently.

Deploy admin code first, verify its public status endpoint, then Fly. Roll back Fly first to deployment-01M5GMHJMFJ525PJX6KXYF28TT before reverting the admin code. Ban rows may remain; old code ignores them. No authenticator, CloudFront origin, IAM policy, or machine sizing change.

Verification:26 automated tests and independent security review; test TCP resets during asynchronous access checking, new/active relay bans, status cache expiry, auth/origin rejection, and private-note isolation. Owner acceptance: enter a test browser code in the TOTP console, ban and observe disconnection, then unban/reload. This is browser-scoped moderation and not robust anti-evasion.
