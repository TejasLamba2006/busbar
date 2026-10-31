export default {
  id: "inceptionlabs",
  alias: "inceptionlabs",
  uiAlias: "inceptionlabs",
  display: {
    name: "inceptionlabs",
    icon: "hub",
    color: "#6366F1",
    textIcon: "IN",
    notice: {}
  },
  category: "apikey",
  authType: "apikey",
  authModes: [
    "apikey"
  ],
  transport: {
    baseUrl: "https://api.inceptionlabs.ai/v1/chat/completions",
    validateUrl: "https://api.inceptionlabs.ai/v1/models"
  },
  models: [
    { id: "mercury-2", name: "mercury-2" },
    { id: "mercury-2.5", name: "mercury-2.5" },
    { id: "mercury-decide", name: "mercury-decide", kind: "systemone" },
    { id: "mercury-3", name: "Inception: Mercury 3" }
  ],
  serviceKinds: ["llm", "systemone"],
  systemoneConfig: {
    baseUrl: "https://api.inceptionlabs.ai/v1/decisions",
    authType: "apikey",
    authHeader: "bearer"
  },
  modelsFetcher: {
    url: "https://api.inceptionlabs.ai/v1/models",
    type: "openai"
  },
  passthroughModels: true
};
