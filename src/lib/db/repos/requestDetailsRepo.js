import { getAdapter } from "../driver.js";
import { parseJson, stringifyJson } from "../helpers/jsonCol.js";

const DEFAULT_MAX_RECORDS = 200;
const DEFAULT_BATCH_SIZE = 20;
const DEFAULT_FLUSH_INTERVAL_MS = 5000;
const DEFAULT_MAX_JSON_SIZE = 5 * 1024;
const CONFIG_CACHE_TTL_MS = 5000;

let cachedConfig = null;
let cachedConfigTs = 0;

async function getObservabilityConfig() {
  if (cachedConfig && (Date.now() - cachedConfigTs) < CONFIG_CACHE_TTL_MS) return cachedConfig;
  try {
    const { getSettings } = await import("./settingsRepo.js");
    const settings = await getSettings();
    const envRequestLogs = process.env.ENABLE_REQUEST_LOGS;
    if (envRequestLogs !== undefined) {
      const enabled = envRequestLogs.toLowerCase() === "true";
      cachedConfig = {
        enabled,
        maxRecords: settings.observabilityMaxRecords || parseInt(process.env.OBSERVABILITY_MAX_RECORDS || String(DEFAULT_MAX_RECORDS), 10),
        batchSize: settings.observabilityBatchSize || parseInt(process.env.OBSERVABILITY_BATCH_SIZE || String(DEFAULT_BATCH_SIZE), 10),
        flushIntervalMs: settings.observabilityFlushIntervalMs || parseInt(process.env.OBSERVABILITY_FLUSH_INTERVAL_MS || String(DEFAULT_FLUSH_INTERVAL_MS), 10),
        maxJsonSize: (settings.observabilityMaxJsonSize || parseInt(process.env.OBSERVABILITY_MAX_JSON_SIZE || "5", 10)) * 1024,
      };
      cachedConfigTs = Date.now();
      return cachedConfig;
    }
    const envFallback = process.env.OBSERVABILITY_ENABLED !== "false";
    const uiFlag = typeof settings.enableObservability === "boolean";
    const enabled = uiFlag
      ? settings.enableObservability
      : envFallback;

    cachedConfig = {
      enabled,
      maxRecords: settings.observabilityMaxRecords || parseInt(process.env.OBSERVABILITY_MAX_RECORDS || String(DEFAULT_MAX_RECORDS), 10),
      batchSize: settings.observabilityBatchSize || parseInt(process.env.OBSERVABILITY_BATCH_SIZE || String(DEFAULT_BATCH_SIZE), 10),
      flushIntervalMs: settings.observabilityFlushIntervalMs || parseInt(process.env.OBSERVABILITY_FLUSH_INTERVAL_MS || String(DEFAULT_FLUSH_INTERVAL_MS), 10),
      maxJsonSize: (settings.observabilityMaxJsonSize || parseInt(process.env.OBSERVABILITY_MAX_JSON_SIZE || "5", 10)) * 1024,
    };
  } catch {
    cachedConfig = {
      enabled: false,
      maxRecords: DEFAULT_MAX_RECORDS,
      batchSize: DEFAULT_BATCH_SIZE,
      flushIntervalMs: DEFAULT_FLUSH_INTERVAL_MS,
      maxJsonSize: DEFAULT_MAX_JSON_SIZE,
    };
  }
  cachedConfigTs = Date.now();
  return cachedConfig;
}

let writeBuffer = [];
let flushTimer = null;
let isFlushing = false;

function sanitizeHeaders(headers) {
  if (!headers || typeof headers !== "object") return {};
  const sensitiveKeys = ["authorization", "x-api-key", "cookie", "token", "api-key"];
  const sanitized = { ...headers };
  for (const key of Object.keys(sanitized)) {
    if (sensitiveKeys.some((s) => key.toLowerCase().includes(s))) delete sanitized[key];
  }
  return sanitized;
}

export const __test__ = { sanitizeHeaders, truncateField };

function generateDetailId(model) {
  const timestamp = new Date().toISOString();
  const random = Math.random().toString(36).substring(2, 8);
  const modelPart = model ? model.replace(/[^a-zA-Z0-9-]/g, "-") : "unknown";
  return `${timestamp}-${random}-${modelPart}`;
}

// Keep the payload's structure (roles, tool calls, params): trim long strings, and for very long
// lists (agent chats with thousands of turns) keep the first 2 and the latest `arrKeep` items.
function shrinkDeep(value, strLimit, arrKeep) {
  if (typeof value === "string") return value.length > strLimit ? `${value.slice(0, strLimit)}… [+${value.length - strLimit} chars]` : value;
  if (Array.isArray(value)) {
    const items = value.length > arrKeep + 2
      ? [...value.slice(0, 2), { _omitted: value.length - 2 - arrKeep }, ...value.slice(-arrKeep)]
      : value;
    return items.map((v) => shrinkDeep(v, strLimit, arrKeep));
  }
  if (value && typeof value === "object") {
    const out = {};
    for (const k of Object.keys(value)) out[k] = shrinkDeep(value[k], strLimit, arrKeep);
    return out;
  }
  return value;
}

