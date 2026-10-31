# Account platform implementation

2026-10-25. User approved both supplied platform specifications and an `/admin` entry on every main Frost origin that redirects to the existing isolated TOTP console.

## Architecture and boundaries

- Keep vanilla Frost UI, Node/Fly browsing runtime, existing TOTP enrollment and admin DynamoDB table.
- Reuse AWS Lambda, DynamoDB transactions/TTL and CloudFront for a separate dispenser. One new account-state table is authoritative for all Frost IDs, sessions, assignments and reports; it is not a second account database.
- Account management and owner authorization stay on isolated origins. Main browsing origins receive only restricted browsing sessions; they never receive owner sessions, account-refresh credentials or Google credentials.
- Google Forms verified-email events complete pending registrations via signed, idempotent webhook. The same signed Google Form flow supports returning users and recovery; no OAuth login is used. Neither integration may fake readiness before owner configuration.
- Refresh credentials are hashed, rotated, scoped to device families and revocable. One-time handoff codes are destination-bound and exchanged server-to-server. Status is rechecked on protected requests.
- Monitor only registered Frost infrastructure; no alternate-domain generation or recovery for network-policy blocks. Reassignment requires confirmed infrastructure failure and owner approval.

## Milestones

1. `/admin` redirect/menu entry and regression tests.
2. Transactional account/session/assignment backend with deterministic tests and real DynamoDB adapter.
3. Isolated dispenser and admin views, Google Forms script/email-code setup, settings/devices/support flows.
4. Endpoint health worker, audit/retention/notifications and failure-path verification.
5. Infrastructure packaging, independent security review, rendered UI checks and staged deployment. Enable mandatory sign-in only after real owner-configured registration/recovery/handoff checks pass.

## Release prerequisites

Owner Google Form with VERIFIED collection, Apps Script trigger and webhook secret; AWS deployment access. Preserve live browsing until these prerequisites are verified. Record incomplete external setup explicitly.

Rollback retains the current Fly image `registry.fly.io/frost-browsing:deployment-01M5NXT0CTA1SYP74QTFTJ9SRZ`, existing admin distribution and TOTP records. New account records are additive and must be retained on stack removal.

## Added scope and current boundary, 2026-10-25

Save current tabs and website cookies per account, encrypted and revision-controlled; keep navigation history local. Device grants have no server inactivity expiry, use rotating credentials and remain revocable. Bans deny browsing and point to dispenser appeals. The user confirmed Google is not set up and requested owner setup files; these are now in platform/google-form/, platform/.env.example and docs/ACCOUNT-SETUP.md.

The existing engine accesses controller hooks through a same-origin parent. Moving its containing iframe alone would not isolate account data. Finish a verified controller/runtime bridge before connecting account-access.mjs or synchronizing the vault. No live account integration, infrastructure provisioning or deployment has happened yet. The backend, dispenser UI source and Lambda packaging are intermediate milestones, not completion of the full specifications.
