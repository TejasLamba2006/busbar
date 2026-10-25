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
});
