# Terms of Service draft

2026-10-31: Added public/terms.html and terms.css, linked from main new-tab and account footers. The platform builder packages the same files for the isolated account site. Draft only; not deployed and not yet effective. No forced consent, authentication, retention, or moderation behavior changed.

Owner review before publication should establish the service operator, applicable eligibility requirements, effective date, notice process, and a separate accurate privacy notice. No jurisdiction, arbitration clause, registered copyright agent, or no-logging promise was invented. Software license rights remain separate.

Drafting references: https://www.ftc.gov/business-guidance/privacy-security (honor privacy promises); https://www.copyright.gov/dmca-directory/faq.html (do not imply an unregistered designated agent).

Validation: existing not-found route test passed (1/1); unauthenticated HTTP GET /terms.html and /terms.css returned 200 with correct content types; node scripts/build-platform.mjs passed. Browser preview attempt timed out, so visual verification remains outstanding. No deployment performed.


2026-10-31 versioned terms: updated disclosure distinguishes planned administrator history access from current local-only history. No history collection added. Build derives terms version from normalized document SHA-256; explicit authenticated CSRF-protected acceptance records version/time on account. All handoff, redemption, browse checks, refresh and ongoing connection checks require current acceptance. Account support, appeals, logout and deletion remain accessible. UI offers explicit unchecked agreement and account-options alternative. No production deployment or GitHub push for this change.

## Admin browsing history — 2026-10-31

Local implementation, not deployed or pushed. Supersedes the earlier planned/local-only history statements. After current terms acceptance, newly observed visits are sent through the authenticated browsing adapter to the existing account store. No local history backfill. Authorized staff and the TOTP owner can view the latest 100 visits within 30 days from Accounts > Browsing history; reads are audited. URL credentials, queries and fragments are stripped, titles are bounded, times are server-recorded, expired entries are filtered/pruned, and account deletion removes the row. Client reporting is best effort, not a comprehensive or tamper-proof activity log.

Verification: 154/154 tests pass; admin and platform Lambda builds pass. Independent review found no remaining blockers; suggested adapter tests were added. Desktop and 390px synthetic browser dialog inspected, HTML title rendered literally, Close restores focus. No real history collected or real consent submitted. Evidence: `.project-memory/history-test-results.txt` and `.project-memory/history-mobile.png`.

Release remains pending: coordinate account Lambda, admin Lambda and browsing app deployments so terms/hash/gate and collector agree. No schema or IAM change. Preserve current deployment artifacts before rollout; rollback all three components together. New history rows are additive with DynamoDB TTL; stop the collector on rollback and preserve deletion handling or explicitly remove retained synthetic history before retiring it. Earlier deployment artifacts and unrelated pending work were not modified through a release.

2026-10-31 source publication: prepared on `codex/admin-browsing-history` at owner request, including prerequisite account platform code missing from main. Earlier local-only statements describe the pre-publication checkpoint. Hosting remains unchanged; no merge or deployment performed.
