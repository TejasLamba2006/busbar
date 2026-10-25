<div align="center">
  <img src="https://raw.githubusercontent.com/TejasLamba2006/busbar/main/public/banner.png" alt="Busbar" width="100%"/>

  # Busbar

  **A local LLM multiplexer. One `/v1` endpoint in front of 292 providers.**

  In electrical engineering, a busbar is the solid copper strip that collects power from multiple sources and feeds every circuit on one common rail. Busbar does the same for 292 LLM providers on `localhost:20128/v1`.

  [![npm](https://img.shields.io/npm/v/busbar-ai.svg)](https://www.npmjs.com/package/busbar-ai)
  [![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
</div>

## What Busbar is

Busbar is a local gateway that speaks the OpenAI, Anthropic, and Gemini APIs on port `20128`. It connects 292 native providers behind one `/v1` endpoint: OAuth subscriptions, API keys, free tiers, aggregators, local models, web search, web fetch, TTS, STT, image, video, and embeddings.

Point your tools at it, add accounts in the dashboard, and it handles format translation, model combos, multi-account fallback, token refresh, and usage tracking.

Busbar is a fork of [9Router](https://github.com/decolua/9router). The data directory is `~/.busbar` (`%APPDATA%\busbar` on Windows). Existing `~/.9router` data is copied over automatically on first start, so databases, API keys, and connections keep loading.

## Why Busbar exists

### Why OmniRoute feels bloated

OmniRoute grew into a monolith: 193 SQLite migrations, 90+ CI ratchet scripts, embedded A2A/ACP agent servers, Qdrant vector memory, gamification, sponsor banners, chaos mode, streaming regex PII redaction that mutates payloads, and a 25-file heuristic router. It uses more RAM, starts slowly, and ships features a local gateway should not run.

### Why stock 9Router was not enough

Stock 9Router is fast and lean, but:

- It ships about 144 providers.
- The dashboard has no provider/model search and no category or media filtering.
- `/v1/models` blocks for 15 to 23 seconds waiting on slow upstream catalogs.
- No native `web_search` and `web_fetch` server-tool redirects for non-Anthropic models.
- It lacks multi-proxy failover and stealth-model reasoning fixes.

### What Busbar adds

Busbar keeps 9Router's footprint and ports the useful parts of OmniRoute without the rest.

1. **292 native providers and a filter bar.** 150+ additional providers with config-driven connection testing. The dashboard has instant search by provider or model ID, `All | Configured | Compact` views, 13 category chips, and 7 media-kind filters. Includes native `freepi` (`fp/*`): FreePi's ad-supported free tier with GitHub device-code sign-in, a daily USD allowance, and 27 models (Claude Sonnet 5.5, Gemini 4 Argon, GPT-6.1 Sol, Kimi K3.1 Pro, DeepSeek V4). Also native `freebuff` (`fb/*`): Freebuff's ad-supported free tier with device-key signed requests (Ed25519), a live model catalog, 12 models, and Freebucks quota display.
2. **Sub-second `/v1/models` (23.4s to 1.0s).** Catalogs refresh in the background and persist in the SQLite `kv` table, so `/v1/models` never waits on the Kiro, Qoder, Copilot, or Cursor resolvers.
3. **Native `web_search` and `web_fetch` redirect.** Claude Code's web search and fetch tools work on Gemini, DeepSeek, GLM, Codex, or any OpenAI model, routed through Exa, Brave, Tavily, Serper, or SearXNG. Includes SSRF protection and domain filtering.
4. **Claude Code auto-permission classifier compat.** The optional `claudeClassifierCompat` setting lets non-Claude models answer Claude Code's security classifier without failing permission prompts.
5. **Per-connection proxy pool rotation and local direct toggle.** Rotate requests across Cloudflare workers, SOCKS5/HTTP proxies, and your own IP (`__local__`), per connection or per retry. Timed-out relays are skipped without locking the upstream account.
6. **Streaming empty-turn retry and thinking-signature recovery.** The first 128 KB of every upstream SSE stream is cloned and checked, so empty or aborted turns retry before bytes reach the client. Claude 5/5.5 `CAIS` protobuf signatures are validated, Vertex `thoughtSignature` poisoning is fixed, and invalid historical thinking signatures are recovered automatically.
7. **`models.dev` auto-pricing.** 4-rate pricing (input, output, cache read, cache write/reasoning) across 2,180+ model basenames, including custom Azure and OpenAI-compatible deployments.
8. **RTK and Headroom protected-tools guard.** Output from `Read`, `Edit`, `Write`, `Grep`, `NotebookEdit`, `MultiEdit`, `patch`, `apply_patch`, and `anchor` is never compressed or summarized. Error results are preserved too. Line numbers and exact strings that `Edit` depends on stay intact.
9. **OpenCode `FreeTierError` and abuse direct-egress replay.** When OpenCode free models return a `FreeTierError` or an IP-abuse block, the request replays once through the next proxy in the pool or your direct egress, instead of failing the turn.

## Installation and quick start

Global install:

```bash
npm install -g busbar-ai
busbar
```

Or run with `npx`:

```bash
npx busbar-ai
```

The dashboard opens at `http://localhost:20128/dashboard`. The API is served at `http://localhost:20128/v1`.

The `9router` command still works as an alias for `busbar`.

### Changing the port

The default port is 20128. Port resolution order:

1. `busbar --port <port>` (or `-p <port>`); add `--save-port` to keep it as the new default
2. `PORT=<port>` environment variable
3. Dashboard, Settings, Server Port (saved to `port.json` in the data directory, applies on next restart)
4. 20128

### Claude Code

```bash
export ANTHROPIC_BASE_URL=http://localhost:20128
export ANTHROPIC_AUTH_TOKEN=<your Busbar API key>
claude
```

### Codex and the OpenAI SDK

```bash
export OPENAI_BASE_URL=http://localhost:20128/v1
export OPENAI_API_KEY=<your Busbar API key>
```

```python
from openai import OpenAI

client = OpenAI(base_url="http://localhost:20128/v1", api_key="<your Busbar API key>")
r = client.chat.completions.create(
    model="<provider/model or combo name>",
    messages=[{"role": "user", "content": "hello"}],
)
```

### Build from source

```bash
git clone https://github.com/TejasLamba2006/busbar.git
cd busbar
cp .env.example .env
npm install
npm run dev
```

Set `INITIAL_PASSWORD`, `JWT_SECRET`, and `API_KEY_SECRET` in `.env` before exposing the server beyond localhost.

## Docs

- [Architecture](docs/ARCHITECTURE.md)
- [Routing engine conventions](open-sse/AGENTS.md)
- [Changelog](CHANGELOG.md)

## Author and support

Made by [Tejas Lamba](https://tejas.is-a.dev/) ([GitHub](https://github.com/TejasLamba2006)). Support the project via [PayPal](https://www.paypal.com/paypalme/tejaslamba) or [GitHub Sponsors](https://github.com/sponsors/TejasLamba2006).

## License

MIT
