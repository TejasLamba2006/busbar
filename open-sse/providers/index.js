// Single source: build PROVIDERS + PROVIDER_MODELS from registry/{id}.js (transport + models co-located).
import REGISTRY from "./registry/index.js";
import { PROVIDER_DEFAULTS } from "./schema.js";
import { normalizeModel } from "./models/schema.js";
import { buildTtsProviderModels } from "../config/ttsModels.js";

// oauth block is canonical for these fields; inject into transport so executors reading
// this.config.{clientId,clientSecret,tokenUrl} keep working without duplicating in transport
const OAUTH_INJECT_FIELDS = ["clientId", "clientSecret", "tokenUrl"];

// transport: re-apply shared default (format:"openai") + inject oauth-canonical fields
function buildTransport(transport, oauth) {
  const t = { ...transport };
  if (!t.format) t.format = PROVIDER_DEFAULTS.format;
  if (oauth) {
    for (const f of OAUTH_INJECT_FIELDS) {
      if (t[f] === undefined && oauth[f] !== undefined) t[f] = oauth[f];
    }
  }
  return t;
}

const MEDIA_KEYS = new Set([
  "serviceKinds", "ttsConfig", "sttConfig", "embeddingConfig",
  "imageConfig", "imageToTextConfig", "videoConfig", "musicConfig",
  "searchViaChat", "searchConfig", "fetchConfig", "systemoneConfig",
  "modelsFetcher", "mediaPriority", "hiddenKinds",
]);

const CONFIG_MODEL_KINDS = [
  ["ttsConfig", "tts"],
  ["sttConfig", "stt"],
  ["embeddingConfig", "embedding"],
  ["imageConfig", "image"],
  ["imageToTextConfig", "imageToText"],
  ["videoConfig", "video"],
  ["musicConfig", "music"],
  ["systemoneConfig", "systemone"],
];

export const PROVIDERS = {};
export const PROVIDER_MODELS = {};
export const PROVIDER_OAUTH = {};
export const PROVIDER_MEDIA = {};
export const PROVIDER_MODEL_DISCOVERY = {};
for (const entry of REGISTRY) {
  if (entry.transport) {
    PROVIDERS[entry.id] = buildTransport(entry.transport, entry.oauth);
    if (entry.transports) PROVIDERS[entry.id].transports = entry.transports;
  }
  const modelKey = entry.alias || entry.id;
  const baseModels = entry.models !== undefined ? entry.models.map(normalizeModel) : [];
  const seenKeyKinds = new Set(baseModels.map((m) => `${m.id}:${m.kind || m.type || "llm"}`));
  for (const [cfgKey, kind] of CONFIG_MODEL_KINDS) {
    const cfgModels = entry[cfgKey]?.models || entry.media?.[cfgKey]?.models;
    if (!Array.isArray(cfgModels)) continue;
    for (const raw of cfgModels) {
      const m = normalizeModel(typeof raw === "string" ? { id: raw, kind } : { ...raw, kind: raw.kind || raw.type || kind });
      const keyKind = `${m.id}:${m.kind || m.type || kind}`;
      if (!seenKeyKinds.has(keyKind)) {
        seenKeyKinds.add(keyKind);
        baseModels.push(m);
      }
    }
  }
  if (entry.models !== undefined || baseModels.length > 0) {
    PROVIDER_MODELS[modelKey] = baseModels;
    if (modelKey !== entry.id && PROVIDER_MODELS[entry.id] === undefined) {
      PROVIDER_MODELS[entry.id] = baseModels;
    }
  }
  if (entry.oauth) PROVIDER_OAUTH[entry.id] = entry.oauth;
  if (entry.modelDiscovery) PROVIDER_MODEL_DISCOVERY[entry.id] = entry.modelDiscovery;
  // Build PROVIDER_MEDIA from top-level fields (post-migration) + legacy entry.media
  const mediaFields = {};
  for (const k of MEDIA_KEYS) {
    if (entry[k] !== undefined) mediaFields[k] = entry[k];
  }
  if (entry.media) Object.assign(mediaFields, entry.media);
  if (Object.keys(mediaFields).length) PROVIDER_MEDIA[entry.id] = mediaFields;
}

// TTS model/voice tables keyed by special names (openai-tts-models, ...), not provider ids
Object.assign(PROVIDER_MODELS, buildTtsProviderModels());
