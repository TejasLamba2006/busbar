import { beforeEach, describe, expect, it, vi } from "vitest";
import REGISTRY from "open-sse/providers/registry/index.js";

const mocks = vi.hoisted(() => ({
  getProviderConnections: vi.fn(),
  getModelAliases: vi.fn(),
  getComboByName: vi.fn(),
  getProviderNodes: vi.fn(),
  updateProviderConnection: vi.fn(),
  getSettings: vi.fn(),
  getAccountActiveRequestCount: vi.fn(),
}));

vi.mock("@/lib/localDb", () => ({
  getProviderConnections: mocks.getProviderConnections,
  getProviderConnectionById: vi.fn(),
  getModelAliases: mocks.getModelAliases,
  getComboByName: mocks.getComboByName,
  getProviderNodes: mocks.getProviderNodes,
  updateProviderConnection: mocks.updateProviderConnection,
  getSettings: mocks.getSettings,
  getProxyPools: vi.fn(),
  getApiKeyById: vi.fn(),
  getApiKeyByKey: vi.fn(),
  validateApiKey: vi.fn(),
}));
vi.mock("@/lib/usageDb", () => ({
  getAccountActiveRequestCount: mocks.getAccountActiveRequestCount,
}));
vi.mock("@/sse/services/antigravityQuota.js", () => ({
  getAntigravityQuotaCache: vi.fn(() => new Map()),
  getAntigravityModelQuota: vi.fn(),
}));
vi.mock("@/lib/providers/claudeExtraUsage.js", () => ({
  isClaudeExtraUsageAllowed: vi.fn(),
  isClaudeExtraUsageState: vi.fn(),
}));
vi.mock("@/sse/utils/logger.js", () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }));

const { skipFullAccounts, markAccountUnavailable } = await import("@/sse/services/auth.js");
const { getBareModelFailoverTargets } = await import("@/sse/services/model.js");

const conn = (id, provider, extra = {}) => ({ id, provider, isActive: true, providerSpecificData: {}, ...extra });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getModelAliases.mockResolvedValue({});
  mocks.getComboByName.mockResolvedValue(null);
  mocks.getProviderNodes.mockResolvedValue([]);
  mocks.getSettings.mockResolvedValue({});
  mocks.getAccountActiveRequestCount.mockReturnValue(0);
  mocks.updateProviderConnection.mockResolvedValue(undefined);
});

describe("Feature 1: skipFullAccounts (maxConcurrent)", () => {
  it("skips an account at its cap when a sibling is below cap", () => {
    mocks.getAccountActiveRequestCount.mockImplementation((id) => (id === "a" ? 2 : 0));
    const a = conn("a", "openai", { maxConcurrent: 2 });
    const b = conn("b", "openai", { maxConcurrent: 2 });

    const result = skipFullAccounts([a, b]);

    expect(result.map((c) => c.id)).toEqual(["b"]);
  });

  it("reads the cap from providerSpecificData when top-level is missing", () => {
    mocks.getAccountActiveRequestCount.mockImplementation((id) => (id === "a" ? 1 : 0));
    const a = conn("a", "openai", { providerSpecificData: { maxConcurrent: 1 } });
    const b = conn("b", "openai");

    expect(skipFullAccounts([a, b]).map((c) => c.id)).toEqual(["b"]);
  });

  it("falls back to all accounts when every account is at cap", () => {
    mocks.getAccountActiveRequestCount.mockReturnValue(3);
    const a = conn("a", "openai", { maxConcurrent: 3 });
    const b = conn("b", "openai", { maxConcurrent: 3 });

    expect(skipFullAccounts([a, b])).toEqual([a, b]);
  });

  it("returns the input untouched for a single account or no cap set", () => {
    const solo = [conn("a", "openai", { maxConcurrent: 1 })];
    expect(skipFullAccounts(solo)).toBe(solo);

    const uncapped = [conn("a", "openai"), conn("b", "openai")];
    expect(skipFullAccounts(uncapped)).toEqual(uncapped);
  });
});

