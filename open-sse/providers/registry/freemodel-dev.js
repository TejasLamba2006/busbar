export default {
  id: "freemodel-dev",
  alias: "freemodel-dev",
  aliases: [
    "fmd"
  ],
  uiAlias: "freemodel-dev",
  display: {
    name: "FreeModel.dev",
    icon: "auto_awesome",
    color: "#8B5CF6",
    textIcon: "FM",
    website: "https://freemodel.dev",
    notice: {
      text: "OpenAI-compatible API gateway (gpt-6-luna, gpt-6-sol, gpt-6-astra). Requires active account balance on freemodel.dev.",
      apiKeyUrl: "https://freemodel.dev"
    }
  },
  category: "apikey",
  authType: "apikey",
  authModes: [
    "apikey"
  ],
  modelDiscovery: "refresh",
  transport: {
    baseUrl: "https://api.freemodel.dev/v1/chat/completions",
    validateUrl: "https://api.freemodel.dev/v1/models"
  },
  models: [
    { id: "gpt-6-luna", name: "GPT-6 Luna" },
    { id: "gpt-6-sol", name: "GPT-6 Sol" },
    { id: "gpt-6-astra", name: "GPT-6 Astra" }
  ],
  modelsFetcher: {
    url: "https://api.freemodel.dev/v1/models",
    type: "openai"
  },
  passthroughModels: true
};
