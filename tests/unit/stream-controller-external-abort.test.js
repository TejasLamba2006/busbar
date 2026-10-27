import { describe, expect, it, vi } from "vitest";
import { createStreamController, createDisconnectAwareStream } from "../../open-sse/utils/streamHandler.js";

describe("stream controller external abort", () => {
  it("forwards an external abort to the executor signal", () => {
    const external = new AbortController();
    const controller = createStreamController({ signal: external.signal });
    expect(controller.signal.aborted).toBe(false);
    external.abort(new Error("cancelled"));
    expect(controller.signal.aborted).toBe(true);
  });

  it("removes the external listener after completion", () => {
    const external = new AbortController();
    const remove = vi.spyOn(external.signal, "removeEventListener");
    const controller = createStreamController({ signal: external.signal });
    controller.handleComplete();
    expect(remove).toHaveBeenCalledWith("abort", expect.any(Function));
  });

  it("emits SSE keepalive comments while upstream is silent and clears timer on completion", async () => {
    const controller = createStreamController();
    let emitChunk;
    const readable = new ReadableStream({
      start(c) {
        emitChunk = c;
      },
    });
    const stream = createDisconnectAwareStream(
      { readable, writable: { getWriter: () => ({ abort: () => Promise.resolve() }) } },
      controller,
      null,
      20
    );
    const reader = stream.getReader();

    const first = await reader.read();
    expect(new TextDecoder().decode(first.value)).toBe(": keepalive\n\n");

    emitChunk.enqueue(new TextEncoder().encode("data: {\"ok\":true}\n\n"));
    emitChunk.close();

    const chunks = [];
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(new TextDecoder().decode(value));
    }
    expect(chunks.some((c) => c.includes("data: {\"ok\":true}"))).toBe(true);
  });
});
