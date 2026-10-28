import { createHash, randomUUID } from "node:crypto";
import { BaseExecutor } from "./base.js";
import { SSE_DONE, SSE_HEADERS_NO_BUFFER } from "../utils/sseConstants.js";
import { sseChunk } from "../utils/sse.js";
import { acquireBrowserContext, openPage, releaseBrowserContext } from "../services/browserPool.js";
import { resolveSystemChromeExecutable, isMissingBrowserExecutable } from "./browserExecutableCheck.js";
import {
  serializeDeepSeekToolPrompt,
  parseDeepSeekToolCalls,
  buildToolConversationPrompt,
  hasMalformedDeepSeekToolIntent,
} from "../translator/deepseekWebTools.js";

export const QWEN_WEB_BASE = "https://chat.qwen.ai";
const QWEN_COMPLETION_URL = `${QWEN_WEB_BASE}/api/v2/chat/completions`;
const QWEN_VERSION = "0.3.26";
const DEFAULT_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36";

export function extractQwenCredential(credentials) {
  const raw = credentials?.apiKey || credentials?.accessToken || "";
  if (typeof raw !== "string" || !raw.trim()) return { token: "", cookieHeader: "", email: "", password: "" };
  const trimmed = raw.trim();

  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (typeof parsed?.token === "string") {
        return { token: parsed.token.trim(), cookieHeader: typeof parsed.cookie === "string" ? parsed.cookie : "", email: "", password: "" };
      }
      if (typeof parsed?.value === "string") {
        return { token: parsed.value.trim(), cookieHeader: "", email: "", password: "" };
      }
      if (typeof parsed?.email === "string" && typeof parsed?.password === "string") {
        return { token: "", cookieHeader: "", email: parsed.email.trim(), password: parsed.password };
      }
    } catch {
      // ignore
    }
  }

  // Raw JWT (3 dot-separated base64 segments)
  if (/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(trimmed)) {
    return { token: trimmed, cookieHeader: `token=${trimmed}`, email: "", password: "" };
  }

  // email:password or email|password shorthand
  if (!trimmed.includes(";") && /^[^\s@:|]+@[^\s@:|]+\.[^\s@:|]+[:|].+$/.test(trimmed)) {
    const sepIdx = trimmed.search(/[:|]/);
    return {
      token: "",
      cookieHeader: "",
      email: trimmed.slice(0, sepIdx).trim(),
      password: trimmed.slice(sepIdx + 1),
    };
  }

  // Cookie header string (e.g. "token=eyJ...; acw_tc=...")
  let token = "";
  for (const part of trimmed.split(";")) {
    const eq = part.indexOf("=");
    if (eq <= 0) continue;
    const k = part.slice(0, eq).trim();
    const v = part.slice(eq + 1).trim();
    if ((k === "token" || k === "qwen_token") && v && v.split(".").length === 3) {
      token = v;
      break;
    }
  }
  return { token, cookieHeader: trimmed, email: "", password: "" };
}

function resolveQwenModelOptions(model, bodyObj) {
  const raw = String(model || "qwen3.7-plus").trim();
  const lower = raw.toLowerCase();

  let baseModel = raw
    .replace(/-think-search$/i, "")
    .replace(/-thinking$/i, "")
    .replace(/-think$/i, "")
    .replace(/-search$/i, "");

  if (!baseModel || baseModel === "qwen-web") baseModel = "qwen3.7-plus";

  const thinkingEnabled =
    lower.includes("-think") ||
    bodyObj?.thinking_enabled === true ||
    bodyObj?.thinking === true ||
    bodyObj?.thinking?.type === "enabled" ||
    Boolean(bodyObj?.reasoning_effort && bodyObj.reasoning_effort !== "none");

  const searchEnabled =
    lower.includes("-search") ||
    bodyObj?.search_enabled === true ||
    bodyObj?.search === true ||
    bodyObj?.web_search === true;

  return {
    upstreamModel: baseModel,
    thinkingEnabled,
    searchEnabled,
    chatType: searchEnabled ? "search" : "t2t",
  };
}

