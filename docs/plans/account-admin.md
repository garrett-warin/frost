# Account-based dispenser administration

Owner request: replace TOTP entry for regular admin access with existing verified dispenser sessions, and bootstrap Frost ID fr_a1359b81-1fde-48e7-be73-1cac9a58f425 as owner. Add owner-only grant/revoke controls.

Use the isolated dispenser /admin, reusing the existing dashboard. Server role checks use staff-roster stored in the existing account table on every request, not browser storage. Account-scope session, active account/family and matching CSRF are required. Members and browse-scope credentials cannot administer. Owner cannot be removed or account-deleted through the UI; admins cannot restrict owner or peer admins. Role changes are transactional and audited with actor Frost ID. Removing a role denies subsequent requests; already-authorized in-flight operations can finish.

Existing account analytics/control functions are reused. Only announcement/device operations invoke the existing admin Lambda through an exact-function IAM grant; its direct dispatcher rejects HTTP invocation and unknown paths. Existing isolated TOTP console remains a recovery path; account administrators do not receive its secret or session token. No new visitor OAuth or shared browser-origin admin access.

Release: back up both Lambda bundles, existing account stack template/parameters and roster; provision owner only if exact active account exists and roster is absent. Apply exact-function permission and environment reference using CloudFormation. Publish tested bundles and verify real owner via existing dispenser session. Rollback restores prior bundles/config/roster; never remove browsing gates. New independent review not performed in this side conversation (subagents prohibited).
