# Isolated-site domain preparation

DNS and certificate preparation is complete; runtime activation remains disabled. This is not a working full-storage-sync release.

Reproducibility instructions (already completed): DNS records are listed in dns-plan.json. Add only these explicit labels after checking no conflicts; do not modify the existing root wildcard, frost redirect or email records. DNS records alone must not grant browsing/account access. Retain existing gateway deny behavior until origin-scoped runtime authentication is implemented and verified.

Use DNS validation for the wildcard certificate. A renewable setup needs a narrowly scoped Cloudflare token (garretts.space only; Zone DNS Edit and Zone Read), stored root-only outside source and container images. For any replacement credential, obtain action-time authorization before creating it; the current credential was explicitly approved and installed on 2026-11-05. Never pass credentials on a command line or print them. A DNS-only wildcard avoids dependence on Cloudflare edge certificate depth, but requires a publicly trusted origin certificate.

Keep the existing protected CloudFront gateway. Add the new virtual host only after TLS and isolated-runtime tests pass. No proxy route or live-account vault endpoint is enabled by this plan.

Current certificate: /etc/letsencrypt/live/frost-isolated-sites/ on OVH. Installed Debian certbot and python3-certbot-dns-cloudflare; root-only credentials are under /etc/frost/secrets/cloudflare-certbot.ini. certbot.timer renews certificate files. Gateway mounting and post-renewal reload integration remain pending and must be tested before use. No live application routing changed.
