import { getAdapter } from "../driver.js";
import { parseJson, stringifyJson } from "../helpers/jsonCol.js";

const SCOPE = "disabledModels";
const scopeFor = (ownerKeyId) => ownerKeyId ? `${SCOPE}:${ownerKeyId}` : SCOPE;
const MAX_PROVIDER_LENGTH = 256;
const MAX_MODEL_ID_LENGTH = 512;
const MAX_MODEL_IDS = 1000;

function cleanProvider(providerAlias) {
  if (typeof providerAlias !== "string") return null;
  const value = providerAlias.trim();
  return value && value.length <= MAX_PROVIDER_LENGTH ? value : null;
}

function cleanIds(ids) {
  if (!Array.isArray(ids) || ids.length > MAX_MODEL_IDS) return null;
  const clean = [];
  const seen = new Set();
  for (const id of ids) {
    if (typeof id !== "string") return null;
    const value = id.trim();
    if (!value || value.length > MAX_MODEL_ID_LENGTH) return null;
    if (!seen.has(value)) { seen.add(value); clean.push(value); }
  }
  return clean;
}

export async function getDisabledModels(ownerKeyId = null) {
  const db = await getAdapter();
  const scope = scopeFor(ownerKeyId);
  const rows = db.all(`SELECT key, value FROM kv WHERE scope = ?`, [scope]);
  const out = {};
  for (const r of rows) out[r.key] = parseJson(r.value, []);
  return out;
}

export async function getDisabledByProvider(providerAlias, ownerKeyId = null) {
  const db = await getAdapter();
  const scope = scopeFor(ownerKeyId);
  const row = db.get(`SELECT value FROM kv WHERE scope = ? AND key = ?`, [scope, providerAlias]);
  return row ? (parseJson(row.value, []) || []) : [];
}

// Atomic read-merge-write inside a transaction (no JS yield mid-transaction).
export async function disableModels(providerAlias, ids, ownerKeyId = null) {
  const provider = cleanProvider(providerAlias);
  const modelIds = cleanIds(ids);
  if (!provider || !modelIds) throw new Error("Invalid disabled model input");
  if (modelIds.length === 0) return;
  const db = await getAdapter();
  const scope = scopeFor(ownerKeyId);
  db.transaction(() => {
    const row = db.get(`SELECT value FROM kv WHERE scope = ? AND key = ?`, [scope, provider]);
    const current = row ? (parseJson(row.value, []) || []) : [];
    const merged = [...new Set([...current, ...modelIds])];
    db.run(
      `INSERT INTO kv(scope, key, value) VALUES(?, ?, ?) ON CONFLICT(scope, key) DO UPDATE SET value = excluded.value`,
      [scope, provider, stringifyJson(merged)]
    );
  });
}

export async function enableModels(providerAlias, ids, ownerKeyId = null) {
  const provider = cleanProvider(providerAlias);
  if (!provider) throw new Error("Invalid disabled model input");
  const modelIds = ids == null ? [] : cleanIds(ids);
  if (!modelIds) throw new Error("Invalid disabled model input");
  const db = await getAdapter();
  const scope = scopeFor(ownerKeyId);
  db.transaction(() => {
    if (modelIds.length === 0) {
      db.run(`DELETE FROM kv WHERE scope = ? AND key = ?`, [scope, provider]);
      return;
    }
    const row = db.get(`SELECT value FROM kv WHERE scope = ? AND key = ?`, [scope, provider]);
    const current = row ? (parseJson(row.value, []) || []) : [];
    const removeSet = new Set(modelIds);
    const next = current.filter((id) => !removeSet.has(id));
    if (next.length === 0) {
      db.run(`DELETE FROM kv WHERE scope = ? AND key = ?`, [scope, provider]);
    } else {
      db.run(
        `INSERT INTO kv(scope, key, value) VALUES(?, ?, ?) ON CONFLICT(scope, key) DO UPDATE SET value = excluded.value`,
        [scope, provider, stringifyJson(next)]
      );
    }
  });
}