function flattenMessagesToPrompt(messages) {
  if (!Array.isArray(messages) || messages.length === 0) return "";
  if (messages.length === 1) {
    return extractTextContent(messages[0]?.content);
  }
  const parts = [];
  for (const m of messages) {
    const role = String(m?.role || "user").toLowerCase();
    const text = extractTextContent(m?.content);
    if (!text) continue;
    if (role === "system" || role === "developer") {
      parts.push(`[System]\n${text}`);
    } else if (role === "assistant") {
      parts.push(`[Assistant]\n${text}`);
    } else if (role === "tool") {
      parts.push(`[Tool Result]\n${text}`);
    } else {
      parts.push(`[User]\n${text}`);
    }
  }
  return parts.join("\n\n");
}

function extractTextContent(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part === "string" ? part : part?.text || ""))
      .filter(Boolean)
      .join("\n");
  }
  return "";
}

function errorResponse(status, message, code = `HTTP_${status}`) {
  return new Response(
    JSON.stringify({
      error: {
        message,
        type: "upstream_error",
        code,
      },
    }),
    { status, headers: { "Content-Type": "application/json" } }
  );
}

const cachedEmailTokens = new Map(); // email -> { token, expiresAt }
const QWEN_TOKEN_MARGIN_MS = 60_000;

function jwtExpiryMs(token) {
  try {
    const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const exp = JSON.parse(Buffer.from(payload, "base64").toString("utf8")).exp;
    return exp ? Number(exp) * 1000 : 0;
  } catch {
    return 0;
  }
}

function seedLocalStorage(token, digest) {
  const expMs = jwtExpiryMs(token) || Date.now() + 3600 * 1000;
  return {
    token,
    at_expire_time: String(expMs),
    qwen_access_token_state: JSON.stringify({
      version: 1,
      stateId: `busbar-${digest}`,
      token,
      expiresAt: expMs,
      updatedAt: Date.now(),
      sourceId: "busbar",
    }),
  };
}

