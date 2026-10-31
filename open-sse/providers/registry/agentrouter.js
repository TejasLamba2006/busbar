import { CLAUDE_CLI_SPOOF_HEADERS } from "../shared.js";

export default {
  id: "agentrouter",
  alias: "agentrouter",
  uiAlias: "agentrouter",
  display: {
    name: "AgentRouter",
    icon: "router",
    color: "#10B981",
    textIcon: "AR",
    website: "https://agentrouter.org/register?aff=iBCR",
    notice: {
      text: "$200 free credits on signup - multi-model routing gateway",
      apiKeyUrl: "https://agentrouter.org/register?aff=iBCR"
    }
  },
  category: "freeTier",
  authType: "apikey",
  authModes: [
    "apikey"
  ],
  modelDiscovery: "refresh",
  transport: {
    baseUrl: "https://agentrouter.org/v1/responses",
    format: "openai-responses",
    validateUrl: "https://agentrouter.org/v1/models",
    headers: { ...CLAUDE_CLI_SPOOF_HEADERS }
  },
  transports: [
    {
      format: "openai-responses",
      baseUrl: "https://agentrouter.org/v1/responses",
      headers: { ...CLAUDE_CLI_SPOOF_HEADERS },
      auth: { combined: true, header: "Authorization", scheme: "bearer" }
    },
    {
      format: "claude",
      baseUrl: "https://agentrouter.org/v1/messages",
      headers: { ...CLAUDE_CLI_SPOOF_HEADERS },
      auth: { combined: true, header: "x-api-key", scheme: "raw", anthropicVersion: true }
    },
    {
      format: "openai",
      baseUrl: "https://agentrouter.org/v1/chat/completions",
      headers: { ...CLAUDE_CLI_SPOOF_HEADERS },
      auth: { combined: true, header: "Authorization", scheme: "bearer" }
    }
  ],
  models: [
    { id: "gpt-5.6-sol", name: "GPT-5.6 Sol", targetFormat: "openai-responses", supportedFormats: ["openai-responses"] },
    { id: "gpt-6-astra", name: "GPT-6 Astra", targetFormat: "openai-responses", supportedFormats: ["openai-responses"] },
    { id: "gpt-6.1-sol", name: "GPT-6.1 Sol", targetFormat: "openai-responses", supportedFormats: ["openai-responses"] },
    { id: "claude-opus-4-8", name: "Claude Opus 4.8", targetFormat: "claude", supportedFormats: ["claude"] },
    { id: "claude-opus-5", name: "Claude Opus 5", targetFormat: "claude", supportedFormats: ["claude"] }
  ],
  modelsFetcher: {
    url: "https://agentrouter.org/v1/models",
    type: "openai"
  },
  features: {
    usage: true,
    usageApikey: true,
  },
  passthroughModels: true
};
