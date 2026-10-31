# Frost project index

Read in order:

1. [Current state](CURRENT.md)
2. [Product intent](PRODUCT.md)
3. [PRD](PRD.md)
4. [Acceptance](ACCEPTANCE.md)
5. [Code map](CODEMAP.md)

Supporting records:

- [Terms of Service draft and publication notes](TERMS.md)

- [Local runtime and upstream reuse](decisions/001-local-runtime.md)
- [2026-10-20 implementation worklog](worklog/2026-10-20.md)
- [Run and build instructions](../README.md)

Status: browser workspace and handmade-theme checkpoints verified within the recorded scope; broader compatibility limits remain documented. Last updated: 2026-10-20.

- [Engine migration and Fly hosting](decisions/002-fly-engine-migration.md)

- [Owner announcement publishing](ANNOUNCEMENTS.md)

- [CloudFront addresses and online status](CLOUDFRONT.md)
- [Browser ban enforcement](decisions/003-browser-bans.md)

- [Frosty API configuration](FROSTY.md)

- [Frosty Groq Free decision](decisions/004-frosty-groq.md)
- [2026-10-23 provider worklog](worklog/2026-10-23.md)

Latest status, 2026-10-23: Groq Free switch accepted before deployment; key entry, provider verification and rollout pending.

## Current account work — 2026-10-25

- [Account platform plan](plans/account-platform.md)
- [Google and account setup](ACCOUNT-SETUP.md)
- [Account security and persistence decision](decisions/005-account-platform.md)

This supersedes older pending-provider status above: Groq was deployed in the preceding release. The isolated account infrastructure is deployed with registration disabled; Google webhook connection and live browser integration remain pending. See CURRENT.md first.
- [2026-10-25 account worklog](worklog/2026-10-25.md)
- [2026-10-26 account entry clarity](worklog/2026-10-26.md)

- [Owner dashboard reuse](decisions/006-admin-dashboard.md)

- [Account-based dispenser admin](plans/account-admin.md)

- [Timed suspensions](decisions/007-timed-suspensions.md)
- [Timed suspension release](worklog/2026-10-28-timed-suspensions.md)

- [Maintenance notice](decisions/008-maintenance-notice.md)

- [New-tab customization and templates](plans/customize.md)

- [October 29 replacement browsing links](FROST-LINKS-2026-10-29.md)

## Latest local work — 2026-10-31

[Admin browsing history decision](decisions/009-browsing-history.md) and [verification / changed files](worklog/2026-10-31-browsing-history.md). Local only; 154 tests pass.

2026-10-31 source publication: prepared on `codex/admin-browsing-history` at owner request, including prerequisite account platform code missing from main. Earlier local-only statements describe the pre-publication checkpoint. Hosting remains unchanged; no merge or deployment performed.
