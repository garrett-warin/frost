# Replacement account dispenser — 2026-11-04

1. Clone the existing CloudFront distribution disabled, preserving routing/security/cache policies.
2. Add strict per-host account-service configuration and session-isolation tests.
3. Back up runtime/configuration; stage the new hostname as an alias without changing the default.
4. Validate protected origin routing, activate CloudFront and verify public HTTPS before switching canonical configuration/browser default.
5. Retain the old distribution and webhook; document fresh sign-in on the new hostname and preserve rollback without reverting user data.

New distribution: EQH6FTYCK3TNP / d3mwcpxtmhbydi.cloudfront.net.
A malformed initial Caddy header matcher briefly interrupted the gateway. The previous file was restored and all 17 original public routes passed. Corrected repeated header matchers were validated in an isolated Caddy container before applying; both account hostnames then passed protected HTTPS checks.

Independent review covered shared-account identity, old/new session and CSRF separation, Google callback compatibility and concurrent initialization; no blocker found. Automated test and live release evidence are recorded in CURRENT.md.