// [stringLimit, arrayKeep] in order of preference: keep all items first, window lists only if needed.
const SHRINK_ATTEMPTS = [[4000, Infinity], [1500, Infinity], [500, Infinity], [160, Infinity], [1500, 60], [500, 30], [500, 16], [160, 8], [160, 4]];

function truncateField(obj, maxSize) {
  const str = JSON.stringify(obj || {});
  if (str.length <= maxSize) return obj || {};
  // An all-or-nothing cap made agent prompts (100KB+ of system text) unreadable; shrink text first.
  if (obj && typeof obj === "object" && !Array.isArray(obj)) {
    for (const [limit, keep] of SHRINK_ATTEMPTS) {
      const shrunk = shrinkDeep(obj, limit, keep);
      if (JSON.stringify(shrunk).length + 100 <= maxSize) {
        return { ...shrunk, _shrunk: { originalSize: str.length, stringLimit: limit, ...(keep === Infinity ? {} : { arrayKeep: keep }) } };
      }
    }
  }
  return { _truncated: true, _originalSize: str.length, _preview: str.substring(0, 200) };
}

async function flushToDatabase() {
  if (isFlushing) return;
  if (writeBuffer.length === 0) return;
  isFlushing = true;
  try {
    // Drain entire buffer (loop in case more pushed during await)
    while (writeBuffer.length > 0) {
      const items = writeBuffer.splice(0, writeBuffer.length);
      const db = await getAdapter();
      const config = await getObservabilityConfig();

      db.transaction(() => {
        for (const item of items) {
          if (!item.id) item.id = generateDetailId(item.model);
          if (!item.timestamp) item.timestamp = new Date().toISOString();
          if (item.request?.headers) item.request.headers = sanitizeHeaders(item.request.headers);

          const record = {
            id: item.id,
            provider: item.provider || null,
            model: item.model || null,
            connectionId: item.connectionId || null,
            timestamp: item.timestamp,
            status: item.status || null,
            latency: item.latency || {},
            tokens: item.tokens || {},
            request: truncateField(item.request, config.maxJsonSize),
            providerRequest: truncateField(item.providerRequest, config.maxJsonSize),
            providerResponse: truncateField(item.providerResponse, config.maxJsonSize),
            response: truncateField(item.response, config.maxJsonSize),
            pxpipe: item.pxpipe || undefined,
          };

          db.run(
            `INSERT INTO requestDetails(id, timestamp, provider, model, connectionId, status, data) VALUES(?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET timestamp = excluded.timestamp, provider = excluded.provider, model = excluded.model, connectionId = excluded.connectionId, status = excluded.status, data = excluded.data`,
            [record.id, record.timestamp, record.provider, record.model, record.connectionId, record.status, stringifyJson(record)]
          );
        }

        const cnt = db.get(`SELECT COUNT(*) as c FROM requestDetails`);
        if (cnt && cnt.c > config.maxRecords) {
          db.run(
            `DELETE FROM requestDetails WHERE id IN (SELECT id FROM requestDetails ORDER BY timestamp ASC LIMIT ?)`,
            [cnt.c - config.maxRecords]
          );
        }
      });
    }
  } catch (e) {
    console.error("[requestDetailsRepo] Batch write failed:", e);
  } finally {
    isFlushing = false;
  }
}

export async function saveRequestDetail(detail) {
  const config = await getObservabilityConfig();
  if (!config.enabled) {return;}

  writeBuffer.push(detail);

  // Trigger immediate flush if batch threshold reached.
  // flushToDatabase() drains entire buffer in a loop, so all pushes during await are persisted.
  if (writeBuffer.length >= config.batchSize) {
    if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
    flushToDatabase().catch((e) => console.error("[requestDetailsRepo] flush err:", e));
  } else if (!flushTimer) {
    flushTimer = setTimeout(() => {
      flushTimer = null;
      flushToDatabase().catch(() => {});
    }, config.flushIntervalMs);
  }
}

