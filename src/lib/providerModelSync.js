// Pulls each connected provider's live model list and stores the models the
// built-in registry does not already know as custom models, so routing,
// /v1/models and the pickers all see them. Additive only: a failed or empty
// fetch never removes anything, and built-in models stay as the fallback.

import { PROVIDERS } from "open-sse/config/providers.js";

const TYPES_WITH_OWN_FETCH = ["openai-compatible", "anthropic-compatible"];

// Most OpenAI-style providers serve /models next to /chat/completions.
export function genericModelsConfig(providerId) {
  const base = PROVIDERS[providerId]?.baseUrl || PROVIDERS[providerId]?.transport?.baseUrl;
  if (typeof base !== "string" || !base.endsWith("/chat/completions")) return null;
  return {
    url: base.replace(/\/chat\/completions$/, "/models"),
    method: "GET",
    headers: { "Content-Type": "application/json" },
    authHeader: "Authorization",
    authPrefix: "Bearer ",
    parseResponse: (data) => (Array.isArray(data) ? data : data?.data || data?.models || []),
  };
}

const REPORTED_FIELDS = [
  "owned_by", "created", "description", "capabilities", "architecture",
  "context_length", "max_completion_tokens", "pricing", "supportedGenerationMethods",
  "supported_endpoint_types", "tags",
];

const NON_CHAT_PATTERN = /(?:^|[-_/])(guard|safeguard|safety|moderation|rerank)(?:$|[-_/])/i;

export function classifyProviderModelKind(provider, model) {
  const id = String(model?.id || model?.name || model?.model || "").replace(/^models\//, "").toLowerCase();
  if (!id || NON_CHAT_PATTERN.test(id)) return null;

  const endpointTypes = Array.isArray(model?.supported_endpoint_types)
    ? model.supported_endpoint_types.map((value) => String(value).toLowerCase())
    : [];
  if (endpointTypes.includes("embeddings")) return "embedding";
  if (endpointTypes.includes("image-generation")) return "image";
  if (endpointTypes.includes("audio-chat")) return "tts";

  const outputModalities = model?.architecture?.output_modalities;
  if (Array.isArray(outputModalities) && outputModalities.includes("image")) return "image";
  if (Array.isArray(outputModalities) && outputModalities.includes("audio")) return "tts";

  if (provider === "typesafe" || /(?:^|\/)jev(?:-|$)|^clef(?:-|:|$)/i.test(id)) return "systemone";
  if (/embed/.test(id)) return "embedding";
  if (/whisper|transcri/.test(id)) return "stt";
  if (/tts|speech|orpheus/.test(id)) return "tts";
  if (/sora|veo/.test(id)) return "video";
  if (/image|imagen|dall-?e|nano-banana/.test(id)) return "image";
  if (/realtime|live|audio|omni|lyria|robotics|computer-use|antigravity|deep-research|aqa/.test(id)) return null;
  if (provider === "gemini" && Array.isArray(model?.supportedGenerationMethods)
    && !model.supportedGenerationMethods.includes("generateContent")) return null;
  return "llm";
}

// Providers answer with {id}, {name: "models/x"} (Gemini) or {model}. Keep
// useful, bounded metadata for Phase 4 without treating it as verified here.
export function normalizeModelList(list, prefixes = []) {
  const seen = new Set();
  const out = [];
  let invalid = 0;
  let duplicates = 0;
  for (const m of Array.isArray(list) ? list : []) {
    if (!m || typeof m !== "object" || Array.isArray(m)) { invalid += 1; continue; }
    const raw = m.id || m.name || m.model;
    let id = typeof raw === "string" ? raw.replace(/^models\//, "").trim() : "";
    for (const prefix of Array.isArray(prefixes) ? prefixes : [prefixes]) {
      if (prefix && id.startsWith(`${prefix}/`)) { id = id.slice(prefix.length + 1); break; }
    }
    if (!id) { invalid += 1; continue; }
    if (seen.has(id)) { duplicates += 1; continue; }
    seen.add(id);
    const reported = {};
    for (const field of REPORTED_FIELDS) if (m[field] !== undefined) reported[field] = m[field];
    const display = m.displayName || ((m.id || m.model) && m.name) || id;
    out.push({ id, name: typeof display === "string" && display.trim() ? display.trim() : id, reported });
  }
  Object.defineProperties(out, {
    invalid: { value: invalid, enumerable: false },
    duplicates: { value: duplicates, enumerable: false },
  });
  return out;
}

// `fetchModels(conn)` returns one raw list; `upsertModels` persists the whole
// normalized catalog in one transaction. Built-ins stay registry-owned.
export async function syncConnectionModels(conn, { fetchModels, alias, builtinIds, builtinKinds, trackedKinds, upsertModels, signal }) {
  const builtins = builtinKinds || new Set([...builtinIds].map((id) => `llm:${id}`));
  const empty = { provider: conn.provider, connectionId: conn.id, fetched: 0, added: 0, updated: 0, unchanged: 0, invalid: 0, stale: 0 };
  if (signal?.aborted) return { ...empty, error: "Import cancelled" };
  let raw;
  try {
    raw = await fetchModels(conn);
  } catch (error) {
    return { ...empty, error: signal?.aborted ? "Import cancelled" : (error?.message || String(error)) };
  }
  if (signal?.aborted) return { ...empty, error: "Import cancelled" };
  const catalog = Array.isArray(raw) ? { models: raw, authoritative: true } : raw || {};
  const rawModels = Array.isArray(catalog.models) ? catalog.models : [];
  const byKind = new Map();
  let invalid = 0;
  for (const rawModel of rawModels) {
    const declaredKind = ["llm", "embedding", "image", "tts", "stt", "video", "systemone"].includes(rawModel?.kind)
      ? rawModel.kind
      : null;
    const kind = declaredKind || classifyProviderModelKind(conn.provider, rawModel);
    if (!kind) { invalid += 1; continue; }
    const models = byKind.get(kind) || [];
    models.push(rawModel);
    byKind.set(kind, models);
  }
  if (byKind.size === 0 && catalog.authoritative !== true) {
    return { ...empty, fetched: rawModels.length, invalid };
  }

  const kinds = catalog.authoritative === true
    ? new Set([...(trackedKinds || []), ...byKind.keys()])
    : new Set(byKind.keys());
  const total = { fetched: rawModels.length, added: 0, updated: 0, unchanged: 0, invalid, stale: 0 };
  for (const type of kinds) {
    const models = normalizeModelList(byKind.get(type) || [], [conn.provider, alias]);
    const imported = models.filter(({ id }) => !builtins.has(`${type}:${id}`));
    const saved = await upsertModels({
      providerAlias: alias,
      connectionId: conn.id,
      models: imported,
      type,
      // Fallback/static catalogs are useful additions, but only a confirmed live
      // catalog may mark previously imported entries stale.
      authoritative: catalog.authoritative === true,
    });
    total.added += saved.added || 0;
    total.updated += saved.updated || 0;
    total.unchanged += saved.unchanged || 0;
    total.invalid += (saved.invalid || 0) + models.invalid + models.duplicates;
    total.stale += saved.stale || 0;
  }
  return { provider: conn.provider, connectionId: conn.id, ...total };
}

export { TYPES_WITH_OWN_FETCH };
