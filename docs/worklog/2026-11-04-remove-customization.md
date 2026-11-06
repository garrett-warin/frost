# Customization retirement — 2026-11-04

Owner requested removal of all new-tab customization and restoration of original appearance. Removed renderer mount, menu and account entries, template moderation UI, editor files, design service integrations, editor build and interactjs/pngjs dependencies. Existing original markup, wordmark intro, admin note, clock, search, shortcuts and notices remain. Persistent design/template rows are dormant, not purged.

Validation: full suite157 passed; independent reviewer16 passed. Regression tests cover admin lock, malformed URLs, encoded retired paths and stale account editor assets. Both platform/admin builds pass. Browser at localhost3130 shows original layout and menu without Customize. Live Fly, sample mirror, dispenser and admin editor URLs return410. Live app/admin scripts contain no renderer/menu or stale template-lock calls. Evidence under .project-memory/remove-customize/.

Deployment: layer only patched live app/index/server over previous Fly image, physically removing customization assets. Both machines version38 healthy, deployment-01M6M7BSBYN7AS4G1KW2AN3JX0. Initial Depot zstd export failed before rollout; gzip retry succeeded. Account/admin deployed by narrow backed-up bundle patch, preserving other live features including the verification repair. Initial patch assertions stopped before modifying each mismatched bundle; adjusted for actual HTML encoding and assets2 binding, then passed syntax and revision checks.

Rollback: Fly deployment-01M654X1EYZ404QR06E503P4WZ; AWS CloudShell ~/frost-retire-customize-20261104/accounts-before.zip and admin-before.zip. No database migrations or deletion. Existing open clients need a refresh to receive the removal.
