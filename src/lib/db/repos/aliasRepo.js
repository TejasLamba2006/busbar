import { getAdapter } from "../driver.js";
import { parseJson, stringifyJson } from "../helpers/jsonCol.js";
import { makeKv } from "../helpers/kvStore.js";

const aliasKv = makeKv("modelAliases");
const customKv = makeKv("customModels");
const mitmKv = makeKv("mitmAlias");

// modelAliases: key=alias, value=modelString
export async function getModelAliases() {
  return await aliasKv.getAll();
}

export async function setModelAlias(alias, model) {
  await aliasKv.set(alias, model);
}

export async function deleteModelAlias(alias) {
  await aliasKv.remove(alias);
}

// customModels: key=`${providerAlias}|${id}|${type}`, value=full model object
function customKey(providerAlias, id, type) {
  return `${providerAlias}|${id}|${type}`;
}

const REPORTED_MODEL_FIELDS = [
  "owned_by", "created", "description", "capabilities", "architecture",
  "context_length", "max_completion_tokens", "pricing", "supportedGenerationMethods",
];
const MAX_MODEL_ID_LENGTH = 512;
const MAX_MODEL_NAME_LENGTH = 512;
const MAX_REPORTED_BYTES = 16 * 1024;

function normalizeImportedModel(model) {
  if (!model || typeof model !== "object" || Array.isArray(model)) return null;
  const rawId = model.id ?? model.model ?? model.name;
  if (typeof rawId !== "string") return null;
  const id = rawId.replace(/^models\//, "").trim();
  if (!id || id.length > MAX_MODEL_ID_LENGTH) return null;

  const rawName = model.displayName ?? ((model.id || model.model) ? model.name : null);
  const name = typeof rawName === "string" && rawName.trim()
    ? rawName.trim().slice(0, MAX_MODEL_NAME_LENGTH)
    : id;
  const reported = model.reported && typeof model.reported === "object" && !Array.isArray(model.reported)
    ? { ...model.reported }
    : {};
  for (const field of REPORTED_MODEL_FIELDS) {
    if (model[field] !== undefined) reported[field] = model[field];
  }
  let safeReported = {};
  try {
    const encoded = JSON.stringify(reported);
    if (Buffer.byteLength(encoded) <= MAX_REPORTED_BYTES) safeReported = JSON.parse(encoded);
  } catch { /* ignore non-serializable upstream metadata */ }
  return { id, name, reported: safeReported };
}

export async function getCustomModels() {
  const all = await customKv.getAll();
  return Object.values(all);
}

// Atomic upsert inside transaction to prevent duplicate races.
// Re-adding an existing model updates caps/name/transport without resetting omitted fields.
export async function addCustomModel({ providerAlias, id, type = "llm", name, caps, transport, upstreamModelId }) {
  const k = customKey(providerAlias, id, type);
  const db = await getAdapter();
  const cleanUpstream = typeof upstreamModelId === "string" && upstreamModelId.trim()
    ? upstreamModelId.trim()
    : null;
  let added = false;
  db.transaction(() => {
    const row = db.get(`SELECT value FROM kv WHERE scope = 'customModels' AND key = ?`, [k]);
    if (row) {
      const prev = parseJson(row.value) || {};
      const next = {
        ...prev,
        ...(name ? { name } : {}),
        ...(caps ? { caps } : {}),
        ...(transport ? { transport } : {}),
        source: "manual",
        stale: false,
        ...(cleanUpstream ? { upstreamModelId: cleanUpstream } : {}),
      };
      db.run(`UPDATE kv SET value = ? WHERE scope = 'customModels' AND key = ?`, [stringifyJson(next), k]);
      return;
    }
    const value = stringifyJson({ providerAlias, id, type, name: name || id, source: "manual", ...(caps ? { caps } : {}), ...(transport ? { transport } : {}), ...(cleanUpstream ? { upstreamModelId: cleanUpstream } : {}) });
    db.run(`INSERT INTO kv(scope, key, value) VALUES('customModels', ?, ?)`, [k, value]);
    added = true;
  });
  return added;
}

// Import one authoritative upstream catalog in one transaction. Additive: an
// empty catalog changes nothing; missing upstream-imported entries become stale
// instead of being deleted/hidden. Manual fields (name/caps/transport) stay owned
// by the operator when an imported id already exists.
export async function upsertCustomModels({ providerAlias, connectionId, models, type = "llm", fetchedAt = new Date().toISOString(), authoritative = false }) {
  if (typeof providerAlias !== "string" || !providerAlias.trim()) throw new Error("providerAlias required");
  if (!Array.isArray(models)) throw new Error("models must be an array");
  const result = { fetched: models.length, added: 0, updated: 0, unchanged: 0, invalid: 0, stale: 0 };
  const normalized = new Map();
  for (const model of models) {
    const clean = normalizeImportedModel(model);
    if (!clean) { result.invalid += 1; continue; }
    if (!normalized.has(clean.id)) normalized.set(clean.id, clean);
  }
  if (normalized.size === 0 && !authoritative) return result;

  const alias = providerAlias.trim();
  const db = await getAdapter();
  db.transaction(() => {
    const rows = db.all(`SELECT key, value FROM kv WHERE scope = 'customModels'`);
    const existing = new Map();
    for (const row of rows) {
      const value = parseJson(row.value) || {};
      if (value.providerAlias === alias && (value.type || value.kind || "llm") === type) {
        existing.set(value.id, { key: row.key, value });
      }
    }

    for (const [id, incoming] of normalized) {
      const found = existing.get(id);
      if (!found) {
        const value = {
          providerAlias: alias, id, type, name: incoming.name,
          source: "upstream", connectionId: connectionId || null,
          connectionIds: connectionId ? [connectionId] : [],
          firstSeenAt: fetchedAt, lastSeenAt: fetchedAt, stale: false,
          ...(Object.keys(incoming.reported).length ? { reported: incoming.reported } : {}),
        };
        db.run(`INSERT INTO kv(scope, key, value) VALUES('customModels', ?, ?)`, [customKey(alias, id, type), stringifyJson(value)]);
        result.added += 1;
        continue;
      }

      const prev = found.value;
      const manual = prev.source === "manual" || prev.source == null;
      const connectionIds = [...new Set([
        ...(Array.isArray(prev.connectionIds) ? prev.connectionIds : []),
        ...(prev.connectionId ? [prev.connectionId] : []),
        ...(connectionId ? [connectionId] : []),
      ])];
      const next = {
        ...prev,
        ...(manual ? {} : { name: incoming.name }),
        source: manual ? "manual" : "upstream",
        connectionId: connectionId || prev.connectionId || null,
        connectionIds,
        firstSeenAt: prev.firstSeenAt || fetchedAt,
        lastSeenAt: fetchedAt,
        stale: false,
        ...(Object.keys(incoming.reported).length ? { reported: incoming.reported } : { reported: {} }),
      };
      const comparablePrev = { ...prev, lastSeenAt: null };
      const comparableNext = { ...next, lastSeenAt: null };
      const metadataChanged = stringifyJson(comparableNext) !== stringifyJson(comparablePrev);
      if (stringifyJson(next) !== stringifyJson(prev)) {
        db.run(`UPDATE kv SET value = ? WHERE scope = 'customModels' AND key = ?`, [stringifyJson(next), found.key]);
      }
      if (metadataChanged) result.updated += 1;
      else result.unchanged += 1;
    }

    if (!authoritative) return;
    for (const [id, found] of existing) {
      if (normalized.has(id) || found.value.source !== "upstream" || found.value.stale === true) continue;
      const connectionIds = [...new Set([
        ...(Array.isArray(found.value.connectionIds) ? found.value.connectionIds : []),
        ...(found.value.connectionId ? [found.value.connectionId] : []),
      ])];
      if (!connectionIds.includes(connectionId)) continue;
      const remainingConnectionIds = connectionIds.filter((id) => id !== connectionId);
      const next = {
        ...found.value,
        connectionIds: remainingConnectionIds,
        connectionId: remainingConnectionIds.at(-1) || null,
        stale: remainingConnectionIds.length === 0,
      };
      db.run(`UPDATE kv SET value = ? WHERE scope = 'customModels' AND key = ?`, [stringifyJson(next), found.key]);
      if (next.stale) result.stale += 1;
    }
  });
  return result;
}

export async function deleteCustomModel({ providerAlias, id, type = "llm" }) {
  await customKv.remove(customKey(providerAlias, id, type));
}

// mitmAlias: key=toolName, value=mappings object
export async function getMitmAlias(toolName) {
  if (toolName) {
    const v = await mitmKv.get(toolName);
    return v || {};
  }
  return await mitmKv.getAll();
}

export async function setMitmAliasAll(toolName, mappings) {
  await mitmKv.set(toolName, mappings || {});
}