describe("Feature 2: markAccountUnavailable transient drops", () => {
  it.each([
    ["terminated", 502],
    ["socket hang up", 502],
    ["ECONNRESET", 502],
    ["stream_terminated", 504],
    ["other side closed", 502],
  ])("does not lock the account on %s (%i)", async (errorText, status) => {
    const result = await markAccountUnavailable("conn-12345678", status, errorText, "openai", "gpt-x");

    expect(result).toEqual({ shouldFallback: true, cooldownMs: 0 });
    expect(mocks.updateProviderConnection).not.toHaveBeenCalled();
  });

  it("treats client abort (499) as transient without locking", async () => {
    const result = await markAccountUnavailable("conn-12345678", 499, "client closed", "openai", "gpt-x");

    expect(result).toEqual({ shouldFallback: true, cooldownMs: 0 });
    expect(mocks.updateProviderConnection).not.toHaveBeenCalled();
  });
});

describe("Feature 3: getBareModelFailoverTargets", () => {
  // Pick a model id that two registry providers both list, so the test does not
  // hard-code catalog contents.
  const sharedModel = (() => {
    const seen = new Map();
    for (const entry of REGISTRY) {
      for (const m of entry.models || []) {
        const key = m.id.toLowerCase();
        if (!seen.has(key)) seen.set(key, new Map());
        seen.get(key).set(entry.id, m.id);
      }
    }
    for (const [, providers] of seen) {
      if (providers.size >= 2) return [...providers.entries()];
    }
    return null;
  })();

  it("resolves crow-uncensored:free to the active crowllm provider", async () => {
    mocks.getProviderConnections.mockResolvedValue([conn("c1", "crowllm")]);

    const targets = await getBareModelFailoverTargets("crow-uncensored:free", { clientKeyId: null });

    expect(targets).toEqual(["crowllm/crow-uncensored:free"]);
  });

  it("returns targets on every active provider that serves a shared model", async () => {
    expect(sharedModel, "catalog should contain a model shared across providers").not.toBeNull();
    const [[p1, id1], [p2]] = sharedModel;
    mocks.getProviderConnections.mockResolvedValue([conn("x1", p1), conn("x2", p2)]);

    const targets = await getBareModelFailoverTargets(id1);

    expect(targets).toContain(`${p1}/${id1}`);
    expect(targets).toContain(`${sharedModel[1][0]}/${sharedModel[1][1]}`);
    expect(new Set(targets).size).toBe(targets.length);
  });

  it("ignores provider/model strings", async () => {
    mocks.getProviderConnections.mockResolvedValue([conn("c1", "crowllm")]);

    expect(await getBareModelFailoverTargets("crowllm/crow-uncensored:free")).toEqual([]);
  });

  it("ignores combo names", async () => {
    mocks.getProviderConnections.mockResolvedValue([conn("c1", "crowllm")]);
    mocks.getComboByName.mockResolvedValue({ name: "my-combo", models: ["crowllm/crow-uncensored:free"] });

    expect(await getBareModelFailoverTargets("crow-uncensored:free")).toEqual([]);
  });

  it("ignores user model aliases", async () => {
    mocks.getProviderConnections.mockResolvedValue([conn("c1", "crowllm")]);
    mocks.getModelAliases.mockResolvedValue({ "crow-uncensored:free": "crowllm/crow-uncensored:free" });

    expect(await getBareModelFailoverTargets("crow-uncensored:free")).toEqual([]);
  });

  it("does not route to a provider the caller has no active connection on", async () => {
    mocks.getProviderConnections.mockResolvedValue([conn("c1", "crowllm", { isActive: false })]);

    expect(await getBareModelFailoverTargets("crow-uncensored:free")).toEqual([]);
  });

  it("scopes connections to the calling client key when clientKeyId is set", async () => {
    mocks.getProviderConnections.mockResolvedValue([
      conn("c1", "crowllm", { providerSpecificData: { ownerKeyId: "other-key" } }),
    ]);

    expect(await getBareModelFailoverTargets("crow-uncensored:free", { clientKeyId: "my-key" })).toEqual([]);

    mocks.getProviderConnections.mockResolvedValue([
      conn("c2", "crowllm", { providerSpecificData: { ownerKeyId: "my-key" } }),
    ]);
    expect(await getBareModelFailoverTargets("crow-uncensored:free", { clientKeyId: "my-key" })).toEqual([
      "crowllm/crow-uncensored:free",
    ]);
  });
});
