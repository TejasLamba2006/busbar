// Re-export from open-sse with localDb integration
import { getModelAliases, getComboByName, getProviderNodes, getProviderConnections } from "@/lib/localDb";
import { parseModel as parseModelCore, resolveModelAliasFromMap, getModelInfoCore } from "open-sse/services/model.js";
import REGISTRY from "open-sse/providers/registry/index.js";
import { FREE_PROVIDERS } from "@/shared/constants/providers.js";

// Local provider alias overrides (HMR-friendly, applied on top of open-sse map)
const LOCAL_PROVIDER_ALIASES = {
  xmtp: "xiaomi-tokenplan",
  "xiaomi-tokenplan": "xiaomi-tokenplan",
};

const RESERVED_PROVIDER_PREFIXES = new Set(Object.keys(LOCAL_PROVIDER_ALIASES));
for (const entry of REGISTRY) {
  RESERVED_PROVIDER_PREFIXES.add(entry.id);
  if (entry.alias) RESERVED_PROVIDER_PREFIXES.add(entry.alias);
  for (const alias of entry.aliases || []) RESERVED_PROVIDER_PREFIXES.add(alias);
}

export function parseModel(modelStr) {
  const parsed = parseModelCore(modelStr);
  if (parsed?.providerAlias && LOCAL_PROVIDER_ALIASES[parsed.providerAlias]) {
    return { ...parsed, provider: LOCAL_PROVIDER_ALIASES[parsed.providerAlias] };
  }
  return parsed;
}

/**
 * Resolve model alias from localDb
 */
export async function resolveModelAlias(alias) {
  const aliases = await getModelAliases();
  return resolveModelAliasFromMap(alias, aliases);
}

/**
 * Get full model info (parse or resolve)
 */
export async function getModelInfo(modelStr) {
  // Exact aliases may themselves look like provider/model paths. Resolve them
  // before parseModel(), otherwise the slash makes the alias unreachable.
  const aliases = await getModelAliases();
  const exactAlias = resolveModelAliasFromMap(modelStr, aliases);
  if (exactAlias) return exactAlias;

  const parsed = parseModel(modelStr);

  if (!parsed.isAlias) {
    // Provider-node prefixes are user-defined. They must not override built-in
    // provider ids/aliases such as `cf`, `cloudflare-ai`, `openai`, or `hf`.
    if (!RESERVED_PROVIDER_PREFIXES.has(parsed.providerAlias)) {
      const openaiNodes = await getProviderNodes({ type: "openai-compatible" });
      const matchedOpenAI = openaiNodes.find((node) => node.prefix === parsed.providerAlias);
      if (matchedOpenAI) {
        return { provider: matchedOpenAI.id, model: parsed.model };
      }

      const anthropicNodes = await getProviderNodes({ type: "anthropic-compatible" });
      const matchedAnthropic = anthropicNodes.find((node) => node.prefix === parsed.providerAlias);
      if (matchedAnthropic) {
        return { provider: matchedAnthropic.id, model: parsed.model };
      }

      const embeddingNodes = await getProviderNodes({ type: "custom-embedding" });
      const matchedEmbedding = embeddingNodes.find((node) => node.prefix === parsed.providerAlias);
      if (matchedEmbedding) {
        return { provider: matchedEmbedding.id, model: parsed.model };
      }
    }
    return {
      provider: parsed.provider,
      model: parsed.model
    };
  }

  // Check if this is a combo name before resolving as alias
  // This prevents combo names from being incorrectly routed to providers
  const combo = await getComboByName(parsed.model);
  if (combo) {
    // Return null provider to signal this should be handled as combo
    // The caller (handleChat) will detect this and handle it as combo
    return { provider: null, model: parsed.model };
  }

  return getModelInfoCore(modelStr, aliases);
}

/**
 * Check if model is a combo and get models list
 * @returns {Promise<string[]|null>} Array of models or null if not a combo
 */
export async function getComboModels(modelStr) {
  // Only check if it's not in provider/model format
  if (modelStr.includes("/")) return null;

  const combo = await getComboByName(modelStr);
  if (combo && combo.models && combo.models.length > 0) {
    return combo.models;
  }
  return null;
}

/**
 * Bare model id (no provider prefix) -> "provider/model" targets on providers
 * the caller can use. Primary inferred provider first. Empty = keep old routing.
 * @returns {Promise<string[]>}
 */
export async function getBareModelFailoverTargets(modelStr, options = {}) {
  if (!modelStr || typeof modelStr !== "string" || modelStr.includes("/")) return [];
  if (await getComboByName(modelStr)) return [];
  const aliases = await getModelAliases();
  if (aliases?.[modelStr]) return [];

  const conns = await getProviderConnections();
  const activeProviders = new Set(
    conns
      .filter((c) => options.clientKeyId
        ? c.providerSpecificData?.ownerKeyId === options.clientKeyId && c.providerSpecificData?.clientActive !== false
        : c.isActive !== false && !c.providerSpecificData?.ownerKeyId)
      .map((c) => c.provider)
  );
  for (const [id, entry] of Object.entries(FREE_PROVIDERS)) {
    if (entry.noAuth) activeProviders.add(id);
  }

  const lower = modelStr.toLowerCase();
  const listsModel = (entry) => {
    const hit = (entry.models || []).find((m) => m.id?.toLowerCase() === lower);
    return hit ? hit.id : null;
  };

  const primary = await getModelInfoCore(modelStr, aliases);
  const ordered = [];
  if (primary?.provider) ordered.push(primary.provider);
  for (const entry of REGISTRY) if (!ordered.includes(entry.id)) ordered.push(entry.id);

  const targets = [];
  for (const providerId of ordered) {
    if (!activeProviders.has(providerId)) continue;
    const entry = REGISTRY.find((r) => r.id === providerId);
    const matchedId = entry && listsModel(entry);
    if (!matchedId) continue;
    const target = `${providerId}/${matchedId}`;
    if (!targets.includes(target)) targets.push(target);
  }
  return targets;
}
