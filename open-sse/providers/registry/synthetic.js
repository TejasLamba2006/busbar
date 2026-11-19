export default {
  id: "synthetic",
  alias: "synthetic",
  aliases: [
    "syn",
    "synthetic-new",
  ],
  uiAlias: "syn",
  display: {
    name: "Synthetic",
    icon: "verified_user",
    color: "#6366F1",
    textIcon: "SY",
    website: "https://synthetic.new",
    notice: {
      apiKeyUrl: "https://synthetic.new/user-settings/api",
    },
  },
  category: "apikey",
  authType: "apikey",
  authModes: [
    "apikey",
  ],
  transport: {
    baseUrl: "https://api.synthetic.new/openai/v1/chat/completions",
    // /openai/v1/models is public, so it cannot tell a bad key from a good one; quotas can.
    validateUrl: "https://api.synthetic.new/v2/quotas",
    usage: {
      url: "https://api.synthetic.new/v2/quotas",
    },
  },
  models: [
    { id: "hf:zai-org/GLM-5.3", name: "GLM 5.3" },
    { id: "hf:zai-org/GLM-5.3-Flash", name: "GLM 5.3 Flash" },
    { id: "hf:zai-org/GLM-4.7-Flash", name: "GLM 4.7 Flash", contextLength: 196608 },
    { id: "hf:moonshotai/Kimi-K3", name: "Kimi K3" },
    { id: "hf:deepseek-ai/DeepSeek-V4.1-Flash", name: "DeepSeek V4.1 Flash" },
    { id: "hf:deepseek-ai/DeepSeek-V4.1-Flash-1017", name: "DeepSeek V4.1 Flash 1017" },
    { id: "hf:Qwen/Qwen3.8-27B", name: "Qwen3.8 27B" },
    { id: "hf:openai/gpt-oss-120b", name: "GPT-OSS 120B", contextLength: 131072 },
    { id: "hf:nvidia/NVIDIA-Nemotron-3-Super-120B-A12B-NVFP4", name: "Nemotron 3 Super 120B", contextLength: 262144 },
    { id: "hf:zai-org/GLM-5.2", name: "zai-org/GLM-5.2", contextLength: 524288 },
    { id: "hf:moonshotai/Kimi-K2.7-Code", name: "moonshotai/Kimi-K2.7-Code", contextLength: 262144 },
    { id: "hf:Qwen/Qwen3.6-27B", name: "Qwen/Qwen3.6-27B", contextLength: 262144 },
    { id: "hf:MiniMaxAI/MiniMax-M3", name: "MiniMaxAI/MiniMax-M3", contextLength: 262144 },
    { id: "syn:large:text", name: "syn:large:text" },
    { id: "syn:small:text", name: "syn:small:text" },
    { id: "syn:large:vision", name: "syn:large:vision" },
    { id: "syn:small:vision", name: "syn:small:vision" },
  ],
  modelsFetcher: {
    url: "https://api.synthetic.new/openai/v1/models",
    type: "openai",
  },
  passthroughModels: true,
  features: {
    usage: true,
    usageApikey: true,
  },
};
