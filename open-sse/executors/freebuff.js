import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DATA_DIR } from "@/lib/dataDir.js";
import { DefaultExecutor } from "./default.js";
import { cloakTools, uncloakResponse } from "./freebuffTools.js";
import { FREEBUFF_ROOT_AGENT } from "../providers/registry/freebuff.js";
import {
  ensureFreebuffDeviceKey,
  forgetFreebuffDeviceKey,
  freebuffDeviceHeaders,
  invalidateFreebuffCatalog,
  resolveFreebuffRow,
} from "../services/freebuffModels.js";

const API = "https://www.codebuff.com";
const TIMEOUT_MS = 20000;
const SESSION_ERR_RE = /session_|superseded|expired|model_mismatch|no_active|session_required|catalog_stale|stale/i;
// Free mode only accepts requests whose single leading system message is the Buffy prompt.
const BUFFY_PREFIX = "You are Buffy, the coding agent behind Codebuff.";
// A prompt that is only the prefix is answered 503 "model temporarily unavailable" (and the start is refunded);
// the real base3 opening sentence plus date is enough.
const buffyIntro = () =>
  `${BUFFY_PREFIX} You help users with software engineering tasks: fixing bugs, adding functionality, refactoring, and explaining code.

Current date: ${new Date().toISOString().slice(0, 10)}.`;
const UA = "ai-sdk/openai-compatible/0.0.0-test/codebuff ai-sdk/provider-utils/3.0.25 runtime/browser";
// per `${token}|${model}`: { instanceId, runId, expiresAt, handle, fetchId }
const sessions = new Map();

// Persist live sessions so a restart does not pay for a new admission.
let sessionFile = path.join(DATA_DIR, "freebuff-sessions.json");
let loaded = false;
const loadSessions = () => {
  if (loaded) return;
  loaded = true;
  try {
    const now = Date.now();
    for (const [k, v] of Object.entries(JSON.parse(fs.readFileSync(sessionFile, "utf8")))) {
      if (v?.expiresAt > now) sessions.set(k, v);
    }
  } catch { /* no file yet */ }
};
const saveSessions = () => {
  try {
    const now = Date.now();
    const live = Object.fromEntries([...sessions].filter(([, v]) => v.expiresAt > now));
    fs.mkdirSync(path.dirname(sessionFile), { recursive: true });
    fs.writeFileSync(sessionFile, JSON.stringify(live), { mode: 0o600 });
  } catch { /* best effort */ }
};
const putSession = (k, v) => { sessions.set(k, v); saveSessions(); };
const dropSession = (k) => { if (sessions.delete(k)) saveSessions(); };

export function resetFreebuffForTests(file) {
  sessions.clear();
  loaded = false;
  if (file) sessionFile = file;
}

// Per-model price shortfall is not an account failure: answer 400 so the connection is not locked.
export function shortfallMessage(json, model) {
  const sf = json?.freebucksShortfall;
  const d = json?.freebucks?.daily || {};
  const limit = json?.limit ?? d.limit;
  const used = json?.recentCount ?? d.spent;
  const resetAt = json?.resetAt || d.resetAt || "unknown";
  return `Insufficient Freebucks for ${model}: costs ${sf.price} Freebucks, balance is ${sf.balance} (${used}/${limit} daily used, resets at ${resetAt}). Try a 0-cost or 5-cost fb/* model.`;
}

const errorResponse = (status, message, code) =>
  new Response(JSON.stringify({ error: { message, type: code || "freebuff_error", code } }), {
    status,
    headers: { "content-type": "application/json" },
  });

const catalogHeaders = (fetchId) => ({ "x-freebuff-catalog-protocol": "1", ...(fetchId ? { "x-freebuff-catalog-fetch": fetchId } : {}) });

async function api(token, path, { method = "GET", headers = {}, body, fetchId = "" } = {}) {
  const bodyStr = body ? JSON.stringify(body) : undefined;
  const sig = freebuffDeviceHeaders(token, { method, url: `${API}${path}`, body: bodyStr, fetchId });
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "content-type": "application/json", ...catalogHeaders(fetchId), ...headers, ...sig },
    body: bodyStr,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const json = await res.json().catch(() => ({}));
  return { res, json };
}

const release = (token, instanceId, fetchId) =>
  api(token, "/api/v1/freebuff/session", {
    method: "DELETE",
    fetchId,
    headers: { "x-freebuff-instance-id": instanceId, "x-freebuff-multi-session": "1" },
  }).catch(() => {});