// Qwen reloads the page once after the Aliyun WAF cookie is set, so evaluate() can hit a
// destroyed context. Poll until Baxia is initialised on the settled page.
async function waitForBaxia(page, timeoutMs = 10000) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    try {
      const ready = await page.evaluate(() =>
        Boolean(window.baxiaInitialized && window.__baxia__?.getFYModule?.getUidToken?.())
      );
      if (ready) return true;
    } catch {
      // navigation in flight
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

async function signInWithEmail(page, email, password) {
  const passwordHash = createHash("sha256").update(password).digest("hex");
  let lastError = "Qwen sign-in failed";
  for (let attempt = 0; attempt < 3; attempt++) {
    await waitForBaxia(page);
    let res;
    try {
      res = await page.evaluate(
        async ({ email, passwordHash, version }) =>
          new Promise((resolve) => {
            const timer = setTimeout(() => resolve({ status: -1, text: "" }), 12000);
            const xhr = new XMLHttpRequest();
            xhr.open("POST", "https://auth.qwen.ai/api/v2/auths/signin", true);
            xhr.withCredentials = true;
            xhr.setRequestHeader("Accept", "application/json");
            xhr.setRequestHeader("Content-Type", "application/json");
            xhr.setRequestHeader("source", "web");
            xhr.setRequestHeader("Version", version);
            xhr.setRequestHeader("X-Request-Id", crypto.randomUUID());
            xhr.setRequestHeader("Timezone", new Date().toString().replace(/\s*\(.+\)$/, ""));
            xhr.setRequestHeader("x-request-origin", "https://chat.qwen.ai");
            xhr.onload = () => { clearTimeout(timer); resolve({ status: xhr.status, text: xhr.responseText }); };
            xhr.onerror = () => { clearTimeout(timer); resolve({ status: 0, text: "" }); };
            xhr.send(JSON.stringify({ email, password: passwordHash }));
          }),
        { email, passwordHash, version: QWEN_VERSION }
      );
    } catch (err) {
      lastError = err?.message || lastError;
      await new Promise((r) => setTimeout(r, 1500));
      continue;
    }
    let json = null;
    try { json = JSON.parse(res.text); } catch { /* WAF challenge page or timeout: retry */ }
    if (!json) {
      lastError = "Qwen sign-in blocked by WAF challenge";
      await new Promise((r) => setTimeout(r, 1500));
      continue;
    }
    const token = json?.data?.access_token || json?.data?.token || "";
    if (json.success && token) {
      return { token, expiresAt: jwtExpiryMs(token) || Date.now() + 10 * 60 * 1000 };
    }
    // Definitive rejection (bad password etc.): do not retry.
    throw new Error(json?.data?.details || json?.data?.message || "Qwen sign-in failed");
  }
  throw new Error(lastError);
}

// forceFresh drops the pooled browser context (cookies + quota fingerprint) and cached token,
// which is how Qwen's per-session limits reset.
async function getOrOpenQwenPage(credentials, { forceFresh = false } = {}) {
  let { token, cookieHeader, email, password } = extractQwenCredential(credentials);
  const useEmail = !token && email && password;

  const digest = createHash("sha256")
    .update(String(credentials?.connectionId || "qwen"))
    .update("\0")
    .update(useEmail ? `email:${email}` : token || cookieHeader)
    .digest("hex")
    .slice(0, 16);

  if (forceFresh) {
    if (useEmail) cachedEmailTokens.delete(email);
    await releaseBrowserContext(`qwen-web:${digest}`).catch(() => {});
  }

  if (useEmail) {
    const cached = cachedEmailTokens.get(email);
    if (cached && cached.expiresAt > Date.now() + QWEN_TOKEN_MARGIN_MS) token = cached.token;
  }

  const pooled = await acquireBrowserContext(`qwen-web:${digest}`, {
    cookieDomain: ".qwen.ai",
    ...(cookieHeader ? { cookieString: cookieHeader } : {}),
    localStorage: token ? seedLocalStorage(token, digest) : {},
    localStorageOrigin: QWEN_WEB_BASE,
    warmupUrl: `${QWEN_WEB_BASE}/`,
    userAgent: DEFAULT_UA,
    headless: true,
    executablePath: resolveSystemChromeExecutable(),
  });

  let page = pooled.warmupPage && !pooled.warmupPage.isClosed() ? pooled.warmupPage : await openPage(pooled);
  if (pooled.warmupPage !== page) {
    pooled.warmupPage = page;
    await page.goto(`${QWEN_WEB_BASE}/`, { waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => {});
  }

  if (useEmail && !token) {
    // Access tokens live ~15 min; sign in again whenever the cached one is gone.
    const signed = await signInWithEmail(page, email, password);
    token = signed.token;
    cachedEmailTokens.set(email, signed);
  } else if (token) {
    // Qwen's boot-time refresh wipes localStorage.token when it has no auth cookies; restore it.
    await page
      .evaluate((seed) => {
        for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v);
      }, seedLocalStorage(token, digest))
      .catch(() => {});
  }

  return { pooled, page, digest, token };
}

export class QwenWebExecutor extends BaseExecutor {
  constructor() {
    super("qwen-web", { id: "qwen-web", baseUrl: QWEN_WEB_BASE });
  }

  async testConnection(credentials) {
    const { token, email, password } = extractQwenCredential(credentials);
    return Boolean(token || (email && password));
  }

  async execute({ model, body, stream, credentials, signal, log }) {
    const bodyObj = body || {};
    const { token: initialToken, cookieHeader, email, password } = extractQwenCredential(credentials);
    if (!initialToken && !cookieHeader && !(email && password)) {
      return {
        response: errorResponse(
          401,
          "Missing Qwen Web token — paste your JWT token from chat.qwen.ai localStorage (key 'token', starts with eyJ...), or enter email:password"
        ),
        url: QWEN_COMPLETION_URL,
        headers: {},
        transformedBody: body,
      };
    }
    if (!initialToken && !(email && password) && cookieHeader) {
      return {
        response: errorResponse(
          401,
          "Qwen Web requires your JWT token from chat.qwen.ai localStorage (DevTools → Application → Local Storage → https://chat.qwen.ai → key 'token', starts with eyJ...), or email:password. Browser cookies alone do not include the auth token."
        ),
        url: QWEN_COMPLETION_URL,
        headers: {},
        transformedBody: body,
      };
    }

    const requestedTools = bodyObj.tools;
    const hasTools = Array.isArray(requestedTools) && requestedTools.length > 0;
    const toolSystemPrompt = hasTools ? serializeDeepSeekToolPrompt(requestedTools) : "";
    const messages = Array.isArray(bodyObj.messages) ? bodyObj.messages : [];
    const promptMessages = toolSystemPrompt
      ? [{ role: "system", content: toolSystemPrompt }, ...messages]
      : messages;

    let prompt = hasTools
      ? buildToolConversationPrompt(messages, toolSystemPrompt)
      : flattenMessagesToPrompt(promptMessages);

    if (!prompt.trim()) {
      return {
        response: errorResponse(400, "Qwen Web requires non-empty message content"),
        url: QWEN_COMPLETION_URL,
        headers: {},
        transformedBody: body,
      };
    }

    const { upstreamModel, thinkingEnabled, searchEnabled, chatType } = resolveQwenModelOptions(model, bodyObj);
    const clientModel = model || upstreamModel;
    const cid = `chatcmpl-qwen-${randomUUID().slice(0, 12)}`;
    const created = Math.floor(Date.now() / 1000);

    let pageInfo;
    try {
      pageInfo = await getOrOpenQwenPage(credentials);
    } catch (error) {
      const msg = error?.message || String(error);
      if (isMissingBrowserExecutable(msg)) {
        return {
          response: errorResponse(
            503,
            "Qwen Web requires a Chrome/Chromium browser on the host to run Qwen's anti-bot token signer."
          ),
          url: QWEN_COMPLETION_URL,
          headers: {},
          transformedBody: body,
        };
      }
      return {
        response: errorResponse(502, `Qwen Web browser launch failed: ${msg}`),
        url: QWEN_COMPLETION_URL,
        headers: {},
        transformedBody: body,
      };
    }

    let { page, digest, token: resolvedToken } = pageInfo;
    let token = resolvedToken || initialToken;
    const canRefresh = Boolean(!initialToken && email && password);
    log?.info?.(
      "QWEN-WEB",
      `model=${upstreamModel}, thinking=${thinkingEnabled}, search=${searchEnabled}, stream=${stream !== false}`
    );

    const runInPageTurn = async (onDelta) => {
      const callbackName = `__qwenStreamCb_${randomUUID().replace(/-/g, "")}`;
      if (onDelta) {
        await page.exposeFunction(callbackName, (chunk) => {
          onDelta(chunk);
        });
      }

      try {
        return await page.evaluate(
          async ({ token, upstreamModel, prompt, thinkingEnabled, searchEnabled, chatType, version, callbackName }) => {
            const headers = {
              Accept: "application/json",
              "Content-Type": "application/json",
              source: "web",
              Version: version,
              "X-Request-Id": crypto.randomUUID(),
              Timezone: new Date().toString().replace(/\s*\(.+\)$/, ""),
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            };

            // Wait up to 3s for Baxia anti-bot module if not ready yet
            for (let i = 0; i < 15; i++) {
              if (window.__baxia__?.getFYModule?.getUidToken?.()) break;
              await new Promise((r) => setTimeout(r, 200));
            }

            const fetchWithWafTimeout = (url, init, timeoutMs = 15000) =>
              Promise.race([
                fetch(url, init),
                new Promise((_, reject) =>
                  setTimeout(() => reject(new Error("__QWEN_WAF_TIMEOUT__")), timeoutMs)
                ),
              ]);

            let createRes;
            try {
              createRes = await fetchWithWafTimeout(
                "/api/v2/chats/new",
                {
                  method: "POST",
                  headers,
                  credentials: "include",
                  body: JSON.stringify({
                    title: "New Chat",
                    models: [upstreamModel],
                    chat_mode: "normal",
                    chat_type: chatType,
                    timestamp: Date.now(),
                  }),
                },
                15000
              );
            } catch (err) {
              return {
                ok: false,
                status: 403,
                error:
                  err?.message === "__QWEN_WAF_TIMEOUT__"
                    ? "Qwen Web triggered Aliyun WAF verification or token was rejected — verify your JWT token from chat.qwen.ai localStorage (key 'token')"
                    : err?.message || "Qwen createChat failed",
              };
            }

            const createText = await createRes.text();
            let createJson = null;
            try {
              createJson = JSON.parse(createText);
            } catch {
              return {
                ok: false,
                status: createRes.status === 200 ? 403 : createRes.status || 502,
                error: createText.includes("aliyun_waf")
                  ? "Qwen Web triggered Aliyun WAF verification or token was rejected — verify your JWT token from chat.qwen.ai localStorage (key 'token')"
                  : `Qwen createChat returned non-JSON (HTTP ${createRes.status})`,
              };
            }

            if (!createRes.ok || createJson?.success === false || !createJson?.data?.id) {
              const code = createJson?.data?.code || "";
              const details = createJson?.data?.details || createJson?.data?.message || createJson?.detail || "Failed to create Qwen chat";
              const status = /unauthorized|invalid token/i.test(`${code} ${details}`) ? 401 : (createRes.status >= 400 ? createRes.status : 400);
              return { ok: false, status, error: details, code };
            }

            const chatId = createJson.data.id;
            const userFid = crypto.randomUUID();
            const childId = crypto.randomUUID();
            const nowSec = Math.floor(Date.now() / 1000);

            const completionPayload = {
              stream: true,
              version: "2.1",
              incremental_output: true,
              chat_id: chatId,
              chat_mode: "normal",
              model: upstreamModel,
              parent_id: null,
              messages: [
                {
                  fid: userFid,
                  parentId: null,
                  childrenIds: [childId],
                  role: "user",
                  content: prompt,
                  user_action: "chat",
                  files: [],
                  timestamp: nowSec,
                  models: [upstreamModel],
                  chat_type: chatType,
                  feature_config: {
                    thinking_enabled: thinkingEnabled,
                    output_schema: "phase",
                    research_mode: "normal",
                    auto_thinking: thinkingEnabled,
                    thinking_format: "summary",
                    auto_search: searchEnabled,
                  },
                  extra: {
                    meta: {
                      subChatType: chatType,
                    },
                  },
                  sub_chat_type: chatType,
                  parent_id: null,
                },
              ],
              timestamp: nowSec,
            };

            let compRes;
            try {
              compRes = await fetchWithWafTimeout(
                `/api/v2/chat/completions?chat_id=${encodeURIComponent(chatId)}`,
                {
                  method: "POST",
                  headers: {
                    ...headers,
                    "X-Request-Id": crypto.randomUUID(),
                    "X-Accel-Buffering": "no",
                  },
                  credentials: "include",
                  body: JSON.stringify(completionPayload),
                },
                30000
              );
            } catch (err) {
              return {
                ok: false,
                status: 403,
                error:
                  err?.message === "__QWEN_WAF_TIMEOUT__"
                    ? "Qwen Web completion blocked by Aliyun WAF challenge"
                    : err?.message || "Qwen completion request failed",
              };
            }

            const ctype = compRes.headers.get("content-type") || "";
            if (!compRes.ok || !ctype.includes("text/event-stream")) {
              const errText = await compRes.text();
              let errJson = null;
              try { errJson = JSON.parse(errText); } catch {}
              const errMsg = errJson?.data?.details || errJson?.data?.message || errJson?.error?.message || errText.slice(0, 200);
              return {
                ok: false,
                status: compRes.status >= 400 ? compRes.status : 502,
                error: errMsg || `Qwen completion failed (HTTP ${compRes.status})`,
              };
            }

            const reader = compRes.body.getReader();
            const decoder = new TextDecoder();
            let buf = "";
            let fullContent = "";
            let fullReasoning = "";
            let usage = null;

            const emit = callbackName && typeof window[callbackName] === "function" ? window[callbackName] : null;

            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              buf += decoder.decode(value, { stream: true });
              const lines = buf.split(/\r?\n/);
              buf = lines.pop() || "";
              for (const line of lines) {
                if (!line.startsWith("data:")) continue;
                const dataStr = line.slice(5).trim();
                if (!dataStr || dataStr === "[DONE]") continue;
                let parsed = null;
                try { parsed = JSON.parse(dataStr); } catch { continue; }
                if (parsed?.error) {
                  const errDetail = typeof parsed.error === "string" ? parsed.error : (parsed.error.details || parsed.error.message || "Qwen stream error");
                  return { ok: false, status: 502, error: errDetail };
                }
                if (parsed?.usage) usage = parsed.usage;
                const delta = parsed?.choices?.[0]?.delta;
                if (!delta) continue;
                const phase = delta.phase;
                const text = typeof delta.content === "string" ? delta.content : "";
                if (!text) continue;
                if (phase === "think" || phase === "thinking_summary" || phase === "DeepThinking") {
                  fullReasoning += text;
                  if (emit) await emit({ reasoning: text });
                } else if (phase === "answer" || !phase) {
                  fullContent += text;
                  if (emit) await emit({ content: text });
                }
              }
            }

            return {
              ok: true,
              content: fullContent,
              reasoning: fullReasoning,
              usage,
            };
          },
          {
            token,
            upstreamModel,
            prompt,
            thinkingEnabled,
            searchEnabled,
            chatType,
            version: QWEN_VERSION,
            callbackName: onDelta ? callbackName : null,
          }
        );
      } catch (err) {
        await releaseBrowserContext(`qwen-web:${digest}`).catch(() => {});
        throw err;
      }
    };

    // Expired token / WAF block / exhausted quota: drop the browser context (resets the
    // per-session limits), sign in again and retry once. Only safe before output was emitted.
    const isRetryable = (r) =>
      !r?.ok && (r?.status === 401 || r?.status === 403 || r?.status === 429 ||
        /unauthori|expired|token|quota|limit|too many|waf|verif/i.test(String(r?.error || "")));
    const runWithRefresh = async (onDelta) => {
      let emitted = false;
      const tracked = onDelta ? (d) => { emitted = true; onDelta(d); } : null;
      let result = await runInPageTurn(tracked);
      if (canRefresh && isRetryable(result) && !emitted) {
        log?.info?.("QWEN-WEB", `refreshing session after: ${result?.error}`);
        const fresh = await getOrOpenQwenPage(credentials, { forceFresh: true });
        ({ page, digest } = fresh);
        token = fresh.token;
        result = await runInPageTurn(tracked);
      }
      return result;
    };

    try {
      // Tool calls or non-streaming: buffer full response so tool XML can be parsed
      if (!stream || hasTools) {
        let result = await runWithRefresh(null);
        if (!result?.ok) {
          return {
            response: errorResponse(result?.status || 502, result?.error || "Qwen Web request failed", result?.code),
            url: QWEN_COMPLETION_URL,
            headers: {},
            transformedBody: body,
          };
        }

        const callIdSeed = `call-${Date.now()}`;
        let parsedTools = hasTools ? parseDeepSeekToolCalls(result.content || "", callIdSeed, requestedTools) : null;
        // A reply that clearly tried to call a tool but failed the nonce/schema/shape checks is
        // retried once with an explicit reminder, instead of leaking raw <tool> text to the client.
        if (hasTools && !parsedTools.toolCalls?.length && hasMalformedDeepSeekToolIntent(parsedTools.content, requestedTools)) {
          log?.warn?.("QWEN-WEB", "Malformed tool envelope, retrying once");
          prompt = [
            prompt,
            "Your previous response used an invalid tool envelope and was rejected.",
            "Retry the requested next action from scratch. Follow the tool contract exactly, including the _nonce binding and argument schema. Emit one <tool>{...}</tool> block per call with complete, balanced JSON.",
          ].join("\n\n");
          const retry = await runWithRefresh(null);
          if (retry?.ok) {
            result = retry;
            parsedTools = parseDeepSeekToolCalls(result.content || "", callIdSeed, requestedTools);
          }
        }
        const hasToolCalls = Array.isArray(parsedTools?.toolCalls) && parsedTools.toolCalls.length > 0;
        const message = {
          role: "assistant",
          content: hasToolCalls ? (parsedTools.content?.trim() || null) : (hasTools ? parsedTools.content : (result.content || "")),
          ...(result.reasoning ? { reasoning_content: result.reasoning } : {}),
          ...(hasToolCalls ? { tool_calls: parsedTools.toolCalls } : {}),
        };
        const finishReason = hasToolCalls ? "tool_calls" : "stop";
        const usage = result.usage || {
          prompt_tokens: Math.ceil(prompt.length / 4),
          completion_tokens: Math.ceil((result.content || "").length / 4),
          total_tokens: Math.ceil((prompt.length + (result.content || "").length) / 4),
        };

        if (!stream) {
          return {
            response: Response.json({
              id: cid,
              object: "chat.completion",
              created,
              model: clientModel,
              choices: [{ index: 0, message, finish_reason: finishReason }],
              usage,
            }),
            url: QWEN_COMPLETION_URL,
            headers: {},
            transformedBody: body,
          };
        }

        // Streamed tool response
        const encoder = new TextEncoder();
        const sseBody = new ReadableStream({
          start(controller) {
            controller.enqueue(encoder.encode(sseChunk({
              id: cid, object: "chat.completion.chunk", created, model: clientModel,
              choices: [{ index: 0, delta: { role: "assistant" }, finish_reason: null }],
            })));
            if (result.reasoning) {
              controller.enqueue(encoder.encode(sseChunk({
                id: cid, object: "chat.completion.chunk", created, model: clientModel,
                choices: [{ index: 0, delta: { reasoning_content: result.reasoning }, finish_reason: null }],
              })));
            }
            if (message.content) {
              controller.enqueue(encoder.encode(sseChunk({
                id: cid, object: "chat.completion.chunk", created, model: clientModel,
                choices: [{ index: 0, delta: { content: message.content }, finish_reason: null }],
              })));
            }
            if (hasToolCalls) {
              controller.enqueue(encoder.encode(sseChunk({
                id: cid, object: "chat.completion.chunk", created, model: clientModel,
                choices: [{ index: 0, delta: { tool_calls: parsedTools.toolCalls.map((tc, i) => ({ index: i, id: tc.id, type: "function", function: { name: tc.function.name, arguments: tc.function.arguments } })) }, finish_reason: null }],
              })));
            }
            controller.enqueue(encoder.encode(sseChunk({
              id: cid, object: "chat.completion.chunk", created, model: clientModel,
              choices: [{ index: 0, delta: {}, finish_reason: finishReason }],
              usage,
            })));
            controller.enqueue(encoder.encode(SSE_DONE));
            controller.close();
          },
        });
        return {
          response: new Response(sseBody, { status: 200, headers: { ...SSE_HEADERS_NO_BUFFER } }),
          url: QWEN_COMPLETION_URL,
          headers: {},
          transformedBody: body,
        };
      }

      // Live streaming response
      const encoder = new TextEncoder();
      const sseStream = new ReadableStream({
        async start(controller) {
          controller.enqueue(encoder.encode(sseChunk({
            id: cid, object: "chat.completion.chunk", created, model: clientModel,
            choices: [{ index: 0, delta: { role: "assistant" }, finish_reason: null }],
          })));
          try {
            const result = await runWithRefresh((delta) => {
              if (delta?.reasoning) {
                controller.enqueue(encoder.encode(sseChunk({
                  id: cid, object: "chat.completion.chunk", created, model: clientModel,
                  choices: [{ index: 0, delta: { reasoning_content: delta.reasoning }, finish_reason: null }],
                })));
              }
              if (delta?.content) {
                controller.enqueue(encoder.encode(sseChunk({
                  id: cid, object: "chat.completion.chunk", created, model: clientModel,
                  choices: [{ index: 0, delta: { content: delta.content }, finish_reason: null }],
                })));
              }
            });
            if (!result?.ok) {
              controller.enqueue(encoder.encode(sseChunk({
                id: cid, object: "chat.completion.chunk", created, model: clientModel,
                choices: [{ index: 0, delta: { content: `\n[Qwen Web Error: ${result?.error || "Request failed"}]` }, finish_reason: "stop" }],
              })));
            } else {
              controller.enqueue(encoder.encode(sseChunk({
                id: cid, object: "chat.completion.chunk", created, model: clientModel,
                choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
                ...(result.usage ? { usage: result.usage } : {}),
              })));
            }
          } catch (err) {
            controller.enqueue(encoder.encode(sseChunk({
              id: cid, object: "chat.completion.chunk", created, model: clientModel,
              choices: [{ index: 0, delta: { content: `\n[Qwen Web Error: ${err?.message || String(err)}]` }, finish_reason: "stop" }],
            })));
          } finally {
            controller.enqueue(encoder.encode(SSE_DONE));
            controller.close();
          }
        },
      });

      return {
        response: new Response(sseStream, { status: 200, headers: { ...SSE_HEADERS_NO_BUFFER } }),
        url: QWEN_COMPLETION_URL,
        headers: {},
        transformedBody: body,
      };
    } catch (error) {
      return {
        response: errorResponse(502, error?.message || "Qwen Web execution failed"),
        url: QWEN_COMPLETION_URL,
        headers: {},
        transformedBody: body,
      };
    }
  }
}

export default QwenWebExecutor;
