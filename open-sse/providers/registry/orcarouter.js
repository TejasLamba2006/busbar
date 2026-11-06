export default {
  "id": "orcarouter",
  "alias": "orcarouter",
  "uiAlias": "orcarouter",
  "display": {
    "name": "OrcaRouter",
    "icon": "orcarouter",
    "color": "#0891B2",
    "textIcon": "ORC",
    "website": "https://www.orcarouter.ai",
    "notice": {
      "text": "Includes free models (orcarouter/free, deepseek/*-free, tencent/*-free, z-ai/*-free). Link a GitHub account in OrcaRouter settings to unlock *-free models.",
      "apiKeyUrl": "https://www.orcarouter.ai"
    }
  },
  "category": "freeTier",
  "authType": "apikey",
  "authModes": [
    "apikey"
  ],
  "transport": {
    "baseUrl": "https://api.orcarouter.ai/v1/chat/completions",
    "validateUrl": "https://api.orcarouter.ai/v1/models",
    "headers": {
      "HTTP-Referer": "https://endpoint-proxy.local",
      "X-Title": "Endpoint Proxy"
    }
  },
  "models": [
    {
      "id": "orcarouter/pod",
      "name": "orcarouter/pod"
    },
    {
      "id": "orcarouter/free",
      "name": "orcarouter/free"
    },
    {
      "id": "orcarouter/fusion",
      "name": "orcarouter/fusion",
      "contextLength": 1000000
    },
    {
      "id": "orcarouter/fusion-flash",
      "name": "orcarouter/fusion-flash",
      "contextLength": 262144
    },
    {
      "id": "orcarouter/fusion-mini",
      "name": "orcarouter/fusion-mini",
      "contextLength": 1000000
    },
    {
      "id": "orcarouter/auto",
      "name": "orcarouter/auto"
    },
    {
      "id": "anthropic/claude-fable-5",
      "name": "Anthropic: Claude Fable 5",
      "contextLength": 1000000,
      "maxOutputTokens": 128000
    },
    {
      "id": "anthropic/claude-fable-5.1",
      "name": "Anthropic: Claude Fable 5.1",
      "contextLength": 1000000,
      "maxOutputTokens": 128000
    },
    {
      "id": "anthropic/claude-haiku-4.5",
      "name": "Anthropic: Claude Haiku 4.5",
      "contextLength": 200000,
      "maxOutputTokens": 64000
    },
    {
      "id": "anthropic/claude-opus-4.5",
      "name": "Anthropic: Claude Opus 4.5",
      "contextLength": 200000,
      "maxOutputTokens": 64000
    },
    {
      "id": "anthropic/claude-opus-4.6",
      "name": "Anthropic: Claude Opus 4.6",
      "contextLength": 1000000,
      "maxOutputTokens": 128000
    },
    {
      "id": "anthropic/claude-opus-4.7",
      "name": "Anthropic: Claude Opus 4.7",
      "contextLength": 1000000,
      "maxOutputTokens": 128000
    },
    {
      "id": "anthropic/claude-opus-4.8",
      "name": "Anthropic: Claude Opus 4.8",
      "contextLength": 1000000,
      "maxOutputTokens": 128000
    },
    {
      "id": "anthropic/claude-opus-5",
      "name": "Anthropic: Claude Opus 5",
      "contextLength": 1000000,
      "maxOutputTokens": 128000
    },
    {
      "id": "anthropic/claude-opus-5.5",
      "name": "Anthropic: Claude Opus 5.5",
      "contextLength": 1000000,
      "maxOutputTokens": 128000
    },
    {
      "id": "anthropic/claude-sonnet-4.6",
      "name": "Anthropic: Claude Sonnet 4.6",
      "contextLength": 1000000,
      "maxOutputTokens": 64000
    },
    {
      "id": "anthropic/claude-sonnet-5",
      "name": "Anthropic: Claude Sonnet 5",
      "contextLength": 1000000,
      "maxOutputTokens": 128000
    },
    {
      "id": "anthropic/claude-sonnet-5.5",
      "name": "Anthropic: Claude Sonnet 5.5",
      "contextLength": 1000000,
      "maxOutputTokens": 128000
    },
    {
      "id": "deepseek/deepseek-chat",
      "name": "DeepSeek: DeepSeek V3",
      "contextLength": 1048576,
      "maxOutputTokens": 384000
    },
    {
      "id": "deepseek/deepseek-reasoner",
      "name": "deepseek/deepseek-reasoner",
      "contextLength": 1048576,
      "maxOutputTokens": 384000
    },
    {
      "id": "deepseek/deepseek-v4-flash",
      "name": "DeepSeek: DeepSeek V4 Flash",
      "contextLength": 1048576,
      "maxOutputTokens": 384000
    },
    {
      "id": "deepseek/deepseek-v4-flash-0731",
      "name": "DeepSeek: DeepSeek V4 Flash 0731",
      "contextLength": 1048576,
      "maxOutputTokens": 384000
    },
    {
      "id": "deepseek/deepseek-v4-flash-free",
      "name": "DeepSeek: DeepSeek V4 Flash (Free)"
    },
    {
      "id": "deepseek/deepseek-v4-flash-vision-exp",
      "name": "DeepSeek: DeepSeek V4 Flash Vision (Exp)",
      "contextLength": 1048576,
      "maxOutputTokens": 384000
    },
    {
      "id": "deepseek/deepseek-v4-pro",
      "name": "DeepSeek: DeepSeek V4 Pro",
      "contextLength": 1048576,
      "maxOutputTokens": 384000
    },
    {
      "id": "deepseek/deepseek-v4-pro-0813",
      "name": "DeepSeek: DeepSeek V4 Pro 0813",
      "contextLength": 1048576,
      "maxOutputTokens": 384000
    },
    {
      "id": "deepseek/deepseek-v4.1-flash",
      "name": "DeepSeek: DeepSeek V4.1 Flash",
      "contextLength": 1048576,
      "maxOutputTokens": 384000
    },
    {
      "id": "deepseek/deepseek-v4.1-flash-1017",
      "name": "DeepSeek: DeepSeek V4.1 Flash 1017",
      "contextLength": 1048576,
      "maxOutputTokens": 393216
    },
    {
      "id": "deepseek/deepseek-v4.1-flash-free",
      "name": "DeepSeek: DeepSeek V4.1 Flash (Free)"
    },
    {
      "id": "google/gemini-2.5-flash",
      "name": "Google: Gemini 2.5 Flash",
      "contextLength": 1048576,
      "maxOutputTokens": 65536
    },
    {
      "id": "google/gemini-2.5-flash-image",
      "name": "Google: Nano Banana (Gemini 2.5 Flash Image)",
      "contextLength": 32768
    },
    {
      "id": "google/gemini-2.5-flash-lite",
      "name": "Google: Gemini 2.5 Flash Lite",
      "contextLength": 1048576,
      "maxOutputTokens": 65536
    },
    {
      "id": "google/gemini-2.5-pro",
      "name": "Google: Gemini 2.5 Pro",
      "contextLength": 1048576,
      "maxOutputTokens": 65536
    },
    {
      "id": "google/gemini-3-flash-preview",
      "name": "Google: Gemini 3 Flash Preview",
      "contextLength": 1048576,
      "maxOutputTokens": 65536
    },
    {
      "id": "google/gemini-3-pro-image-preview",
      "name": "Google: Nano Banana Pro (Gemini 3 Pro Image Preview)",
      "contextLength": 65536
    },
    {
      "id": "google/gemini-3.1-flash-image-preview",
      "name": "Google: Nano Banana 2 (Gemini 3.1 Flash Image Preview)",
      "contextLength": 65536
    },
    {
      "id": "google/gemini-3.1-flash-lite",
      "name": "google/gemini-3.1-flash-lite"
    },
    {
      "id": "google/gemini-3.1-flash-lite-preview",
      "name": "Google: Gemini 3.1 Flash Lite Preview",
      "contextLength": 1048576,
      "maxOutputTokens": 65536
    },
    {
      "id": "google/gemini-3.1-pro-preview",
      "name": "Google: Gemini 3.1 Pro Preview",
      "contextLength": 1048576,
      "maxOutputTokens": 65536
    },
    {
      "id": "google/gemini-3.1-pro-preview-customtools",
      "name": "Google: Gemini 3.1 Pro Preview Custom Tools",
      "contextLength": 1048576,
      "maxOutputTokens": 65536
    },
    {
      "id": "google/gemini-3.5-flash",
      "name": "Gemini 3.5 Flash",
      "contextLength": 1048576,
      "maxOutputTokens": 65536
    },
    {
      "id": "google/gemini-3.5-flash-lite",
      "name": "Google: Gemini 3.5 Flash-Lite",
      "contextLength": 1048576,
      "maxOutputTokens": 65536
    },
    {
      "id": "google/gemini-3.6-flash",
      "name": "Google: Gemini 3.6 Flash",
      "contextLength": 1048576,
      "maxOutputTokens": 65536
    },
    {
      "id": "google/gemini-3.8-flash",
      "name": "Google: Gemini 3.8 Flash",
      "contextLength": 1048576,
      "maxOutputTokens": 65536
    },
    {
      "id": "google/gemini-4-argon",
      "name": "google/gemini-4-argon"
    },
    {
      "id": "google/gemini-flash-latest",
      "name": "google/gemini-flash-latest",
      "maxOutputTokens": 65536
    },
    {
      "id": "google/gemini-flash-lite-latest",
      "name": "google/gemini-flash-lite-latest",
      "maxOutputTokens": 65536
    },
    {
      "id": "google/gemini-pro-latest",
      "name": "google/gemini-pro-latest",
      "maxOutputTokens": 65536
    },
    {
      "id": "google/gemini-robotics-er-1.6-preview",
      "name": "google/gemini-robotics-er-1.6-preview",
      "maxOutputTokens": 65536
    },
    {
      "id": "google/gemma-4-26b-a4b-it",
      "name": "Google: Gemma 4 26B A4B ",
      "contextLength": 262144
    },
    {
      "id": "google/gemma-4-31b-it",
      "name": "Google: Gemma 4 31B"
    },
    {
      "id": "gpt-5.6-luna",
      "name": "gpt-5.6-luna",
      "contextLength": 1050000,
      "maxOutputTokens": 128000
    },
    {
      "id": "grok/grok-4.3",
      "name": "grok/grok-4.3",
      "contextLength": 1000000
    },
    {
      "id": "grok/grok-4.5",
      "name": "xAI: Grok 4.5",
      "contextLength": 500000
    },
    {
      "id": "grok/grok-4.6",
      "name": "SpaceXAI: Grok 4.6",
      "contextLength": 500000
    },
    {
      "id": "grok/grok-4.7",
      "name": "Grok 4.7",
      "contextLength": 500000,
      "maxOutputTokens": 450000
    },
    {
      "id": "kimi/kimi-k2.5",
      "name": "kimi/kimi-k2.5",
      "contextLength": 262144,
      "maxOutputTokens": 32768
    },
    {
      "id": "kimi/kimi-k2.6",
      "name": "kimi/kimi-k2.6",
      "contextLength": 262144,
      "maxOutputTokens": 32768
    },
    {
      "id": "kimi/kimi-k2.7-code",
      "name": "MoonshotAI: Kimi K2.7 Code",
      "contextLength": 262144,
      "maxOutputTokens": 262144
    },
    {
      "id": "kimi/kimi-k3",
      "name": "MoonshotAI: Kimi K3",
      "contextLength": 1048576
    },
    {
      "id": "kimi/kimi-k3.1-pro",
      "name": "MoonshotAI: Kimi K3.1 Pro",
      "contextLength": 1048576,
      "maxOutputTokens": 943718
    },
    {
      "id": "meta/muse-spark-1.1",
      "name": "Meta: Muse Spark 1.1",
      "contextLength": 1048576
    },
    {
      "id": "meta/muse-spark-1.2",
      "name": "Meta: Muse Spark 1.2",
      "contextLength": 1048576
    },
    {
      "id": "minimax/minimax-m2.5",
      "name": "MiniMax: MiniMax M2.5",
      "contextLength": 204800,
      "maxOutputTokens": 2048
    },
    {
      "id": "minimax/minimax-m2.5-highspeed",
      "name": "MiniMax M2.5 highspeed",
      "contextLength": 204800,
      "maxOutputTokens": 2048
    },
    {
      "id": "minimax/minimax-m2.7",
      "name": "MiniMax: MiniMax M2.7",
      "contextLength": 204800,
      "maxOutputTokens": 2048
    },
    {
      "id": "minimax/minimax-m2.7-highspeed",
      "name": "MiniMax M2.7 highspeed",
      "contextLength": 204800,
      "maxOutputTokens": 2048
    },
    {
      "id": "minimax/minimax-m3",
      "name": "MiniMax: MiniMax M3",
      "contextLength": 1048576,
      "maxOutputTokens": 512000
    },
    {
      "id": "minimax/minimax-m3.1-flash",
      "name": "MiniMax: M3.1 Flash",
      "contextLength": 1048576,
      "maxOutputTokens": 524288
    },
    {
      "id": "obsidian/gemma-4-26B-A4B",
      "name": "Gemma 4 26B A4B",
      "contextLength": 262144
    },
    {
      "id": "obsidian/Qwen3.6-35B-A3B",
      "name": "Qwen3.6 35B A3B",
      "contextLength": 262144
    },
    {
      "id": "obsidian/Qwen3.8-27B",
      "name": "Qwen3.8 27B",
      "contextLength": 262144
    },
    {
      "id": "openai/gpt-3.5-turbo",
      "name": "OpenAI: GPT-3.5 Turbo",
      "contextLength": 16385,
      "maxOutputTokens": 4096
    },
    {
      "id": "openai/gpt-3.5-turbo-0125",
      "name": "openai/gpt-3.5-turbo-0125",
      "maxOutputTokens": 4096
    },
    {
      "id": "openai/gpt-3.5-turbo-1106",
      "name": "openai/gpt-3.5-turbo-1106",
      "maxOutputTokens": 4096
    },
    {
      "id": "openai/gpt-3.5-turbo-16k",
      "name": "OpenAI: GPT-3.5 Turbo 16k",
      "contextLength": 16385,
      "maxOutputTokens": 4096
    },
    {
      "id": "openai/gpt-4",
      "name": "OpenAI: GPT-4",
      "contextLength": 8191,
      "maxOutputTokens": 8192
    },
    {
      "id": "openai/gpt-4-0613",
      "name": "openai/gpt-4-0613",
      "maxOutputTokens": 8192
    },
    {
      "id": "openai/gpt-4-turbo",
      "name": "OpenAI: GPT-4 Turbo",
      "contextLength": 128000,
      "maxOutputTokens": 4096
    },
    {
      "id": "openai/gpt-4-turbo-2024-04-09",
      "name": "openai/gpt-4-turbo-2024-04-09",
      "contextLength": 128000,
      "maxOutputTokens": 4096
    },
    {
      "id": "openai/gpt-4.1",
      "name": "OpenAI: GPT-4.1",
      "contextLength": 1047576,
      "maxOutputTokens": 32768
    },
    {
      "id": "openai/gpt-4.1-2025-04-14",
      "name": "openai/gpt-4.1-2025-04-14",
      "contextLength": 1047576,
      "maxOutputTokens": 32768
    },
    {
      "id": "openai/gpt-4.1-mini",
      "name": "OpenAI: GPT-4.1 Mini",
      "contextLength": 1047576,
      "maxOutputTokens": 32768
    },
    {
      "id": "openai/gpt-4.1-mini-2025-04-14",
      "name": "openai/gpt-4.1-mini-2025-04-14",
      "contextLength": 1047576,
      "maxOutputTokens": 32768
    },
    {
      "id": "openai/gpt-4.1-nano",
      "name": "OpenAI: GPT-4.1 Nano",
      "contextLength": 1047576,
      "maxOutputTokens": 32768
    },
    {
      "id": "openai/gpt-4.1-nano-2025-04-14",
      "name": "openai/gpt-4.1-nano-2025-04-14",
      "contextLength": 1047576,
      "maxOutputTokens": 32768
    },
    {
      "id": "openai/gpt-4o",
      "name": "OpenAI: GPT-4o",
      "contextLength": 128000,
      "maxOutputTokens": 16384
    },
    {
      "id": "openai/gpt-4o-2024-05-13",
      "name": "OpenAI: GPT-4o (2024-05-13)",
      "contextLength": 128000,
      "maxOutputTokens": 16384
    },
    {
      "id": "openai/gpt-4o-2024-08-06",
      "name": "OpenAI: GPT-4o (2024-08-06)",
      "contextLength": 128000,
      "maxOutputTokens": 16384
    },
    {
      "id": "openai/gpt-4o-2024-11-20",
      "name": "OpenAI: GPT-4o (2024-11-20)",
      "contextLength": 128000,
      "maxOutputTokens": 16384
    },
    {
      "id": "openai/gpt-4o-mini",
      "name": "OpenAI: GPT-4o-mini",
      "contextLength": 128000,
      "maxOutputTokens": 16384
    },
    {
      "id": "openai/gpt-4o-mini-2024-07-18",
      "name": "OpenAI: GPT-4o-mini (2024-07-18)",
      "contextLength": 128000,
      "maxOutputTokens": 16384
    },
    {
      "id": "openai/gpt-5",
      "name": "OpenAI: GPT-5",
      "contextLength": 400000,
      "maxOutputTokens": 128000
    },
    {
      "id": "openai/gpt-5-2025-08-07",
      "name": "openai/gpt-5-2025-08-07",
      "contextLength": 400000,
      "maxOutputTokens": 128000
    },
    {
      "id": "openai/gpt-5-chat-latest",
      "name": "openai/gpt-5-chat-latest",
      "maxOutputTokens": 100000
    },
    {
      "id": "openai/gpt-5-mini",
      "name": "OpenAI: GPT-5 Mini",
      "contextLength": 400000,
      "maxOutputTokens": 128000
    },
    {
      "id": "openai/gpt-5-mini-2025-08-07",
      "name": "openai/gpt-5-mini-2025-08-07",
      "contextLength": 400000,
      "maxOutputTokens": 128000
    },
    {
      "id": "openai/gpt-5-nano",
      "name": "OpenAI: GPT-5 Nano",
      "contextLength": 400000,
      "maxOutputTokens": 128000
    },
    {
      "id": "openai/gpt-5-nano-2025-08-07",
      "name": "openai/gpt-5-nano-2025-08-07",
      "contextLength": 400000,
      "maxOutputTokens": 128000
    },
    {
      "id": "openai/gpt-5-pro",
      "name": "OpenAI: GPT-5 Pro",
      "contextLength": 400000,
      "maxOutputTokens": 272000
    },
    {
      "id": "openai/gpt-5-pro-2025-10-06",
      "name": "openai/gpt-5-pro-2025-10-06",
      "contextLength": 400000,
      "maxOutputTokens": 272000
    },
    {
      "id": "openai/gpt-5-search-api",
      "name": "openai/gpt-5-search-api",
      "maxOutputTokens": 128000
    },
    {
      "id": "openai/gpt-5-search-api-2025-10-14",
      "name": "openai/gpt-5-search-api-2025-10-14",
      "maxOutputTokens": 128000
    },
    {
      "id": "openai/gpt-5.1",
      "name": "OpenAI: GPT-5.1",
      "contextLength": 400000,
      "maxOutputTokens": 128000
    },
    {
      "id": "openai/gpt-5.1-2025-11-13",
      "name": "openai/gpt-5.1-2025-11-13",
      "contextLength": 400000,
      "maxOutputTokens": 128000
    },
    {
      "id": "openai/gpt-5.1-chat-latest",
      "name": "openai/gpt-5.1-chat-latest",
      "maxOutputTokens": 16384
    },
    {
      "id": "openai/gpt-5.1-codex",
      "name": "OpenAI: GPT-5.1-Codex",
      "contextLength": 400000,
      "maxOutputTokens": 128000
    },
    {
      "id": "openai/gpt-5.1-codex-mini",
      "name": "OpenAI: GPT-5.1-Codex-Mini",
      "contextLength": 400000,
      "maxOutputTokens": 128000
    },
    {
      "id": "openai/gpt-5.2",
      "name": "OpenAI: GPT-5.2",
      "contextLength": 400000,
      "maxOutputTokens": 128000
    },
    {
      "id": "openai/gpt-5.2-2025-12-11",
      "name": "openai/gpt-5.2-2025-12-11",
      "contextLength": 400000,
      "maxOutputTokens": 128000
    },
    {
      "id": "openai/gpt-5.2-chat-latest",
      "name": "openai/gpt-5.2-chat-latest",
      "maxOutputTokens": 16384
    },
    {
      "id": "openai/gpt-5.2-codex",
      "name": "OpenAI: GPT-5.2-Codex",
      "contextLength": 400000,
      "maxOutputTokens": 128000
    },
    {
      "id": "openai/gpt-5.2-pro",
      "name": "OpenAI: GPT-5.2 Pro",
      "contextLength": 400000,
      "maxOutputTokens": 128000
    },
    {
      "id": "openai/gpt-5.2-pro-2025-12-11",
      "name": "openai/gpt-5.2-pro-2025-12-11",
      "contextLength": 400000,
      "maxOutputTokens": 128000
    },
    {
      "id": "openai/gpt-5.3-codex",
      "name": "OpenAI: GPT-5.3-Codex",
      "contextLength": 400000,
      "maxOutputTokens": 128000
    },
    {
      "id": "openai/gpt-5.4",
      "name": "OpenAI: GPT-5.4",
      "contextLength": 1050000,
      "maxOutputTokens": 128000
    },
    {
      "id": "openai/gpt-5.4-2026-03-05",
      "name": "openai/gpt-5.4-2026-03-05",
      "contextLength": 1050000,
      "maxOutputTokens": 128000
    },
    {
      "id": "openai/gpt-5.4-mini",
      "name": "OpenAI: GPT-5.4 Mini",
      "contextLength": 400000,
      "maxOutputTokens": 128000
    },
    {
      "id": "openai/gpt-5.4-mini-2026-03-17",
      "name": "openai/gpt-5.4-mini-2026-03-17",
      "maxOutputTokens": 128000
    },
    {
      "id": "openai/gpt-5.4-nano",
      "name": "OpenAI: GPT-5.4 Nano",
      "contextLength": 400000,
      "maxOutputTokens": 128000
    },
    {
      "id": "openai/gpt-5.4-nano-2026-03-17",
      "name": "openai/gpt-5.4-nano-2026-03-17",
      "maxOutputTokens": 128000
    },
    {
      "id": "openai/gpt-5.4-pro",
      "name": "OpenAI: GPT-5.4 Pro",
      "contextLength": 1050000,
      "maxOutputTokens": 128000
    },
    {
      "id": "openai/gpt-5.4-pro-2026-03-05",
      "name": "openai/gpt-5.4-pro-2026-03-05",
      "contextLength": 1050000,
      "maxOutputTokens": 128000
    },
    {
      "id": "openai/gpt-5.5",
      "name": "OpenAI: GPT-5.5",
      "maxOutputTokens": 128000
    },
    {
      "id": "openai/gpt-5.5-2026-04-23",
      "name": "openai/gpt-5.5-2026-04-23",
      "maxOutputTokens": 128000
    },
    {
      "id": "openai/gpt-5.5-pro",
      "name": "OpenAI: GPT-5.5 Pro",
      "maxOutputTokens": 100000
    },
    {
      "id": "openai/gpt-5.5-pro-2026-04-23",
      "name": "openai/gpt-5.5-pro-2026-04-23",
      "maxOutputTokens": 100000
    },
    {
      "id": "openai/gpt-5.6-luna",
      "name": "OpenAI: GPT-5.6 Luna",
      "contextLength": 1050000,
      "maxOutputTokens": 128000
    },
    {
      "id": "openai/gpt-5.6-sol",
      "name": "OpenAI: GPT-5.6 Sol",
      "contextLength": 1050000,
      "maxOutputTokens": 128000
    },
    {
      "id": "openai/gpt-5.6-terra",
      "name": "OpenAI: GPT-5.6 Terra",
      "contextLength": 1050000,
      "maxOutputTokens": 128000
    },
    {
      "id": "openai/gpt-6-astra",
      "name": "OpenAI: GPT-6 Astra",
      "contextLength": 1050000,
      "maxOutputTokens": 128000
    },
    {
      "id": "openai/gpt-6-luna",
      "name": "OpenAI: GPT-6 Luna",
      "contextLength": 1050000,
      "maxOutputTokens": 128000
    },
    {
      "id": "openai/gpt-6-sol",
      "name": "OpenAI: GPT-6 Sol",
      "contextLength": 1050000,
      "maxOutputTokens": 128000
    },
    {
      "id": "openai/gpt-6.1-sol",
      "name": "OpenAI: GPT-6.1 Sol",
      "contextLength": 1050000,
      "maxOutputTokens": 128000
    },
    {
      "id": "orca/orcaverify-text1.0",
      "name": "Orca: OrcaVerify Text 1.0"
    },
    {
      "id": "qwen/qwen3-max",
      "name": "Qwen: Qwen3 Max",
      "contextLength": 262144,
      "maxOutputTokens": 65536
    },
    {
      "id": "qwen/qwen3-max-preview",
      "name": "qwen/qwen3-max-preview",
      "contextLength": 262144,
      "maxOutputTokens": 65536
    },
    {
      "id": "qwen/qwen3-vl-235b-a22b-instruct",
      "name": "Qwen: Qwen3 VL 235B A22B Instruct"
    },
    {
      "id": "qwen/qwen3-vl-235b-a22b-thinking",
      "name": "Qwen: Qwen3 VL 235B A22B Thinking",
      "contextLength": 131072,
      "maxOutputTokens": 40960
    },
    {
      "id": "qwen/qwen3-vl-8b-instruct",
      "name": "Qwen: Qwen3 VL 8B Instruct",
      "contextLength": 131072,
      "maxOutputTokens": 32768
    },
    {
      "id": "qwen/qwen3-vl-8b-thinking",
      "name": "Qwen: Qwen3 VL 8B Thinking",
      "contextLength": 131072,
      "maxOutputTokens": 40960
    },
    {
      "id": "qwen/qwen3.5-122b-a10b",
      "name": "Qwen: Qwen3.5-122B-A10B",
      "contextLength": 32768,
      "maxOutputTokens": 65536
    },
    {
      "id": "qwen/qwen3.5-27b",
      "name": "Qwen: Qwen3.5-27B",
      "contextLength": 32768,
      "maxOutputTokens": 65536
    },
    {
      "id": "qwen/qwen3.5-35b-a3b",
      "name": "Qwen: Qwen3.5-35B-A3B",
      "contextLength": 32768,
      "maxOutputTokens": 65536
    },
    {
      "id": "qwen/qwen3.5-397b-a17b",
      "name": "Qwen: Qwen3.5 397B A17B",
      "contextLength": 32768,
      "maxOutputTokens": 65536
    },
    {
      "id": "qwen/qwen3.5-flash",
      "name": "qwen/qwen3.5-flash",
      "contextLength": 1048576,
      "maxOutputTokens": 65536
    },
    {
      "id": "qwen/qwen3.5-flash-2026-02-23",
      "name": "qwen/qwen3.5-flash-2026-02-23",
      "contextLength": 1048576,
      "maxOutputTokens": 65536
    },
    {
      "id": "qwen/qwen3.5-plus",
      "name": "qwen/qwen3.5-plus",
      "contextLength": 1048576,
      "maxOutputTokens": 65536
    },
    {
      "id": "qwen/qwen3.5-plus-2026-02-15",
      "name": "qwen/qwen3.5-plus-2026-02-15",
      "contextLength": 1048576,
      "maxOutputTokens": 65536
    },
    {
      "id": "qwen/qwen3.6-35b-a3b",
      "name": "Qwen: Qwen3.6 35B A3B",
      "contextLength": 262144,
      "maxOutputTokens": 65536
    },
    {
      "id": "qwen/qwen3.6-flash",
      "name": "Qwen: Qwen3.6 Flash",
      "contextLength": 1048576,
      "maxOutputTokens": 65536
    },
    {
      "id": "qwen/qwen3.6-flash-2026-04-16",
      "name": "qwen/qwen3.6-flash-2026-04-16",
      "contextLength": 1048576,
      "maxOutputTokens": 65536
    },
    {
      "id": "qwen/qwen3.6-plus",
      "name": "Qwen: Qwen3.6 Plus",
      "contextLength": 1048576,
      "maxOutputTokens": 65536
    },
    {
      "id": "qwen/qwen3.6-plus-2026-04-02",
      "name": "qwen/qwen3.6-plus-2026-04-02",
      "contextLength": 1048576,
      "maxOutputTokens": 65536
    },
    {
      "id": "qwen/qwen3.7-flash",
      "name": "Qwen: Qwen3.7 Flash",
      "contextLength": 1000000,
      "maxOutputTokens": 65536
    },
    {
      "id": "qwen/qwen3.7-max",
      "name": "Qwen3.7 Max",
      "contextLength": 1000000,
      "maxOutputTokens": 64000
    },
    {
      "id": "qwen/qwen3.7-max-2026-05-20",
      "name": "Qwen3.7 Max (2026-05-20)",
      "contextLength": 1000000,
      "maxOutputTokens": 64000
    },
    {
      "id": "qwen/qwen3.7-plus",
      "name": "Qwen: Qwen3.7 Plus",
      "contextLength": 1000000,
      "maxOutputTokens": 65536
    },
    {
      "id": "qwen/qwen3.8-27b",
      "name": "Qwen: Qwen3.8 27B",
      "contextLength": 262144
    },
    {
      "id": "qwen/qwen3.8-flash",
      "name": "Qwen: Qwen3.8 Flash",
      "contextLength": 1000000,
      "maxOutputTokens": 131072
    },
    {
      "id": "qwen/qwen3.8-max",
      "name": "Qwen: Qwen3.8 Max",
      "contextLength": 1000000
    },
    {
      "id": "qwen/qwen3.8-max-0902",
      "name": "Qwen: Qwen3.8 Max (0902)",
      "contextLength": 1000000,
      "maxOutputTokens": 131072
    },
    {
      "id": "tencent/hy3",
      "name": "Tencent: Hy3",
      "contextLength": 262144
    },
    {
      "id": "tencent/hy4-preview",
      "name": "Tencent: Hy4 preview",
      "contextLength": 1048576,
      "maxOutputTokens": 64000
    },
    {
      "id": "xiaomi/mimo-v2.6-flash",
      "name": "Xiaomi: MiMo-V2.6-Flash",
      "contextLength": 1048576,
      "maxOutputTokens": 131072
    },
    {
      "id": "xiaomi/mimo-v2.6-pro",
      "name": "Xiaomi: MiMo-V2.6-Pro",
      "contextLength": 1048576,
      "maxOutputTokens": 131072
    },
    {
      "id": "z-ai/glm-4.5",
      "name": "Z.ai: GLM 4.5",
      "contextLength": 128000,
      "maxOutputTokens": 96000
    },
    {
      "id": "z-ai/glm-4.5-air",
      "name": "Z.ai: GLM 4.5 Air",
      "contextLength": 128000,
      "maxOutputTokens": 96000
    },
    {
      "id": "z-ai/glm-4.6",
      "name": "Z.ai: GLM 4.6",
      "contextLength": 200000,
      "maxOutputTokens": 128000
    },
    {
      "id": "z-ai/glm-4.7",
      "name": "Z.ai: GLM 4.7",
      "contextLength": 200000,
      "maxOutputTokens": 128000
    },
    {
      "id": "z-ai/glm-5",
      "name": "Z.ai: GLM 5",
      "contextLength": 200000,
      "maxOutputTokens": 128000
    },
    {
      "id": "z-ai/glm-5.1",
      "name": "Z.ai: GLM 5.1",
      "contextLength": 200000,
      "maxOutputTokens": 128000
    },
    {
      "id": "z-ai/glm-5.2",
      "name": "Z.ai: GLM 5.2",
      "contextLength": 1000000,
      "maxOutputTokens": 128000
    },
    {
      "id": "z-ai/glm-5.3",
      "name": "Z.ai: GLM 5.3",
      "contextLength": 1000000,
      "maxOutputTokens": 128000
    },
    {
      "id": "z-ai/glm-5.3-flash",
      "name": "Z.ai: GLM 5.3 Flash",
      "contextLength": 1000000,
      "maxOutputTokens": 128000
    },
    {
      "id": "z-ai/glm-5.3-flash-free",
      "name": "Z.ai: GLM 5.3 Flash (Free)"
    }
  ],
  "modelsFetcher": {
    "url": "https://api.orcarouter.ai/v1/models",
    "type": "openai"
  },
  "passthroughModels": true
};
