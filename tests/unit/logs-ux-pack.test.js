import { describe, expect, it } from "vitest";
import { buildCurlSnippet } from "@/app/(dashboard)/dashboard/console-log/requests/curlSnippet.js";

const ORIGIN = "http://localhost:20128";
const HEADERS = `  -H "Authorization: Bearer $BUSBAR_API_KEY" \\\n  -H "Content-Type: application/json" \\\n`;

// Pull the single-quoted -d payload back out and undo the '\'' escaping.
const payloadOf = (snippet) => {
  const m = snippet.match(/-d '([\s\S]*)'$/);
  return JSON.parse(m[1].replace(/'\\''/g, "'"));
};

describe("buildCurlSnippet", () => {
  it("builds a chat completions curl from request.messages with provider-prefixed model", () => {
    const detail = {
      provider: "openai",
      model: "gpt-4o",
      request: { messages: [{ role: "user", content: "hi" }], temperature: 0.2, max_tokens: 50, stream: false },
    };
    const out = buildCurlSnippet(detail, ORIGIN);
    expect(out.startsWith(`curl ${ORIGIN}/v1/chat/completions \\\n${HEADERS}  -d '`)).toBe(true);
    expect(payloadOf(out)).toEqual({
      model: "openai/gpt-4o",
      messages: [{ role: "user", content: "hi" }],
      temperature: 0.2,
      max_tokens: 50,
      stream: false,
    });
  });

  it("omits optional fields that are null or undefined and uses bare model without provider", () => {
    const detail = { model: "gpt-4o", request: { messages: [{ role: "user", content: "x" }], temperature: null } };
    const payload = payloadOf(buildCurlSnippet(detail, ORIGIN));
    expect(payload).toEqual({ model: "gpt-4o", messages: [{ role: "user", content: "x" }] });
  });

  it("routes SystemOne requests (request.questions) to /v1/decisions", () => {
    const detail = {
      provider: "systemone",
      model: "s1-core",
      request: { questions: [{ id: "q1", text: "Is it fraud?" }], context: "acct" },
    };
    const out = buildCurlSnippet(detail, ORIGIN);
    expect(out.startsWith(`curl ${ORIGIN}/v1/decisions \\\n`)).toBe(true);
    expect(payloadOf(out)).toEqual({
      model: "systemone/s1-core",
      questions: [{ id: "q1", text: "Is it fraud?" }],
      context: "acct",
    });
  });

  it("honours an explicit endpoint over inference", () => {
    const out = buildCurlSnippet({ endpoint: "/v1/embeddings", model: "e", request: { input: "a" } }, ORIGIN);
    expect(out.startsWith(`curl ${ORIGIN}/v1/embeddings \\\n`)).toBe(true);
  });

  it("prefers providerRequest when it carries a messages/input/prompt/questions field", () => {
    const detail = {
      provider: "openai",
      model: "gpt-4o",
      request: { messages: [{ role: "user", content: "client" }] },
      providerRequest: { model: "gpt-4o-2024", messages: [{ role: "user", content: "upstream" }] },
    };
    expect(payloadOf(buildCurlSnippet(detail, ORIGIN))).toEqual(detail.providerRequest);
  });

  it("escapes single quotes so the -d payload stays valid shell quoting", () => {
    const detail = { provider: "openai", model: "gpt-4o", request: { messages: [{ role: "user", content: "it's 'fine'" }] } };
    const out = buildCurlSnippet(detail, ORIGIN);
    expect(out).toContain(`it'\\''s '\\''fine'\\''`);
    expect(payloadOf(out).messages[0].content).toBe("it's 'fine'");
  });

  it("does not throw on an empty detail", () => {
    expect(buildCurlSnippet(undefined, ORIGIN)).toContain(`curl ${ORIGIN}/v1/chat/completions`);
    expect(buildCurlSnippet(undefined, ORIGIN)).toContain(`-d '{}'`);
  });
});
