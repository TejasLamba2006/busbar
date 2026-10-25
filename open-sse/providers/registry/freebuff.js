/**
 * Freebuff (freebuff.com / CodebuffAI/freebuff): ad-supported free coding models.
 * Auth: freebuff.com CLI device login (/api/auth/cli/code + /status) yields a bearer authToken.
 * Chat: POST www.codebuff.com/api/v1/chat/completions inside a free-mode session + agent run.
 * `agent` maps each wire model to the base3 root agent the server pairs it with.
 */
export const FREEBUFF_AGENTS = {
  "mimo/mimo-v2.5": "base3-free-mimo",
  "z-ai/glm-5.3-flash": "base3-free-glm-5-3-flash",
  "deepseek/deepseek-v4-flash": "base3-free-deepseek-flash",
  "upstage/solar-mini4": "base3-free-solar-mini4",
  "upstage/solar-pro4": "base3-free-solar-pro4",
  "openai/gpt-6-luna": "base3-free-luna-6",
  "mimo/mimo-v2.6-pro": "base3-free-mimo-2-6-pro",
  "google/gemini-3.8-flash": "base3-free-gemini-3-8-flash",
  "google/gemini-4-argon": "base3-free-gemini-4-argon",
  "openai/gpt-6.1-sol": "base3-free-gpt-6-1-sol",
  "deepseek/deepseek-v4-flash-fast": "base3-fast-free-deepseek-flash",
  "meta/muse-spark-1.3-contributor": "base3-free-muse-spark-1-3",
};

export default {
  id: "freebuff",
  priority: 186,
  alias: "freebuff",
  aliases: ["fb"],
  uiAlias: "fb",
  hasFree: true,
  display: {
    name: "Freebuff (Ad-Supported Free Tier)",
    icon: "terminal",
    color: "#F59E0B",
    textIcon: "FB",
    website: "https://freebuff.com",
    notice: {
      text: "Sign in at freebuff.com via the browser login link (or paste the authToken from ~/.config/manicode/credentials.json). Unmetered: GLM 5.3 Flash, DeepSeek V4.1 Flash, MiMo v2.6 Flash, Solar Mini/Pro 4. Premium models draw on daily sessions.",
    },
  },
  category: "oauth",
  authModes: ["oauth", "apikey"],
  hasOAuth: true,
  transport: {
    baseUrl: "https://www.codebuff.com/api/v1/chat/completions",
    format: "openai",
  },
  models: [
    { id: "mimo/mimo-v2.5", name: "MiMo v2.6 Flash" },
    { id: "z-ai/glm-5.3-flash", name: "GLM 5.3 Flash" },
    { id: "deepseek/deepseek-v4-flash", name: "DeepSeek V4.1 Flash" },
    { id: "upstage/solar-mini4", name: "Solar Mini 4" },
    { id: "upstage/solar-pro4", name: "Solar Pro 4" },
    { id: "openai/gpt-6-luna", name: "GPT-6 Luna" },
    { id: "mimo/mimo-v2.6-pro", name: "MiMo 2.6 Pro" },
    { id: "google/gemini-3.8-flash", name: "Gemini 3.8 Flash" },
    { id: "google/gemini-4-argon", name: "Gemini 4 Argon" },
    { id: "openai/gpt-6.1-sol", name: "GPT-6.1 Sol" },
    { id: "deepseek/deepseek-v4-flash-fast", name: "DeepSeek V4.1 Flash Fast" },
    { id: "meta/muse-spark-1.3-contributor", name: "Muse Spark 1.3 (Contributor)" },
  ],
  oauth: {
    codeUrl: "https://freebuff.com/api/auth/cli/code",
    statusUrl: "https://freebuff.com/api/auth/cli/status",
    apiBase: "https://www.codebuff.com",
  },
};
