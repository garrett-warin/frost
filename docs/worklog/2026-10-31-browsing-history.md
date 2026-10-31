# Browsing-history implementation

## Admin browsing history — 2026-10-31

Local implementation, not deployed or pushed. Supersedes the earlier planned/local-only history statements. After current terms acceptance, newly observed visits are sent through the authenticated browsing adapter to the existing account store. No local history backfill. Authorized staff and the TOTP owner can view the latest 100 visits within 30 days from Accounts > Browsing history; reads are audited. URL credentials, queries and fragments are stripped, titles are bounded, times are server-recorded, expired entries are filtered/pruned, and account deletion removes the row. Client reporting is best effort, not a comprehensive or tamper-proof activity log.

Verification: 154/154 tests pass; admin and platform Lambda builds pass. Independent review found no remaining blockers; suggested adapter tests were added. Desktop and 390px synthetic browser dialog inspected, HTML title rendered literally, Close restores focus. No real history collected or real consent submitted. Evidence: `.project-memory/history-test-results.txt` and `.project-memory/history-mobile.png`.

Release remains pending: coordinate account Lambda, admin Lambda and browsing app deployments so terms/hash/gate and collector agree. No schema or IAM change. Preserve current deployment artifacts before rollout; rollback all three components together. New history rows are additive with DynamoDB TTL; stop the collector on rollback and preserve deletion handling or explicitly remove retained synthetic history before retiring it. Earlier deployment artifacts and unrelated pending work were not modified through a release.

Changed files: platform/browsing-history.mjs; public/browsing-history.mjs; public/app.mjs; public/panels.mjs; account-access.mjs; platform/http.mjs; platform/internal.mjs; platform/staff.mjs; platform/owner.mjs; platform/control.mjs; admin/service.mjs; admin/admin.js; admin/index.html; admin/admin.css; generated admin/assets.mjs; public/terms.html; platform/ui/index.html; generated platform/terms-document.mjs; test/browsing-history.test.mjs; test/account-access.test.mjs; docs/{INDEX,CURRENT,PRODUCT,PRD,ACCEPTANCE,CODEMAP,TERMS}.md and this worklog/decision.

## GitHub publication preparation

At the owner's request, publish source on codex/admin-browsing-history based on origin/main a3fd244, preserving newer remote README changes. The snapshot includes prerequisite account/admin/customization code absent from remote main; it is not a history-only diff. No merge, deployment command, live consent, or real history collection is authorized for this publication. Local evidence, generated vendor runtime, dependencies, and environment secrets stay excluded.

The isolated checkout initially lacked generated vendor runtime and failed the existing WASM-serving test (153/154 passed). Reused the existing local runtime artifacts for verification only. The general build script also expects upstream/app/vendor, absent from this checkout; no engine rebuild is claimed. Admin and account Lambda packages build successfully with existing local dependencies.

Publication verification: all 154 tests pass in the isolated branch with the existing generated runtime restored. Both Lambda builds pass. Staged files exclude local evidence, runtime binaries, dependencies and secrets.
