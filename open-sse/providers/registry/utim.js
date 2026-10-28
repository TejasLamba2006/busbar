// UTIM playground (api.utim.dev): OpenAI-compatible, no key needed. Speaks stream and non-stream JSON
// and executes native tools, so the default executor is enough (no shim).
export default {
  id: "utim",
  priority: 41,
  hasFree: true,
  alias: "ut",
  uiAlias: "ut",
  display: {
    name: "UTIM Playground",
    icon: "terminal",
    color: "#7C5CFF",
    textIcon: "UT",
    website: "https://utim.dev",
  },
  category: "free",
  noAuth: true,
  modelDiscovery: "refresh",
  transport: {
    baseUrl: "https://api.utim.dev/api/playground/chat",
    validateUrl: "https://api.utim.dev/v1/models",
    format: "openai",
    noAuth: true,
  },
  models: [
    { id: "utim/deepseek-v4.1-flash", name: "DeepSeek V4.1 Flash", contextLength: 1048576, maxOutputTokens: 131072, supportsReasoning: true },
    { id: "utim/kimi-k3", name: "Kimi K3", contextLength: 1048576, maxOutputTokens: 943718, supportsReasoning: true },
    { id: "utim/glm-5.3-flash", name: "GLM 5.3 Flash", contextLength: 1048576, maxOutputTokens: 131072, supportsReasoning: true },
    { id: "utim/deepseek-v4.1-flash-1017", name: "DeepSeek V4.1 Flash 1017", contextLength: 1048576, maxOutputTokens: 393216, supportsReasoning: true },
    { id: "utim/minimax-m3", name: "MiniMax M3", contextLength: 1048576, maxOutputTokens: 512000, supportsReasoning: true },
    { id: "utim/glm-5.3", name: "GLM 5.3", contextLength: 1048576, maxOutputTokens: 943718, supportsReasoning: true },
    // Short aliases (upstream accepts bare IDs without `utim/` prefix)
    { id: "deepseek-v4.1-flash", name: "DeepSeek V4.1 Flash (short alias)", contextLength: 1048576, maxOutputTokens: 131072, supportsReasoning: true },
    { id: "kimi-k3", name: "Kimi K3 (short alias)", contextLength: 1048576, maxOutputTokens: 943718, supportsReasoning: true },
    { id: "glm-5.3-flash", name: "GLM 5.3 Flash (short alias)", contextLength: 1048576, maxOutputTokens: 131072, supportsReasoning: true },
    { id: "deepseek-v4.1-flash-1017", name: "DeepSeek V4.1 Flash 1017 (short alias)", contextLength: 1048576, maxOutputTokens: 393216, supportsReasoning: true },
    { id: "minimax-m3", name: "MiniMax M3 (short alias)", contextLength: 1048576, maxOutputTokens: 512000, supportsReasoning: true },
    { id: "glm-5.3", name: "GLM 5.3 (short alias)", contextLength: 1048576, maxOutputTokens: 943718, supportsReasoning: true },
  ],
  modelsFetcher: {
    url: "https://api.utim.dev/v1/models",
    type: "openai",
  },
  passthroughModels: true,
};
