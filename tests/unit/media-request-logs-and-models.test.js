import { describe, expect, it, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  saveRequestDetail: vi.fn().mockResolvedValue(undefined),
  saveRequestUsage: vi.fn().mockResolvedValue(undefined),
  listRequestLogRows: vi.fn(),
  getObservabilityConfigPublic: vi.fn().mockResolvedValue({ enabled: true, maxRecords: 500, maxJsonKB: 64 }),
  countRequestDetails: vi.fn().mockResolvedValue(1),
  getAdapter: vi.fn().mockResolvedValue({}),
  resolvePricing: vi.fn(),
  getSettings: vi.fn().mockResolvedValue({ requireApiKey: false }),
  getProviderCredentials: vi.fn(),
  getModelInfo: vi.fn(),
  handleSystemoneCore: vi.fn(),
  getProviderConnections: vi.fn(),
  getApiKeyByKey: vi.fn(),
  getCombos: vi.fn().mockResolvedValue([]),
  getCustomModels: vi.fn().mockResolvedValue([]),
  getProviderNodes: vi.fn().mockResolvedValue([]),
  getModelAliases: vi.fn().mockResolvedValue({}),
  getDisabledModels: vi.fn().mockResolvedValue({}),
  getKeyAccessContext: vi.fn().mockResolvedValue(null),
}));

