// Per-API-key access control for the /v1/* inference keys.
//
// Two modes per key: UNRESTRICTED (default — exactly today's behaviour) or
// RESTRICTED, where the key may call ONLY the combos and models in its allow
// list. No wildcards, no deny mode. Matching is exact and case-insensitive, on
// RESOLVED identities, so every spelling that routes to the same target is
// treated the same and no spelling can route somewhere the list does not name:
//
//   * a request that routes as a combo (getComboModels — the lookup routing
//     itself uses) is allowed iff that combo's name is listed;
//   * a request that routes to a model is allowed iff its resolved
//     `providerId/model` equals the resolved `providerId/model` of a listed
//     model entry. So `cx/gpt-5`, `codex/gpt-5` and an alias that points there
//     are one target; a raw string that merely looks like a listed entry but
//     routes elsewhere (e.g. `MAIN` when the combo is `Main`, which routes to
//     `openai/MAIN`) is not;
//   * search/fetch (provider IS the model) are allowed iff the resolved
//     provider id is listed, or the request is a listed combo.
//
// An allowed combo grants its members when they are reached THROUGH that combo
// (the check runs once, on the requested target, before combo expansion). It
// does not grant calling a member directly by name — that needs its own entry.
// The check runs before any credential lookup, so a denied request never
// touches a provider account.
import { getApiKeyByKey } from "@/lib/db/repos/apiKeysRepo.js";
import { getCombos } from "@/lib/db/repos/combosRepo.js";
import { getModelInfo, getComboModels } from "./model.js";
import { resolveProviderId } from "@/shared/constants/providers.js";
import {
  KEY_ACCESS_COMBO_OWNER,
  KEY_ACCESS_PROVIDER_AS_MODEL_KINDS,
  ENDPOINT_SCOPES,
  endpointDeniedMessage,
  keyAccessDeniedMessage,
} from "@/shared/constants/keyAccess.js";
import { errorResponse } from "open-sse/utils/error.js";
import { HTTP_STATUS } from "open-sse/config/runtimeConfig.js";
import * as log from "../utils/logger.js";

export { ENDPOINT_SCOPES };

const lower = (s) => String(s).toLowerCase();
const canonicalModel = (provider, model) => lower(`${provider}/${model}`);

/**
 * The client key, read from the same places and in the same order as the
 * middleware (src/dashboardGuard.js) reads the key it authorizes a remote
 * /v1 call with: Bearer, x-api-key, x-goog-api-key, ?key=. Handlers' own
 * extractApiKey() only reads the first two, so using it here would let a
 * restricted key sent as x-goog-api-key look like "no key" (= unrestricted).
 */
