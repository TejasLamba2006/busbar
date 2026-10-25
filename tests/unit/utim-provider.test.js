import { describe, it, expect } from "vitest";

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
    expect(JSON.stringify(packed.messages).length).toBeLessThan(5500);
    const ctxTools = packed.tools.filter((t) => t.function.name.startsWith("ctx_part_"));
    expect(ctxTools.length).toBeGreaterThanOrEqual(4);
    for (const ct of ctxTools) {
      expect(ct.function.description.length).toBeLessThanOrEqual(9000);
    }
    expect(packed.tools[packed.tools.length - 1].function.name).toBe("Bash");
  });
});
