# Support workspace revision

Adapt existing account/control transactions, admin bridge, DOM components and device polling; no new dependency or independent ticket engine. Reuse audited assignment eligibility and staff authorization.

Plan: add guarded ticket lifecycle and user ownership; separate queue/chat/audit UI; add minimal admin notification; test concurrency/isolation/anonymous identity and browser interactions; independently review; deploy account/admin bundles and narrowly patch the live migrated browser runtime with backups.

One-open guard is version checked and consulted before legacy scanning. Existing duplicate legacy requests are retained; no new/reopened duplicate is allowed. Messages remain bounded to100 replies of2000 characters per request. User reply rate30/minute. Admin identity stays in audit, never in public reply labels. TOTP is recorded as shared owner, not an invented individual identity. Notification is a cached30-second boolean, no private ticket content at browsing origin.

Rollback must restore saved artifacts, not old database state. New ticket fields are backward compatible; do not remove customer messages. No production customer requests should be modified for testing.

Final verification:171tests, independent review, browser two-way chat/live notification, both service smokes/all18routes passed.
