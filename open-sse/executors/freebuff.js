import { randomUUID } from "node:crypto";
import { DefaultExecutor } from "./default.js";
import { FREEBUFF_AGENTS } from "../providers/registry/freebuff.js";
import { ensureFreebuffDeviceKey, forgetFreebuffDeviceKey, freebuffDeviceHeaders } from "../services/freebuffModels.js";

const API = "https://www.codebuff.com";
const TIMEOUT_MS = 20000;
const SESSION_ERR_RE = /session_|superseded|expired|model_mismatch|no_active|session_required/i;
// per `${token}|${model}`: { instanceId, runId, expiresAt }
const sessions = new Map();

export function resetFreebuffForTests() {
  sessions.clear();
}

const errorResponse = (status, message, code) =>
  new Response(JSON.stringify({ error: { message, type: code || "freebuff_error", code } }), {
    status,
    headers: { "content-type": "application/json" },
  });

async function api(token, path, { method = "GET", headers = {}, body } = {}) {
  const bodyStr = body ? JSON.stringify(body) : undefined;
  const sig = freebuffDeviceHeaders(token, { method, url: `${API}${path}`, body: bodyStr });
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "content-type": "application/json", ...headers, ...sig },
    body: bodyStr,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const json = await res.json().catch(() => ({}));
  return { res, json };
}

// Admit (or reuse) a free-mode session bound to `model`, then open an agent run on its root agent.
// Mirrors freebuff CLI multi-session claims: instance id "cli:<uuid>" + attempt id header.
async function ensureSession(token, model) {
  const key = `${token}|${model}`;
  const cur = sessions.get(key);
  if (cur && cur.expiresAt - Date.now() > 60_000) return { s: cur };

  const attempt = randomUUID();
  const instanceId = `cli:${attempt}`;
  const { res, json } = await api(token, "/api/v1/freebuff/session/admission", {
    method: "POST",
    headers: {
      "x-freebuff-instance-id": instanceId,
      "x-freebuff-model": model,
      "x-freebuff-multi-session": "1",
      "x-freebuff-purchase-continuity": "1",
      "x-freebuff-desktop-attempt-id": attempt,
      "x-freebuff-wallet-spend-limit": "session",
    },
  });
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
  const agentId = FREEBUFF_AGENTS[model];
  const run = await api(token, "/api/v1/agent-runs", {
    method: "POST",
    body: { action: "START", agentId, ancestorRunIds: [] },
  });
  if (!run.res.ok || !run.json?.runId) {
    return { error: errorResponse(run.res.status || 502, run.json?.message || "Freebuff agent run failed to start", "run_start_failed") };
  }
  const s = {
    instanceId: json.instanceId || instanceId,
    runId: run.json.runId,
    expiresAt: json.expiresAt ? Date.parse(json.expiresAt) : Date.now() + 30 * 60_000,
  };
  sessions.set(key, s);
  return { s };
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
    Object.assign(headers, freebuffDeviceHeaders(token, { method: "POST", url: url || `${API}/api/v1/chat/completions`, body: JSON.stringify(body) }));
    return headers;
  }

  async execute(args, retried = false) {
    const token = args.credentials?.accessToken || args.credentials?.apiKey;
    if (!token) return { response: errorResponse(401, "Freebuff token missing. Sign in again."), url: API, headers: {}, transformedBody: args.body };
    await ensureFreebuffDeviceKey(token);
    const { s, error } = await ensureSession(token, args.model);
    if (error) return { response: error, url: API, headers: {}, transformedBody: args.body };

    const body = {
      ...args.body,
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
    if (retried || ![400, 403, 409, 410].includes(status)) return result;
    const text = await result.response.clone().text().catch(() => "");
    if (!SESSION_ERR_RE.test(text)) return result;
    sessions.delete(`${token}|${args.model}`);
    if (/device[_-]?key/i.test(text)) forgetFreebuffDeviceKey(token);
    return this.execute(args, true);
  }
}
