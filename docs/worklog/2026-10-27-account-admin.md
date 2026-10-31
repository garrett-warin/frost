# Account-based admin release

Need: verified dispenser accounts should open administration without TOTP, and the nominated Frost ID should own admin membership.

Changed source: platform/staff.mjs, platform/http.mjs, platform/control.mjs, platform/handler.mjs, platform/ui/staff-session.mjs, platform/ui/account.mjs, platform/ui/index.html; admin/admin.js, admin/handler.mjs and generated admin/assets.mjs; scripts/build-platform.mjs and scripts/platform-template.mjs. Documentation: CURRENT, PRD, ACCEPTANCE, CODEMAP, INDEX, plans/account-admin.md and this record.

Server-side role authorization, protected owner, transactional membership changes, actor audit for account actions, origin/CSRF checks, account-scoped HttpOnly sessions and removal checks were added. Existing dashboard reused on isolated dispenser /admin. Exact-function IAM bridge handles existing announcement/device controls. TOTP console remains recovery. Initial roster creation verified that the requested account existed and was active before writing, and refused a conflicting existing owner.

112 tests pass. Live owner navigation confirmed Admin link, no TOTP prompt, populated dashboard, announcement read, and owner-only membership controls. No real member grants/removals or moderation changes were performed. Anonymous request denied401. Screenshot .project-memory/account-admin-20261027/owner-dashboard.png. No independent agent review in this side conversation.

Rollback: previous Lambda bundles and CloudFormation template/parameters in ~/frost-account-admin-20261027. Restore both bundles and previous account template/CodeKey while preserving secrets via previous parameter values. staff-roster can remain inert under previous code. Existing browsing gate unchanged.
