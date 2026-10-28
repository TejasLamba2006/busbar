// Pure helpers for the providers dashboard: search, category/media chips,
// model search, display mode and URL param sync. No React / server imports so
// they stay unit-testable.

export const DISPLAY_MODE_STORAGE_KEY = "9router:providers-display-mode";
export const DISPLAY_MODES = ["all", "configured", "compact"];

export const IDE_PROVIDERS = new Set([
  "cursor", "windsurf", "trae", "zed", "kilo-gateway", "cline", "clinepass",
  "codebuddy-cn", "codebuddy-intl", "qoder", "qoder-cn", "github", "auggie", "void-ai",
]);

export const AGGREGATOR_PROVIDERS = new Set([
  "openrouter", "requesty", "routeway", "poe", "aimlapi", "zenmux", "nara", "0w0",
  "agentrouter", "synthetic", "pollinations", "llm7", "vercel-ai-gateway", "tokenrouter",
  "tokenharbor", "dahl", "bai", "evomap", "infron", "vsllm", "lumosel", "navy", "wafer",
  "getgoapi", "routesme", "openference", "nano-gpt", "gorouter", "tokenlayer", "tukenku",
  "aihubmix", "apinex", "experientiallabs", "cavoti", "electronhub", "llmgateway", "anyapi",
  "fastrouter", "literouter", "orcarouter", "unorouter", "poixe-ai", "sumopod", "naga-ai",
  "modelscope", "inceptionlabs", "seekai", "freemodel-dev", "ainative", "aion", "v0-vercel",
  "pixrouter",
]);

export const LOCAL_PROVIDERS = new Set([
  "ollama-local", "comfyui", "sdwebui", "local-device", "coqui", "tortoise",
  "selfhosted-stt", "selfhosted-tts", "selfhosted-embedding",
]);

// id -> chip meta. `dot` is the colored dot class.
export const CATEGORY_FILTERS = [
  { id: "all", label: "All", dot: null },
  { id: "oauth", label: "OAuth", dot: "bg-blue-500" },
  { id: "ide", label: "IDE", dot: "bg-cyan-500" },
  { id: "free", label: "Free", dot: "bg-green-500" },
  { id: "noauth", label: "No-Auth", dot: "bg-stone-500" },
  { id: "aggregators", label: "Aggregators", dot: "bg-indigo-500" },
  { id: "apikey", label: "API Key", dot: "bg-amber-500" },
  { id: "custom", label: "Custom Compatible", dot: "bg-orange-500" },
  { id: "webcookie", label: "Web Cookie", dot: "bg-purple-500" },
  { id: "search", label: "Search", dot: "bg-teal-500" },
  { id: "fetch", label: "Web Fetch", dot: "bg-orange-500" },
  { id: "audio", label: "Audio", dot: "bg-rose-500" },
  { id: "local", label: "Local", dot: "bg-emerald-500" },
];
export const CATEGORY_IDS = CATEGORY_FILTERS.map((c) => c.id);

export const MEDIA_FILTERS = [
  { id: "image", label: "Image", icon: "image" },
  { id: "video", label: "Video", icon: "videocam" },
  { id: "tts", label: "Text→Speech", icon: "record_voice_over" },
  { id: "stt", label: "Speech→Text", icon: "hearing" },
  { id: "embedding", label: "Embedding", icon: "scatter_plot" },
  { id: "webSearch", label: "Web Search", icon: "travel_explore" },
  { id: "webFetch", label: "Web Fetch", icon: "http" },
];
export const MEDIA_IDS = MEDIA_FILTERS.map((m) => m.id);

export const getServiceKinds = (info) =>
  Array.isArray(info?.serviceKinds) && info.serviceKinds.length ? info.serviceKinds : ["llm"];

// Does provider support a media kind? search/fetch also count a config object.
export function supportsKind(info, kind) {
  const kinds = getServiceKinds(info);
  if (kinds.includes(kind)) return true;
  if (kind === "webSearch") return !!info?.searchConfig;
  if (kind === "webFetch") return !!info?.fetchConfig;
  return false;
}

export function matchesMedia(info, media) {
  return !media || supportsKind(info, media);
}

// group: "oauth" | "free" | "freeTier" | "apikey" | "webCookie" | "custom"
export function getProviderCategories(key, info, group) {
  const cats = new Set();
  if (group === "oauth") cats.add("oauth");
  if (group === "apikey") cats.add("apikey");
  if (group === "webCookie") cats.add("webcookie");
  if (group === "custom") cats.add("custom");
  if (group === "free" || group === "freeTier" || info?.hasFree) cats.add("free");
  if (info?.noAuth) cats.add("noauth");
  if (IDE_PROVIDERS.has(key)) cats.add("ide");
  if (AGGREGATOR_PROVIDERS.has(key)) cats.add("aggregators");
  if (LOCAL_PROVIDERS.has(key)) cats.add("local");
  if (supportsKind(info, "webSearch")) cats.add("search");
  if (supportsKind(info, "webFetch")) cats.add("fetch");
  if (supportsKind(info, "tts") || supportsKind(info, "stt")) cats.add("audio");
  return cats;
}