export function extractClientApiKey(request) {
  const headers = request?.headers;
  if (!headers?.get) return null;
  const auth = headers.get("Authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7);
  const xApiKey = headers.get("x-api-key");
  if (xApiKey) return xApiKey;
  const googKey = headers.get("x-goog-api-key");
  if (googKey) return googKey;
  try {
    return new URL(request.url).searchParams.get("key") || null;
  } catch {
    return null;
  }
}

/**
 * Access context for the request's key, or null when the request is
 * unrestricted (no key, unknown key, or a key whose access is unrestricted).
 * Keys are only authenticated elsewhere (middleware / requireApiKey); this only
 * decides what an identified key may call.
 */
export async function getKeyAccessContext(request) {
  const apiKey = extractClientApiKey(request);
  if (!apiKey) return null;
  const record = await getApiKeyByKey(apiKey);
  const allowedEndpoints = record?.allowedEndpoints || [];
  const modelRestricted = !!record?.access?.restricted;
  if (!modelRestricted && allowedEndpoints.length === 0) return null;
  return {
    keyId: record.id,
    keyName: record.name || record.id,
    modelRestricted,
    allow: record.access?.allow || [],
    allowedEndpoints,
    pathname: normalizePathname(request),
    _sets: null,
  };
}

function normalizePathname(request) {
  try {
    return new URL(request.url).pathname.replace(/^\/api(?=\/v1)/, "").replace(/\/+$/, "") || "/";
  } catch {
    return "";
  }
}

const underPath = (pathname, prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`);

/**
 * Per-key endpoint gate. Entries are scope ids (ENDPOINT_SCOPES) or raw "/v1/..."
 * path prefixes. Empty list = unrestricted. `endpointOrRequest` defaults to the
 * path captured in the context; pass a Request or a path string to override.
 * @returns {Response|null} 403 when the key may not call this endpoint.
 */
export function enforceEndpointAccess(ctx, endpointOrRequest) {
  if (!ctx?.allowedEndpoints?.length) return null;
  const pathname = typeof endpointOrRequest === "string"
    ? endpointOrRequest
    : endpointOrRequest ? normalizePathname(endpointOrRequest) : ctx.pathname;
  const ok = ctx.allowedEndpoints.some((entry) => {
    const prefixes = ENDPOINT_SCOPES[entry]?.paths || (entry.startsWith("/") ? [entry.replace(/\/+$/, "")] : []);
    return prefixes.some((p) => underPath(pathname, p));
  });
  if (ok) return null;
  log.warn("AUTH", `key-access: key "${ctx.keyName}" denied endpoint "${pathname}"`);
  return Response.json(
    { error: { message: endpointDeniedMessage(pathname), type: "permission_error", code: "endpoint_not_allowed" } },
    { status: HTTP_STATUS.FORBIDDEN }
  );
}

// Resolve the allow list once per request: combo names, resolved model ids,
// and resolved provider ids (for provider-as-model kinds and provider/* wildcards).
async function getAllowSets(ctx) {
  if (ctx._sets) return ctx._sets;
  const comboNames = new Set((await getCombos()).map((c) => lower(c.name)));
  const combos = new Set();
  const models = new Set();
  const providers = new Set();
  const wildcardProviders = new Set();
  for (const entry of ctx.allow) {
    const key = lower(entry);
    if (comboNames.has(key)) {
      combos.add(key);
      continue;
    }
    if (!entry.includes("/")) {
      const resolvedId = lower(resolveProviderId(entry));
      providers.add(resolvedId);
      const info = await getModelInfo(entry);
      if (info?.provider && info.model) models.add(canonicalModel(info.provider, info.model));
      continue;
    }
    const info = await getModelInfo(entry);
    if (info?.provider && info.model === "*") {
      wildcardProviders.add(lower(info.provider));
      providers.add(lower(info.provider));
      continue;
    }
    if (info?.provider && (info.model === "search" || info.model === "fetch")) {
      providers.add(lower(info.provider));
    }
    if (info?.provider && info.model) models.add(canonicalModel(info.provider, info.model));
  }
  ctx._sets = { combos, models, providers, wildcardProviders };
  return ctx._sets;
}

function matchesAllowedModel(sets, provider, model) {
  if (!provider || !model) return false;
  const p = lower(provider);
  if (sets.wildcardProviders.has(p) || sets.providers.has(p)) return true;
  if (sets.models.has(canonicalModel(provider, model))) return true;
  // TTS requests often send "provider/tts-model/voice" while the allow list stores "provider/tts-model"
  if (typeof model === "string" && model.includes("/")) {
    const baseModel = model.slice(0, model.indexOf("/"));
    if (sets.models.has(canonicalModel(provider, baseModel))) return true;
  }
  return false;
}

async function isModelStringAllowed(ctx, requested) {
  const sets = await getAllowSets(ctx);
  const info = await getModelInfo(requested);
  // provider null ⇔ an existing combo with no members (routes nowhere).
  if (!info?.provider) return sets.combos.has(lower(requested));
  return matchesAllowedModel(sets, info.provider, info.model);
}

export function keyAccessDeniedResponse(ctx, requested) {
  log.warn("AUTH", `key-access: key "${ctx.keyName}" denied "${requested}"`);
  return errorResponse(HTTP_STATUS.FORBIDDEN, keyAccessDeniedMessage(requested));
}

/**
 * Gate for endpoints whose `model` may be a combo or a model (chat, image, tts).
 * Call with the requested string BEFORE combo expansion.
 * @returns {Promise<Response|null>} a 403 Response, or null when allowed.
 */
export async function enforceKeyAccess(ctx, requested) {
  if (!ctx) return null;
  const endpointDenied = enforceEndpointAccess(ctx);
  if (endpointDenied) return endpointDenied;
  if (!ctx.modelRestricted) return null;
  if (typeof requested !== "string" || !requested) return keyAccessDeniedResponse(ctx, String(requested ?? ""));
  const sets = await getAllowSets(ctx);
  const comboModels = await getComboModels(requested);
  const allowed = comboModels
    ? sets.combos.has(lower(requested))
    : await isModelStringAllowed(ctx, requested);
  return allowed ? null : keyAccessDeniedResponse(ctx, requested);
}

/**
 * Gate for endpoints that resolve a single provider/model themselves
 * (embeddings, stt, systemone, video, Gemini-native TTS). A missing model
 * (e.g. a multipart video body we do not parse) is denied for restricted keys:
 * an unverifiable target is not an allowed one.
 */
export async function enforceKeyAccessResolved(ctx, requested, provider, model) {
  if (!ctx) return null;
  const endpointDenied = enforceEndpointAccess(ctx);
  if (endpointDenied) return endpointDenied;
  if (!ctx.modelRestricted) return null;
  const label = requested || (provider ? `${provider}/${model ?? ""}` : "");
  if (!provider || !model) return keyAccessDeniedResponse(ctx, label);
  const sets = await getAllowSets(ctx);
  return matchesAllowedModel(sets, provider, model) ? null : keyAccessDeniedResponse(ctx, label);
}

/**
 * Gate for search/fetch, where the provider IS the model.
 * @param {string[]|null} comboModels - routing's own combo resolution for `requested`
 */
export async function enforceKeyAccessProvider(ctx, requested, comboModels) {
  if (!ctx) return null;
  const endpointDenied = enforceEndpointAccess(ctx);
  if (endpointDenied) return endpointDenied;
  if (!ctx.modelRestricted) return null;
  if (typeof requested !== "string" || !requested) return keyAccessDeniedResponse(ctx, String(requested ?? ""));
  const sets = await getAllowSets(ctx);
  let resolvedProvider = requested;
  if (requested.includes("/")) {
    const info = await getModelInfo(requested);
    if (info?.provider) resolvedProvider = info.provider;
  }
  const p = lower(resolveProviderId(resolvedProvider));
  const allowed = comboModels
    ? sets.combos.has(lower(requested))
    : (sets.providers.has(p) || sets.wildcardProviders.has(p));
  return allowed ? null : keyAccessDeniedResponse(ctx, requested);
}

/**
 * Capacity-adapter models are appended by the gateway, not chosen by the
 * client. For a restricted key keep only the adapter models the key may call
 * directly; the original targets (already gated) are always kept. Dropping a
 * model just shortens the fallback list, so combo failover is unaffected.
 */
export async function filterAdapterModels(ctx, augmented, original) {
  if (!ctx?.modelRestricted || !Array.isArray(augmented)) return augmented;
  const keep = new Set(original || []);
  const out = [];
  for (const m of augmented) {
    if (keep.has(m) || await isModelStringAllowed(ctx, m)) out.push(m);
    else log.info("AUTH", `key-access: key "${ctx.keyName}" skips adapter model "${m}" (not allowed)`);
  }
  return out;
}

/** /v1/models: a restricted key sees only the combos and models it may call. */
export async function filterModelsListForKey(ctx, list) {
  if (!ctx?.modelRestricted || !Array.isArray(list)) return list;
  const sets = await getAllowSets(ctx);
  const out = [];
  for (const entry of list) {
    if (!entry?.id) continue;
    if (entry.owned_by === KEY_ACCESS_COMBO_OWNER) {
      if (sets.combos.has(lower(entry.id))) out.push(entry);
      continue;
    }
    const info = await getModelInfo(entry.id);
    if (!info?.provider) continue;
    if (KEY_ACCESS_PROVIDER_AS_MODEL_KINDS.includes(entry.kind)) {
      const p = lower(info.provider);
      if (sets.providers.has(p) || sets.wildcardProviders.has(p) || sets.models.has(canonicalModel(info.provider, info.model))) {
        out.push(entry);
      }
      continue;
    }
    if (matchesAllowedModel(sets, info.provider, info.model)) out.push(entry);
  }
  return out;
}
