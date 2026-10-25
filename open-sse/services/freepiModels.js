/**
 * FreePi live catalog + client version resolver.
 * GET https://api.freepi.ai/client-version -> { min, latest, models: [{ id, name }] }
 * Cached in memory for 30 minutes.
 */
const CLIENT_VERSION_URL = "https://api.freepi.ai/client-version";
const TTL_MS = 30 * 60 * 1000;
export const FREEPI_FALLBACK_VERSION = "0.6.1";

let cache = null; // { at, version, models }
let inflight = null;

async function load(force, token = null) {
  if (!force && cache && Date.now() - cache.at < TTL_MS) return cache;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const res = await fetch(CLIENT_VERSION_URL, {
        headers: { Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      // report the current CLI version, like free-pi-cli does
      cache = {
        at: Date.now(),
        version: data.latest || data.min || FREEPI_FALLBACK_VERSION,
        models: Array.isArray(data.models) ? data.models : [],
      };
    } catch {
      // keep stale data on failure, but back off for the full TTL window
      cache = { at: Date.now(), version: cache?.version || FREEPI_FALLBACK_VERSION, models: cache?.models || [] };
    } finally {
      inflight = null;
    }
    return cache;
  })();
  return inflight;
}

export function getCachedFreepiVersion() {
  return cache?.version || FREEPI_FALLBACK_VERSION;
}

export async function getFreepiClientVersion(force = false, token = null) {
  return (await load(force, token)).version;
}

export async function resolveFreepiModels(token = null) {
  const { models } = await load(false, token);
  if (!models.length) return null;
  return {
    models: models.map((m) => ({ id: m.id, name: (m.name || m.id).split(" · ")[0] })),
  };
}

export function resetFreepiCacheForTests() {
  cache = null;
  inflight = null;
}
