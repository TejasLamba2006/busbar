export default {
  "id": "numes",
  "alias": "numes",
  "uiAlias": "numes",
  "hasFree": true,
  "display": {
    "name": "Numes",
    "icon": "numes",
    "color": "#18181B",
    "textIcon": "NM",
    "website": "https://numes.ai",
    "notice": {
      "text": "Includes 338 models with 8 1M-context :free models (z-ai/glm-5.3-flash:free, z-ai/glm-5.3:free, deepseek/deepseek-v4.1-flash-1017:free, moonshotai/kimi-k3.1-pro:free).",
      "apiKeyUrl": "https://numes.ai"
    }
  },
  "category": "freeTier",
  "authType": "apikey",
  "authModes": [
    "apikey"
  ],
  "transport": {
    "baseUrl": "https://api.numes.ai/api/v1/chat/completions",
    "validateUrl": "https://api.numes.ai/api/v1/key"
  },
  "models": [
    {
      "id": "z-ai/glm-5.3-flash:free",
      "name": "GLM 5.3 Flash (free)",
      "contextLength": 1048576,
      "maxOutputTokens": 131072
    },
    {
      "id": "z-ai/glm-5.3:free",
      "name": "GLM 5.3 (free)",
      "contextLength": 1048576,
      "maxOutputTokens": 131072
    },
    {
      "id": "deepseek/deepseek-v4.1-flash-1017:free",
      "name": "DeepSeek V4.1 Flash 1017 (free)",
      "contextLength": 1048576,
      "maxOutputTokens": 131072
    },
    {
      "id": "moonshotai/kimi-k3.1-pro:free",
      "name": "Kimi K3.1 Pro (free)",
      "contextLength": 1048576,
      "maxOutputTokens": 131072
    },
    {
      "id": "dealignai/glm-5.3-flash-uncensored-fp8:free",
      "name": "GLM 5.3 Flash Uncensored FP8 (free)",
      "contextLength": 1048576,
      "maxOutputTokens": 131072
    },
    {
      "id": "dealignai/glm-5.3-uncensored-fp8:free",
      "name": "GLM 5.3 Uncensored FP8 (free)",
      "contextLength": 1048576,
      "maxOutputTokens": 131072
    },
    {
      "id": "deepseek/deepseek-v4.1-flash-1017-uncensored:free",
      "name": "DeepSeek V4.1 Flash 1017 Uncensored FP8 (free)",
      "contextLength": 1048576,
      "maxOutputTokens": 131072
    },
    {
      "id": "uniboshi/kimi-k3-abliterated-v1:free",
      "name": "Kimi K3 Abliterated (free)",
      "contextLength": 1048576,
      "maxOutputTokens": 131072
    },
    {
      "id": "amazon/nova-2-lite-v1",
      "name": "Nova 2 Lite",
      "contextLength": 1000000
    },
    {
      "id": "amazon/nova-lite-v1",
      "name": "Nova Lite 1.0",
      "contextLength": 300000
    },
    {
      "id": "amazon/nova-micro-v1",
      "name": "Nova Micro 1.0",
      "contextLength": 128000
    },
    {
      "id": "amazon/nova-premier-v1",
      "name": "Nova Premier 1.0",
      "contextLength": 1000000
    },
    {
      "id": "amazon/nova-pro-v1",
      "name": "Nova Pro 1.0",
      "contextLength": 300000
    },
    {
      "id": "anthropic/claude-fable-5",
      "name": "Claude Fable 5",
      "contextLength": 1000000
    },
    {
      "id": "anthropic/claude-fable-5.1",
      "name": "Claude Fable 5.1",
      "contextLength": 1000000,
      "maxOutputTokens": 128000
    },
    {
      "id": "anthropic/claude-fable-5.2",
      "name": "Claude Fable 5.2",
      "contextLength": 1000000,
      "maxOutputTokens": 128000
    },
    {
      "id": "anthropic/claude-haiku-4.5",
      "name": "Claude Haiku 4.5",
      "contextLength": 200000
    },
    {
      "id": "anthropic/claude-haiku-5.5",
      "name": "Claude Haiku 5.5",
      "contextLength": 1000000,
      "maxOutputTokens": 128000
    },
    {
      "id": "anthropic/claude-opus-4.1",
      "name": "Claude Opus 4.1",
      "contextLength": 200000
    },
    {
      "id": "anthropic/claude-opus-4.5",
      "name": "Claude Opus 4.5",
      "contextLength": 200000,
      "maxOutputTokens": 64000
    },
    {
      "id": "anthropic/claude-opus-4.6",
      "name": "Claude Opus 4.6",
      "contextLength": 1000000,
      "maxOutputTokens": 128000
    },
    {
      "id": "anthropic/claude-opus-4.7",
      "name": "Claude Opus 4.7",
      "contextLength": 1000000
    },
    {
      "id": "anthropic/claude-opus-4.8",
      "name": "Claude Opus 4.8",
      "contextLength": 1000000
    },
    {
      "id": "anthropic/claude-opus-5",
      "name": "Claude Opus 5",
      "contextLength": 1000000
    },
    {
      "id": "anthropic/claude-opus-5.5",
      "name": "Claude Opus 5.5",
      "contextLength": 1000000
    },
    {
      "id": "anthropic/claude-sonnet-4.5",
      "name": "Claude Sonnet 4.5",
      "contextLength": 1000000
    },
    {
      "id": "anthropic/claude-sonnet-4.6",
      "name": "Claude Sonnet 4.6",
      "contextLength": 1000000
    },
    {
      "id": "anthropic/claude-sonnet-5",
      "name": "Claude Sonnet 5",
      "contextLength": 1000000
    },
    {
      "id": "anthropic/claude-sonnet-5.5",
      "name": "Claude Sonnet 5.5",
      "contextLength": 1000000
    },
    {
      "id": "baichuan/baichuan-m2-32b",
      "name": "Baichuan M2 32B",
      "contextLength": 131072,
      "maxOutputTokens": 131072
    },
    {
      "id": "baidu/ernie-5.5-flash-preview",
      "name": "ERNIE-5.5-Flash-Preview",
      "contextLength": 1024000
    },
    {
      "id": "baidu/ernie-light-dt-1.0-intl",
      "name": "ERNIE-Light-DT-1.0",
      "contextLength": 1024000
    },
    {
      "id": "bytedance-seed/seed-2-1-turbo",
      "name": "Seed 2.1 Turbo",
      "contextLength": 262144
    },
    {
      "id": "bytedance-seed/seed-2.0-lite",
      "name": "Seed-2.0-Lite",
      "contextLength": 262144
    },
    {
      "id": "bytedance/seed-1.8",
      "name": "Seed 1.8",
      "contextLength": 256000
    },
    {
      "id": "bytedance/seed-2.0-code",
      "name": "Seed 2.0 Code",
      "contextLength": 256000
    },
    {
      "id": "bytedance/seed-2.0-mini",
      "name": "Seed 2.0 Mini",
      "contextLength": 256000
    },
    {
      "id": "bytedance/seed-2.0-pro",
      "name": "Seed 2.0 Pro",
      "contextLength": 256000
    },
    {
      "id": "bytedance/ui-tars-1.5-7b",
      "name": "UI-TARS 7B",
      "contextLength": 128000
    },
    {
      "id": "cohere/command-a",
      "name": "Command A",
      "contextLength": 256000
    },
    {
      "id": "cohere/command-a-plus",
      "name": "Command A+",
      "contextLength": 192000
    },
    {
      "id": "cohere/command-r-08-2024",
      "name": "Command R (08-2024)",
      "contextLength": 128000
    },
    {
      "id": "cohere/command-r-plus-08-2024",
      "name": "Command R+ (08-2024)",
      "contextLength": 128000
    },
    {
      "id": "cohere/command-r7b-12-2024",
      "name": "Command R7B (12-2024)",
      "contextLength": 128000
    },
    {
      "id": "cohere/north-mini-code",
      "name": "North Mini Code",
      "contextLength": 256000
    },
    {
      "id": "dealignai/deepseek-v4.1-flash-1017-uncensored",
      "name": "DeepSeek V4.1 Flash 1017 Uncensored",
      "contextLength": 1000000,
      "maxOutputTokens": 131072
    },
    {
      "id": "deepseek/deepseek-chat",
      "name": "DeepSeek V3",
      "contextLength": 163840
    },
    {
      "id": "deepseek/deepseek-chat-v3-0324",
      "name": "DeepSeek V3 0324",
      "contextLength": 163840
    },
    {
      "id": "deepseek/deepseek-chat-v3.1",
      "name": "DeepSeek V3.1",
      "contextLength": 163840,
      "maxOutputTokens": 131072
    },
    {
      "id": "deepseek/deepseek-ocr-2",
      "name": "DeepSeek OCR 2",
      "contextLength": 8192,
      "maxOutputTokens": 8192
    },
    {
      "id": "deepseek/deepseek-r1-0528",
      "name": "DeepSeek R1 0528",
      "contextLength": 163840,
      "maxOutputTokens": 32768
    },
    {
      "id": "deepseek/deepseek-r1-0528-qwen3-8b",
      "name": "DeepSeek R1 Distill Qwen3 8B 0528",
      "contextLength": 128000,
      "maxOutputTokens": 32000
    },
    {
      "id": "deepseek/deepseek-r1-turbo",
      "name": "DeepSeek R1 Turbo",
      "contextLength": 64000,
      "maxOutputTokens": 16000
    },
    {
      "id": "deepseek/deepseek-v3.1-terminus",
      "name": "DeepSeek V3.1 Terminus",
      "contextLength": 163840
    },
    {
      "id": "deepseek/deepseek-v3.2",
      "name": "DeepSeek V3.2",
      "contextLength": 163840,
      "maxOutputTokens": 131072
    },
    {
      "id": "deepseek/deepseek-v3.2-exp",
      "name": "DeepSeek V3.2 Exp",
      "contextLength": 163840
    },
    {
      "id": "deepseek/deepseek-v4-flash",
      "name": "DeepSeek V4 Flash 0423",
      "contextLength": 1048576
    },
    {
      "id": "deepseek/deepseek-v4-flash-0731",
      "name": "DeepSeek V4 Flash 0731",
      "contextLength": 1048576
    },
    {
      "id": "deepseek/deepseek-v4-flash-vision-exp",
      "name": "DeepSeek V4 Flash Vision Exp",
      "contextLength": 1048576
    },
    {
      "id": "deepseek/deepseek-v4-pro",
      "name": "DeepSeek V4 Pro 0423",
      "contextLength": 1048576
    },
    {
      "id": "deepseek/deepseek-v4-pro-0813",
      "name": "DeepSeek V4 Pro 0813",
      "contextLength": 1048576,
      "maxOutputTokens": 131072
    },
    {
      "id": "deepseek/deepseek-v4.1-flash",
      "name": "DeepSeek V4.1 Flash",
      "contextLength": 1048576,
      "maxOutputTokens": 131072
    },
    {
      "id": "deepseek/deepseek-v4.1-flash-1017",
      "name": "DeepSeek V4.1 Flash 1017",
      "contextLength": 1048576,
      "maxOutputTokens": 131072
    },
    {
      "id": "deepseek/deepseek-v4.1-flash-1017-ultrafast",
      "name": "Deepseek V4.1 Flash 1017 Ultrafast",
      "contextLength": 393216,
      "maxOutputTokens": 131072
    },
    {
      "id": "deepseek/deepseek-v4.1-flash:e2ee",
      "name": "DeepSeek V4.1 Flash",
      "contextLength": 1048576,
      "maxOutputTokens": 131072
    },
    {
      "id": "google/gemini-2.5-flash",
      "name": "Gemini 2.5 Flash",
      "contextLength": 1000000
    },
    {
      "id": "google/gemini-2.5-flash-lite",
      "name": "Gemini 2.5 Flash Lite",
      "contextLength": 1048576
    },
    {
      "id": "google/gemini-2.5-pro",
      "name": "Gemini 2.5 Pro",
      "contextLength": 1000000
    },
    {
      "id": "google/gemini-2.5-pro-preview",
      "name": "Gemini 2.5 Pro Preview 06-05",
      "contextLength": 1048576
    },
    {
      "id": "google/gemini-3-flash-preview",
      "name": "Gemini 3 Flash Preview",
      "contextLength": 1048576
    },
    {
      "id": "google/gemini-3.1-flash-lite",
      "name": "Gemini 3.1 Flash Lite",
      "contextLength": 1000000
    },
    {
      "id": "google/gemini-3.1-flash-lite-preview",
      "name": "Gemini 3.1 Flash Lite Preview",
      "contextLength": 1048576
    },
    {
      "id": "google/gemini-3.1-pro",
      "name": "Gemini 3.1 Pro",
      "contextLength": 1000000
    },
    {
      "id": "google/gemini-3.1-pro-preview",
      "name": "Gemini 3.1 Pro Preview",
      "contextLength": 1048576
    },
    {
      "id": "google/gemini-3.1-pro-preview-customtools",
      "name": "Gemini 3.1 Pro Preview Custom Tools",
      "contextLength": 1048576
    },
    {
      "id": "google/gemini-3.5-flash",
      "name": "Gemini 3.5 Flash",
      "contextLength": 1000000
    },
    {
      "id": "google/gemini-3.5-flash-lite",
      "name": "Gemini 3.5 Flash Lite",
      "contextLength": 1048576
    },
    {
      "id": "google/gemini-3.6-flash",
      "name": "Gemini 3.6 Flash",
      "contextLength": 1048576
    },
    {
      "id": "google/gemini-3.7-flash",
      "name": "Gemini 3.7 Flash",
      "contextLength": 1000000
    },
    {
      "id": "google/gemini-3.8-flash",
      "name": "Gemini 3.8 Flash",
      "contextLength": 1048576
    },
    {
      "id": "google/gemini-4-argon",
      "name": "Gemini 4 Argon",
      "contextLength": 1048576
    },
    {
      "id": "google/gemini-4-carbon",
      "name": "Gemini 4 Carbon",
      "contextLength": 1048576
    },
    {
      "id": "google/gemini-4-hydrogen",
      "name": "Gemini 4 Hydrogen",
      "contextLength": 1048576
    },
    {
      "id": "google/gemma-2-27b-it",
      "name": "Gemma 2 27B",
      "contextLength": 8192
    },
    {
      "id": "google/gemma-3-12b-it",
      "name": "Gemma 3 12B It",
      "contextLength": 131072
    },
    {
      "id": "google/gemma-3-27b-it",
      "name": "Gemma 3 27B It",
      "contextLength": 131072
    },
    {
      "id": "google/gemma-3-4b-it",
      "name": "Gemma 3 4B It",
      "contextLength": 131072
    },
    {
      "id": "google/gemma-4-26b-a4b-it",
      "name": "Gemma 4 26B A4B It",
      "contextLength": 262144
    },
    {
      "id": "google/gemma-4-31b-it",
      "name": "Gemma 4 31B It",
      "contextLength": 262144
    },
    {
      "id": "google/gemma-4-31b-it-turbo",
      "name": "Gemma 4 31B It Turbo",
      "contextLength": 262144,
      "maxOutputTokens": 16384
    },
    {
      "id": "google/gemma-4-31b-it-ultra",
      "name": "Gemma 4 31B It Ultra",
      "contextLength": 131072,
      "maxOutputTokens": 8192
    },
    {
      "id": "google/gemma-4-31b-it:e2ee",
      "name": "Gemma 4 31B It",
      "contextLength": 262144,
      "maxOutputTokens": 131072
    },
    {
      "id": "gryphe/mythomax-l2-13b",
      "name": "MythoMax L2 13B",
      "contextLength": 4096,
      "maxOutputTokens": 3200
    },
    {
      "id": "ibm-granite/granite-4.2-8b",
      "name": "Granite 4.2 8B",
      "contextLength": 131072
    },
    {
      "id": "inclusionai/ling-3.0-flash",
      "name": "Ling 3.0 Flash",
      "contextLength": 131072,
      "maxOutputTokens": 32768
    },
    {
      "id": "inclusionai/ling-3.0-flash-fin",
      "name": "Ling 3.0 Flash Fin",
      "contextLength": 262144,
      "maxOutputTokens": 32768
    },
    {
      "id": "inclusionai/ling-3.0-flash-sante",
      "name": "Ling 3.0 Flash Sante",
      "contextLength": 262144,
      "maxOutputTokens": 32768
    },
    {
      "id": "inclusionai/ling-3.0-flash-vl",
      "name": "Ling 3.0 Flash VL",
      "contextLength": 131072,
      "maxOutputTokens": 32768
    },
    {
      "id": "inclusionai/ling-3.0-tiny",
      "name": "Ling 3.0 Tiny",
      "contextLength": 262144
    },
    {
      "id": "inclusionai/ling-3.1-flash",
      "name": "Ling 3.1 Flash",
      "contextLength": 1000000
    },
    {
      "id": "inclusionai/ling-3.2-flash",
      "name": "Ling 3.2 Flash",
      "contextLength": 1048576
    },
    {
      "id": "liquid/lfm-2.5-24b-a2b",
      "name": "LFM2.5-24B-A2B",
      "contextLength": 128000
    },
    {
      "id": "liquid/lfm-3-1.7b",
      "name": "LFM3-1.7B",
      "contextLength": 262144
    },
    {
      "id": "meituan/longcat-2.0",
      "name": "LongCat 2.0",
      "contextLength": 1048756
    },
    {
      "id": "meta-llama/llama-3.1-70b-instruct",
      "name": "Llama 3.1 70B Instruct",
      "contextLength": 131072
    },
    {
      "id": "meta-llama/llama-3.1-8b-instruct",
      "name": "Llama 3.1 8B Instruct",
      "contextLength": 16384,
      "maxOutputTokens": 16384
    },
    {
      "id": "meta-llama/llama-3.2-1b-instruct",
      "name": "Llama 3.2 1B Instruct",
      "contextLength": 60000
    },
    {
      "id": "meta-llama/llama-3.2-3b-instruct",
      "name": "Llama 3.2 3B Instruct",
      "contextLength": 131072
    },
    {
      "id": "meta-llama/llama-3.3-70b-instruct",
      "name": "Llama 3.3 70B Instruct",
      "contextLength": 131072,
      "maxOutputTokens": 16384
    },
    {
      "id": "meta-llama/llama-4-scout",
      "name": "Llama 4 Scout",
      "contextLength": 327680
    },
    {
      "id": "meta-llama/llama-guard-4-12b",
      "name": "Llama Guard 4 12B",
      "contextLength": 163840
    },
    {
      "id": "meta-llama/meta-llama-3.1-8b-instruct-turbo",
      "name": "Meta Llama 3.1 8B Instruct Turbo",
      "contextLength": 131072
    },
    {
      "id": "meta/muse-ember",
      "name": "Muse Ember",
      "contextLength": 1048576
    },
    {
      "id": "meta/muse-glimmer-30b",
      "name": "Muse Glimmer 30B",
      "contextLength": 131072
    },
    {
      "id": "meta/muse-spark-1.1",
      "name": "Muse Spark 1.1",
      "contextLength": 1048576
    },
    {
      "id": "meta/muse-spark-1.2",
      "name": "Muse Spark 1.2",
      "contextLength": 1048576
    },
    {
      "id": "meta/muse-spark-1.2-contributor",
      "name": "Muse Spark 1.2 Contributor",
      "contextLength": 1048576
    },
    {
      "id": "meta/muse-spark-1.3",
      "name": "Muse Spark 1.3",
      "contextLength": 1048576
    },
    {
      "id": "meta/muse-spark-1.3-contributor",
      "name": "Muse Spark 1.3 Contributor",
      "contextLength": 1048576
    },
    {
      "id": "meta/muse-spark-open",
      "name": "Muse Spark Open",
      "contextLength": 1048576
    },
    {
      "id": "meta/muse-wonder",
      "name": "Muse Wonder",
      "contextLength": 1048576
    },
    {
      "id": "microsoft/phi-4",
      "name": "Phi 4",
      "contextLength": 16384
    },
    {
      "id": "microsoft/wizardlm-2-8x22b",
      "name": "WizardLM-2 8x22B",
      "contextLength": 65535,
      "maxOutputTokens": 8000
    },
    {
      "id": "mindai/macaron-v1-tall",
      "name": "Macaron V1 Tall",
      "contextLength": 262144,
      "maxOutputTokens": 32768
    },
    {
      "id": "mindai/macaron-v1-venti",
      "name": "Macaron V1 Venti",
      "contextLength": 1048576,
      "maxOutputTokens": 131072
    },
    {
      "id": "minimax/minimax-m2.5",
      "name": "MiniMax M2.5",
      "contextLength": 204800,
      "maxOutputTokens": 131072
    },
    {
      "id": "minimax/minimax-m2.7",
      "name": "MiniMax M2.7",
      "contextLength": 196608
    },
    {
      "id": "minimax/minimax-m3",
      "name": "MiniMax M3",
      "contextLength": 524288,
      "maxOutputTokens": 131072
    },
    {
      "id": "minimax/minimax-m3.1-flash",
      "name": "MiniMax M3.1 Flash",
      "contextLength": 1000000,
      "maxOutputTokens": 131072
    },
    {
      "id": "mistralai/codestral-2508",
      "name": "Codestral 2508",
      "contextLength": 256000
    },
    {
      "id": "mistralai/devstral-2512",
      "name": "Devstral 2 2512",
      "contextLength": 262144
    },
    {
      "id": "mistralai/ministral-14b-2512",
      "name": "Ministral 3 14B 2512",
      "contextLength": 262144
    },
    {
      "id": "mistralai/ministral-3b-2512",
      "name": "Ministral 3 3B 2512",
      "contextLength": 131072
    },
    {
      "id": "mistralai/ministral-8b-2512",
      "name": "Ministral 3 8B 2512",
      "contextLength": 262144
    },
    {
      "id": "mistralai/mistral-large",
      "name": "Mistral Large",
      "contextLength": 128000
    },
    {
      "id": "mistralai/mistral-large-2407",
      "name": "Mistral Large 2407",
      "contextLength": 131072
    },
    {
      "id": "mistralai/mistral-large-2512",
      "name": "Mistral Large 3 2512",
      "contextLength": 262144
    },
    {
      "id": "mistralai/mistral-large-4-0",
      "name": "Mistral Large 4",
      "contextLength": 1048576
    },
    {
      "id": "mistralai/mistral-medium-3",
      "name": "Mistral Medium 3",
      "contextLength": 131072
    },
    {
      "id": "mistralai/mistral-medium-3-5",
      "name": "Mistral Medium 3.5",
      "contextLength": 262144
    },
    {
      "id": "mistralai/mistral-medium-3.1",
      "name": "Mistral Medium 3.1",
      "contextLength": 131072
    },
    {
      "id": "mistralai/mistral-nemo",
      "name": "Mistral Nemo",
      "contextLength": 131072
    },
    {
      "id": "mistralai/mistral-saba",
      "name": "Saba",
      "contextLength": 32768
    },
    {
      "id": "mistralai/mistral-small-24b-instruct-2501",
      "name": "Mistral Small 3",
      "contextLength": 32768
    },
    {
      "id": "mistralai/mistral-small-2603",
      "name": "Mistral Small 4",
      "contextLength": 262144
    },
    {
      "id": "mistralai/mistral-small-3.1-24b-instruct",
      "name": "Mistral Small 3.1 24B",
      "contextLength": 128000
    },
    {
      "id": "mistralai/mistral-small-3.2-24b-instruct",
      "name": "Mistral Small 3.2 24B Instruct 2506",
      "contextLength": 128000
    },
    {
      "id": "mistralai/mixtral-8x22b-instruct",
      "name": "Mixtral 8x22B Instruct",
      "contextLength": 65536
    },
    {
      "id": "mistralai/voxtral-small-24b-2507",
      "name": "Voxtral Small 24B 2507",
      "contextLength": 32768
    },
    {
      "id": "moonshotai/kimi-k2",
      "name": "Kimi K2 0711",
      "contextLength": 131072
    },
    {
      "id": "moonshotai/kimi-k2-0905",
      "name": "Kimi K2 Instruct 0905",
      "contextLength": 262144,
      "maxOutputTokens": 98304
    },
    {
      "id": "moonshotai/kimi-k2-instruct",
      "name": "Kimi K2 Instruct",
      "contextLength": 131072,
      "maxOutputTokens": 98304
    },
    {
      "id": "moonshotai/kimi-k2-thinking",
      "name": "Kimi K2 Thinking",
      "contextLength": 262144,
      "maxOutputTokens": 98304
    },
    {
      "id": "moonshotai/kimi-k2.5",
      "name": "Kimi K2.5",
      "contextLength": 262144
    },
    {
      "id": "moonshotai/kimi-k2.6",
      "name": "Kimi K2.6",
      "contextLength": 262144
    },
    {
      "id": "moonshotai/kimi-k2.7-code",
      "name": "Kimi K2.7 Code",
      "contextLength": 262144
    },
    {
      "id": "moonshotai/kimi-k3",
      "name": "Kimi K3",
      "contextLength": 1048576,
      "maxOutputTokens": 131072
    },
    {
      "id": "moonshotai/kimi-k3.1-pro",
      "name": "Kimi K3.1 Pro",
      "contextLength": 1048576
    },
    {
      "id": "moonshotai/kimi-k3.1-pro-highspeed",
      "name": "Kimi K3.1 Pro Highspeed",
      "contextLength": 1048576,
      "maxOutputTokens": 131072
    },
    {
      "id": "moonshotai/kimi-k3.1-pro:e2ee",
      "name": "Kimi K3.1 Pro",
      "contextLength": 262144,
      "maxOutputTokens": 131072
    },
    {
      "id": "nex-agi/nex-n2.5-mini",
      "name": "Nex-N2.5-Mini",
      "contextLength": 262144
    },
    {
      "id": "nex-agi/nex-n2.5-pro",
      "name": "Nex-N2.5-Pro",
      "contextLength": 262144
    },
    {
      "id": "nex-agi/nex-n2.6",
      "name": "Nex-N2.6",
      "contextLength": 262144
    },
    {
      "id": "nousresearch/hermes-2-pro-llama-3-8b",
      "name": "Hermes 2 Pro Llama 3 8B",
      "contextLength": 8192,
      "maxOutputTokens": 8192
    },
    {
      "id": "nousresearch/hermes-4-405b",
      "name": "Hermes 4 405B",
      "contextLength": 131072
    },
    {
      "id": "nvidia/nemotron-3-nano-30b-a3b",
      "name": "Nemotron 3 Nano 30B A3B",
      "contextLength": 262144,
      "maxOutputTokens": 32768
    },
    {
      "id": "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning",
      "name": "Nemotron 3 Nano Omni",
      "contextLength": 256000
    },
    {
      "id": "nvidia/nemotron-3-super-120b-a12b",
      "name": "Nemotron 3 Super",
      "contextLength": 262144
    },
    {
      "id": "nvidia/nemotron-3-ultra-550b-a55b",
      "name": "Nemotron 3 Ultra",
      "contextLength": 262144,
      "maxOutputTokens": 16384
    },
    {
      "id": "nvidia/nemotron-3.5-content-safety",
      "name": "Nemotron 3.5 Content Safety",
      "contextLength": 131072
    },
    {
      "id": "nvidia/nemotron-3.5-lightning",
      "name": "Nemotron 3.5 Lightning",
      "contextLength": 262144,
      "maxOutputTokens": 32768
    },
    {
      "id": "nvidia/nemotron-3.5-super-vl",
      "name": "Nemotron 3.5 Super VL",
      "contextLength": 262144
    },
    {
      "id": "openai/gpt-3.5-turbo-0613",
      "name": "GPT-3.5 Turbo (older v0613)",
      "contextLength": 4095
    },
    {
      "id": "openai/gpt-3.5-turbo-16k",
      "name": "GPT-3.5 Turbo 16k",
      "contextLength": 16385
    },
    {
      "id": "openai/gpt-4",
      "name": "GPT-4",
      "contextLength": 8191
    },
    {
      "id": "openai/gpt-4.1",
      "name": "GPT-4.1",
      "contextLength": 1047576
    },
    {
      "id": "openai/gpt-4.1-mini",
      "name": "GPT-4.1 Mini",
      "contextLength": 1047576
    },
    {
      "id": "openai/gpt-4.1-nano",
      "name": "GPT-4.1 Nano",
      "contextLength": 1047576
    },
    {
      "id": "openai/gpt-4o",
      "name": "GPT-4o",
      "contextLength": 128000
    },
    {
      "id": "openai/gpt-4o-2024-05-13",
      "name": "GPT-4o (2024-05-13)",
      "contextLength": 128000
    },
    {
      "id": "openai/gpt-4o-2024-08-06",
      "name": "GPT-4o (2024-08-06)",
      "contextLength": 128000
    },
    {
      "id": "openai/gpt-4o-2024-11-20",
      "name": "GPT-4o (2024-11-20)",
      "contextLength": 128000
    },
    {
      "id": "openai/gpt-4o-mini",
      "name": "GPT-4o-mini",
      "contextLength": 128000
    },
    {
      "id": "openai/gpt-4o-mini-2024-07-18",
      "name": "GPT-4o-mini (2024-07-18)",
      "contextLength": 128000
    },
    {
      "id": "openai/gpt-5",
      "name": "GPT-5",
      "contextLength": 400000
    },
    {
      "id": "openai/gpt-5-image",
      "name": "GPT-5 Image",
      "contextLength": 400000
    },
    {
      "id": "openai/gpt-5-image-mini",
      "name": "GPT-5 Image Mini",
      "contextLength": 400000
    },
    {
      "id": "openai/gpt-5-mini",
      "name": "GPT-5 Mini",
      "contextLength": 400000
    },
    {
      "id": "openai/gpt-5-nano",
      "name": "GPT-5 Nano",
      "contextLength": 400000
    },
    {
      "id": "openai/gpt-5-pro",
      "name": "GPT-5 Pro",
      "contextLength": 400000
    },
    {
      "id": "openai/gpt-5.1",
      "name": "GPT-5.1",
      "contextLength": 400000
    },
    {
      "id": "openai/gpt-5.1-codex",
      "name": "GPT-5.1-Codex",
      "contextLength": 400000
    },
    {
      "id": "openai/gpt-5.1-codex-max",
      "name": "GPT-5.1-Codex-Max",
      "contextLength": 400000
    },
    {
      "id": "openai/gpt-5.1-codex-mini",
      "name": "GPT-5.1-Codex-Mini",
      "contextLength": 400000
    },
    {
      "id": "openai/gpt-5.2",
      "name": "GPT-5.2",
      "contextLength": 400000
    },
    {
      "id": "openai/gpt-5.2-chat",
      "name": "GPT-5.2 Chat",
      "contextLength": 128000
    },
    {
      "id": "openai/gpt-5.2-codex",
      "name": "GPT-5.2-Codex",
      "contextLength": 400000
    },
    {
      "id": "openai/gpt-5.2-pro",
      "name": "GPT-5.2 Pro",
      "contextLength": 400000
    },
    {
      "id": "openai/gpt-5.3-codex",
      "name": "GPT-5.3-Codex",
      "contextLength": 400000
    },
    {
      "id": "openai/gpt-5.4",
      "name": "GPT-5.4",
      "contextLength": 1050000
    },
    {
      "id": "openai/gpt-5.4-image-2",
      "name": "GPT-5.4 Image 2",
      "contextLength": 272000
    },
    {
      "id": "openai/gpt-5.4-mini",
      "name": "GPT-5.4 Mini",
      "contextLength": 400000
    },
    {
      "id": "openai/gpt-5.4-nano",
      "name": "GPT-5.4 Nano",
      "contextLength": 400000
    },
    {
      "id": "openai/gpt-5.4-pro",
      "name": "GPT-5.4 Pro",
      "contextLength": 1050000
    },
    {
      "id": "openai/gpt-5.5",
      "name": "GPT-5.5",
      "contextLength": 1050000
    },
    {
      "id": "openai/gpt-5.5-pro",
      "name": "GPT-5.5 Pro",
      "contextLength": 1050000
    },
    {
      "id": "openai/gpt-5.6-luna",
      "name": "GPT-5.6 Luna",
      "contextLength": 1050000
    },
    {
      "id": "openai/gpt-5.6-luna-pro",
      "name": "GPT-5.6 Luna Pro",
      "contextLength": 1050000
    },
    {
      "id": "openai/gpt-5.6-sol",
      "name": "GPT-5.6 Sol",
      "contextLength": 1050000
    },
    {
      "id": "openai/gpt-5.6-sol-pro",
      "name": "GPT-5.6 Sol Pro",
      "contextLength": 1050000
    },
    {
      "id": "openai/gpt-5.6-terra",
      "name": "GPT-5.6 Terra",
      "contextLength": 1050000
    },
    {
      "id": "openai/gpt-5.6-terra-pro",
      "name": "GPT-5.6 Terra Pro",
      "contextLength": 1050000
    },
    {
      "id": "openai/gpt-6-astra",
      "name": "GPT-6 Astra",
      "contextLength": 1050000
    },
    {
      "id": "openai/gpt-6-astra-pro",
      "name": "GPT-6 Astra Pro",
      "contextLength": 1050000
    },
    {
      "id": "openai/gpt-6-luna",
      "name": "GPT-6 Luna",
      "contextLength": 1050000
    },
    {
      "id": "openai/gpt-6-luna-pro",
      "name": "GPT-6 Luna Pro",
      "contextLength": 1050000
    },
    {
      "id": "openai/gpt-6-sol",
      "name": "GPT-6 Sol",
      "contextLength": 1050000
    },
    {
      "id": "openai/gpt-6-sol-pro",
      "name": "GPT-6 Sol Pro",
      "contextLength": 1050000
    },
    {
      "id": "openai/gpt-6.1-sol",
      "name": "GPT-6.1 Sol",
      "contextLength": 1050000
    },
    {
      "id": "openai/gpt-6.1-sol-pro",
      "name": "GPT-6.1 Sol Pro",
      "contextLength": 1050000
    },
    {
      "id": "openai/gpt-6.1-terra",
      "name": "GPT-6.1 Terra",
      "contextLength": 1050000
    },
    {
      "id": "openai/gpt-6.1-terra-pro",
      "name": "GPT-6.1 Terra Pro",
      "contextLength": 1050000
    },
    {
      "id": "openai/gpt-6.2-astra",
      "name": "GPT-6.2 Astra",
      "contextLength": 1050000
    },
    {
      "id": "openai/gpt-6.2-astra-pro",
      "name": "GPT-6.2 Astra Pro",
      "contextLength": 1050000
    },
    {
      "id": "openai/gpt-6.2-sol",
      "name": "GPT-6.2 Sol",
      "contextLength": 1050000
    },
    {
      "id": "openai/gpt-6.2-sol-pro",
      "name": "GPT-6.2 Sol Pro",
      "contextLength": 1050000
    },
    {
      "id": "openai/gpt-audio",
      "name": "GPT Audio",
      "contextLength": 128000
    },
    {
      "id": "openai/gpt-audio-mini",
      "name": "GPT Audio Mini",
      "contextLength": 128000
    },
    {
      "id": "openai/gpt-chat-latest",
      "name": "GPT Chat Latest",
      "contextLength": 400000
    },
    {
      "id": "openai/gpt-oss-120b",
      "name": "gpt-oss-120b",
      "contextLength": 131072,
      "maxOutputTokens": 131072
    },
    {
      "id": "openai/gpt-oss-120b:e2ee",
      "name": "gpt-oss-120b",
      "contextLength": 131072,
      "maxOutputTokens": 131072
    },
    {
      "id": "openai/gpt-oss-20b",
      "name": "gpt-oss-20b",
      "contextLength": 131072,
      "maxOutputTokens": 131072
    },
    {
      "id": "openai/gpt-oss-safeguard-20b",
      "name": "gpt-oss-safeguard-20b",
      "contextLength": 131072
    },
    {
      "id": "openai/o3",
      "name": "o3",
      "contextLength": 200000
    },
    {
      "id": "openai/o3-pro",
      "name": "o3 Pro",
      "contextLength": 200000
    },
    {
      "id": "paddlepaddle/paddleocr-vl",
      "name": "PaddleOCR VL",
      "contextLength": 16384,
      "maxOutputTokens": 16384
    },
    {
      "id": "perplexity/sonar",
      "name": "Sonar",
      "contextLength": 127072
    },
    {
      "id": "perplexity/sonar-deep-research",
      "name": "Sonar Deep Research",
      "contextLength": 128000
    },
    {
      "id": "perplexity/sonar-pro",
      "name": "Sonar Pro",
      "contextLength": 200000
    },
    {
      "id": "perplexity/sonar-pro-search",
      "name": "Sonar Pro Search",
      "contextLength": 200000
    },
    {
      "id": "perplexity/sonar-reasoning-pro",
      "name": "Sonar Reasoning Pro",
      "contextLength": 128000
    },
    {
      "id": "qwen/qwen-2.5-72b-instruct",
      "name": "Qwen2.5 72B Instruct",
      "contextLength": 32768
    },
    {
      "id": "qwen/qwen-2.5-coder-32b-instruct",
      "name": "Qwen2.5 Coder 32B Instruct",
      "contextLength": 32768
    },
    {
      "id": "qwen/qwen-mt-plus",
      "name": "Qwen MT Plus",
      "contextLength": 16384,
      "maxOutputTokens": 8192
    },
    {
      "id": "qwen/qwen-plus",
      "name": "Qwen-Plus",
      "contextLength": 1000000
    },
    {
      "id": "qwen/qwen2.5-vl-72b-instruct",
      "name": "Qwen2.5 VL 72B Instruct",
      "contextLength": 128000
    },
    {
      "id": "qwen/qwen3-14b",
      "name": "Qwen3 14B",
      "contextLength": 40960
    },
    {
      "id": "qwen/qwen3-235b-a22b-2507",
      "name": "Qwen3 235B A22B Instruct 2507",
      "contextLength": 262144
    },
    {
      "id": "qwen/qwen3-235b-a22b-thinking-2507",
      "name": "Qwen3 235B A22B Thinking 2507",
      "contextLength": 128000
    },
    {
      "id": "qwen/qwen3-30b-a3b",
      "name": "Qwen3 30B A3B",
      "contextLength": 40960
    },
    {
      "id": "qwen/qwen3-30b-a3b-instruct-2507",
      "name": "Qwen3 30B A3B Instruct 2507",
      "contextLength": 262144
    },
    {
      "id": "qwen/qwen3-32b",
      "name": "Qwen3 32B",
      "contextLength": 40960
    },
    {
      "id": "qwen/qwen3-coder",
      "name": "Qwen3 Coder 480B A35B Instruct Turbo",
      "contextLength": 262144,
      "maxOutputTokens": 65536
    },
    {
      "id": "qwen/qwen3-coder-30b-a3b-instruct",
      "name": "Qwen3 Coder 30B A3B Instruct",
      "contextLength": 262144
    },
    {
      "id": "qwen/qwen3-coder-flash",
      "name": "Qwen3 Coder Flash",
      "contextLength": 1000000
    },
    {
      "id": "qwen/qwen3-coder-next",
      "name": "Qwen3 Coder Next",
      "contextLength": 262144
    },
    {
      "id": "qwen/qwen3-next-80b-a3b-instruct",
      "name": "Qwen3 Next 80B A3B Instruct",
      "contextLength": 262144
    },
    {
      "id": "qwen/qwen3-omni-30b-a3b-thinking",
      "name": "Qwen3 Omni 30B A3B Thinking",
      "contextLength": 65536,
      "maxOutputTokens": 16384
    },
    {
      "id": "qwen/qwen3-vl-235b-a22b-instruct",
      "name": "Qwen3 VL 235B A22B Instruct",
      "contextLength": 262144
    },
    {
      "id": "qwen/qwen3-vl-30b-a3b-instruct",
      "name": "Qwen3 VL 30B A3B Instruct",
      "contextLength": 262144
    },
    {
      "id": "qwen/qwen3-vl-8b-instruct",
      "name": "Qwen3 VL 8B Instruct",
      "contextLength": 262144
    },
    {
      "id": "qwen/qwen3.5-122b-a10b",
      "name": "Qwen3.5 122B A10B",
      "contextLength": 262144
    },
    {
      "id": "qwen/qwen3.5-27b",
      "name": "Qwen3.5 27B",
      "contextLength": 262144,
      "maxOutputTokens": 81920
    },
    {
      "id": "qwen/qwen3.5-35b-a3b",
      "name": "Qwen3.5 35B A3B",
      "contextLength": 262144,
      "maxOutputTokens": 81920
    },
    {
      "id": "qwen/qwen3.5-397b-a17b",
      "name": "Qwen3.5 397B A17B",
      "contextLength": 262144,
      "maxOutputTokens": 81920
    },
    {
      "id": "qwen/qwen3.5-9b",
      "name": "Qwen3.5-9B",
      "contextLength": 262144,
      "maxOutputTokens": 81920
    },
    {
      "id": "qwen/qwen3.5-flash-02-23",
      "name": "Qwen3.5-Flash",
      "contextLength": 1000000
    },
    {
      "id": "qwen/qwen3.5-plus-02-15",
      "name": "Qwen3.5 Plus 2026-02-15",
      "contextLength": 1000000
    },
    {
      "id": "qwen/qwen3.5-plus-20260420",
      "name": "Qwen3.5 Plus 2026-04-20",
      "contextLength": 1000000
    },
    {
      "id": "qwen/qwen3.6-27b",
      "name": "Qwen3.6 27B",
      "contextLength": 262144,
      "maxOutputTokens": 81920
    },
    {
      "id": "qwen/qwen3.6-35b-a3b",
      "name": "Qwen3.6 35B A3B",
      "contextLength": 262144,
      "maxOutputTokens": 65536
    },
    {
      "id": "qwen/qwen3.6-flash",
      "name": "Qwen3.6 Flash",
      "contextLength": 1000000
    },
    {
      "id": "qwen/qwen3.6-plus",
      "name": "Qwen3.6 Plus",
      "contextLength": 1000000
    },
    {
      "id": "qwen/qwen3.7-flash",
      "name": "Qwen3.7 Flash",
      "contextLength": 1000000
    },
    {
      "id": "qwen/qwen3.7-max",
      "name": "Qwen3.7 Max",
      "contextLength": 256000
    },
    {
      "id": "qwen/qwen3.7-plus",
      "name": "Qwen3.7 Plus",
      "contextLength": 1000000
    },
    {
      "id": "qwen/qwen3.8-2.4t-a95b",
      "name": "Qwen3.8 2.4T A95B",
      "contextLength": 1000000,
      "maxOutputTokens": 131072
    },
    {
      "id": "qwen/qwen3.8-27b",
      "name": "Qwen3.8 27B",
      "contextLength": 1024000
    },
    {
      "id": "qwen/qwen3.8-flash",
      "name": "Qwen3.8 Flash",
      "contextLength": 1000000,
      "maxOutputTokens": 131072
    },
    {
      "id": "qwen/qwen3.8-max",
      "name": "Qwen3.8 Max",
      "contextLength": 256000
    },
    {
      "id": "qwen/qwen3.8-max-0902",
      "name": "Qwen3.8 Max (0902)",
      "contextLength": 1000000
    },
    {
      "id": "qwen/qwen3.8-max-prime",
      "name": "Qwen3.8 Max Prime",
      "contextLength": 1000000
    },
    {
      "id": "qwen/qwen3.8-omni-flash",
      "name": "Qwen3.8 Omni Flash",
      "contextLength": 1000000
    },
    {
      "id": "qwen/qwen4-max",
      "name": "Qwen4 Max",
      "contextLength": 1000000
    },
    {
      "id": "sakana/fugu-max",
      "name": "Fugu Max",
      "contextLength": 1000000
    },
    {
      "id": "sakana/fugu-ultra",
      "name": "Fugu Ultra",
      "contextLength": 1000000
    },
    {
      "id": "sakana/fugu-ultra-v2",
      "name": "Fugu Ultra v2",
      "contextLength": 1000000
    },
    {
      "id": "sakana/sakana-namazu",
      "name": "Sakana Namazu",
      "contextLength": 262144
    },
    {
      "id": "sao10k/l3-70b-euryale-v2.1",
      "name": "Llama 3 70B Euryale V2.1",
      "contextLength": 8192,
      "maxOutputTokens": 8192
    },
    {
      "id": "sao10k/l3-lunaris-8b",
      "name": "L3 8B Lunaris V1 Turbo",
      "contextLength": 8192
    },
    {
      "id": "sao10k/l3.1-euryale-70b",
      "name": "L3.1 70B Euryale V2.2",
      "contextLength": 131072
    },
    {
      "id": "stepfun/step-3.7-flash",
      "name": "Step 3.7 Flash",
      "contextLength": 262144,
      "maxOutputTokens": 131072
    },
    {
      "id": "stepfun/step-5-preview",
      "name": "Step 5 Preview",
      "contextLength": 1000000,
      "maxOutputTokens": 64000
    },
    {
      "id": "tencent/hy-mt2-1.8b",
      "name": "Hy-MT2-1.8B",
      "contextLength": 8192
    },
    {
      "id": "tencent/hy-mt2-30b-a3b",
      "name": "Hy-MT2-30B-A3B",
      "contextLength": 8192
    },
    {
      "id": "tencent/hy-mt2-7b",
      "name": "Hy-MT2-7B",
      "contextLength": 8192
    },
    {
      "id": "tencent/hy3",
      "name": "Hy3",
      "contextLength": 262144
    },
    {
      "id": "tencent/hy3-preview",
      "name": "Hy3 preview",
      "contextLength": 262144
    },
    {
      "id": "tencent/hy4",
      "name": "Hy4",
      "contextLength": 1000000,
      "maxOutputTokens": 64000
    },
    {
      "id": "tencent/hy4-flash",
      "name": "Hy4 Flash",
      "contextLength": 1000000,
      "maxOutputTokens": 64000
    },
    {
      "id": "tencent/hy4-preview",
      "name": "Hy4 Preview",
      "contextLength": 1048576
    },
    {
      "id": "thinkingmachines/inkling",
      "name": "Inkling",
      "contextLength": 524288
    },
    {
      "id": "thinkingmachines/inkling-2-small",
      "name": "Inkling 2 Small",
      "contextLength": 1048576
    },
    {
      "id": "thinkingmachines/inkling-small",
      "name": "Inkling Small",
      "contextLength": 524288,
      "maxOutputTokens": 131072
    },
    {
      "id": "upstage/solar-mini4",
      "name": "Solar Mini 4",
      "contextLength": 524288
    },
    {
      "id": "upstage/solar-pro4",
      "name": "Solar Pro 4",
      "contextLength": 524288
    },
    {
      "id": "writer/palmyra-x5",
      "name": "Palmyra X5",
      "contextLength": 1040000
    },
    {
      "id": "x-ai/grok-4.20",
      "name": "Grok 4.20",
      "contextLength": 2000000
    },
    {
      "id": "x-ai/grok-4.20-multi-agent",
      "name": "Grok 4.20 Multi-Agent",
      "contextLength": 2000000
    },
    {
      "id": "x-ai/grok-4.3",
      "name": "Grok 4.3",
      "contextLength": 1000000
    },
    {
      "id": "x-ai/grok-4.5",
      "name": "Grok 4.5",
      "contextLength": 500000
    },
    {
      "id": "x-ai/grok-4.6",
      "name": "Grok 4.6",
      "contextLength": 500000
    },
    {
      "id": "x-ai/grok-4.7",
      "name": "Grok 4.7",
      "contextLength": 500000
    },
    {
      "id": "x-ai/grok-build-0.1",
      "name": "Grok Build 0.1",
      "contextLength": 256000
    },
    {
      "id": "xiaomi/mimo-v2.5",
      "name": "MiMo-V2.5",
      "contextLength": 1000000
    },
    {
      "id": "xiaomi/mimo-v2.5-pro",
      "name": "MiMo-V2.5-Pro",
      "contextLength": 262144
    },
    {
      "id": "xiaomi/mimo-v2.6-flash",
      "name": "MiMo V2.6 Flash",
      "contextLength": 1048576,
      "maxOutputTokens": 131072
    },
    {
      "id": "xiaomi/mimo-v2.6-pro",
      "name": "MiMo-V2.6-Pro",
      "contextLength": 1048576,
      "maxOutputTokens": 131072
    },
    {
      "id": "xiaomi/mimo-v2.6-pro-ultraspeed",
      "name": "MiMo-V2.6-Pro-UltraSpeed",
      "contextLength": 1048576
    },
    {
      "id": "z-ai/glm-4.5",
      "name": "GLM 4.5",
      "contextLength": 131072
    },
    {
      "id": "z-ai/glm-4.5-air",
      "name": "GLM 4.5 Air",
      "contextLength": 131072,
      "maxOutputTokens": 98304
    },
    {
      "id": "z-ai/glm-4.5v",
      "name": "GLM 4.5V",
      "contextLength": 65536,
      "maxOutputTokens": 16384
    },
    {
      "id": "z-ai/glm-4.6",
      "name": "GLM 4.6",
      "contextLength": 202752,
      "maxOutputTokens": 131072
    },
    {
      "id": "z-ai/glm-4.6v",
      "name": "GLM 4.6V",
      "contextLength": 131072,
      "maxOutputTokens": 32768
    },
    {
      "id": "z-ai/glm-4.7",
      "name": "GLM 4.7",
      "contextLength": 202752,
      "maxOutputTokens": 131072
    },
    {
      "id": "z-ai/glm-4.7-flash",
      "name": "GLM 4.7 Flash",
      "contextLength": 200000,
      "maxOutputTokens": 128000
    },
    {
      "id": "z-ai/glm-5",
      "name": "GLM 5",
      "contextLength": 202800,
      "maxOutputTokens": 131072
    },
    {
      "id": "z-ai/glm-5-turbo",
      "name": "GLM 5 Turbo",
      "contextLength": 202752
    },
    {
      "id": "z-ai/glm-5.1",
      "name": "GLM 5.1",
      "contextLength": 204800,
      "maxOutputTokens": 131072
    },
    {
      "id": "z-ai/glm-5.2",
      "name": "GLM 5.2",
      "contextLength": 1048576,
      "maxOutputTokens": 131072
    },
    {
      "id": "z-ai/glm-5.3-flash",
      "name": "GLM 5.3 Flash",
      "contextLength": 1048576,
      "maxOutputTokens": 131072
    },
    {
      "id": "z-ai/glm-5.3-flash:e2ee",
      "name": "GLM 5.3 Flash",
      "contextLength": 393216,
      "maxOutputTokens": 131072
    },
    {
      "id": "z-ai/glm-5.3-flashx",
      "name": "GLM 5.3 FlashX",
      "contextLength": 1048576,
      "maxOutputTokens": 131072
    },
    {
      "id": "z-ai/glm-5.3-flashx-legal",
      "name": "GLM 5.3 FlashX Legal",
      "contextLength": 1048576
    },
    {
      "id": "z-ai/glm-5.3-prime",
      "name": "GLM 5.3 Prime",
      "contextLength": 1000000
    },
    {
      "id": "z-ai/glm-5.3:e2ee",
      "name": "GLM 5.3",
      "contextLength": 1048576,
      "maxOutputTokens": 131072
    },
    {
      "id": "z-ai/glm-5v-turbo",
      "name": "GLM 5V Turbo",
      "contextLength": 202752
    },
    {
      "id": "zai-org/autoglm-phone-9b-multilingual",
      "name": "AutoGLM Phone 9B Multilingual",
      "contextLength": 65536,
      "maxOutputTokens": 65536
    }
  ],
  "modelsFetcher": {
    "url": "https://api.numes.ai/api/v1/models",
    "type": "openai"
  },
  "passthroughModels": true
};