vi.mock("next/headers", () => ({ cookies: vi.fn().mockResolvedValue({ get: () => undefined }) }));
vi.mock("@/lib/auth/dashboardSession", () => ({ getDashboardAuthSession: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/usageDb.js", () => ({
  saveRequestDetail: mocks.saveRequestDetail,
  saveRequestUsage: mocks.saveRequestUsage,
}));
vi.mock("@/lib/db/repos/requestDetailsRepo.js", async (importOriginal) => ({
  ...(await importOriginal()),
  listRequestLogRows: mocks.listRequestLogRows,
  getObservabilityConfigPublic: mocks.getObservabilityConfigPublic,
  countRequestDetails: mocks.countRequestDetails,
}));
vi.mock("@/lib/db/driver.js", () => ({ getAdapter: mocks.getAdapter }));
vi.mock("@/lib/db/repos/pricingRepo.js", () => ({
  createPricingResolver: async () => mocks.resolvePricing,
}));
vi.mock("@/lib/localDb", () => ({
  getSettings: mocks.getSettings,
  getProviderCredentials: mocks.getProviderCredentials,
  getProviderConnections: mocks.getProviderConnections,
  getProviderNodes: mocks.getProviderNodes,
  getCombos: mocks.getCombos,
  getCustomModels: mocks.getCustomModels,
  getModelAliases: mocks.getModelAliases,
  getApiKeyById: vi.fn(),
  getApiKeyByKey: mocks.getApiKeyByKey,
}));
vi.mock("@/lib/db/repos/combosRepo.js", async (importOriginal) => ({
  ...(await importOriginal()),
  getCombos: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/lib/disabledModelsDb", () => ({ getDisabledModels: mocks.getDisabledModels }));
vi.mock("@/lib/modelCatalog/liveCatalogs.js", () => ({
  getLiveCatalogSnapshot: vi.fn().mockResolvedValue({ catalogs: new Map(), missing: [] }),
  requestLiveCatalogRefresh: vi.fn(),
}));
vi.mock("@/sse/services/modelVisibility.js", () => ({
  getDisabledModelIds: vi.fn().mockResolvedValue([]),
  enforceModelEnabled: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/sse/utils/logger.js", () => ({
  request: vi.fn(), debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), maskKey: vi.fn(),
}));
vi.mock("../../src/sse/utils/logger.js", () => ({
  request: vi.fn(), debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), maskKey: vi.fn(),
}));
vi.mock("../../src/sse/services/auth.js", () => ({
  getProviderCredentials: mocks.getProviderCredentials,
  markAccountUnavailable: vi.fn(),
  clearAccountError: vi.fn().mockResolvedValue(undefined),
  extractApiKey: () => null,
  isValidApiKey: vi.fn(),
}));
vi.mock("../../src/sse/services/model.js", () => ({
  getModelInfo: mocks.getModelInfo,
  getComboModels: async () => null,
}));
vi.mock("../../src/sse/services/keyAccess.js", async (importOriginal) => ({
  ...(await importOriginal()),
  getKeyAccessContext: mocks.getKeyAccessContext,
  enforceKeyAccessResolved: vi.fn().mockResolvedValue(null),
  enforceEndpointAccess: vi.fn().mockReturnValue(null),
}));
vi.mock("../../src/sse/services/tokenRefresh.js", () => ({
  checkAndRefreshToken: async (_provider, credentials) => credentials,
  updateProviderCredentials: vi.fn(),
}));
vi.mock("../../open-sse/handlers/systemoneCore.js", () => ({
  handleSystemoneCore: mocks.handleSystemoneCore,
}));

import { getProviderAlias, resolveProviderId } from "@/shared/constants/providers";
const { GET: requestLogGET } = await import("../../src/app/api/usage/request-log/route.js");
const { handleSystemone } = await import("../../src/sse/handlers/systemone.js");
const { buildModelsList, GET: modelsGET } = await import("../../src/app/api/v1/models/route.js");

// Pricing shape used by open-sse/providers/pricing.js for jev-latest: $0.20 per 1M input and output.
const JEV_RATES = { input: 0.2, output: 0.2, cached: 0.02, reasoning: 0.2, cache_creation: 0.2 };
const TS = getProviderAlias("typesafe");
const OA = getProviderAlias("openai");

const baseRow = {
  timestamp: new Date().toISOString(),
  status: "success",
  total: 100,
  ttft: 0,
  promptTokens: 0,
  completionTokens: 0,
  cachedTokens: 0,
  reasoningTokens: 0,
  cacheCreationTokens: 0,
  reqType: "object",
  msgType: null,
  reqTrunc: null,
  messages: null,
  reqState: null,
  reqPrompt: null,
  reqInput: null,
  reqQuery: null,
  reqUrl: null,
  mediaCost: null,
};

describe("/api/usage/request-log GET: preview, hasPayload, cost", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAdapter.mockResolvedValue({});
    mocks.resolvePricing.mockImplementation((_db, provider, model) =>
      provider === "typesafe" && model === "jev-latest" ? JEV_RATES : null
    );
  });

  it("returns preview, hasPayload and token-priced cost for SystemOne jev-latest", async () => {
    mocks.listRequestLogRows.mockResolvedValue({
      totalItems: 1,
      rows: [{
        ...baseRow,
        id: "sys1",
        provider: "typesafe",
        model: "jev-latest",
        connectionId: "conn-ts",
        promptTokens: 1_000_000,
        completionTokens: 500_000,
        reqState: "Payment failed for three days",
      }],
    });

    const res = await requestLogGET(new Request("http://localhost/api/usage/request-log"));
    const json = await res.json();
    const [item] = json.items;

    expect(item.preview).toBe("Payment failed for three days");
    expect(item.hasPayload).toBe(true);
    expect(item.promptTokens).toBe(1_000_000);
    expect(item.completionTokens).toBe(500_000);
    // 1M in * $0.20/1M + 0.5M out * $0.20/1M = $0.30
    expect(item.cost).toBeCloseTo(0.3, 10);
  });

  it("returns preview for image rows from reqPrompt and uses mediaCost when present", async () => {
    mocks.listRequestLogRows.mockResolvedValue({
      totalItems: 1,
      rows: [{
        ...baseRow,
        id: "img1",
        provider: "codex",
        model: "gpt-6-sol-image",
        connectionId: "conn-cx",
        reqPrompt: "draw a futuristic busbar",
        mediaCost: 0.042,
      }],
    });

    const res = await requestLogGET(new Request("http://localhost/api/usage/request-log"));
    const [item] = (await res.json()).items;

    expect(item.preview).toBe("draw a futuristic busbar");
    expect(item.hasPayload).toBe(true);
    expect(item.cost).toBe(0.042);
    expect(mocks.resolvePricing).not.toHaveBeenCalled();
  });

  it("returns preview for embedding rows from reqInput", async () => {
    mocks.listRequestLogRows.mockResolvedValue({
      totalItems: 1,
      rows: [{
        ...baseRow,
        id: "emb1",
        provider: "openai",
        model: "text-embedding-3-small",
        connectionId: "conn-oa",
        promptTokens: 8,
        reqInput: "hello embeddings",
      }],
    });

    const res = await requestLogGET(new Request("http://localhost/api/usage/request-log"));
    const [item] = (await res.json()).items;

    expect(item.preview).toBe("hello embeddings");
    expect(item.hasPayload).toBe(true);
  });

  it("uses mediaCost fallback for web search rows with reqQuery and no token pricing", async () => {
    mocks.listRequestLogRows.mockResolvedValue({
      totalItems: 1,
      rows: [{
        ...baseRow,
        id: "srch1",
        provider: "exa",
        model: "exa-search",
        connectionId: "conn-exa",
        reqQuery: "busbar gateway release notes",
        mediaCost: 0.005,
      }],
    });

    const res = await requestLogGET(new Request("http://localhost/api/usage/request-log"));
    const [item] = (await res.json()).items;

    expect(item.preview).toBe("busbar gateway release notes");
    expect(item.cost).toBe(0.005);
  });

  it("reports hasPayload false when no payload columns remain on a truncated row", async () => {
    mocks.listRequestLogRows.mockResolvedValue({
      totalItems: 1,
      rows: [{ ...baseRow, id: "empty1", provider: "openai", model: "gpt-x", reqType: "object", reqTrunc: 1 }],
    });

    const res = await requestLogGET(new Request("http://localhost/api/usage/request-log"));
    const [item] = (await res.json()).items;

    expect(item.hasPayload).toBe(false);
    expect(item.preview).toBe("");
  });
});