// Admit (or reuse) a free-mode session bound to the model's live catalog handle, then open a run on the
// catalog root agent. Mirrors freebuff CLI multi-session claims: instance id "cli:<uuid>" + attempt id header.
async function ensureSession(token, model) {
  loadSessions();
  const key = `${token}|${model}`;
  const cur = sessions.get(key);
  if (cur && cur.expiresAt - Date.now() > 60_000) return { s: cur };

  const row = await resolveFreebuffRow(token, model);
  if (!row) return { error: errorResponse(404, `Freebuff model "${model}" is not available for this account`, "model_not_found") };
  const { handle, fetchId } = row;

  // adopt a session the server still holds for this handle (e.g. after a restart) instead of paying again
  const adopted = await api(token, "/api/v1/freebuff/session", { fetchId }).catch(() => null);
  const a = adopted?.json;
  if (adopted?.res.ok && a?.status === "active" && a.model === handle && a.instanceId) {
    const run = await api(token, "/api/v1/agent-runs", { method: "POST", fetchId, body: { action: "START", agentId: FREEBUFF_ROOT_AGENT, ancestorRunIds: [] } });
    if (run.res.ok && run.json?.runId) {
      const s = { instanceId: a.instanceId, runId: run.json.runId, handle, fetchId, expiresAt: a.expiresAt ? Date.parse(a.expiresAt) : Date.now() + 30 * 60_000 };
      putSession(key, s);
      return { s };
    }
  }

  const admit = () => {
    const attempt = randomUUID();
    const instanceId = `cli:${attempt}`;
    return api(token, "/api/v1/freebuff/session/admission", {
      method: "POST",
      fetchId,
      headers: {
        "x-freebuff-instance-id": instanceId,
        "x-freebuff-model": handle,
        "x-freebuff-multi-session": "1",
        "x-freebuff-purchase-continuity": "1",
        "x-freebuff-desktop-attempt-id": attempt,
        "x-freebuff-wallet-spend-limit": "session",
      },
    }).then((r) => ({ ...r, instanceId }));
  };
  let { res, json, instanceId } = await admit();
  if (res.status === 409 && /purchase_|model_|session_superseded|superseded/.test(`${json?.status} ${json?.error}`)) {
    // another model still holds this account's claim: release it (and our own cached sessions), then retry once
    const held = new Set([json?.currentInstanceId].filter(Boolean));
    for (const [k, v] of sessions) if (k.startsWith(`${token}|`)) { held.add(v.instanceId); dropSession(k); }
    await Promise.all([...held].map((id) => release(token, id, fetchId)));
    ({ res, json, instanceId } = await admit());
  }
  if (json?.status === "rate_limited" && json.freebucksShortfall && Number(json.freebucksShortfall.balance) < Number(json.freebucksShortfall.price)) {
    return { error: errorResponse(400, shortfallMessage(json, model), "freebucks_shortfall") };
  }
  if (!res.ok || json?.status !== "active") {
    const status = res.ok ? 403 : res.status;
    return {
      error: errorResponse(
        status,
        json?.message || json?.error || `Freebuff session not admitted (${json?.status || res.status})`,
        json?.status || json?.error,
      ),
    };
  }
  const run = await api(token, "/api/v1/agent-runs", {
    method: "POST",
    fetchId,
    body: { action: "START", agentId: FREEBUFF_ROOT_AGENT, ancestorRunIds: [] },
  });
  if (!run.res.ok || !run.json?.runId) {
    return { error: errorResponse(run.res.status || 502, run.json?.message || "Freebuff agent run failed to start", "run_start_failed") };
  }
  const s = {
    instanceId: json.instanceId || instanceId,
    runId: run.json.runId,
    handle,
    fetchId,
    expiresAt: json.expiresAt ? Date.parse(json.expiresAt) : Date.now() + 30 * 60_000,
  };
  putSession(key, s);
  return { s };
}

const textOf = (c) => (typeof c === "string" ? c : Array.isArray(c) ? c.map((p) => p?.text || "").join("") : "");

// Collapse leading system/developer messages into the single Buffy-prefixed system message the server requires.
export function withBuffySystem(messages = []) {
  let i = 0;
  const sys = [];
  while (i < messages.length && (messages[i].role === "system" || messages[i].role === "developer")) sys.push(textOf(messages[i++].content));
  return [{ role: "system", content: [buffyIntro(), ...sys.filter(Boolean)].join("\n\n") }, ...messages.slice(i)];
}

export class FreebuffExecutor extends DefaultExecutor {
  constructor() {
    super("freebuff");
  }

  buildHeaders(credentials, stream = true, url, model, body = null) {
    const headers = super.buildHeaders(credentials, stream, url, model, body);
    const token = credentials?.accessToken || credentials?.apiKey;
    headers.Authorization = `Bearer ${token}`;
    // signature covers the exact JSON bytes base.js sends (JSON.stringify(transformedBody))
    const fetchId = sessions.get(`${token}|${model}`)?.fetchId || "";
    Object.assign(headers, catalogHeaders(fetchId), { "x-freebuff-sse-gzip-recovery": "1", "user-agent": UA });
    Object.assign(headers, freebuffDeviceHeaders(token, { method: "POST", url: url || `${API}/api/v1/chat/completions`, body: JSON.stringify(body), fetchId }));
    return headers;
  }

  async execute(args, retried = false) {
    const token = args.credentials?.accessToken || args.credentials?.apiKey;
    if (!token) return { response: errorResponse(401, "Freebuff token missing. Sign in again."), url: API, headers: {}, transformedBody: args.body };
    await ensureFreebuffDeviceKey(token);
    const { s, error } = await ensureSession(token, args.model);
    if (error) return { response: error, url: API, headers: {}, transformedBody: args.body };

    const cloak = cloakTools(args.body);
    const body = {
      ...args.body,
      ...cloak.fields,
      model: s.handle,
      messages: withBuffySystem(cloak.fields.messages),
      codebuff_metadata: {
        run_id: s.runId,
        client_id: randomUUID(),
        cost_mode: "free",
        freebuff_instance_id: s.instanceId,
        freebuff_multi_session: "1",
        surface: "cli",
      },
    };
    const result = await super.execute({ ...args, body });
    const status = result?.response?.status;
    if (status === 200 && cloak.bySlot) result.response = await uncloakResponse(result.response, cloak);
    // a refunded start (503 "model temporarily unavailable") closes the session: never reuse the cached claim
    if (status >= 500 || status === 429) dropSession(`${token}|${args.model}`);
    if (retried || ![400, 403, 409, 410].includes(status)) return result;
    const text = await result.response.clone().text().catch(() => "");
    if (!SESSION_ERR_RE.test(text)) return result;
    dropSession(`${token}|${args.model}`);
    await release(token, s.instanceId, s.fetchId);
    invalidateFreebuffCatalog();
    if (/device[_-]?key/i.test(text)) forgetFreebuffDeviceKey(token);
    return this.execute(args, true);
  }
}
