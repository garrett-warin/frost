# Frosty API configuration

Updated 2026-10-23. The accepted release direction is Groq on its Free plan, selected with `FROST_AI_PROVIDER=groq`. Provider tests, the user's new key entry, a real Groq response, and deployment remain pending. Earlier OpenRouter smoke results do not verify Groq.

## Local setup

1. Use Node 22.9 or newer. Copy `.env.example` to `.env` only when the latter does not exist; preserve existing configuration.
2. Create a key in [Groq Console](https://console.groq.com/keys) under an organization that remains on the Free plan. Enter it locally as `GROQ_API_KEY`; never paste it into chat, frontend files, Git, or build output.
3. Set `FROST_AI_PROVIDER=groq`. `FROST_AI_MODELS` can contain only `openai/gpt-oss-20b`, `openai/gpt-oss-120b`, and `qwen/qwen3.8-27b`. GPT-OSS models are text-only; Qwen is the image-capable preview option. The picker remembers the visitor's selection.
4. Restart `npm start`. `.env` is loaded when present; shell variables take precedence. The local template uses port 3104.

Groq requests use the fixed official endpoint `https://api.groq.com/openai/v1/chat/completions`; changing `FROST_AI_BASE_URL` does not redirect them. The public configuration endpoint exposes readiness and model metadata, never the key. `.env` is excluded from Git, Docker context, and corresponding-source archives. See [Groq API compatibility](https://console.groq.com/docs/openai).

## Free-plan limits and safeguards

The [Groq limits table](https://console.groq.com/docs/rate-limits), checked 2026-10-23, lists each approved model at 30 requests/minute, 1,000/day, 8,000 tokens/minute, and 200,000/day. Limits apply at organization level, with the account console authoritative for exceptions; switching visitors or Fly Machines does not create new allowances.

Keep the organization on Free. Groq has no request-level equivalent of OpenRouter's zero-price routing guard: a model allowlist does not prevent charges if the account is upgraded. Frost does not upgrade the account or switch providers automatically. Limit errors remain visible.

The Groq adapter reserves 2,048 output tokens and 512 framing tokens. One image reserves another 2,048 input tokens, as documented in [Groq vision](https://console.groq.com/docs/vision). A conservative UTF-8 byte guard bounds all text sent, including system instruction, conversation, and attached page/selection snapshot:

| Request | Maximum text bytes |
| --- | ---: |
| Text only | 5,440 |
| With one image | 3,392 |

Over-budget requests are rejected explicitly with guidance to start a new chat or reduce page text; nothing is silently truncated. This per-request approximation does not guarantee remaining organization quota or exact tokenization.

Frost's existing per-process limits remain five requests/minute per device, twenty/minute globally, four concurrent requests, and a sixty-second deadline. Two Fly processes can exceed the provider's shared minute allowance, so provider 429 responses must remain an expected recoverable state.

## Images and data

Attach one PNG/JPEG/WebP up to 2 MiB, preview/remove it locally, then explicitly Send. Groq image attachment selects `qwen/qwen3.8-27b` with a visible notice; text-only models reject images. Qwen is a preview model and availability can change; consult the [model catalog](https://console.groq.com/docs/models).

Server validation checks declared type against bytes, base64 encoding, size, and model capability. Image bytes are held in memory, omitted from saved chat history, and must be reattached for follow-ups. Chat text stays in session storage until cleared. Page/selection snapshots are opt-in reference text, not trusted instructions. Frosty has no autonomous browsing/search tools and exposes activity labels, not hidden reasoning.

## Explicit OpenRouter fallback

To deliberately return to OpenRouter, set `FROST_AI_PROVIDER=openrouter`, supply its separate `FROST_AI_API_KEY`, retain `https://openrouter.ai/api/v1`, and provide approved `:free` model IDs in `FROST_AI_MODELS`. The adapter retains `data_collection: deny` and zero prompt/completion price caps. It never sends the Groq key to OpenRouter or silently substitutes a paid model. Availability and account limits still apply. Existing image capability there is `google/gemma-4-31b-it:free`; North Mini Code is text-only.

## Hosted setup and release state

Local configuration does not configure Fly. The intended hosted selection is `FROST_AI_PROVIDER=groq`, the approved model list, and `GROQ_API_KEY` as a Fly secret. Do not import local `PORT=3104`; Fly uses 8080. Preserve the separate OpenRouter credential only if retaining an explicitly selectable fallback.

The user has accepted switching before deployment, but key entry and Groq verification are still pending. Do not report the new provider as live until a real harmless response and the existing two-Machine health checks succeed. No database/admin migration is required. Preserve the prior release image `registry.fly.io/frost-browsing:deployment-01M5HNCHZ901FC3RYJ3V205WT2` and the established rollback procedure. See [provider decision](decisions/004-frosty-groq.md).