describe("handleSystemone saves request detail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSettings.mockResolvedValue({ requireApiKey: false });
    mocks.getModelInfo.mockResolvedValue({ provider: "typesafe", model: "jev-latest" });
    mocks.getProviderCredentials.mockResolvedValue({
      accessToken: "tok",
      connectionId: "conn-ts",
      connectionName: "TS A",
    });
    mocks.saveRequestUsage.mockResolvedValue(undefined);
  });

  it("records state, questions, response, tokens and latency via saveRequestDetail", async () => {
    mocks.handleSystemoneCore.mockImplementation(async () => ({
      success: true,
      response: Response.json({ decision: "yes" }),
      usage: { prompt_tokens: 120, completion_tokens: 15, total_tokens: 135 },
    }));

    const body = {
      model: "typesafe/jev-latest",
      state: "Payment failed for three days",
      questions: { q1: { type: "noul", instructions: "Is this a ping?" } },
    };
    const res = await handleSystemone(new Request("http://localhost/v1/systemone", {
      method: "POST",
      body: JSON.stringify(body),
    }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ decision: "yes" });
    expect(mocks.saveRequestDetail).toHaveBeenCalledTimes(1);
    const detail = mocks.saveRequestDetail.mock.calls[0][0];
    expect(detail).toMatchObject({
      provider: "typesafe",
      model: "jev-latest",
      connectionId: "conn-ts",
      status: "success",
      tokens: { prompt_tokens: 120, completion_tokens: 15, total_tokens: 135 },
      latency: { ttft: 0, total: expect.any(Number) },
      request: {
        model: "typesafe/jev-latest",
        state: "Payment failed for three days",
        questions: { q1: { type: "noul", instructions: "Is this a ping?" } },
      },
      response: { decision: "yes" },
    });
    expect(detail.latency.total).toBeGreaterThanOrEqual(0);
    expect(mocks.saveRequestUsage).toHaveBeenCalledTimes(1);
  });

  it("rejects requests missing state without saving request detail", async () => {
    const res = await handleSystemone(new Request("http://localhost/v1/systemone", {
      method: "POST",
      body: JSON.stringify({ model: "typesafe/jev-latest", questions: {} }),
    }));

    expect(res.status).toBe(400);
    expect(mocks.saveRequestDetail).not.toHaveBeenCalled();
    expect(mocks.handleSystemoneCore).not.toHaveBeenCalled();
  });
});

