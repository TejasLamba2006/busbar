// ponytail: memory-only ring, resets on restart; move to a SQLite table if history across restarts is wanted
const CAP = 1000;

if (!global._proxyLogBufferState) global._proxyLogBufferState = { logs: [], nextId: 1 };
const state = global._proxyLogBufferState;

export function maskProxyUrl(url) {
  try {
    const u = new URL(String(url));
    return `${u.protocol}//${u.host}`;
  } catch {
    return "invalid";
  }
}

export function hostOf(url) {
  try { return new URL(String(url)).hostname; } catch { return ""; }
}

export function recordProxyLog(partial) {
  const p = partial || {};
  const entry = {
    id: state.nextId++,
    ts: Date.now(),
    via: p.via,
    proxy: p.proxy ?? "",
    host: p.host ?? "",
    status: p.status ?? null,
    ok: !!p.ok,
    error: p.error == null ? null : String(p.error).slice(0, 200),
    latencyMs: p.latencyMs ?? 0,
    connectionId: p.connectionId ?? null,
  };
  state.logs.push(entry);
  if (state.logs.length > CAP) state.logs.splice(0, state.logs.length - CAP);
  return entry;
}

export function getProxyLogs({ limit = 500, sinceId = 0 } = {}) {
  const since = Number(sinceId) || 0;
  const n = Math.max(1, Math.min(Number(limit) || 500, CAP));
  const logs = state.logs.filter((l) => l.id > since);
  return { logs: logs.slice(-n), total: state.logs.length };
}

export function clearProxyLogs() {
  state.logs.length = 0;
}
