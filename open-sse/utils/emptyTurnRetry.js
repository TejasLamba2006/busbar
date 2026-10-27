// Streaming empty-turn probe: inspects a cloned SSE response up to a bounded byte
// budget before any bytes are piped to the client. Stops immediately ("pass") on the
// first content or tool-call fragment; returns "retry" when the upstream stream closes
// or errors with zero usable content/tool calls so the caller can fall back to the
// next account or combo model.

export const EMPTY_TURN_PROBE_MAX_BYTES = 128_000;
// Bound how long the empty-turn probe waits once the stream starts emitting bytes
// (e.g. long thinking streams on Vertex/Gemini or Claude behind Cloudflare's 100s
// HTTP response-header timeout). If the stream is actively sending frames for >12s
// without an error, flush headers and pipe to the client immediately so Cloudflare
// never kills the request with 524.
export const EMPTY_TURN_PROBE_MAX_MS = 12_000;

function concatChunks(chunks, total) {
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(out);
}

// Fast check on a single SSE `data:` JSON payload across OpenAI Chat, OpenAI Responses,
// Claude Messages, and Gemini/Vertex/Antigravity formats.
export function payloadHasUsableOutput(parsed) {
  if (!parsed || typeof parsed !== "object") return false;

  // Upstream inline error frame inside a 200 SSE stream -> not usable output
  if (parsed.error || parsed.type === "error" || parsed.type === "response.failed") {
    return false;
  }

  // OpenAI Chat Completions delta / message
  if (Array.isArray(parsed.choices) && parsed.choices.length > 0) {
    for (const choice of parsed.choices) {
      const msg = choice?.delta || choice?.message;
      if (typeof msg?.content === "string" && msg.content.length > 0) return true;
      if (Array.isArray(msg?.content) && msg.content.length > 0) return true;
      if (Array.isArray(msg?.tool_calls) && msg.tool_calls.length > 0) return true;
      if (msg?.function_call) return true;
      if (choice?.finish_reason === "tool_calls" || choice?.finish_reason === "function_call" || choice?.finish_reason === "length") {
        return true;
      }
    }
  }

  // Claude Messages SSE (content_block_start / content_block_delta)
  if (parsed.type === "content_block_start") {
    const bt = parsed.content_block?.type;
    if (bt === "tool_use" || bt === "server_tool_use") return true;
    if (bt === "text" && typeof parsed.content_block?.text === "string" && parsed.content_block.text.length > 0) return true;
  }
  if (parsed.type === "content_block_delta") {
    const dt = parsed.delta?.type;
    if (dt === "text_delta" && typeof parsed.delta?.text === "string" && parsed.delta.text.length > 0) return true;
    if (dt === "input_json_delta" && typeof parsed.delta?.partial_json === "string" && parsed.delta.partial_json.length > 0) return true;
  }

  // OpenAI Responses SSE
  if (parsed.type === "response.output_text.delta" && typeof parsed.delta === "string" && parsed.delta.length > 0) {
    return true;
  }
  if (parsed.type === "response.function_call_arguments.delta" || parsed.type === "response.function_call_arguments.done") {
    return true;
  }
  if ((parsed.type === "response.output_item.added" || parsed.type === "response.output_item.done") && parsed.item) {
    const it = parsed.item;
    if (it.type === "function_call" || it.type === "custom_tool_call") return true;
    if (it.type === "message" && Array.isArray(it.content) && it.content.some((c) => typeof c?.text === "string" && c.text.length > 0)) {
      return true;
    }
  }
  if (parsed.type === "response.completed" && Array.isArray(parsed.response?.output)) {
    for (const it of parsed.response.output) {
      if (it?.type === "function_call" || it?.type === "custom_tool_call") return true;
      if (it?.type === "message" && Array.isArray(it.content) && it.content.some((c) => typeof c?.text === "string" && c.text.length > 0)) {
        return true;
      }
    }
  }

  // Gemini / Vertex / Antigravity candidates
  const candidates = parsed.candidates || parsed.response?.candidates;
  if (Array.isArray(candidates) && candidates.length > 0) {
    for (const cand of candidates) {
      const parts = cand?.content?.parts;
      if (Array.isArray(parts)) {
        for (const p of parts) {
          if (p?.functionCall) return true;
          if (!p?.thought && typeof p?.text === "string" && p.text.length > 0) return true;
        }
      }
    }
  }

  return false;
}

