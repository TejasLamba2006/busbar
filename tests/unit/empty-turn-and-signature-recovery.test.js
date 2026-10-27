import { describe, expect, it } from "vitest";
import { probeStreamingResponseForEmptyTurn, payloadHasUsableOutput } from "../../open-sse/utils/emptyTurnRetry.js";
import {
  isAnthropicThinkingSignatureError,
  stripHistoricalThinkingForSignatureRecovery,
} from "../../open-sse/utils/thinkingSignatureRecovery.js";

function sseResponse(lines, contentType = "text/event-stream") {
  const text = lines.join("\n") + "\n";
  return new Response(text, {
    status: 200,
    headers: { "content-type": contentType },
  });
}

describe("probeStreamingResponseForEmptyTurn", () => {
  it("passes a stream with OpenAI delta content and leaves original readable", async () => {
    const res = sseResponse([
      'data: {"id":"1","choices":[{"delta":{"role":"assistant"}}]}',
      'data: {"id":"1","choices":[{"delta":{"content":"hello"}}]}',
      "data: [DONE]",
    ]);
    const verdict = await probeStreamingResponseForEmptyTurn(res);
    expect(verdict.empty).toBe(false);
    const bodyText = await res.text();
    expect(bodyText).toContain('"content":"hello"');
  });

  it("flags an SSE stream that closes with only role/reasoning and no content or tool calls", async () => {
    const res = sseResponse([
      'data: {"id":"1","choices":[{"delta":{"role":"assistant"}}]}',
      'data: {"id":"1","choices":[{"delta":{},"finish_reason":"stop"}]}',
      "data: [DONE]",
    ]);
    const verdict = await probeStreamingResponseForEmptyTurn(res);
    expect(verdict.empty).toBe(true);
    expect(verdict.reason).toMatch(/zero usable content/i);
  });

  it("flags an SSE stream carrying an inline upstream error event", async () => {
    const res = sseResponse([
      'event: error',
      'data: {"type":"error","error":{"type":"overloaded_error","message":"Overloaded"}}',
    ]);
    const verdict = await probeStreamingResponseForEmptyTurn(res);
    expect(verdict.empty).toBe(true);
    expect(verdict.reason).toContain("Overloaded");
  });

  it("passes tool_use / functionCall / Responses output_text streams", async () => {
    expect(payloadHasUsableOutput({ type: "content_block_start", content_block: { type: "tool_use", id: "t1", name: "Read" } })).toBe(true);
    expect(payloadHasUsableOutput({ candidates: [{ content: { parts: [{ functionCall: { name: "Read", args: {} } }] } }] })).toBe(true);
    expect(payloadHasUsableOutput({ candidates: [{ content: { parts: [{ thought: true, text: "thinking..." }] } }] })).toBe(false);
    expect(payloadHasUsableOutput({ type: "response.output_text.delta", delta: "hi" })).toBe(true);
  });

  it("releases a slow thinking stream after maxMs so Cloudflare never times out with 524", async () => {
    const enc = new TextEncoder();
    const res = new Response(
      new ReadableStream({
        start(c) {
          c.enqueue(enc.encode('data: {"candidates":[{"content":{"parts":[{"thought":true,"text":"thinking..."}]}}]}\n\n'));
          setTimeout(() => {
            c.enqueue(enc.encode('data: {"candidates":[{"content":{"parts":[{"text":"final answer"}]}}]}\n\n'));
            c.close();
          }, 250);
        },
      }),
      { status: 200, headers: { "content-type": "text/event-stream" } }
    );
    const t0 = Date.now();
    const verdict = await probeStreamingResponseForEmptyTurn(res, 128_000, 60);
    expect(verdict.empty).toBe(false);
    expect(Date.now() - t0).toBeLessThan(200);
    const fullText = await res.text();
    expect(fullText).toContain("thinking...");
    expect(fullText).toContain("final answer");
  });
});

describe("Anthropic thinking-signature one-shot recovery", () => {
  it("matches only Anthropic 400 invalid signature in thinking block errors", () => {
    expect(isAnthropicThinkingSignatureError({
      provider: "claude",
      status: 400,
      message: "messages.1.content.0: Invalid `signature` in `thinking` block",
    })).toBe(true);
    expect(isAnthropicThinkingSignatureError({
      provider: "openai",
      status: 400,
      message: "Invalid signature in thinking block",
    })).toBe(false);
    expect(isAnthropicThinkingSignatureError({
      provider: "claude",
      status: 429,
      message: "Invalid signature in thinking block",
    })).toBe(false);
  });

  it("strips historical thinking blocks while preserving the active trailing tool_use/tool_result chain", () => {
    const body = {
      model: "claude-sonnet-4-6",
      messages: [
        { role: "user", content: [{ type: "text", text: "first" }] },
        {
          role: "assistant",
          content: [
            { type: "thinking", thinking: "old thought", signature: "stale_sig" },
            { type: "text", text: "first answer" },
          ],
        },
        { role: "user", content: [{ type: "text", text: "second" }] },
        {
          role: "assistant",
          content: [
            { type: "thinking", thinking: "active tool thought", signature: "active_sig" },
            { type: "tool_use", id: "tu_1", name: "Read", input: {} },
          ],
        },
        {
          role: "user",
          content: [{ type: "tool_result", tool_use_id: "tu_1", content: "ok" }],
        },
      ],
    };

    const recovered = stripHistoricalThinkingForSignatureRecovery(body);
    expect(recovered).not.toBe(body);
    expect(recovered.messages[1].content).toEqual([{ type: "text", text: "first answer" }]);
    expect(recovered.messages[3].content).toEqual([
      { type: "thinking", thinking: "active tool thought", signature: "active_sig" },
      { type: "tool_use", id: "tu_1", name: "Read", input: {} },
    ]);
  });
});
