// Early-commit wrapper for streaming chat requests.
//
// Cloudflare (and nginx) answer 524 when the origin sends NO bytes for ~100-120s. A huge prompt
// (e.g. 600k+ tokens on Vertex) can sit upstream longer than that before the first response
// header exists, and the normal SSE keepalive only starts once we hold an upstream response.
//
// So: race the real handler against a short grace timer. If it answers first, return its
// response untouched (status codes preserved). If the grace timer wins on a streaming
// request, commit a 200 SSE response now, send keepalive comments while the handler keeps
// working, then pipe its body through, or emit a protocol-correct in-stream error.

import { STREAM_EARLY_COMMIT_MS, STREAM_KEEPALIVE_INTERVAL_MS } from "../config/runtimeConfig.js";

const encoder = new TextEncoder();
const KEEPALIVE = encoder.encode(": keepalive\n\n");
const TIMED_OUT = Symbol("early-commit-timeout");

function errorFrame(endpoint, status, message) {
  const err = { message, type: "upstream_error", code: `HTTP_${status}` };
  if (endpoint.includes("/messages")) {
    const type = status === 429 ? "rate_limit_error" : status >= 500 ? "api_error" : "invalid_request_error";
    return `event: error\ndata: ${JSON.stringify({ type: "error", error: { type, message } })}\n\n`;
  }
  if (endpoint.includes("/responses")) {
    return `event: error\ndata: ${JSON.stringify({ type: "error", error: err })}\n\n`;
  }
  return `data: ${JSON.stringify({ error: err })}\n\ndata: [DONE]\n\n`;
}

async function describeFailure(res) {
  let message = `Upstream error (HTTP ${res.status})`;
  try {
    const text = await res.text();
    const json = JSON.parse(text);
    message = json?.error?.message || json?.message || text.slice(0, 500) || message;
  } catch { /* keep default */ }
  return message;
}

/**
 * @param {Promise<Response>} work     the real handler promise
 * @param {{stream?: boolean}} ctx     set by the handler once the body is parsed
 * @param {string} endpoint            request pathname, picks the error frame format
 */
export async function withEarlyCommit(work, ctx, endpoint = "") {
  const graceMs = STREAM_EARLY_COMMIT_MS;
  if (!(graceMs > 0)) return work;

  let timer;
  const first = await Promise.race([
    work,
    new Promise((resolve) => { timer = setTimeout(() => resolve(TIMED_OUT), graceMs); }),
  ]);
  clearTimeout(timer);
  if (first !== TIMED_OUT) return first;
  // Non-streaming replies are a single JSON body: nothing to keepalive, keep normal semantics.
  if (ctx.stream !== true) return work;

  let upstreamReader = null;
  let closed = false;
  const body = new ReadableStream({
    start(controller) {
      const safeEnqueue = (chunk) => { try { controller.enqueue(chunk); } catch { closed = true; } };
      const finish = () => { clearInterval(ping); try { controller.close(); } catch { /* already closed */ } };
      safeEnqueue(KEEPALIVE);
      const ping = setInterval(() => safeEnqueue(KEEPALIVE), STREAM_KEEPALIVE_INTERVAL_MS);
      ping.unref?.();

      work.then(async (res) => {
        clearInterval(ping);
        if (closed) { res?.body?.cancel?.().catch(() => {}); return; }
        if (!res?.ok || !res.body) {
          safeEnqueue(encoder.encode(errorFrame(endpoint, res?.status || 502, res ? await describeFailure(res) : "Empty upstream response")));
          return finish();
        }
        upstreamReader = res.body.getReader();
        for (;;) {
          const { done, value } = await upstreamReader.read();
          if (done || closed) break;
          safeEnqueue(value);
        }
        finish();
      }).catch((error) => {
        clearInterval(ping);
        safeEnqueue(encoder.encode(errorFrame(endpoint, 502, error?.message || "Request failed")));
        finish();
      });
    },
    cancel() {
      closed = true;
      upstreamReader?.cancel?.().catch(() => {});
    },
  });

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
