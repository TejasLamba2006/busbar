import { describe, it, expect, vi, beforeEach } from "vitest";

const getModelInfo = vi.fn();
const getProviderCredentials = vi.fn();
const handleSystemoneCore = vi.fn();

vi.mock("../../src/sse/services/model.js", () => ({ getModelInfo }));
vi.mock("../../src/sse/services/auth.js", () => ({ getProviderCredentials }));
vi.mock("../../src/sse/services/tokenRefresh.js", () => ({ checkAndRefreshToken: async (_p, c) => c }));
vi.mock("open-sse/handlers/systemoneCore.js", () => ({ handleSystemoneCore }));
vi.mock("../../src/sse/utils/mediaRequestLog.js", () => ({
  recordMediaRequestDetail: () => {}, recordMediaUsage: () => {}, summarizeMediaResponse: () => ({}),
}));

const { resolveSmartChoice, parseRouterModels } = await import("../../src/sse/services/systemoneRouter.js");

const body = { messages: [{ role: "user", content: "write a haiku" }] };
const models = ["a/one", "b/two"];
const log = { info: vi.fn(), warn: vi.fn(), debug: vi.fn() };
const answer = (choice) => ({ success: true, response: { json: async () => ({ answers: { route: { choice, confidence: 0.5 } } }) } });

beforeEach(() => {
  vi.clearAllMocks();
  getModelInfo.mockImplementation(async (id) => ({ provider: id.split("/")[0], model: id.split("/")[1] }));
  getProviderCredentials.mockResolvedValue({ connectionId: "c1" });
});

describe("parseRouterModels", () => {
  it("accepts string, comma list and array; trims, dedupes, drops blanks", () => {
    expect(parseRouterModels("oc/jev-1.13-free, ts/jev-latest ,oc/jev-1.13-free,")).toEqual(["oc/jev-1.13-free", "ts/jev-latest"]);
    expect(parseRouterModels([" a/b ", "", "c/d"])).toEqual(["a/b", "c/d"]);
  });
  it("falls back to the default router for empty or invalid input", () => {
    expect(parseRouterModels(undefined)).toEqual(["oc/jev-1.13-free"]);
    expect(parseRouterModels("  ,, ")).toEqual(["oc/jev-1.13-free"]);
  });
});

describe("resolveSmartChoice fallback", () => {
  it("uses the first router when it decides, never touching the second", async () => {
    handleSystemoneCore.mockResolvedValueOnce(answer("a/one"));
    const r = await resolveSmartChoice({ body, models, routerModel: "oc/jev,ts/jev", log });
    expect(r.choice).toBe("a/one");
    expect(handleSystemoneCore).toHaveBeenCalledTimes(1);
    expect(handleSystemoneCore.mock.calls[0][0].modelInfo.provider).toBe("oc");
  });

  it("falls to the second router when the first is rate limited (no credentials)", async () => {
    getProviderCredentials.mockImplementation(async (provider) => (provider === "oc" ? { allRateLimited: true } : { connectionId: "c2" }));
    handleSystemoneCore.mockResolvedValueOnce(answer("b/two"));
    const r = await resolveSmartChoice({ body, models, routerModel: "oc/jev,ts/jev", log });
    expect(r.choice).toBe("b/two");
    expect(handleSystemoneCore.mock.calls[0][0].modelInfo.provider).toBe("ts");
  });

  it("falls to the second router when the first returns an upstream failure", async () => {
    handleSystemoneCore
      .mockResolvedValueOnce({ success: false, status: 429, error: "Free usage limit reached" })
      .mockResolvedValueOnce(answer("a/one"));
    const r = await resolveSmartChoice({ body, models, routerModel: "oc/jev,ts/jev", log });
    expect(r.choice).toBe("a/one");
    expect(handleSystemoneCore).toHaveBeenCalledTimes(2);
  });

  it("falls to the second router when the first throws", async () => {
    handleSystemoneCore.mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce(answer("a/one"));
    expect((await resolveSmartChoice({ body, models, routerModel: ["oc/jev", "ts/jev"], log })).choice).toBe("a/one");
  });

  it("returns null (fail open) when every router fails", async () => {
    handleSystemoneCore.mockResolvedValue({ success: false, status: 500 });
    expect(await resolveSmartChoice({ body, models, routerModel: "oc/jev,ts/jev", log })).toBeNull();
    expect(handleSystemoneCore).toHaveBeenCalledTimes(2);
  });

  it("does not call any router for a single-model pool", async () => {
    expect(await resolveSmartChoice({ body, models: ["a/one"], routerModel: "oc/jev,ts/jev", log })).toBeNull();
    expect(handleSystemoneCore).not.toHaveBeenCalled();
  });

  it("single string routerModel behaves exactly as before", async () => {
    handleSystemoneCore.mockResolvedValueOnce({ success: false, status: 500 });
    expect(await resolveSmartChoice({ body, models, routerModel: "oc/jev", log })).toBeNull();
    expect(handleSystemoneCore).toHaveBeenCalledTimes(1);
  });
});
