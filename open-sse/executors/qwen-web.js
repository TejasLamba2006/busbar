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
} from "../translator/deepseekWebTools.js";

export const QWEN_WEB_BASE = "https://chat.qwen.ai";
const QWEN_COMPLETION_URL = `${QWEN_WEB_BASE}/api/v2/chat/completions`;
const QWEN_VERSION = "0.3.26";
const DEFAULT_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36";

export function extractQwenCredential(credentials) {
  const raw = credentials?.apiKey || credentials?.accessToken || "";
  if (typeof raw !== "string" || !raw.trim()) return { token: "", cookieHeader: "" };
  const trimmed = raw.trim();

  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (typeof parsed?.token === "string") {
        return { token: parsed.token.trim(), cookieHeader: typeof parsed.cookie === "string" ? parsed.cookie : "" };
      }
      if (typeof parsed?.value === "string") {
        return { token: parsed.value.trim(), cookieHeader: "" };
      }
    } catch {
      // ignore
    }
  }

  // Raw JWT (3 dot-separated base64 segments)
  if (/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(trimmed)) {
    return { token: trimmed, cookieHeader: `token=${trimmed}` };
  }

  // Cookie header string (e.g. "token=eyJ...; acw_tc=...")
  let token = "";
  for (const part of trimmed.split(";")) {
    const eq = part.indexOf("=");
    if (eq <= 0) continue;
    const k = part.slice(0, eq).trim();
    const v = part.slice(eq + 1).trim();
    if ((k === "token" || k === "qwen_token") && v) {
      token = v;
      break;
    }
  }
  return { token, cookieHeader: trimmed };
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

async function getOrOpenQwenPage(credentials) {
  const { token, cookieHeader } = extractQwenCredential(credentials);
  const digest = createHash("sha256")
    .update(String(credentials?.connectionId || "qwen"))
    .update("\0")
    .update(token || cookieHeader)
    .digest("hex")
    .slice(0, 16);

  const localStorage = {};
  if (token) {
    localStorage.token = token;
    const expMs = Date.now() + 3600 * 1000;
    localStorage.at_expire_time = String(expMs);
    localStorage.qwen_access_token_state = JSON.stringify({
      version: 1,
      stateId: `busbar-${digest}`,
      token,
      expiresAt: expMs,
      updatedAt: Date.now(),
      sourceId: "busbar",
    });
  }

  const pooled = await acquireBrowserContext(`qwen-web:${digest}`, {
    cookieDomain: ".qwen.ai",
    ...(cookieHeader ? { cookieString: cookieHeader } : {}),
    localStorage,
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
  return { pooled, page, digest };
}

export class QwenWebExecutor extends BaseExecutor {
  constructor() {
    super("qwen-web", { id: "qwen-web", baseUrl: QWEN_WEB_BASE });
  }

  async testConnection(credentials) {
    const { token } = extractQwenCredential(credentials);
    return Boolean(token);
  }

  async execute({ model, body, stream, credentials, signal, log }) {
    const bodyObj = body || {};
    const { token, cookieHeader } = extractQwenCredential(credentials);
    if (!token && !cookieHeader) {
      return {
        response: errorResponse(
          401,
          "Missing Qwen Web token — use Login via Browser or paste your token from chat.qwen.ai localStorage"
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

    const prompt = hasTools
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

    const { page, digest } = pageInfo;
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
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            };

            // Wait up to 3s for Baxia anti-bot module if not ready yet
            for (let i = 0; i < 15; i++) {
              if (window.__baxia__?.getFYModule?.getUidToken?.()) break;
              await new Promise((r) => setTimeout(r, 200));
            }

            const createRes = await fetch("/api/v2/chats/new", {
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
            });

            const createText = await createRes.text();
            let createJson = null;
            try {
              createJson = JSON.parse(createText);
            } catch {
              return {
                ok: false,
                status: createRes.status === 200 ? 403 : createRes.status || 502,
                error: createText.includes("aliyun_waf")
                  ? "Qwen Web triggered Aliyun WAF slider verification — open Qwen Web via Login via Browser once to clear it"
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

            const compRes = await fetch(`/api/v2/chat/completions?chat_id=${encodeURIComponent(chatId)}`, {
              method: "POST",
              headers: {
                ...headers,
                "X-Request-Id": crypto.randomUUID(),
                "X-Accel-Buffering": "no",
              },
              credentials: "include",
              body: JSON.stringify(completionPayload),
            });

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

    try {
      // Tool calls or non-streaming: buffer full response so tool XML can be parsed
      if (!stream || hasTools) {
        const result = await runInPageTurn(null);
        if (!result?.ok) {
          return {
            response: errorResponse(result?.status || 502, result?.error || "Qwen Web request failed", result?.code),
            url: QWEN_COMPLETION_URL,
            headers: {},
            transformedBody: body,
          };
        }

        const parsedTools = hasTools ? parseDeepSeekToolCalls(result.content || "") : null;
        const hasToolCalls = Array.isArray(parsedTools?.toolCalls) && parsedTools.toolCalls.length > 0;
        const message = {
          role: "assistant",
          content: hasToolCalls ? (parsedTools.cleanedText || null) : (result.content || ""),
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
                choices: [{ index: 0, delta: { tool_calls: parsedTools.toolCalls }, finish_reason: null }],
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
            const result = await runInPageTurn((delta) => {
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
