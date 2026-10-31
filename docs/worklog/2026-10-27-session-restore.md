# Dispenser session restoration — local fix

The owner reported repeated verification after reload. Source inspection found that `?verify=1` suppressed restoration even when bootstrap confirmed a valid persistent login, and startup rotated refresh credentials on every load. These are reproducible client defects; the reported production failure was not independently reproduced.

`platform/ui/account.mjs` now restores any server-confirmed saved session regardless of that query flag. It loads the account before attempting renewal, coordinates renewal within a page and through Web Locks across supported same-origin tabs, and checks shared cookies again before rotating. A short bounded retry handles rotation conflicts. Revoked credentials still require verification; service failures do not become verification redirects. No backend validation, cookie lifetime, ban enforcement or replay detection was weakened.

Validation: 46 tests passed across account UI, account backend, access adapter and server enforcement suites. New regressions cover reload/verify redirects, concurrent expiry, cross-tab coordination, rotation conflict recovery, revocation and outages. No live-browser verification or deployment performed in this side conversation. Previously revoked sessions cannot be recovered by this client change and will need verification once.

Changed files for this fix: `platform/ui/account.mjs`, `test/account-ui.test.mjs`, this record and `docs/CURRENT.md`. Preserve unrelated pending work, especially the deferred response-sheet integration, when preparing a deployment.
