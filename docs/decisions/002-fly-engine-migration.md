# ADR 002 — Engine migration and Fly hosting

Date: 2026-10-20. Status: implementation in progress. Supersedes ADR 001's local-only target.

Use garrett-warin/engine commit 23f410dd46d6bfc66cef5cf51e98bb550251d265, its committed matching runtime/WASM/controller assets and HTTP transport. Keep Frost's existing frontend and checked public-destination Wisp relay. The previous engine checkout remains local rollback material and is excluded from builds, source downloads and deployment contexts.

Deploy frost-browsing to the personal Fly organization: exactly two shared-CPU 1-vCPU machines in iad, 1024 MB each, autostop off, minimum running two, always restart. Fly handles TLS and load-aware routing by connection concurrency (initial soft50/hard100; not a measured capacity claim). Long-lived relay connections stay on their selected machine. Browsing state stays client-side; no volumes or cross-machine state replication are required.

Public hosting is expressly authorized by the user. Allow only the configured HTTPS origin/Host for relay upgrades. Preserve public-only DNS destination validation and web-port restrictions. Docker context is an explicit allowlist; no credentials, local evidence, Git metadata, or legacy checkout are included.

Plan: prepare pinned assets and production configuration; test normal HTTP/relay and rejected Host/Origin/private-address cases; independently review; deploy, scale to two in iad, inspect health/config and browse a public page over HTTPS.

Rollback: pre-migration source archive is .project-memory/releases/frost-1.0.0-source.zip with the old local engine checkout retained. For a faulty first remote release, stop both named Frost machines while repairing; do not modify existing unrelated Fly apps. Subsequent rollback can redeploy a previously verified image digest. No server database or migration is involved.
