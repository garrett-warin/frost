# Maintenance notice

Reuse existing authenticated admin publish routes, DynamoDB store and public announcement delivery. Shared admin/maintenance.mjs validation serves account-admin and TOTP routes, preventing validation drift. public/maintenance-banner.mjs renders only text and checks every 15 seconds with a five-second timeout. Notice begins immediately for upcoming work; start/end change wording and visibility. Dates use viewer locale/timezone. Failure retains a previously fetched notice only until its expected end. Fresh loads cannot display a notice if the entire serving site is offline.

No shutdown behavior, new IAM permissions or browsing-history collection. Review found checkbox inherited full-width input styling; explicit compact checkbox rule fixed it. 13 focused tests independently passed. Previous Fly image deployment-01M6212FGS3W6G34TEBC1MD1VT; Lambda backups are in CloudShell frost-maintenance timestamp directories.
