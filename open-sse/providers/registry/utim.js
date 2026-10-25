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
  transport: {
    baseUrl: "https://api.utim.dev/api/playground/chat",
    format: "openai",
    noAuth: true,
  },
  models: [
    { id: "antropic/claude-opus-5", name: "Claude Opus 5" },
    // upstream accepts the correctly spelled and bare ids and maps them to antropic/claude-opus-5
    { id: "anthropic/claude-opus-5", name: "Claude Opus 5 (alias)" },
    { id: "claude-opus-5", name: "Claude Opus 5 (short alias)" },
    { id: "openai/gpt-6.1-sol", name: "GPT 6.1 Sol" },
    { id: "zai/glm-5.3", name: "GLM 5.3" },
    { id: "claude-mythos-preview", name: "Claude Mythos Preview" },
  ],
  passthroughModels: true,
};
