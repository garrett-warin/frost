# Bounded admin browsing history

2026-10-31. Reuse the existing DynamoDB account row/TTL, atomic transactions, scoped signed adapter, staff authorization and TOTP/IAM owner bridge. No new store, permission grant, dependency or logging service. One bounded row per user holds at most 100 sanitized visits; worst-case UTF-8/JSON payload remains below DynamoDB item size. A new per-visit table/index was unnecessary for the requested recent-history viewer.

Titles and paths can contain sensitive data even after URL query/fragment/credential removal. New terms explicitly disclose access and require acceptance. Client-reported visits may be missing or forged by client behavior and cannot prove misconduct. No retroactive ingestion. Thirty-day expiry is enforced on read independent of delayed DynamoDB physical expiry. Clearing browser history is local-only; deleting the account removes the stored row transactionally.

Owner acceptance: review terms, use a synthetic consenting account to visit a page, open Accounts > Browsing history as staff, confirm sanitized URL/title/time, and verify a non-admin cannot read it. Production rollout pending; see CURRENT.md.
