import { saveRequestDetail, saveRequestUsage } from "@/lib/usageDb.js";

const LARGE_KEY_RE = /b64|base64|audio|image|mask|video|embedding|data/i;

function summarizeValue(value, key = "", depth = 0) {
  if (value == null) return value;
  if (typeof value === "string") {
    if (value.length > 512 && (LARGE_KEY_RE.test(key) || value.startsWith("data:") || value.length > 4096)) {
      return `[${key || "string"}: ${value.length} chars]`;
    }
    return value;
  }
  if (Array.isArray(value)) {
    if (value.length > 0 && typeof value[0] === "number") {
      return `[float[${value.length}]]`;
    }
    if (depth > 3) return `[array(${value.length})]`;
    return value.slice(0, 20).map((item) => summarizeValue(item, key, depth + 1));
  }
  if (typeof value === "object") {
    if (depth > 4) return "[object]";
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = summarizeValue(v, k, depth + 1);
    }
    return out;
  }
  return value;
}

export async function summarizeMediaResponse(response) {
  if (!response) return {};
  const ctype = (response.headers?.get?.("content-type") || "").toLowerCase();
  if (ctype.includes("application/json")) {
    try {
      const json = await response.clone().json();
      return summarizeValue(json);
    } catch {
      return { contentType: ctype };
    }
  }
  if (ctype.includes("text/event-stream")) {
    return { stream: true, contentType: ctype };
  }
  const len = response.headers?.get?.("content-length");
  return { binary: true, contentType: ctype || "application/octet-stream", ...(len ? { bytes: Number(len) || len } : {}) };
}

export function recordMediaRequestDetail({
  provider,
  model,
  connectionId,
  status = "success",
  startedAt,
  tokens,
  request,
  providerRequest = null,
  providerResponse = null,
  response = {},
}) {
  const total = startedAt ? Math.max(0, Date.now() - startedAt) : 0;
  saveRequestDetail({
    provider: provider || "unknown",
    model: model || provider || "unknown",
    connectionId: connectionId || undefined,
    timestamp: new Date().toISOString(),
    status,
    latency: { ttft: 0, total },
    tokens: tokens || { prompt_tokens: 0, completion_tokens: 0 },
    request: summarizeValue(request || {}),
    providerRequest: providerRequest ? summarizeValue(providerRequest) : null,
    providerResponse: providerResponse ? summarizeValue(providerResponse) : null,
    response: summarizeValue(response || {}),
  }).catch(() => {});
}

export function recordMediaUsage({
  provider,
  model,
  connectionId,
  apiKey,
  endpoint,
  startedAt,
  tokens,
  status = "success",
}) {
  const total = startedAt ? Math.max(0, Date.now() - startedAt) : 0;
  const promptTokens = Number(tokens?.prompt_tokens ?? tokens?.input_tokens) || 0;
  const completionTokens = Number(tokens?.completion_tokens ?? tokens?.output_tokens) || 0;
  const totalTokens = Number(tokens?.total_tokens) || (promptTokens + completionTokens);
  saveRequestUsage({
    provider: provider || "unknown",
    model: model || provider || "unknown",
    connectionId: connectionId || undefined,
    apiKey: apiKey || undefined,
    endpoint: endpoint || null,
    tokens: {
      ...(tokens || {}),
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: totalTokens,
    },
    latency: { ttft: 0, total },
    status,
  }).catch(() => {});
}