export function matchesCategory(cats, category) {
  return !category || category === "all" || cats.has(category);
}

// Match by name, id, alias/prefix or aliases.
export function matchesSearch(key, info, query) {
  const q = (query || "").trim().toLowerCase();
  if (!q) return true;
  const hay = [info?.name, key, info?.id, info?.alias, ...(Array.isArray(info?.aliases) ? info.aliases : [])];
  return hay.some((v) => typeof v === "string" && v.toLowerCase().includes(q));
}

export const isConfigured = (stats, info) => (stats?.total ?? 0) > 0 || !!info?.noAuth;

// Section a provider lands in when not flat/compact. Media-only providers used
// to be hidden (llm-only filter); they now get dedicated sections.
export function getSectionId(info, group, key) {
  if (group === "oauth") return "oauth";
  if (group === "custom") return "custom";
  if (LOCAL_PROVIDERS.has(key)) return "local";
  if (!getServiceKinds(info).includes("llm")) {
    if (supportsKind(info, "webSearch") || supportsKind(info, "webFetch")) return "search";
    if (supportsKind(info, "tts") || supportsKind(info, "stt")) return "audio";
    if (supportsKind(info, "embedding") && !supportsKind(info, "image") && !supportsKind(info, "video")) return "embedding";
    return "image";
  }
  if (group === "free" || group === "freeTier") return "free";
  return "apikey";
}

export const SECTION_TITLES = {
  custom: "Custom Providers (OpenAI/Anthropic Compatible)",
  oauth: "OAuth Providers",
  free: "Free Tier Providers",
  apikey: "API Key Providers",
  search: "Search & Web Fetch Providers",
  audio: "Audio (TTS / STT) Providers",
  image: "Image & Video Providers",
  embedding: "Embedding Providers",
  local: "Local Providers",
};
export const SECTION_ORDER = ["custom", "oauth", "free", "apikey", "search", "audio", "image", "embedding", "local"];

// ---- Model search ----

// sources: { staticModels: {alias:[{id,name}]}, liveIds: ["alias/model"], custom: [{providerAlias,id,name}] }
export function buildModelIndex({ staticModels = {}, liveIds = [], custom = [] } = {}) {
  const index = {};
  const add = (alias, id, name) => {
    if (!alias || !id) return;
    (index[alias] ||= new Map()).set(id, name || id);
  };
  for (const [alias, models] of Object.entries(staticModels)) {
    for (const m of models || []) add(alias, m.id, m.name);
  }
  for (const full of liveIds) {
    const i = typeof full === "string" ? full.indexOf("/") : -1;
    if (i > 0) add(full.slice(0, i), full.slice(i + 1));
  }
  for (const m of custom) add(m.providerAlias, m.id, m.name);
  return index;
}

// Returns { count, samples } for provider keys (alias / id) matching query.
export function findModelMatches(index, keys, query, maxSamples = 3) {
  const q = (query || "").trim().toLowerCase();
  if (!q) return { count: 0, samples: [] };
  const seen = new Map();
  for (const k of keys) {
    const models = index[k];
    if (!models) continue;
    for (const [id, name] of models) {
      if (id.toLowerCase().includes(q) || String(name).toLowerCase().includes(q)) seen.set(id, name);
    }
  }
  return { count: seen.size, samples: [...seen.keys()].slice(0, maxSamples) };
}

// ---- Display mode / URL sync ----

export const normalizeDisplayMode = (v) => (DISPLAY_MODES.includes(v) ? v : "all");
export const normalizeCategory = (v) => (CATEGORY_IDS.includes(v) ? v : "all");
export const normalizeMedia = (v) => (MEDIA_IDS.includes(v) ? v : "");

export function readFilterParams(search) {
  const p = new URLSearchParams(search || "");
  return {
    search: p.get("search") || "",
    model: p.get("model") || "",
    mode: p.get("mode") ? normalizeDisplayMode(p.get("mode")) : null,
    cat: normalizeCategory(p.get("cat")),
    media: normalizeMedia(p.get("media")),
  };
}

// Default values are dropped from the URL to keep it clean.
export function buildFilterSearch(state) {
  const p = new URLSearchParams();
  if (state.search?.trim()) p.set("search", state.search.trim());
  if (state.model?.trim()) p.set("model", state.model.trim());
  if (state.mode && state.mode !== "all") p.set("mode", state.mode);
  if (state.cat && state.cat !== "all") p.set("cat", state.cat);
  if (state.media) p.set("media", state.media);
  const s = p.toString();
  return s ? `?${s}` : "";
}
