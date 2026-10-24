# ADR 004 — Groq Free for Frosty

Date: 2026-10-23. Status: accepted; local provider verification passed, deployment pending.

The owner accepted switching Frosty to Groq Free before deploying. Reuse the OpenAI-compatible streaming path through a provider-specific adapter. Pin Groq's official endpoint and allow only GPT-OSS 20B, GPT-OSS 120B, and Qwen 3.8 27B (preview, images). Use `GROQ_API_KEY` separately from OpenRouter's credential. Never switch providers automatically.

The organization must remain Free; Groq offers no per-request zero-price enforcement. Preserve OpenRouter only as an explicitly selected fallback with its existing `:free` allowlist, zero-price caps, and data-collection restriction. Model choice is not proof of a free account.

Apply conservative text-byte limits before sending: 5,440 UTF-8 bytes without an image or 3,392 with one, including system/history/context. These reserve 2,048 output tokens, 512 framing tokens, and 2,048 image tokens where applicable. Reject excess explicitly instead of silently discarding context. Provider organization quotas remain authoritative and can still return rate errors.

Keep one validated image up to 2 MiB and visible model capability selection. The Qwen option is preview software, so availability/reliability is not guaranteed. No browser tools, reasoning display, credential exposure, database migration, or account upgrade is introduced.

All 42 automated tests passed, including Groq and image coverage. Local browser smoke requests succeeded on both GPT-OSS models and Qwen vision; key securely staged in Fly. Rollout remains pending. Rollback retains image `registry.fly.io/frost-browsing:deployment-01M5HNCHZ901FC3RYJ3V205WT2`; preserve the existing two Fly Machines and admin state. Configuration details and primary sources: [FROSTY.md](../FROSTY.md).
