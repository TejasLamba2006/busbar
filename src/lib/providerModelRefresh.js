// Server-side driver for the model refresh: walks the active connections, asks
// each provider for its live model list through the existing per-connection
// route (so every provider-specific fetcher is reused) and stores the new ones.

import { getProviderConnections, upsertCustomModels } from "@/lib/localDb";
import { getProviderAlias, isOpenAICompatibleProvider, isAnthropicCompatibleProvider } from "@/shared/constants/providers";
import { getModelsByProviderId } from "open-sse/config/providerModels.js";
import { PROVIDER_MODEL_DISCOVERY, PROVIDER_MEDIA } from "open-sse/providers/index.js";
import { syncConnectionModels, genericModelsConfig } from "@/lib/providerModelSync";

let running = null;
const runningByConnection = new Map();

async function fetchViaRoute(conn, signal) {
  const { GET } = await import("@/app/api/providers/[id]/models/route.js");
  const res = await GET(new Request("http://localhost/internal", { signal }), { params: Promise.resolve({ id: conn.id }) });
  const body = await res.json();
  if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
  return body;
}

function supportsConnectionRefresh(conn) {
  if (isOpenAICompatibleProvider(conn.provider) || isAnthropicCompatibleProvider(conn.provider)) return true;
  if (PROVIDER_MODEL_DISCOVERY[conn.provider] === "refresh") return true;
  if (PROVIDER_MODEL_DISCOVERY[conn.provider] === "live") return false;
  return Boolean(PROVIDER_MEDIA[conn.provider]?.modelsFetcher?.url || genericModelsConfig(conn.provider));
}

function unsupportedResult(conn) {
  return {
    provider: conn.provider,
    connectionId: conn.id,
    fetched: 0,
    added: 0,
    updated: 0,
    unchanged: 0,
    invalid: 0,
    stale: 0,
    error: `Provider ${conn.provider} does not support model refresh`,
  };
}

function refreshConnection(conn, signal) {
  const current = runningByConnection.get(conn.id);
  if (current) return current;
  if (!supportsConnectionRefresh(conn)) return Promise.resolve(unsupportedResult(conn));

  const compat = isOpenAICompatibleProvider(conn.provider) || isAnthropicCompatibleProvider(conn.provider);
  const alias = compat ? conn.provider : getProviderAlias(conn.provider);
  const builtinModels = getModelsByProviderId(conn.provider);
  const job = syncConnectionModels(conn, {
    fetchModels: (connection) => fetchViaRoute(connection, signal),
    alias,
    builtinIds: new Set(builtinModels.map((model) => model.id)),
    builtinKinds: new Set(builtinModels.map((model) => `${model.kind || model.type || "llm"}:${model.id}`)),
    trackedKinds: new Set(builtinModels.map((model) => model.kind || model.type || "llm")),
    upsertModels: upsertCustomModels,
    signal,
  });
  const tracked = job.finally(() => { runningByConnection.delete(conn.id); });
  runningByConnection.set(conn.id, tracked);
  return tracked;
}

// Refresh one connection, or every active one (one per provider) when none is given.
export async function refreshProviderModels({ connectionId, signal } = {}) {
  if (running && !connectionId) return running;
  const job = (async () => {
    const all = await getProviderConnections({ isActive: true });
    const selected = connectionId
      ? all.filter((c) => c.id === connectionId)
      : [...new Map(all.map((c) => [c.provider, c])).values()];
    const conns = connectionId ? selected : selected.filter(supportsConnectionRefresh);
    const results = [];
    for (const conn of conns) results.push(await refreshConnection(conn, signal));
    return results;
  })();
  if (!connectionId) {
    running = job.finally(() => { running = null; });
    return running;
  }
  return job;
}

// Daily background refresh, same shape as the catalog sync timer. MODEL_REFRESH=off disables it.
const DAY_MS = 24 * 60 * 60 * 1000;
let timer = null;
export function startProviderModelRefresh() {
  if (timer || String(process.env.MODEL_REFRESH || "").toLowerCase() === "off") return;
  const tick = (delay) => {
    timer = setTimeout(async () => {
      try { await refreshProviderModels(); } catch (e) { console.log("[modelRefresh]", e?.message || e); }
      tick(DAY_MS);
    }, delay);
    timer.unref?.();
  };
  tick(2 * 60 * 1000);
}
