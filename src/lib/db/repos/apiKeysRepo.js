import { v4 as uuidv4 } from "uuid";
import { getAdapter } from "../driver.js";
import { keyAccessFromColumns, keyAccessToColumns } from "@/shared/utils/keyAccess.js";
import { endpointsFromColumn } from "@/shared/utils/keyAccess.js";
import { KEY_ACCESS_UNRESTRICTED } from "@/shared/constants/keyAccess.js";

function parseJsonObject(val) {
  if (!val) return {};
  if (typeof val === "object" && !Array.isArray(val)) return val;
  try {
    const parsed = JSON.parse(val);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function rowToKey(row) {
  if (!row) return null;
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    machineId: row.machineId,
    isActive: row.isActive === 1 || row.isActive === true,
    createdAt: row.createdAt,
    access: keyAccessFromColumns(row.accessRestricted, row.accessAllow),
    allowedEndpoints: endpointsFromColumn(row.allowedEndpoints),
    clientEmail: row.clientEmail || null,
    tokenSaverSettings: parseJsonObject(row.tokenSaverSettings),
  };
}

export async function getApiKeys() {
  const db = await getAdapter();
  const rows = db.all(`SELECT * FROM apiKeys ORDER BY createdAt ASC`);
  return rows.map(rowToKey);
}

export async function getApiKeyById(id) {
  const db = await getAdapter();
  const row = db.get(`SELECT * FROM apiKeys WHERE id = ?`, [id]);
  return rowToKey(row);
}

// Used by the /v1 handlers to read the presented key's access settings.
export async function getApiKeyByKey(key) {
  if (!key) return null;
  const db = await getAdapter();
  const row = db.get(`SELECT * FROM apiKeys WHERE key = ?`, [key]);
  return rowToKey(row);
}

export async function createApiKey(name, machineId, allowedEndpoints = [], options = {}) {
  if (!machineId) throw new Error("machineId is required");
  const db = await getAdapter();
  const { generateApiKeyWithMachine } = await import("@/shared/utils/apiKey");
  const result = generateApiKeyWithMachine(machineId);
  const clientEmail = typeof options?.clientEmail === "string" && options.clientEmail.trim()
    ? options.clientEmail.trim().toLowerCase()
    : null;
  const tokenSaverSettings = parseJsonObject(options?.tokenSaverSettings);
  const access = options?.access || { restricted: false, allow: [] };
  const apiKey = {
    id: uuidv4(),
    name,
    key: result.key,
    machineId,
    isActive: true,
    createdAt: new Date().toISOString(),
    access,
    allowedEndpoints,
    clientEmail,
    tokenSaverSettings,
  };
  const cols = keyAccessToColumns(access.restricted ? access : KEY_ACCESS_UNRESTRICTED);
  db.run(
    `INSERT INTO apiKeys(id, key, name, machineId, isActive, createdAt, accessRestricted, accessAllow, allowedEndpoints, clientEmail, tokenSaverSettings) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      apiKey.id,
      apiKey.key,
      apiKey.name,
      apiKey.machineId,
      1,
      apiKey.createdAt,
      cols.accessRestricted,
      cols.accessAllow,
      JSON.stringify(allowedEndpoints),
      apiKey.clientEmail,
      JSON.stringify(apiKey.tokenSaverSettings),
    ]
  );
  return apiKey;
}

export async function updateApiKey(id, data) {
  const db = await getAdapter();
  let result = null;
  db.transaction(() => {
    const row = db.get(`SELECT * FROM apiKeys WHERE id = ?`, [id]);
    if (!row) return;
    const current = rowToKey(row);
    const merged = { ...current, ...data };
    if (data.clientEmail !== undefined) {
      merged.clientEmail = typeof data.clientEmail === "string" && data.clientEmail.trim()
        ? data.clientEmail.trim().toLowerCase()
        : null;
    }
    if (data.tokenSaverSettings !== undefined) {
      merged.tokenSaverSettings = {
        ...(current.tokenSaverSettings || {}),
        ...parseJsonObject(data.tokenSaverSettings),
      };
    }
    const cols = keyAccessToColumns(merged.access);
    db.run(
      `UPDATE apiKeys SET key = ?, name = ?, machineId = ?, isActive = ?, accessRestricted = ?, accessAllow = ?, allowedEndpoints = ?, clientEmail = ?, tokenSaverSettings = ? WHERE id = ?`,
      [
        merged.key,
        merged.name,
        merged.machineId,
        merged.isActive ? 1 : 0,
        cols.accessRestricted,
        cols.accessAllow,
        JSON.stringify(merged.allowedEndpoints || []),
        merged.clientEmail || null,
        JSON.stringify(merged.tokenSaverSettings || {}),
        id,
      ]
    );
    result = rowToKey(db.get(`SELECT * FROM apiKeys WHERE id = ?`, [id]));
  });
  return result;
}

export async function deleteApiKey(id) {
  const db = await getAdapter();
  const res = db.run(`DELETE FROM apiKeys WHERE id = ?`, [id]);
  return (res?.changes ?? 0) > 0;
}

export async function validateApiKey(key) {
  const db = await getAdapter();
  const row = db.get(`SELECT isActive FROM apiKeys WHERE key = ?`, [key]);
  if (!row) return false;
  return row.isActive === 1 || row.isActive === true;
}

/**
 * Authenticate a client account using their Busbar API key as password
 * (and optional email match if provided).
 */
export async function authenticateClientKey(email, keyPassword) {
  if (typeof keyPassword !== "string" || !keyPassword.trim()) return null;
  const record = await getApiKeyByKey(keyPassword.trim());
  if (!record || !record.isActive) return null;
  const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
  if (normalizedEmail) {
    const keyEmail = (record.clientEmail || record.name || "").trim().toLowerCase();
    if (keyEmail !== normalizedEmail) return null;
  }
  return record;
}