export function payloadExtractStreamError(parsed) {
  if (!parsed || typeof parsed !== "object") return null;
  if (parsed.type === "error" && parsed.error) {
    return parsed.error.message || JSON.stringify(parsed.error);
  }
  if (parsed.type === "response.failed" && parsed.response?.error) {
    return parsed.response.error.message || JSON.stringify(parsed.response.error);
  }
  if (parsed.error) {
    return typeof parsed.error === "string" ? parsed.error : (parsed.error.message || JSON.stringify(parsed.error));
  }
  return null;
}

function scanLines(lines) {
  let sawError = null;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    let payloadStr = null;
    if (line.startsWith("data:")) {
      payloadStr = line.slice(5).trim();
    } else if (line.startsWith("{")) {
      payloadStr = line;
    }
    if (!payloadStr || payloadStr === "[DONE]") continue;
    try {
      const parsed = JSON.parse(payloadStr);
      if (payloadHasUsableOutput(parsed)) return { usable: true, error: null };
      const err = payloadExtractStreamError(parsed);
      if (err) sawError = err;
    } catch {
      // ignore partial/non-JSON line
    }
  }
  return { usable: false, error: sawError };
}

/**
 * Probe a streaming Response via `.clone()` before piping to the client.
 * Returns `{ empty: false }` as soon as the first usable content/tool-call chunk
 * arrives (or when the buffer cap is exceeded), or `{ empty: true, reason }` if the
 * stream ends or errors without producing any usable output.
 */
export async function probeStreamingResponseForEmptyTurn(response, maxBytes = EMPTY_TURN_PROBE_MAX_BYTES, maxMs = EMPTY_TURN_PROBE_MAX_MS) {
  if (!response?.body || typeof response.clone !== "function") {
    return { empty: false };
  }
  const ct = (response.headers?.get?.("content-type") || "").toLowerCase();
  if (ct && !ct.includes("text/event-stream") && !ct.includes("application/x-ndjson")) {
    return { empty: false };
  }

  let reader;
  try {
    const clone = response.clone();
    if (!clone.body) return { empty: false };
    reader = clone.body.getReader();
  } catch {
    return { empty: false };
  }

  const chunks = [];
  let total = 0;
  let consumed = 0;
  let sawAnyData = false;
  let streamError = null;
  let firstDataAt = 0;

  try {
    for (;;) {
      let readResult;
      if (sawAnyData && maxMs > 0) {
        const remaining = maxMs - (Date.now() - firstDataAt);
        if (remaining <= 0) {
          void reader.cancel().catch(() => {});
          return { empty: false };
        }
        let timer;
        const timedOut = await Promise.race([
          reader.read().then((r) => { clearTimeout(timer); readResult = r; return false; }),
          new Promise((resolve) => { timer = setTimeout(() => resolve(true), remaining); }),
        ]);
        if (timedOut) {
          void reader.cancel().catch(() => {});
          return { empty: false };
        }
      } else {
        readResult = await reader.read();
      }
      const { done, value } = readResult;
      if (done) break;
      if (!value || value.byteLength === 0) continue;
      if (!sawAnyData) firstDataAt = Date.now();
      sawAnyData = true;
      total += value.byteLength;
      if (total > maxBytes || (maxMs > 0 && Date.now() - firstDataAt >= maxMs)) {
        void reader.cancel().catch(() => {});
        return { empty: false };
      }
      chunks.push(value);
      const text = concatChunks(chunks, total);
      const lastNewline = text.lastIndexOf("\n");
      if (lastNewline >= consumed) {
        const segment = text.slice(consumed, lastNewline + 1);
        consumed = lastNewline + 1;
        const { usable, error } = scanLines(segment.split("\n"));
        if (usable) {
          void reader.cancel().catch(() => {});
          return { empty: false };
        }
        if (error) streamError = error;
      }
    }

    if (total > consumed) {
      const tail = concatChunks(chunks, total).slice(consumed);
      const { usable, error } = scanLines(tail.split("\n"));
      if (usable) return { empty: false };
      if (error) streamError = error;
    }

    return {
      empty: true,
      reason: streamError
        ? `Upstream stream error: ${streamError}`
        : sawAnyData
          ? "Upstream stream closed with zero usable content"
          : "Upstream returned an empty stream",
    };
  } catch (err) {
    return {
      empty: true,
      reason: `Upstream stream dropped before first output: ${err?.message || String(err)}`,
    };
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // ignore
    }
  }
}
