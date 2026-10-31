import { getDisabledModels, disableModels, enableModels } from "@/lib/disabledModelsDb";
import { getProviderNodes } from "@/lib/localDb";
import { resolveProviderAlias } from "open-sse/services/model.js";
import REGISTRY from "open-sse/providers/registry/index.js";

function registryKeys(provider) {
  const resolved = resolveProviderAlias(provider);
  const entry = REGISTRY.find((item) =>
    item.id === resolved
    || item.id === provider
    || item.alias === provider
    || item.uiAlias === provider
    || item.aliases?.includes(provider)
  );
  return new Set([
    provider,
    resolved,
    entry?.id,
    entry?.alias,
    entry?.uiAlias,
    ...(entry?.aliases || []),
  ].filter(Boolean));
}

export async function resolveVisibilityKeys(provider, nodes = null) {
  const keys = registryKeys(provider);
  const providerNodes = nodes || await getProviderNodes();
  for (const node of providerNodes) {
    if (node.id === provider || node.prefix === provider || keys.has(node.id) || keys.has(node.prefix)) {
      if (node.id) keys.add(node.id);
      if (node.prefix) keys.add(node.prefix);
    }
  }
  return keys;
}

export async function createModelVisibilitySnapshot(ownerKeyId = null) {
  const [disabled, clientDisabled, nodes] = await Promise.all([
    getDisabledModels(),
    ownerKeyId ? getDisabledModels(ownerKeyId) : Promise.resolve({}),
    getProviderNodes(),
  ]);
  return { disabled, clientDisabled, nodes, ownerKeyId };
}

export async function isModelDisabled(provider, model, snapshot = null, ownerKeyId = null) {
  const state = snapshot || await createModelVisibilitySnapshot(ownerKeyId);
  const keys = await resolveVisibilityKeys(provider, state.nodes || []);
  for (const key of keys) {
    if (Array.isArray(state.disabled?.[key]) && state.disabled[key].includes(model)) return true;
    if (Array.isArray(state.clientDisabled?.[key]) && state.clientDisabled[key].includes(model)) return true;
  }
  return false;
}

export function modelDisabledResponse(provider, model) {
  return new Response(JSON.stringify({
    error: {
      message: `Model '${provider}/${model}' is disabled`,
      type: "model_disabled",
      code: "model_disabled",
    },
  }), {
    status: 409,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
}

export function noEnabledComboModelsResponse(comboName) {
  return new Response(JSON.stringify({
    error: {
      message: `Combo '${comboName}' has no enabled models`,
      type: "model_disabled",
      code: "model_disabled",
    },
  }), {
    status: 409,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
}

export async function enforceModelEnabled(provider, model, snapshot = null, ownerKeyId = null) {
  return await isModelDisabled(provider, model, snapshot, ownerKeyId)
    ? modelDisabledResponse(provider, model)
    : null;
}

export async function getDisabledModelIds(provider, snapshot = null, ownerKeyId = null) {
  const state = snapshot || await createModelVisibilitySnapshot(ownerKeyId);
  const keys = await resolveVisibilityKeys(provider, state.nodes || []);
  const ids = new Set();
  for (const key of keys) {
    for (const id of state.disabled?.[key] || []) ids.add(id);
    for (const id of state.clientDisabled?.[key] || []) ids.add(id);
  }
  return [...ids];
}

export async function disableCanonicalModels(provider, ids, ownerKeyId = null) {
  const nodes = await getProviderNodes();
  const node = nodes.find((item) => item.id === provider || item.prefix === provider);
  await disableModels(node?.id || resolveProviderAlias(provider), ids, ownerKeyId);
}

export async function enableCanonicalModels(provider, ids = [], ownerKeyId = null) {
  const keys = await resolveVisibilityKeys(provider);
  for (const key of keys) await enableModels(key, ids, ownerKeyId);
}

export async function filterEnabledModels(modelStrings, { comboName, resolveCombo, visiting = new Set(), ownerKeyId = null } = {}) {
  const snapshot = await createModelVisibilitySnapshot(ownerKeyId);
  const models = [];
  for (const modelString of modelStrings) {
    const slash = modelString.indexOf("/");
    if (slash <= 0) {
      if (!resolveCombo || visiting.has(modelString)) {
        models.push(modelString);
        continue;
      }
      const nested = await resolveCombo(modelString);
      if (!nested) {
        models.push(modelString);
        continue;
      }
      visiting.add(modelString);
      const visibleNested = await filterEnabledModels(nested, {
        comboName: modelString,
        resolveCombo,
        visiting,
        ownerKeyId,
      });
      visiting.delete(modelString);
      if (visibleNested.models.length > 0) models.push(modelString);
      continue;
    }
    const provider = modelString.slice(0, slash);
    const model = modelString.slice(slash + 1);
    if (!await isModelDisabled(provider, model, snapshot)) models.push(modelString);
  }
  return {
    models,
    response: modelStrings.length > 0 && models.length === 0
      ? noEnabledComboModelsResponse(comboName || "unknown")
      : null,
  };
}
