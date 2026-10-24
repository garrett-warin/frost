# Frosty API configuration

Frosty currently supports one OpenRouter key with multiple approved free models. Its model picker remembers the visitor's choice. Groq and Cloudflare Workers AI are alternatives listed in the user's [free-ai-models repository](https://github.com/ClawLabsAI/free-ai-models), but their direct endpoints need adapter changes; changing only the base URL will not work with the current `:free` model validation and OpenRouter routing options.

## Local setup

1. Use Node 22.9 or newer. Copy `.env.example` to `.env` if the latter does not exist. Never overwrite a configured file.
2. Create an API key in [OpenRouter settings](https://openrouter.ai/settings/keys) and paste it into `FROST_AI_API_KEY` in `.env`. Keep it out of chat and source control.
3. Leave `FROST_AI_BASE_URL` as `https://openrouter.ai/api/v1`. Edit the comma-separated `FROST_AI_MODELS` list to change the picker. Every ID must end in `:free`; up to 12 models are allowed.
4. Stop the old local server and run `npm start` from the Frost folder. It loads `.env` when present. Shell environment variables take precedence. The example uses port 3104.

The template lists [Gemma 4 31B](https://openrouter.ai/google/gemma-4-31b-it:free) and [North Mini Code](https://openrouter.ai/cohere/north-mini-code:free), verified as free catalog entries on 2026-10-23. Catalog presence is not a successful inference test. Availability changes. Requests require a provider that accepts `data_collection: deny`, with prompt/completion prices capped at zero. A model may be unavailable under these restrictions.

The API key is server-only. `.env` is ignored by Git, excluded from the Docker context, and excluded from the source archive. Only the empty `.env.example` is shareable. Do not put either a key or a configured `.env` in `public/`. The public configuration endpoint exposes model IDs and readiness, never the key.

## Free allowances

As checked on 2026-10-23:

- [OpenRouter limits](https://openrouter.ai/docs/api_reference/limits): the supplied repository reports 20 requests/minute and 50/day for accounts below the paid-credit threshold, shared across free models. Check the account's actual limit. Switching models does not reset the daily allowance.
- [Groq limits](https://console.groq.com/docs/rate-limits): its free-plan table lists 30 requests/minute, 1,000/day, 8,000 tokens/minute and 200,000 tokens/day for GPT-OSS 20B/120B and Qwen3.8 27B. Limits are organization-level and model-dependent.
- [Cloudflare Workers AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/): 10,000 Neurons/day on the Free plan, reset at 00:00 UTC. Neurons measure compute, not request count. The Free plan rejects requests over the cap; Paid plans can charge for excess usage.

Frost's own limits apply per server process: five requests/minute per device, twenty/minute globally, four concurrent requests, and a sixty-second deadline. Two Fly processes can allow forty requests/minute and eight concurrent requests in aggregate; provider account limits still apply across both.

## Hosted setup

This local file does not configure the hosted site. Production uses Fly secrets/environment variables with the same three `FROST_AI_*` names. Set the API key as a Fly secret; do not place it in `fly.toml`, Docker images, frontend code, or Git. Do not import the local `PORT=3104` into Fly, which uses port 8080. Deploying the Frosty implementation and verifying a real provider response remain separate release steps.

## Data and behavior

Messages go to the configured provider. Page or selection snapshots are attached only by an explicit click and sent with the next message. They are treated as untrusted reference text. Chat history stays in session storage for the current browser tab until cleared. Frosty has no autonomous browsing/search tools. Activity labels describe actual connection/stream events, not private model reasoning.
