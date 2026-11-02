import { describe, it, expect } from "vitest";

process.env.STREAM_EARLY_COMMIT_MS = "50";
process.env.STREAM_KEEPALIVE_INTERVAL_MS = "20";
const { withEarlyCommit } = await import("open-sse/utils/earlyCommitStream.js");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sseResponse = (text) =>
  new Response(text, { status: 200, headers: { "Content-Type": "text/event-stream" } });

describe("withEarlyCommit", () => {
  it("returns fast responses untouched before grace timer", async () => {
    const ctx = { stream: true };
    const orig = sseResponse("data: fast\n\n");
    const res = await withEarlyCommit(sleep(10).then(() => orig), ctx, "/v1/chat/completions");
    expect(res).toBe(orig);
    expect(await res.text()).toBe("data: fast\n\n");
  });

  it("commits 200 SSE with keepalive when slow streaming work exceeds grace timer, then pipes body", async () => {
    const ctx = { stream: true };
    const work = sleep(110).then(() => sseResponse("data: {\"choices\":[{\"delta\":{\"content\":\"hi\"}}]}\n\ndata: [DONE]\n\n"));
    const t0 = Date.now();
    const res = await withEarlyCommit(work, ctx, "/v1/chat/completions");
    expect(Date.now() - t0).toBeLessThan(95);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain(": keepalive\n\n");
    expect(text).toContain('"content":"hi"');
    expect(text).toContain("data: [DONE]");
  });

  it("does not early-commit non-streaming requests", async () => {
    const ctx = { stream: false };
    const orig = new Response('{"ok":true}', { status: 200 });
    const res = await withEarlyCommit(sleep(90).then(() => orig), ctx, "/v1/chat/completions");
    expect(res).toBe(orig);
  });

  it("emits protocol-appropriate SSE error frame when slow work resolves to upstream error", async () => {
    const ctx = { stream: true };
    const errRes = new Response(JSON.stringify({ error: { message: "Quota exceeded" } }), { status: 429 });
    const res = await withEarlyCommit(sleep(80).then(() => errRes), ctx, "/v1/messages");
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("event: error");
    expect(text).toContain("rate_limit_error");
    expect(text).toContain("Quota exceeded");
  });
});