describe("buildModelsList and /v1/models key isolation", () => {
  const masterConnection = { id: "c-ts", provider: "typesafe", isActive: true, providerSpecificData: {} };
  const clientConnection = {
    id: "c-client",
    provider: "openai",
    isActive: true,
    providerSpecificData: { ownerKeyId: "client-key-1", clientActive: true },
  };

  beforeEach(() => {
    mocks.getModelInfo.mockImplementation(async (id) => {
      const slash = String(id).indexOf("/");
      if (slash <= 0) return null;
      return { provider: resolveProviderId(id.slice(0, slash)), model: id.slice(slash + 1) };
    });
    vi.clearAllMocks();
    mocks.getProviderConnections.mockResolvedValue([masterConnection, clientConnection]);
    mocks.getKeyAccessContext.mockResolvedValue(null);
  });

  const masterKey = { id: "master-key-1", clientEmail: null, name: "master" };
  const restrictedMasterKey = {
    id: "master-key-2",
    clientEmail: null,
    name: "restricted master",
    access: { restricted: true, allow: ["ts/*"] },
  };
  const clientKey = {
    id: "client-key-1",
    clientEmail: "client@email.com",
    name: "client",
    access: { restricted: false },
  };

  const ownersOf = (data) => new Set(data.map((m) => m.owned_by));

  it("buildModelsList with unrestricted Master key (clientEmail null) includes Master provider models", async () => {
    const models = await buildModelsList(["llm", "systemone"], { clientKeyRecord: masterKey });
    const owners = ownersOf(models);
    expect(owners.has(TS)).toBe(true);
    // Master key must not be treated as a client key: no client-owned connection leaks in.
    expect(owners.has(OA)).toBe(true);
  });

  it("/v1/models GET with unrestricted Master key returns Master connections' models", async () => {
    mocks.getApiKeyByKey.mockResolvedValue(masterKey);
    const res = await modelsGET(new Request("http://localhost/v1/models", {
      headers: { Authorization: "Bearer sk-master" },
    }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.object).toBe("list");
    expect(json.data.some((m) => m.owned_by === TS)).toBe(true);
  });

  it("/v1/models GET with restricted Master key returns only allowed Master models", async () => {
    mocks.getApiKeyByKey.mockResolvedValue(restrictedMasterKey);
    const res = await modelsGET(new Request("http://localhost/v1/models", {
      headers: { Authorization: "Bearer sk-master-restricted" },
    }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.data.length).toBeGreaterThan(0);
    for (const m of json.data) {
      expect(m.owned_by).toBe(TS);
    }
    expect(json.data.some((m) => m.owned_by === OA)).toBe(false);
  });

  it("/v1/models GET with client key isolates to that client's connections only", async () => {
    mocks.getApiKeyByKey.mockResolvedValue(clientKey);
    const res = await modelsGET(new Request("http://localhost/v1/models", {
      headers: { Authorization: "Bearer sk-client-1" },
    }));
    const json = await res.json();
    expect(res.status).toBe(200);
    const owners = ownersOf(json.data);
    expect(owners.has(OA)).toBe(true);
    expect(owners.has(TS)).toBe(false);
  });
});
