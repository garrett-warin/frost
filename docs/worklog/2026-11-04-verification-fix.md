# Verification reliability repair — 2026-11-04

Plan: preserve existing verified-email/HMAC boundaries; surface mismatches; retain retryable delivery failures; test recovery; independently review; back up and patch only live verification code.

Found: mismatched emails were rejected without feedback to the waiting user. Script silently discarded some authentication failures, and inspected Google before durably queuing submissions. Existing execution gap alone does not establish the cause of the reported intermittent outage.

Changes: persist only a mismatch category, clear it on success, preserve poll-cookie isolation and show recovery instructions. Queue first, require VERIFIED collection at delivery, retain transient failures, emit safe status-only logs, fail retry executions, discard unusable corrupt entries. Form collection must remain VERIFIED continuously. No new dependency or architecture; adapt existing atomic transaction and queue.

Validation: full npm test 162 passed; independent reviewer 45 focused passed, no remaining blocker. Live Apps Script verifyFrostConnection completed successfully. Narrow live-bundle patch assertions and node --check passed. Live synthetic signed webhook test proved mismatch -> pending/error, correction -> needs_username, anonymous polling -> 401. No account created. Initial probe omitted CloudFront's payload digest and received 403; corrected probe passed. Live /account.mjs contains new error handling.

Release: AWS frost-accounts-Function-qqSxuvfShn08 updated 2026-11-04T20:16:31Z. Original ZIP retained in ~/frost-verification-fix-20261104/before.zip in CloudShell. Restore with aws lambda update-function-code and wait function-updated. Script rollback uses preceding Git Code.gs, no property/secret changes. No Fly change, no full repository replacement.

Open: Google Publish app disabled because Branding incomplete. External Testing has a documented seven-day authorization risk; no evidence that this was the original failure. Public privacy/homepage configuration and production transition remain. Do not invent URLs or weaken verification to avoid this requirement.
