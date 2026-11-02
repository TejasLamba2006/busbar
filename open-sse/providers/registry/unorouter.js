export default {
  "id": "unorouter",
  "alias": "unorouter",
  "uiAlias": "unorouter",
  "display": {
    "name": "UnoRouter",
    "icon": "unorouter",
    "color": "#8B5CF6",
    "textIcon": "UR",
    "website": "https://unorouter.com",
    "notice": {
      "text": "Models with the :free suffix do not debit balance; limit is 1 request/minute per free model per user.",
      "apiKeyUrl": "https://unorouter.com"
    }
  },
  "category": "freeTier",
  "authType": "apikey",
  "authModes": [
    "apikey"
  ],
  "transport": {
    "baseUrl": "https://api.unorouter.com/v1/chat/completions",
    "validateUrl": "https://api.unorouter.com/v1/models"
  },
  "models": [
    {
      "id": "agnes-2.5-flash:free",
      "name": "agnes-2.5-flash:free",
      "contextLength": 512000,
      "maxOutputTokens": 65500
    },
    {
      "id": "agnes-3.0-flash:free",
      "name": "agnes-3.0-flash:free",
      "contextLength": 1000000
    },
    {
      "id": "allam-2-7b:free",
      "name": "allam-2-7b:free",
      "contextLength": 4096
    },
    {
      "id": "beam:free",
      "name": "beam:free",
      "contextLength": 1048576
    },
    {
      "id": "bielik-11b-v3.0-instruct:free",
      "name": "bielik-11b-v3.0-instruct:free",
      "contextLength": 32768
    },
    {
      "id": "big-pickle:free",
      "name": "big-pickle:free",
      "contextLength": 200000
    },
    {
      "id": "claude-fable-5",
      "name": "claude-fable-5",
      "contextLength": 1000000,
      "maxOutputTokens": 128000
    },
    {
      "id": "claude-fable-5.1",
      "name": "claude-fable-5.1",
      "contextLength": 1000000,
      "maxOutputTokens": 128000
    },
    {
      "id": "claude-fable-5.1[1m]",
      "name": "claude-fable-5.1[1m]"
    },
    {
      "id": "claude-fable-5[1m]",
      "name": "claude-fable-5[1m]"
    },
    {
      "id": "claude-haiku-4-5-20251001",
      "name": "claude-haiku-4-5-20251001",
      "contextLength": 200000,
      "maxOutputTokens": 64000
    },
    {
      "id": "claude-haiku-4-5-20251001[1m]",
      "name": "claude-haiku-4-5-20251001[1m]"
    },
    {
      "id": "claude-haiku-5-5",
      "name": "claude-haiku-5-5",
      "contextLength": 1000000,
      "maxOutputTokens": 16000
    },
    {
      "id": "claude-haiku-5-5[1m]",
      "name": "claude-haiku-5-5[1m]"
    },
    {
      "id": "claude-opus-4-5",
      "name": "claude-opus-4-5",
      "contextLength": 200000,
      "maxOutputTokens": 64000
    },
    {
      "id": "claude-opus-4-5-thinking",
      "name": "claude-opus-4-5-thinking",
      "contextLength": 200000,
      "maxOutputTokens": 64000
    },
    {
      "id": "claude-opus-4-5-thinking[1m]",
      "name": "claude-opus-4-5-thinking[1m]"
    },
    {
      "id": "claude-opus-4-5[1m]",
      "name": "claude-opus-4-5[1m]"
    },
    {
      "id": "claude-opus-4-6-thinking",
      "name": "claude-opus-4-6-thinking",
      "contextLength": 1000000,
      "maxOutputTokens": 128000
    },
    {
      "id": "claude-opus-4-6-thinking[1m]",
      "name": "claude-opus-4-6-thinking[1m]"
    },
    {
      "id": "claude-opus-4-7-thinking",
      "name": "claude-opus-4-7-thinking",
      "contextLength": 1000000,
      "maxOutputTokens": 128000
    },
    {
      "id": "claude-opus-4-7-thinking[1m]",
      "name": "claude-opus-4-7-thinking[1m]"
    },
    {
      "id": "claude-opus-4-8-thinking",
      "name": "claude-opus-4-8-thinking",
      "contextLength": 1000000,
      "maxOutputTokens": 128000
    },
    {
      "id": "claude-opus-4-8-thinking[1m]",
      "name": "claude-opus-4-8-thinking[1m]"
    },
    {
      "id": "claude-opus-4.6",
      "name": "claude-opus-4.6",
      "contextLength": 1000000,
      "maxOutputTokens": 128000
    },
    {
      "id": "claude-opus-4.6[1m]",
      "name": "claude-opus-4.6[1m]"
    },
    {
      "id": "claude-opus-4.7",
      "name": "claude-opus-4.7",
      "contextLength": 1000000,
      "maxOutputTokens": 128000
    },
    {
      "id": "claude-opus-4.7[1m]",
      "name": "claude-opus-4.7[1m]"
    },
    {
      "id": "claude-opus-4.8",
      "name": "claude-opus-4.8",
      "contextLength": 1000000,
      "maxOutputTokens": 128000
    },
    {
      "id": "claude-opus-4.8[1m]",
      "name": "claude-opus-4.8[1m]"
    },
    {
      "id": "claude-opus-5",
      "name": "claude-opus-5",
      "contextLength": 1000000,
      "maxOutputTokens": 128000
    },
    {
      "id": "claude-opus-5-thinking",
      "name": "claude-opus-5-thinking",
      "contextLength": 1000000,
      "maxOutputTokens": 128000
    },
    {
      "id": "claude-opus-5-thinking[1m]",
      "name": "claude-opus-5-thinking[1m]"
    },
    {
      "id": "claude-opus-5.5",
      "name": "claude-opus-5.5",
      "contextLength": 1000000,
      "maxOutputTokens": 128000
    },
    {
      "id": "claude-opus-5.5[1m]",
      "name": "claude-opus-5.5[1m]"
    },
    {
      "id": "claude-opus-5[1m]",
      "name": "claude-opus-5[1m]"
    },
    {
      "id": "claude-sonnet-4-5-thinking",
      "name": "claude-sonnet-4-5-thinking",
      "contextLength": 200000,
      "maxOutputTokens": 64000
    },
    {
      "id": "claude-sonnet-4-5-thinking[1m]",
      "name": "claude-sonnet-4-5-thinking[1m]"
    },
    {
      "id": "claude-sonnet-4-5[1m]",
      "name": "claude-sonnet-4-5[1m]"
    },
    {
      "id": "claude-sonnet-4-6-thinking",
      "name": "claude-sonnet-4-6-thinking",
      "contextLength": 1000000,
      "maxOutputTokens": 128000
    },
    {
      "id": "claude-sonnet-4-6-thinking[1m]",
      "name": "claude-sonnet-4-6-thinking[1m]"
    },
    {
      "id": "claude-sonnet-4.5",
      "name": "claude-sonnet-4.5",
      "contextLength": 200000,
      "maxOutputTokens": 64000
    },
    {
      "id": "claude-sonnet-4.6",
      "name": "claude-sonnet-4.6",
      "contextLength": 1000000,
      "maxOutputTokens": 128000
    },
    {
      "id": "claude-sonnet-4.6[1m]",
      "name": "claude-sonnet-4.6[1m]"
    },
    {
      "id": "claude-sonnet-5",
      "name": "claude-sonnet-5",
      "contextLength": 1000000,
      "maxOutputTokens": 128000
    },
    {
      "id": "claude-sonnet-5-5",
      "name": "claude-sonnet-5-5",
      "contextLength": 1000000,
      "maxOutputTokens": 128000
    },
    {
      "id": "claude-sonnet-5-5[1m]",
      "name": "claude-sonnet-5-5[1m]"
    },
    {
      "id": "claude-sonnet-5-thinking",
      "name": "claude-sonnet-5-thinking",
      "contextLength": 1000000,
      "maxOutputTokens": 128000
    },
    {
      "id": "claude-sonnet-5-thinking[1m]",
      "name": "claude-sonnet-5-thinking[1m]"
    },
    {
      "id": "claude-sonnet-5[1m]",
      "name": "claude-sonnet-5[1m]"
    },
    {
      "id": "codestral-latest:free",
      "name": "codestral-latest:free",
      "contextLength": 256000,
      "maxOutputTokens": 8191
    },
    {
      "id": "cohere-command-a:free",
      "name": "cohere-command-a:free",
      "contextLength": 256000,
      "maxOutputTokens": 8182
    },
    {
      "id": "deepseek-r1-distill-llama-70b:free",
      "name": "deepseek-r1-distill-llama-70b:free",
      "contextLength": 131072,
      "maxOutputTokens": 131072
    },
    {
      "id": "deepseek-r1-distill-qwen-32b:free",
      "name": "deepseek-r1-distill-qwen-32b:free",
      "contextLength": 80000,
      "maxOutputTokens": 80000
    },
    {
      "id": "deepseek-v3-0324",
      "name": "deepseek-v3-0324",
      "contextLength": 128000,
      "maxOutputTokens": 163840
    },
    {
      "id": "deepseek-v3.1",
      "name": "deepseek-v3.1",
      "contextLength": 163840,
      "maxOutputTokens": 163840
    },
    {
      "id": "deepseek-v3.1-terminus",
      "name": "deepseek-v3.1-terminus",
      "contextLength": 163840,
      "maxOutputTokens": 163840
    },
    {
      "id": "deepseek-v4-flash",
      "name": "deepseek-v4-flash",
      "contextLength": 1000000,
      "maxOutputTokens": 384000
    },
    {
      "id": "deepseek-v4-flash-0731",
      "name": "deepseek-v4-flash-0731",
      "contextLength": 1000000,
      "maxOutputTokens": 384000
    },
    {
      "id": "deepseek-v4-pro",
      "name": "deepseek-v4-pro",
      "contextLength": 1000000,
      "maxOutputTokens": 384000
    },
    {
      "id": "deepseek-v4-pro-0813",
      "name": "deepseek-v4-pro-0813",
      "contextLength": 1000000,
      "maxOutputTokens": 943718
    },
    {
      "id": "deepseek-v4.1-flash",
      "name": "deepseek-v4.1-flash",
      "contextLength": 1000000,
      "maxOutputTokens": 943718
    },
    {
      "id": "deepseek-v4.1-flash-1017",
      "name": "deepseek-v4.1-flash-1017",
      "contextLength": 1000000,
      "maxOutputTokens": 131072
    },
    {
      "id": "dots-3-note-preview:free",
      "name": "dots-3-note-preview:free",
      "contextLength": 512000,
      "maxOutputTokens": 512000
    },
    {
      "id": "gemini-2.5-flash",
      "name": "gemini-2.5-flash",
      "contextLength": 1000000,
      "maxOutputTokens": 65535
    },
    {
      "id": "gemini-2.5-pro",
      "name": "gemini-2.5-pro",
      "contextLength": 1000000,
      "maxOutputTokens": 65536
    },
    {
      "id": "gemini-2.5-pro-thinking",
      "name": "gemini-2.5-pro-thinking",
      "contextLength": 1000000,
      "maxOutputTokens": 65536
    },
    {
      "id": "gemini-3-flash",
      "name": "gemini-3-flash",
      "contextLength": 1000000,
      "maxOutputTokens": 8192
    },
    {
      "id": "gemini-3-pro",
      "name": "gemini-3-pro",
      "contextLength": 1000000,
      "maxOutputTokens": 64000
    },
    {
      "id": "gemini-3-pro-preview",
      "name": "gemini-3-pro-preview"
    },
    {
      "id": "gemini-3.1-flash-lite",
      "name": "gemini-3.1-flash-lite",
      "contextLength": 1000000,
      "maxOutputTokens": 65536
    },
    {
      "id": "gemini-3.1-flash-lite:free",
      "name": "gemini-3.1-flash-lite:free",
      "contextLength": 1000000,
      "maxOutputTokens": 65536
    },
    {
      "id": "gemini-3.1-pro",
      "name": "gemini-3.1-pro",
      "contextLength": 1000000,
      "maxOutputTokens": 65536
    },
    {
      "id": "gemini-3.1-pro-preview",
      "name": "gemini-3.1-pro-preview"
    },
    {
      "id": "gemini-3.5-flash",
      "name": "gemini-3.5-flash",
      "contextLength": 1000000,
      "maxOutputTokens": 65535
    },
    {
      "id": "gemini-3.5-flash-lite",
      "name": "gemini-3.5-flash-lite",
      "contextLength": 1000000,
      "maxOutputTokens": 65536
    },
    {
      "id": "gemini-3.5-flash-lite:free",
      "name": "gemini-3.5-flash-lite:free",
      "contextLength": 1000000,
      "maxOutputTokens": 65536
    },
    {
      "id": "gemini-3.6-flash:free",
      "name": "gemini-3.6-flash:free",
      "contextLength": 1000000,
      "maxOutputTokens": 65536
    },
    {
      "id": "gemini-3.7-flash",
      "name": "gemini-3.7-flash",
      "contextLength": 1000000,
      "maxOutputTokens": 65536
    },
    {
      "id": "gemini-3.8-flash",
      "name": "gemini-3.8-flash",
      "contextLength": 1000000,
      "maxOutputTokens": 65536
    },
    {
      "id": "gemini-4-argon",
      "name": "gemini-4-argon",
      "contextLength": 1000000,
      "maxOutputTokens": 943718
    },
    {
      "id": "gemini-flash-lite-latest:free",
      "name": "gemini-flash-lite-latest:free",
      "contextLength": 1000000,
      "maxOutputTokens": 65536
    },
    {
      "id": "gemini-nano-banana-2.1",
      "name": "gemini-nano-banana-2.1",
      "contextLength": 65536,
      "maxOutputTokens": 32768
    },
    {
      "id": "gemini-robotics-er-2-preview:free",
      "name": "gemini-robotics-er-2-preview:free",
      "contextLength": 131072,
      "maxOutputTokens": 65536
    },
    {
      "id": "gemma-4-12b:free",
      "name": "gemma-4-12b:free",
      "contextLength": 16384,
      "maxOutputTokens": 16384
    },
    {
      "id": "gemma-4-26b-a4b-it-chimerax:free",
      "name": "gemma-4-26b-a4b-it-chimerax:free",
      "contextLength": 262100,
      "maxOutputTokens": 32768
    },
    {
      "id": "gemma-4-26b-a4b-it-darksoul:free",
      "name": "gemma-4-26b-a4b-it-darksoul:free",
      "contextLength": 262100,
      "maxOutputTokens": 32768
    },
    {
      "id": "gemma-4-26b-a4b-it-luminous:free",
      "name": "gemma-4-26b-a4b-it-luminous:free",
      "contextLength": 262100,
      "maxOutputTokens": 32768
    },
    {
      "id": "gemma-4-26b-a4b-it-meromero:free",
      "name": "gemma-4-26b-a4b-it-meromero:free",
      "contextLength": 262100,
      "maxOutputTokens": 32768
    },
    {
      "id": "gemma-4-26b-a4b-it-moonlight:free",
      "name": "gemma-4-26b-a4b-it-moonlight:free",
      "contextLength": 262100,
      "maxOutputTokens": 32768
    },
    {
      "id": "gemma-4-26b:free",
      "name": "gemma-4-26b:free",
      "contextLength": 262144,
      "maxOutputTokens": 32768
    },
    {
      "id": "gemma-4-31b-it:free",
      "name": "gemma-4-31b-it:free",
      "contextLength": 262100,
      "maxOutputTokens": 16384
    },
    {
      "id": "glm-4.5",
      "name": "glm-4.5",
      "contextLength": 131100,
      "maxOutputTokens": 131072
    },
    {
      "id": "glm-4.5-flash:free",
      "name": "glm-4.5-flash:free",
      "contextLength": 131100,
      "maxOutputTokens": 32000
    },
    {
      "id": "glm-4.6",
      "name": "glm-4.6",
      "contextLength": 204800,
      "maxOutputTokens": 131072
    },
    {
      "id": "glm-4.6v-flash:free",
      "name": "glm-4.6v-flash:free",
      "contextLength": 128000,
      "maxOutputTokens": 32768
    },
    {
      "id": "glm-4.7",
      "name": "glm-4.7",
      "contextLength": 204800,
      "maxOutputTokens": 200000
    },
    {
      "id": "glm-4.7-flash:free",
      "name": "glm-4.7-flash:free",
      "contextLength": 128000,
      "maxOutputTokens": 131072
    },
    {
      "id": "glm-4.7-thinking",
      "name": "glm-4.7-thinking",
      "contextLength": 204800,
      "maxOutputTokens": 200000
    },
    {
      "id": "glm-4:free",
      "name": "glm-4:free",
      "contextLength": 24576,
      "maxOutputTokens": 8192
    },
    {
      "id": "glm-5.1",
      "name": "glm-5.1",
      "contextLength": 200000,
      "maxOutputTokens": 131072
    },
    {
      "id": "glm-5.2",
      "name": "glm-5.2",
      "contextLength": 1000000,
      "maxOutputTokens": 131072
    },
    {
      "id": "glm-5.3",
      "name": "glm-5.3",
      "contextLength": 1000000,
      "maxOutputTokens": 943718
    },
    {
      "id": "glm-5.3-flash",
      "name": "glm-5.3-flash",
      "contextLength": 1000000,
      "maxOutputTokens": 131072
    },
    {
      "id": "glm-5.3-flash-search:free",
      "name": "glm-5.3-flash-search:free",
      "contextLength": 1000000,
      "maxOutputTokens": 131072
    },
    {
      "id": "glm-5.3-flash-think-search:free",
      "name": "glm-5.3-flash-think-search:free",
      "contextLength": 1000000,
      "maxOutputTokens": 131072
    },
    {
      "id": "glm-5.3-flash-thinking:free",
      "name": "glm-5.3-flash-thinking:free",
      "contextLength": 1000000,
      "maxOutputTokens": 131072
    },
    {
      "id": "glm-5.3-flash:free",
      "name": "glm-5.3-flash:free",
      "contextLength": 1000000,
      "maxOutputTokens": 131072
    },
    {
      "id": "gpt-4o:free",
      "name": "gpt-4o:free",
      "contextLength": 128000,
      "maxOutputTokens": 16384
    },
    {
      "id": "gpt-5.5",
      "name": "gpt-5.5",
      "contextLength": 1100000,
      "maxOutputTokens": 128000
    },
    {
      "id": "gpt-5.6-luna",
      "name": "gpt-5.6-luna",
      "contextLength": 1050000,
      "maxOutputTokens": 128000
    },
    {
      "id": "gpt-5.6-sol",
      "name": "gpt-5.6-sol",
      "contextLength": 1050000,
      "maxOutputTokens": 128000
    },
    {
      "id": "gpt-5.6-terra",
      "name": "gpt-5.6-terra",
      "contextLength": 1050000,
      "maxOutputTokens": 128000
    },
    {
      "id": "gpt-6-astra",
      "name": "gpt-6-astra",
      "contextLength": 1100000,
      "maxOutputTokens": 128000
    },
    {
      "id": "gpt-6-luna",
      "name": "gpt-6-luna",
      "contextLength": 1100000,
      "maxOutputTokens": 128000
    },
    {
      "id": "gpt-6-sol",
      "name": "gpt-6-sol",
      "contextLength": 1100000,
      "maxOutputTokens": 128000
    },
    {
      "id": "gpt-6.1-sol",
      "name": "gpt-6.1-sol",
      "contextLength": 1100000,
      "maxOutputTokens": 128000
    },
    {
      "id": "gpt-oss-120b:free",
      "name": "gpt-oss-120b:free",
      "contextLength": 131072,
      "maxOutputTokens": 131072
    },
    {
      "id": "gpt-oss-20b:free",
      "name": "gpt-oss-20b:free",
      "contextLength": 128000,
      "maxOutputTokens": 128000
    },
    {
      "id": "gpt-oss-safeguard-20b:free",
      "name": "gpt-oss-safeguard-20b:free",
      "contextLength": 131072,
      "maxOutputTokens": 65536
    },
    {
      "id": "granite-4.0-micro:free",
      "name": "granite-4.0-micro:free",
      "contextLength": 131000,
      "maxOutputTokens": 131000
    },
    {
      "id": "grok-4.1-fast",
      "name": "grok-4.1-fast",
      "contextLength": 2000000,
      "maxOutputTokens": 128000
    },
    {
      "id": "grok-4.20-non-reasoning",
      "name": "grok-4.20-non-reasoning",
      "contextLength": 1000000,
      "maxOutputTokens": 8192
    },
    {
      "id": "grok-4.20-reasoning",
      "name": "grok-4.20-reasoning",
      "contextLength": 1000000,
      "maxOutputTokens": 8192
    },
    {
      "id": "grok-4.5",
      "name": "grok-4.5",
      "contextLength": 500000,
      "maxOutputTokens": 450000
    },
    {
      "id": "grok-4.6",
      "name": "grok-4.6",
      "contextLength": 500000,
      "maxOutputTokens": 128000
    },
    {
      "id": "grok-4.7",
      "name": "grok-4.7",
      "contextLength": 500000,
      "maxOutputTokens": 450000
    },
    {
      "id": "grok-beta:free",
      "name": "grok-beta:free",
      "contextLength": 24576,
      "maxOutputTokens": 8192
    },
    {
      "id": "intern-s1-mini:free",
      "name": "intern-s1-mini:free",
      "contextLength": 65536
    },
    {
      "id": "intern-s1-pro:free",
      "name": "intern-s1-pro:free",
      "contextLength": 262144
    },
    {
      "id": "intern-s1:free",
      "name": "intern-s1:free",
      "contextLength": 65536
    },
    {
      "id": "intern-s2-preview-35b:free",
      "name": "intern-s2-preview-35b:free",
      "contextLength": 262144
    },
    {
      "id": "intern-s2-preview-397b:free",
      "name": "intern-s2-preview-397b:free",
      "contextLength": 262144
    },
    {
      "id": "intern-s2-preview:free",
      "name": "intern-s2-preview:free",
      "contextLength": 262144
    },
    {
      "id": "intern-s2:free",
      "name": "intern-s2:free",
      "contextLength": 262144
    },
    {
      "id": "ising-calibration-1.5-31b:free",
      "name": "ising-calibration-1.5-31b:free",
      "contextLength": 262144
    },
    {
      "id": "k2-horizon:free",
      "name": "k2-horizon:free",
      "contextLength": 524288,
      "maxOutputTokens": 32768
    },
    {
      "id": "kimi-k2.5",
      "name": "kimi-k2.5",
      "contextLength": 262144,
      "maxOutputTokens": 235929
    },
    {
      "id": "kimi-k2.6",
      "name": "kimi-k2.6",
      "contextLength": 262100,
      "maxOutputTokens": 235929
    },
    {
      "id": "kimi-k2.7-code",
      "name": "kimi-k2.7-code",
      "contextLength": 262100,
      "maxOutputTokens": 235929
    },
    {
      "id": "kimi-k3",
      "name": "kimi-k3",
      "contextLength": 1000000,
      "maxOutputTokens": 943718
    },
    {
      "id": "kimi-k3.1-pro",
      "name": "kimi-k3.1-pro",
      "contextLength": 1000000,
      "maxOutputTokens": 943718
    },
    {
      "id": "laguna-xs-2.1:free",
      "name": "laguna-xs-2.1:free",
      "contextLength": 262144
    },
    {
      "id": "lfm-2.5-2.6b",
      "name": "lfm-2.5-2.6b",
      "contextLength": 128000,
      "maxOutputTokens": 8192
    },
    {
      "id": "lfm-2.5-2.6b:free",
      "name": "lfm-2.5-2.6b:free",
      "contextLength": 128000,
      "maxOutputTokens": 8192
    },
    {
      "id": "llama-3.1-8b:free",
      "name": "llama-3.1-8b:free",
      "contextLength": 128000,
      "maxOutputTokens": 128000
    },
    {
      "id": "llama-3.2-11b-vision:free",
      "name": "llama-3.2-11b-vision:free",
      "contextLength": 131072,
      "maxOutputTokens": 8192
    },
    {
      "id": "llama-3.3-70b:free",
      "name": "llama-3.3-70b:free",
      "contextLength": 128000,
      "maxOutputTokens": 128000
    },
    {
      "id": "llama-4-scout:free",
      "name": "llama-4-scout:free",
      "contextLength": 131072,
      "maxOutputTokens": 8192
    },
    {
      "id": "longcat-2.0",
      "name": "longcat-2.0",
      "contextLength": 1000000,
      "maxOutputTokens": 131072
    },
    {
      "id": "lucid-origin:free",
      "name": "lucid-origin:free"
    },
    {
      "id": "manta-mini-1.0:free",
      "name": "manta-mini-1.0:free",
      "contextLength": 8192
    },
    {
      "id": "mercury-2.5:free",
      "name": "mercury-2.5:free",
      "contextLength": 260000,
      "maxOutputTokens": 65536
    },
    {
      "id": "mercury-2:free",
      "name": "mercury-2:free",
      "contextLength": 128000,
      "maxOutputTokens": 50000
    },
    {
      "id": "mimo-v2.5",
      "name": "mimo-v2.5",
      "contextLength": 1000000,
      "maxOutputTokens": 131072
    },
    {
      "id": "mimo-v2.5-pro",
      "name": "mimo-v2.5-pro",
      "contextLength": 1000000,
      "maxOutputTokens": 131072
    },
    {
      "id": "mimo-v2.6-flash",
      "name": "mimo-v2.6-flash",
      "contextLength": 1000000,
      "maxOutputTokens": 131072
    },
    {
      "id": "mimo-v2.6-pro",
      "name": "mimo-v2.6-pro",
      "contextLength": 1000000,
      "maxOutputTokens": 131072
    },
    {
      "id": "minicpm5-2b:free",
      "name": "minicpm5-2b:free",
      "contextLength": 131072
    },
    {
      "id": "minimax-m2-her",
      "name": "minimax-m2-her",
      "contextLength": 65536,
      "maxOutputTokens": 2048
    },
    {
      "id": "minimax-m2.5:free",
      "name": "minimax-m2.5:free",
      "contextLength": 204800,
      "maxOutputTokens": 196608
    },
    {
      "id": "minimax-m2.7",
      "name": "minimax-m2.7",
      "contextLength": 204800,
      "maxOutputTokens": 131072
    },
    {
      "id": "minimax-m3",
      "name": "minimax-m3",
      "contextLength": 1000000,
      "maxOutputTokens": 512000
    },
    {
      "id": "mistral-7b-instruct:free",
      "name": "mistral-7b-instruct:free",
      "contextLength": 24576,
      "maxOutputTokens": 8192
    },
    {
      "id": "mistral-large-3",
      "name": "mistral-large-3",
      "contextLength": 256000,
      "maxOutputTokens": 8191
    },
    {
      "id": "mistral-large-4",
      "name": "mistral-large-4",
      "contextLength": 1000000,
      "maxOutputTokens": 262144
    },
    {
      "id": "mistral-nemo:free",
      "name": "mistral-nemo:free",
      "contextLength": 131072,
      "maxOutputTokens": 4096
    },
    {
      "id": "mistral-small",
      "name": "mistral-small",
      "contextLength": 262100,
      "maxOutputTokens": 8191
    },
    {
      "id": "mistral-small-3.2:free",
      "name": "mistral-small-3.2:free",
      "contextLength": 128000,
      "maxOutputTokens": 128000
    },
    {
      "id": "mistral-small-4-119b-2603:free",
      "name": "mistral-small-4-119b-2603:free",
      "contextLength": 262144
    },
    {
      "id": "mistral-small:free",
      "name": "mistral-small:free",
      "contextLength": 262100,
      "maxOutputTokens": 8191
    },
    {
      "id": "mn-violet-lotus-12b:free",
      "name": "mn-violet-lotus-12b:free",
      "contextLength": 131072
    },
    {
      "id": "muse-glimmer-30b:free",
      "name": "muse-glimmer-30b:free",
      "contextLength": 131072,
      "maxOutputTokens": 131072
    },
    {
      "id": "muse-spark-1.2-contributor",
      "name": "muse-spark-1.2-contributor",
      "contextLength": 1000000,
      "maxOutputTokens": 131072
    },
    {
      "id": "muse-spark-1.3-contributor",
      "name": "muse-spark-1.3-contributor",
      "contextLength": 1000000,
      "maxOutputTokens": 131072
    },
    {
      "id": "muse-wonder",
      "name": "muse-wonder",
      "contextLength": 1048576,
      "maxOutputTokens": 943718
    },
    {
      "id": "nemotron-3-nano-omni-30b-a3b-reasoning:free",
      "name": "nemotron-3-nano-omni-30b-a3b-reasoning:free",
      "contextLength": 262144
    },
    {
      "id": "nemotron-3-super-120b-a12b:free",
      "name": "nemotron-3-super-120b-a12b:free",
      "contextLength": 262144,
      "maxOutputTokens": 262144
    },
    {
      "id": "nemotron-3-ultra-550b-a55b:free",
      "name": "nemotron-3-ultra-550b-a55b:free",
      "contextLength": 1000000,
      "maxOutputTokens": 182520
    },
    {
      "id": "nemotron-3.5-bolt-e4b:free",
      "name": "nemotron-3.5-bolt-e4b:free"
    },
    {
      "id": "nemotron-3.5-lightning-30b-a3b:free",
      "name": "nemotron-3.5-lightning-30b-a3b:free",
      "contextLength": 262144,
      "maxOutputTokens": 235929
    },
    {
      "id": "nemotron-3.5-super-vl:free",
      "name": "nemotron-3.5-super-vl:free",
      "contextLength": 1048576,
      "maxOutputTokens": 235929
    },
    {
      "id": "nemotron-sea-lion-v4.8-120b-a12b:free",
      "name": "nemotron-sea-lion-v4.8-120b-a12b:free"
    },
    {
      "id": "north-mini-code:free",
      "name": "north-mini-code:free",
      "contextLength": 262144
    },
    {
      "id": "or-claude-haiku-5-5",
      "name": "or-claude-haiku-5-5",
      "contextLength": 1000000,
      "maxOutputTokens": 16000
    },
    {
      "id": "or-claude-haiku-5-5[1m]",
      "name": "or-claude-haiku-5-5[1m]"
    },
    {
      "id": "or-glm-5.3",
      "name": "or-glm-5.3",
      "contextLength": 1000000,
      "maxOutputTokens": 943718
    },
    {
      "id": "or-kimi-k3",
      "name": "or-kimi-k3",
      "contextLength": 1000000,
      "maxOutputTokens": 943718
    },
    {
      "id": "or-kimi-k3.1-pro",
      "name": "or-kimi-k3.1-pro",
      "contextLength": 1000000,
      "maxOutputTokens": 943718
    },
    {
      "id": "phoenix-1.0:free",
      "name": "phoenix-1.0:free"
    },
    {
      "id": "pllum-12b-instruct:free",
      "name": "pllum-12b-instruct:free",
      "contextLength": 131072
    },
    {
      "id": "qwen-sea-lion-v4-32b-it:free",
      "name": "qwen-sea-lion-v4-32b-it:free",
      "contextLength": 32768,
      "maxOutputTokens": 4096
    },
    {
      "id": "qwen-sea-lion-v4.5-27b-it:free",
      "name": "qwen-sea-lion-v4.5-27b-it:free",
      "contextLength": 262144
    },
    {
      "id": "qwen2.5-coder-32b:free",
      "name": "qwen2.5-coder-32b:free",
      "contextLength": 32768,
      "maxOutputTokens": 32768
    },
    {
      "id": "qwen2.5-vl-72b-instruct:free",
      "name": "qwen2.5-vl-72b-instruct:free",
      "contextLength": 32000,
      "maxOutputTokens": 32000
    },
    {
      "id": "qwen2.5-vl-7b-instruct-awq:free",
      "name": "qwen2.5-vl-7b-instruct-awq:free",
      "contextLength": 32768
    },
    {
      "id": "qwen3-coder-plus:free",
      "name": "qwen3-coder-plus:free",
      "contextLength": 1000000,
      "maxOutputTokens": 65536
    },
    {
      "id": "qwen3.5-27b-derestricted:free",
      "name": "qwen3.5-27b-derestricted:free",
      "contextLength": 262100,
      "maxOutputTokens": 65536
    },
    {
      "id": "qwen3.5-397b-a17b:free",
      "name": "qwen3.5-397b-a17b:free",
      "contextLength": 262100,
      "maxOutputTokens": 235929
    },
    {
      "id": "qwen3.5-4b:free",
      "name": "qwen3.5-4b:free",
      "contextLength": 262144
    },
    {
      "id": "qwen3.5-9b:free",
      "name": "qwen3.5-9b:free",
      "contextLength": 262144,
      "maxOutputTokens": 235929
    },
    {
      "id": "qwen3.6-27b:free",
      "name": "qwen3.6-27b:free",
      "contextLength": 262100,
      "maxOutputTokens": 65536
    },
    {
      "id": "qwen3.6-35b-a3b:free",
      "name": "qwen3.6-35b-a3b:free",
      "contextLength": 262100,
      "maxOutputTokens": 235929
    },
    {
      "id": "qwen3.7-max",
      "name": "qwen3.7-max",
      "contextLength": 1000000,
      "maxOutputTokens": 65536
    },
    {
      "id": "qwen3.8-27b:free",
      "name": "qwen3.8-27b:free",
      "contextLength": 65536,
      "maxOutputTokens": 32768
    },
    {
      "id": "qwen3.8-flash",
      "name": "qwen3.8-flash",
      "contextLength": 1000000,
      "maxOutputTokens": 131072
    },
    {
      "id": "qwen3.8-max",
      "name": "qwen3.8-max",
      "contextLength": 1000000,
      "maxOutputTokens": 131072
    },
    {
      "id": "qwen3.8-omni-flash",
      "name": "qwen3.8-omni-flash",
      "contextLength": 1000000,
      "maxOutputTokens": 131072
    },
    {
      "id": "qwen3:free",
      "name": "qwen3:free",
      "contextLength": 24576,
      "maxOutputTokens": 8192
    },
    {
      "id": "qwq-32b:free",
      "name": "qwq-32b:free",
      "contextLength": 24000,
      "maxOutputTokens": 24000
    },
    {
      "id": "riva-translate-4b-instruct-v2:free",
      "name": "riva-translate-4b-instruct-v2:free",
      "contextLength": 8192
    },
    {
      "id": "sensenova-6.8-flash-lite:free",
      "name": "sensenova-6.8-flash-lite:free",
      "contextLength": 262100
    },
    {
      "id": "step-5-preview",
      "name": "step-5-preview",
      "contextLength": 1000000,
      "maxOutputTokens": 65536
    },
    {
      "id": "swe-1-6-slow:free",
      "name": "swe-1-6-slow:free",
      "contextLength": 6400
    },
    {
      "id": "typhoon-v2.5-30b-a3b-instruct:free",
      "name": "typhoon-v2.5-30b-a3b-instruct:free",
      "contextLength": 131072
    },
    {
      "id": "villanova-2b-2512-preview-apnea-ft:free",
      "name": "villanova-2b-2512-preview-apnea-ft:free",
      "contextLength": 32768
    },
    {
      "id": "voyage-4-large:free",
      "name": "voyage-4-large:free",
      "contextLength": 32000
    },
    {
      "id": "voyage-4-lite:free",
      "name": "voyage-4-lite:free",
      "contextLength": 32000
    },
    {
      "id": "voyage-4:free",
      "name": "voyage-4:free",
      "contextLength": 32000
    },
    {
      "id": "voyage-code-2:free",
      "name": "voyage-code-2:free",
      "contextLength": 16000
    },
    {
      "id": "voyage-code-4:free",
      "name": "voyage-code-4:free",
      "contextLength": 32000
    },
    {
      "id": "voyage-finance-2:free",
      "name": "voyage-finance-2:free",
      "contextLength": 32000
    },
    {
      "id": "voyage-law-2:free",
      "name": "voyage-law-2:free",
      "contextLength": 16000
    },
    {
      "id": "voyage-multilingual-2:free",
      "name": "voyage-multilingual-2:free",
      "contextLength": 32000
    },
    {
      "id": "xing4.0-29b-a4b:free",
      "name": "xing4.0-29b-a4b:free",
      "contextLength": 262144
    }
  ],
  "modelsFetcher": {
    "url": "https://api.unorouter.com/v1/models",
    "type": "openai"
  },
  "passthroughModels": true
};
