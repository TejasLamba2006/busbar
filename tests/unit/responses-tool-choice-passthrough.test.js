// The chat→Responses hop must carry tool_choice across. When it was dropped,
// a forced tool past the 128-tool cap vanished and the model answered in prose
// instead ("probe_182 unavailable"), even though the request succeeded.
import { describe, it, expect } from "vitest";
import { openaiToOpenAIResponsesRequest } from "../../open-sse/translator/request/openai-responses.js";

const tool = (name) => ({
  type: "function",
  function: { name, description: "t", parameters: { type: "object", properties: {} } },
});

describe("chat→Responses tool_choice passthrough", () => {
  it("carries a forced function tool", () => {
    const out = openaiToOpenAIResponsesRequest("gpt-5.6-sol", {
      messages: [{ role: "user", content: "hi" }],
      tools: [tool("a"), tool("b")],
      tool_choice: { type: "function", function: { name: "b" } },
    }, true, {});
    expect(out.tool_choice).toEqual({ type: "function", name: "b" });
  });

  it.each([
    [{ type: "required" }, { type: "required" }],
    [{ type: "auto" }, { type: "auto" }],
    [{ type: "none" }, { type: "none" }],
  ])("maps Chat %j to the Responses equivalent", (chat, responses) => {
    const out = openaiToOpenAIResponsesRequest("m", {
      messages: [{ role: "user", content: "hi" }],
      tools: [tool("a")],
      tool_choice: chat,
    }, true, {});
    expect(out.tool_choice).toEqual(responses);
  });

  it("keeps the forced tool present in the declared tool list", () => {
    const out = openaiToOpenAIResponsesRequest("m", {
      messages: [{ role: "user", content: "hi" }],
      tools: [tool("keep_me")],
      tool_choice: { type: "function", function: { name: "keep_me" } },
    }, true, {});
    expect(out.tools.map((t) => t.name)).toContain("keep_me");
  });

  it("leaves tool_choice absent when the client sent none", () => {
    const out = openaiToOpenAIResponsesRequest("m", {
      messages: [{ role: "user", content: "hi" }],
      tools: [tool("a")],
    }, true, {});
    expect("tool_choice" in out).toBe(false);
  });

  it("raises Claude Code's /model max_output_tokens probe to the Responses minimum", () => {
    const out = openaiToOpenAIResponsesRequest("gpt-5.6-sol", {
      messages: [{ role: "user", content: "hi" }],
      max_output_tokens: 1,
    }, true, {});
    expect(out.max_output_tokens).toBe(16);
  });

  it("raises Chat-style max_tokens probes to the same Responses minimum", () => {
    const out = openaiToOpenAIResponsesRequest("gpt-5.6-sol", {
      messages: [{ role: "user", content: "hi" }],
      max_tokens: 1,
    }, true, {});
    expect(out.max_output_tokens).toBe(16);
  });

  it("leaves valid output token caps unchanged", () => {
    const out = openaiToOpenAIResponsesRequest("gpt-5.6-sol", {
      messages: [{ role: "user", content: "hi" }],
      max_output_tokens: 256,
    }, true, {});
    expect(out.max_output_tokens).toBe(256);
  });

  it("preserves parallel_tool_calls when present", () => {
    const out = openaiToOpenAIResponsesRequest("m", {
      messages: [{ role: "user", content: "hi" }],
      tools: [tool("a")],
      parallel_tool_calls: false,
    }, true, {});
    expect(out.parallel_tool_calls).toBe(false);
  });
});