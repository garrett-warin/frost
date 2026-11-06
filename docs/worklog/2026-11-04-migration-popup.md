# Migration popup — 2026-11-04

Preparing-only notice; OVH migration remains paused. Reuses native dialog, existing announcement broadcast and existing admin browser-refresh command. Published banner retains the prior request not to share Frost. No new dependency, secrets, account records or history collection.

Changed public/index.html; added public/migration-notice.mjs, migration-notice.css, migration-notice.json and test/migration-notice.test.mjs. Native modal traps focus; Escape/button acknowledge once per browser origin. Copy uses textContent; bounded validation and eight-second fetch timeout. Hidden tabs defer showing until visible. Independent review identified background keyboard shortcuts and missing fetch timeout; both fixed before release.

Rollback image: deployment-01M6M7BSBYN7AS4G1KW2AN3JX0. Narrow four-file overlay preserves the existing production runtime. Planned release image: deployment-01M6MB4VQJQEGEMZTFEJJ93CHT. Live observation to be appended after rollout.

Release completed: deployment-01M6MB4VQJQEGEMZTFEJJ93CHT on both Fly machines; rolling deployment health checks passed. Direct notice JSON and CloudFront module returned HTTP 200. Nine focused migration/deployment tests passed. Local browser verified modal and acknowledgement persistence across a new page load. Live authenticated mirror displayed the modal and announcement. Owner-authorized global refresh accepted by admin with action-log confirmation. Browser visual check was desktop only; mobile CSS uses bounded viewport sizing but was not separately browser-tested. No OVH migration occurred.
