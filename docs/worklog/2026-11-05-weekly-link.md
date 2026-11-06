# Weekly link replacement — 2026-11-05

Reuse existing assignment transaction, endpoint health/capacity selection, account authentication and CSRF protections. Add user.linkRotationAvailableAt, POST /api/assignment/rotate and a native confirmation dialog. No real-account assignment changed during verification.

Files: platform/control.mjs, platform/http.mjs, platform/ui/account.mjs, platform/ui/index.html, platform/ui/account.css, test/link-rotation.test.mjs, project docs. Account bundle only deployed; no admin/browser restart required.

Independent review found two UI issues, both fixed: outdated reporting copy and unnecessary fetch after successful mutation. Full suite 179 passed after all corrections; targeted three tests also passed. Browser using actual account service and synthetic memory store verified warning, successful replacement, reload persistence and disabled cooldown action. Live smoke, 19 public routes, served assets and unauthenticated POST rejection passed. Live authenticated rotation not run to avoid changing customer assignments.

Deployment first attempt failed before installation because Windows converted shell stdin newlines; rerun used bytes. Immediate post-restart smoke raced startup; subsequent smoke passed. Bundle backup /opt/frost/releases/before-weekly-link-20261105/accounts.mjs. Roll back by restoring and restarting accounts. No irreversible data migration. Evidence local .project-memory/link-rotation-release and link-rotation-tests.txt.
