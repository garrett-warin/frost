# Owner dashboard reuse

2026-10-26: Adapt the existing TOTP service and account control methods. Compose AWS Lambda Invoke (official SDK/IAM) rather than introducing a second credential or publicly reachable owner endpoint. Only the admin role may invoke the exact account function; HTTP requests always have requestContext and cannot reach owner dispatch. Existing account control provides audited atomic ban/unban/revoke and ticket replies.

Use existing Fly aggregate presence sampled by EventBridge once a minute. Native SVG renders small accessible charts; no charting framework or analytics vendor is needed. Store bounded hourly minute samples in the existing account DynamoDB table, retained 32 days. Missing values remain unavailable. UTC defines periods. Registered-account history derives from retained account creation dates and explicitly excludes deleted accounts. No new visitor identifiers or browsing history.

Owner accepts by unlocking existing admin URL and inspecting overview/accounts/announcements/support. Release updates account Lambda then admin Lambda/template, preserving tables and enrollment. Rollback restores captured CodeBucket/CodeKey and disables the new sampler; old dispenser/admin assets remain in immutable S3 bundles.

## Browser update requests

Reuse existing TOTP owner bridge, DynamoDB atomic account mutations and 15-second access polling. Keep per-account and global monotonic revisions rather than adding a messaging service or a new WebSocket channel. First observation is a baseline because a newly loaded document already fetched current assets. No new privilege, transport or framework. Commands are cooperative browser updates, not a security enforcement mechanism; same-origin browsed code cannot be prevented from interfering.
