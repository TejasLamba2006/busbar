export default {
  id: "inferx",
  alias: "inferx",
  uiAlias: "inferx",
  display: {
    name: "InferX",
    icon: "hub",
    color: "#475569",
    textIcon: "IX",
    website: "https://model.inferx.net/catalog/endpoints",
    notice: {
      apiKeyUrl: "https://model.inferx.net/",
    },
  },
  category: "apikey",
  authType: "apikey",
  authModes: ["apikey"],
  modelDiscovery: "refresh",
  transport: {
    baseUrl: "https://model.inferx.net/endpoints/v1/chat/completions",
    validateUrl: "https://model.inferx.net/endpoints/v1/models",
  },
  models: [],
  modelsFetcher: {
    url: "https://model.inferx.net/endpoints/v1/models",
    type: "openai",
  },
  passthroughModels: true,
};
