import { describe, it, expect, vi } from "vitest";

const { AI_PROVIDERS, ALIAS_TO_ID, FREE_PROVIDERS } = await import("@/shared/constants/providers.js");
const { PROVIDERS } = await import("open-sse/config/providers.js");
const { getExecutor } = await import("open-sse/executors/index.js");
const registry = (await import("open-sse/providers/registry/utim.js")).default;

describe("utim provider", () => {
  it("registers as no-auth with alias ut and the playground URL", () => {
    expect(AI_PROVIDERS.utim).toBeDefined();
    expect(ALIAS_TO_ID.ut).toBe("utim");
    expect(FREE_PROVIDERS?.utim?.noAuth ?? AI_PROVIDERS.utim.noAuth).toBe(true);
    expect(PROVIDERS.utim.baseUrl).toBe("https://api.utim.dev/api/playground/chat");
  });

  it("exposes opus under both spellings plus the short alias, unique ids", () => {
    const ids = registry.models.map((m) => m.id);
    expect(ids).toEqual(expect.arrayContaining(["antropic/claude-opus-5", "anthropic/claude-opus-5", "claude-opus-5"]));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("uses the default executor against the playground endpoint without a key", () => {
    const ex = getExecutor("utim");
    expect(ex.buildUrl("antropic/claude-opus-5", true)).toBe("https://api.utim.dev/api/playground/chat");
    const h = ex.buildHeaders({}, true);
    expect(h.Authorization).toBeUndefined();
  });

  it("packs oversized messages (>2k tokens) into 8.8k-char ctx_part_N tool definitions while keeping real tools", () => {
    const ex = getExecutor("utim");
    const bigSystem = "Rule: follow instructions.\n".repeat(1200); // ~32,400 chars
    const body = {
      model: "antropic/claude-opus-5",
      messages: [
        { role: "system", content: bigSystem },
        { role: "user", content: "Run echo hello" },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "Bash",
            description: "Run bash",
            parameters: { type: "object", properties: { command: { type: "string" } } },
          },
        },
      ],
    };

    const packed = ex.transformRequest("antropic/claude-opus-5", body, true, {});
    expect(JSON.stringify(packed.messages).length).toBeLessThan(6000);
    const ctxTools = packed.tools.filter((t) => t.function.name.startsWith("ctx_part_"));
    expect(ctxTools.length).toBeGreaterThanOrEqual(4);
    for (const ct of ctxTools) {
      expect(ct.function.description.length).toBeLessThanOrEqual(9000);
    }
    expect(packed.tools[packed.tools.length - 1].function.name).toBe("Bash");
  });

  it("keeps real assistant tool_calls + tool messages in the tail while packing overflow", () => {
    const ex = getExecutor("utim");
    const call = (id) => ({ id, type: "function", function: { name: "Bash", arguments: JSON.stringify({ command: "x".repeat(900) }) } });
    const body = {
      model: "antropic/claude-opus-5",
      messages: [
        { role: "system", content: "S".repeat(40000) },
        { role: "user", content: "go" },
        { role: "assistant", content: null, tool_calls: [call("c1"), call("c2")] },
        { role: "tool", tool_call_id: "c1", content: "r".repeat(2000) },
        { role: "tool", tool_call_id: "c2", content: "r".repeat(2000) },
      ],
      tools: [{ type: "function", function: { name: "Bash", parameters: { type: "object", properties: {} } } }],
    };
    const out = ex.transformRequest("antropic/claude-opus-5", body, true, {});
    expect(JSON.stringify(out.messages).length).toBeLessThan(6000);
    expect(out.messages[0].role).toBe("system");
    expect(out.messages[1].role).toBe("user");
    const tools = out.messages.filter((m) => m.role === "tool");
    expect(tools.map((m) => m.tool_call_id)).toEqual(["c1", "c2"]);
    const asst = out.messages.find((m) => m.role === "assistant");
    expect(asst.tool_calls.map((c) => c.id)).toEqual(["c1", "c2"]);
    expect(out.tools.some((t) => t.function.name === "ctx_part_0")).toBe(true);
  });

  it("collapses __ in MCP tool names and records the reverse map", async () => {
    const { takeRenamedToolNames } = await import("open-sse/utils/opencodeFingerprint.js");
    const ex = getExecutor("utim");
    const name = "mcp__playwright__browser_navigate";
    const body = {
      model: "antropic/claude-opus-5",
      messages: [
        { role: "user", content: "hi" },
        { role: "assistant", content: null, tool_calls: [{ id: "a", type: "function", function: { name, arguments: "{}" } }] },
        { role: "tool", tool_call_id: "a", content: "ok" },
      ],
      tools: [{ type: "function", function: { name, parameters: { type: "object", properties: {} } } }],
      tool_choice: { type: "function", function: { name } },
    };
    const out = ex.transformRequest("antropic/claude-opus-5", body, true, {});
    expect(out.tools[0].function.name).toBe("mcp_playwright_browser_navigate");
    expect(out.tool_choice.function.name).toBe("mcp_playwright_browser_navigate");
    expect(out.messages[1].tool_calls[0].function.name).toBe("mcp_playwright_browser_navigate");
    expect(takeRenamedToolNames(body).get("mcp_playwright_browser_navigate")).toBe(name);
    expect(takeRenamedToolNames(out).get("mcp_playwright_browser_navigate")).toBe(name);
    expect(body.tools[0].function.name).toBe(name);
    expect(ex.transformRequest("antropic/claude-opus-5", body, true, {}).tools[0].function.name).toBe("mcp_playwright_browser_navigate");
  });

  it("execute() retries when the streaming turn is empty", async () => {
    const { DefaultExecutor } = await import("open-sse/executors/default.js");
    const sse = (data) => new Response(data, { status: 200, headers: { "content-type": "text/event-stream" } });
    const empty = sse("data: [DONE]\n\n");
    const good = sse('data: {"choices":[{"delta":{"content":"hi"}}]}\n\n');
    const spy = vi.spyOn(DefaultExecutor.prototype.__proto__, "execute")
      .mockResolvedValueOnce({ response: empty })
      .mockResolvedValueOnce({ response: good });
    const ex = getExecutor("utim");
    const r = await ex.execute({ model: "m", body: {}, stream: true, credentials: {} });
    expect(spy).toHaveBeenCalledTimes(2);
    expect(r.response).toBe(good);
    spy.mockRestore();
  });
});