export async function getRequestDetails(filter = {}) {
  const db = await getAdapter();
  const conds = [];
  const params = [];

  if (filter.provider) { conds.push("provider = ?"); params.push(filter.provider); }
  if (filter.model) { conds.push("model = ?"); params.push(filter.model); }
  if (filter.connectionId) { conds.push("connectionId = ?"); params.push(filter.connectionId); }
  if (filter.status) { conds.push("status = ?"); params.push(filter.status); }
  if (filter.startDate) { conds.push("timestamp >= ?"); params.push(new Date(filter.startDate).toISOString()); }
  if (filter.endDate) { conds.push("timestamp <= ?"); params.push(new Date(filter.endDate).toISOString()); }

  const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
  const cntRow = db.get(`SELECT COUNT(*) as c FROM requestDetails ${where}`, params);
  const totalItems = cntRow ? cntRow.c : 0;

  const page = filter.page || 1;
  const pageSize = filter.pageSize || 50;
  const totalPages = Math.ceil(totalItems / pageSize);
  const offset = (page - 1) * pageSize;

  const rows = db.all(
    `SELECT data FROM requestDetails ${where} ORDER BY timestamp DESC LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  );
  const details = rows.map((r) => parseJson(r.data, {}));

  return {
    details,
    pagination: { page, pageSize, totalItems, totalPages, hasNext: page < totalPages, hasPrev: page > 1 },
  };
}

export async function getDistinctProviders() {
  const db = await getAdapter();
  const rows = db.all(`SELECT DISTINCT provider FROM requestDetails WHERE provider IS NOT NULL ORDER BY provider ASC`);
  return rows.map((r) => r.provider);
}

export async function getRequestDetailById(id) {
  const db = await getAdapter();
  const row = db.get(`SELECT data FROM requestDetails WHERE id = ?`, [id]);
  return row ? parseJson(row.data, null) : null;
}

const _shutdownHandler = async () => {
  if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
  if (writeBuffer.length > 0) await flushToDatabase();
};

function ensureShutdownHandler() {
  process.off("beforeExit", _shutdownHandler);
  process.off("SIGINT", _shutdownHandler);
  process.off("SIGTERM", _shutdownHandler);
  process.off("exit", _shutdownHandler);

  process.on("beforeExit", _shutdownHandler);
  process.on("SIGINT", _shutdownHandler);
  process.on("SIGTERM", _shutdownHandler);
  process.on("exit", _shutdownHandler);
}

ensureShutdownHandler();

// --- Request-log (list view) helpers ---
export async function getObservabilityConfigPublic() {
  const c = await getObservabilityConfig();
  return { enabled: c.enabled, maxRecords: c.maxRecords, maxJsonKB: Math.round(c.maxJsonSize / 1024), lockedByEnv: process.env.ENABLE_REQUEST_LOGS !== undefined };
}

export function resetObservabilityConfigCache() { cachedConfig = null; cachedConfigTs = 0; }

export async function countRequestDetails() {
  const db = await getAdapter();
  return db.get(`SELECT COUNT(*) as c FROM requestDetails`)?.c || 0;
}

export async function clearRequestDetails() {
  const db = await getAdapter();
  const n = db.get(`SELECT COUNT(*) as c FROM requestDetails`)?.c || 0;
  db.run(`DELETE FROM requestDetails`);
  return n;
}

const likeEsc = (s) => `%${String(s).replace(/[\\%_]/g, "\\$&")}%`;

// List rows via json_extract; never selects payload blobs except request.messages for the page's rows (preview only, dropped in route).
export async function listRequestLogRows({ page = 1, pageSize = 50, provider, model, status, q } = {}) {
  const db = await getAdapter();
  const conds = [];
  const params = [];
  if (provider) { conds.push("provider = ?"); params.push(provider); }
  if (model) { conds.push("model = ?"); params.push(model); }
  if (status) { conds.push("status = ?"); params.push(status); }
  if (q) {
    conds.push("(provider LIKE ? ESCAPE '\\' OR model LIKE ? ESCAPE '\\' OR id LIKE ? ESCAPE '\\')");
    const l = likeEsc(q); params.push(l, l, l);
  }
  const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
  const totalItems = db.get(`SELECT COUNT(*) as c FROM requestDetails ${where}`, params)?.c || 0;
  const rows = db.all(
    `SELECT id, timestamp, provider, model, connectionId, status,
      json_extract(data,'$.latency.total') AS total,
      json_extract(data,'$.latency.ttft') AS ttft,
      json_extract(data,'$.tokens') AS rawTokens,
      json_extract(data,'$.tokens.prompt_tokens') AS promptTokens,
      json_extract(data,'$.tokens.completion_tokens') AS completionTokens,
      json_extract(data,'$.tokens.cached_tokens') AS cachedTokens,
      json_extract(data,'$.tokens.reasoning_tokens') AS reasoningTokens,
      json_extract(data,'$.tokens.cache_creation_input_tokens') AS cacheCreationTokens,
      COALESCE(json_extract(data,'$.response.usage.search_cost_usd'), json_extract(data,'$.response.usage.fetch_cost_usd')) AS mediaCost,
      json_type(data,'$.request') AS reqType,
      json_type(data,'$.request.messages') AS msgType,
      json_extract(data,'$.request._truncated') AS reqTrunc,
      json_extract(data,'$.request.messages') AS messages,
      json_extract(data,'$.request.state') AS reqState,
      json_extract(data,'$.request.prompt') AS reqPrompt,
      json_extract(data,'$.request.input') AS reqInput,
      json_extract(data,'$.request.query') AS reqQuery,
      json_extract(data,'$.request.url') AS reqUrl,
      json_extract(data,'$.request.file') AS reqFile
     FROM requestDetails ${where} ORDER BY timestamp DESC, id DESC LIMIT ? OFFSET ?`,
    [...params, pageSize, (page - 1) * pageSize]
  );
  return { rows, totalItems };
}
