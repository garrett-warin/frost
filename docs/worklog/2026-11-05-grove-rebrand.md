# Grove rebrand

Replace current product-authored Frost/Frosty branding with Grove/Grove AI. Use Grove SVG paths and green surface/accent tokens in browser, accounts and admin. Keep orange outage and blue maintenance distinction. Reuse native components and existing brand asset paths; no new dependencies.

Compatibility: preserve cookie/local-storage keys, IDs, CSRF/private headers, environment variables, service health discriminator, container/database names, domains and old #frosty alias. Do not change past notifications, support content or third-party author attribution. New #ai links and new TOTP enrollment label use Grove; TOTP secret/algorithm unchanged. Reserve grove for new usernames alongside prior reserved names.

Independent review found one missed FROSTY message author, corrected. Existing suite passed 179 tests after updating intended branding expectations. Desktop browser new-tab/AI and synthetic-account page inspected. Browser preview has no AI provider configured; no inference call tested. Release evidence and rollback snapshot under .project-memory/grove-rebrand. Live release verification recorded in CURRENT.
