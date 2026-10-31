import fs from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  session: null,
  connections: [],
  json: vi.fn((body, init = {}) => new Response(JSON.stringify(body), {
    status: init.status || 200,
    headers: { "Content-Type": "application/json" },
  })),
  cookies: vi.fn(),
  getDashboardAuthSession: vi.fn(),
  getApiKeyById: vi.fn(),
  getApiKeyByKey: vi.fn(),
  getProviderConnections: vi.fn(),
  getProviderConnectionById: vi.fn(),
  createProviderConnection: vi.fn(),
  updateProviderConnection: vi.fn(),
  deleteProviderConnection: vi.fn(),
  testSingleConnection: vi.fn(),
  resolveConnectionProxyConfig: vi.fn(),
}));

vi.mock("next/server", () => ({ NextResponse: { json: mocks.json } }));
vi.mock("next/headers", () => ({ cookies: mocks.cookies }));
vi.mock("@/lib/auth/dashboardSession", () => ({
  getDashboardAuthSession: mocks.getDashboardAuthSession,
}));
vi.mock("@/models", () => ({
  getProviderConnections: mocks.getProviderConnections,
  getProviderConnectionById: mocks.getProviderConnectionById,
  createProviderConnection: mocks.createProviderConnection,
  updateProviderConnection: mocks.updateProviderConnection,
  deleteProviderConnection: mocks.deleteProviderConnection,
  getProviderNodeById: vi.fn(),
  getProviderNodes: vi.fn().mockResolvedValue([]),
  getProxyPoolById: vi.fn(),
}));
vi.mock("@/app/api/providers/[id]/test/testUtils.js", () => ({
  testSingleConnection: mocks.testSingleConnection,
}));
vi.mock("@/lib/localDb", () => ({
  getProviderConnections: mocks.getProviderConnections,
  getProviderConnectionById: mocks.getProviderConnectionById,
  getApiKeyById: mocks.getApiKeyById,
  getApiKeyByKey: mocks.getApiKeyByKey,
  getSettings: vi.fn().mockResolvedValue({}),
  getProxyPools: vi.fn().mockResolvedValue([]),
  getProviderNodes: vi.fn().mockResolvedValue([]),
  getCombos: vi.fn().mockResolvedValue([]),
  getCustomModels: vi.fn().mockResolvedValue([]),
  getModelAliases: vi.fn().mockResolvedValue({}),
  validateApiKey: vi.fn(),
  updateProviderConnection: mocks.updateProviderConnection,
}));
vi.mock("@/lib/network/connectionProxy", () => ({
  resolveConnectionProxyConfig: mocks.resolveConnectionProxyConfig,
  pickProxyPoolId: vi.fn(),
}));
vi.mock("@/lib/disabledModelsDb", () => ({ getDisabledModels: vi.fn().mockResolvedValue({}) }));
vi.mock("@/sse/services/modelVisibility.js", () => ({ getDisabledModelIds: vi.fn().mockResolvedValue([]) }));
vi.mock("@/lib/modelCatalog/liveCatalogs.js", () => ({
  getLiveCatalogSnapshot: vi.fn().mockResolvedValue({ catalogs: new Map(), missing: [] }),
  requestLiveCatalogRefresh: vi.fn(),
}));
vi.mock("@/sse/utils/logger.js", () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn() }));

const providersRoute = await import("@/app/api/providers/route.js");
const providerRoute = await import("@/app/api/providers/[id]/route.js");
const providerTestRoute = await import("@/app/api/providers/[id]/test/route.js");
const { getProviderCredentials } = await import("@/sse/services/auth.js");
const modelsRoute = await import("@/app/api/v1/models/route.js");

const client = {
  role: "client",
  apiKeyId: "client-key-1",
  apiKey: "sk-client-1",
  clientEmail: "client@email.com",
};
const clientKey = {
  id: client.apiKeyId,
  key: client.apiKey,
  clientEmail: client.clientEmail,
  access: { restricted: true, allow: ["openai/*"] },
};
const masterConnection = {
  id: "master-openai",
  provider: "openai",
  authType: "apikey",
  name: "Master",
  isActive: true,
  apiKey: "master-secret",
  providerSpecificData: {},
};
const ownConnection = {
  id: "client-openai",
  provider: "openai",
  authType: "apikey",
  name: "Client: client@email.com - Personal",
  email: client.clientEmail,
  isActive: false,
  apiKey: "client-secret",
  providerSpecificData: {
    ownerKeyId: client.apiKeyId,
    ownerEmail: client.clientEmail,
    clientActive: true,
  },
};
const otherConnection = {
  ...ownConnection,
  id: "other-openai",
  email: "other@email.com",
  apiKey: "other-secret",
  providerSpecificData: {
    ownerKeyId: "client-key-2",
    ownerEmail: "other@email.com",
    clientActive: true,
  },
};

function request(method, path, body) {
  return new Request(`https://busbar.local${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

async function body(response) {
  return response.json();
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.session = null;
  mocks.connections = [masterConnection, ownConnection, otherConnection];
  mocks.cookies.mockResolvedValue({ get: vi.fn(() => ({ value: "dashboard-token" })) });
  mocks.getDashboardAuthSession.mockImplementation(() => Promise.resolve(mocks.session));
  mocks.getApiKeyById.mockImplementation((id) => Promise.resolve(id === client.apiKeyId ? clientKey : null));
  mocks.getApiKeyByKey.mockImplementation((key) => Promise.resolve(key === client.apiKey ? clientKey : null));
  mocks.getProviderConnections.mockImplementation((filter = {}) => Promise.resolve(
    mocks.connections.filter((connection) =>
      (!filter.provider || connection.provider === filter.provider)
      && (filter.isActive === undefined || connection.isActive === filter.isActive)),
  ));
  mocks.getProviderConnectionById.mockImplementation((id) => Promise.resolve(
    mocks.connections.find((connection) => connection.id === id) || null,
  ));
  mocks.createProviderConnection.mockImplementation((data) => Promise.resolve({ id: "created", ...data }));
  mocks.updateProviderConnection.mockImplementation((id, data) => Promise.resolve({
    ...mocks.connections.find((connection) => connection.id === id),
    ...data,
  }));
  mocks.deleteProviderConnection.mockResolvedValue(true);
  mocks.testSingleConnection.mockResolvedValue({ valid: true });
  mocks.resolveConnectionProxyConfig.mockResolvedValue({});
});

describe("provider dashboard isolation", () => {
  it("stores client-created keys disabled for Master and labelled with ownership", async () => {
    mocks.session = client;

    const response = await providersRoute.POST(request("POST", "/api/providers", {
      provider: "openai",
      name: "Personal",
      apiKey: "provider-secret",
    }));

    expect(response.status).toBe(201);
    expect(mocks.createProviderConnection).toHaveBeenCalledWith(expect.objectContaining({
      name: "Client: client@email.com - Personal",
      email: client.clientEmail,
      isActive: false,
      providerSpecificData: expect.objectContaining({
        ownerKeyId: client.apiKeyId,
        ownerEmail: client.clientEmail,
        clientActive: true,
      }),
    }));
  });

  it("returns all connections unchanged to Master", async () => {
    mocks.session = { role: "master" };

    const payload = await body(await providersRoute.GET());

    expect(payload.connections.map((connection) => connection.id)).toEqual([
      masterConnection.id,
      ownConnection.id,
      otherConnection.id,
    ]);
    expect(payload.connections[1]).toMatchObject({
      email: client.clientEmail,
      isActive: false,
      providerSpecificData: expect.objectContaining({ ownerEmail: client.clientEmail }),
    });
    expect(payload.isClientSession).toBe(false);
  });

  it("returns only owning client's connections with client toggle state and assignments", async () => {
    mocks.session = client;

    const payload = await body(await providersRoute.GET());

    expect(payload.connections).toHaveLength(1);
    expect(payload.connections[0]).toMatchObject({ id: ownConnection.id, isActive: true });
    expect(payload).toMatchObject({
      isClientSession: true,
      assignedModels: clientKey.access.allow,
    });
  });

  it("keeps top-level Master activation untouched when client toggles a connection", async () => {
    mocks.session = client;

    const response = await providerRoute.PUT(
      request("PUT", `/api/providers/${ownConnection.id}`, { isActive: false }),
      { params: Promise.resolve({ id: ownConnection.id }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.updateProviderConnection).toHaveBeenCalledWith(ownConnection.id, {
      providerSpecificData: expect.objectContaining({
        ownerKeyId: client.apiKeyId,
        clientActive: false,
      }),
    });
    expect(mocks.updateProviderConnection.mock.calls[0][1]).not.toHaveProperty("isActive");
  });

  it.each([
    ["PUT", providerRoute.PUT],
    ["DELETE", providerRoute.DELETE],
    ["TEST", providerTestRoute.POST],
  ])("hides another client's connection from client %s", async (method, handler) => {
    mocks.session = client;
    const req = method === "PUT"
      ? request("PUT", `/api/providers/${otherConnection.id}`, { name: "stolen" })
      : request("POST", `/api/providers/${otherConnection.id}/test`);

    const response = await handler(req, { params: Promise.resolve({ id: otherConnection.id }) });

    expect(response.status).toBe(404);
    expect(mocks.updateProviderConnection).not.toHaveBeenCalled();
    expect(mocks.deleteProviderConnection).not.toHaveBeenCalled();
    expect(mocks.testSingleConnection).not.toHaveBeenCalled();
  });
});

describe("runtime provider routing isolation", () => {
  it("uses only the client's active owned connection despite top-level disabled state", async () => {
    const credentials = await getProviderCredentials("openai", null, "gpt-4o", {
      apiKey: client.apiKey,
    });

    expect(credentials).toMatchObject({ connectionId: ownConnection.id, apiKey: "client-secret" });
    expect(mocks.getProviderConnections).toHaveBeenCalledWith({ provider: "openai" });
  });

  it("returns no credential when only Master or another client's keys exist", async () => {
    mocks.connections = [masterConnection, otherConnection];

    await expect(getProviderCredentials("openai", null, "gpt-4o", {
      clientKeyId: client.apiKeyId,
    })).resolves.toBeNull();
  });

  it("allows assigned no-auth providers without exposing unassigned ones", async () => {
    const restrictedKey = {
      ...clientKey,
      access: { restricted: true, allow: ["opencode/some-model"] },
    };

    await expect(getProviderCredentials("opencode", null, null, {
      clientKeyRecord: restrictedKey,
    })).resolves.toMatchObject({ id: "noauth", accessToken: "public" });
    await expect(getProviderCredentials("edge-tts", null, null, {
      clientKeyRecord: restrictedKey,
    })).resolves.toBeNull();
  });

  it("uses only top-level active connections for Master routing", async () => {
    const credentials = await getProviderCredentials("openai");

    expect(credentials).toMatchObject({ connectionId: masterConnection.id, apiKey: "master-secret" });
  });

  it("does not expose restricted no-auth providers not assigned to client", async () => {
    await expect(getProviderCredentials("opencode", null, null, {
      clientKeyRecord: clientKey,
    })).resolves.toBeNull();
  });
});

describe("client models and provider catalog", () => {
  it("builds models from client-active owned connections, not Master connections", async () => {
    const models = await modelsRoute.buildModelsList(["llm"], {
      clientKeyId: client.apiKeyId,
      clientKeyRecord: clientKey,
    });

    expect(models.some((model) => model.id.startsWith("openai/"))).toBe(true);
    mocks.connections = [masterConnection, otherConnection];
    await expect(modelsRoute.buildModelsList(["llm"], {
      clientKeyId: client.apiKeyId,
      clientKeyRecord: clientKey,
    })).resolves.toEqual([]);
  });

  it("builds assigned no-auth models for a restricted client", async () => {
    mocks.connections = [masterConnection, otherConnection];
    const models = await modelsRoute.buildModelsList(["llm"], {
      clientKeyId: client.apiKeyId,
      clientKeyRecord: {
        ...clientKey,
        access: { restricted: true, allow: ["opencode/some-model"] },
      },
    });

    expect(models.some((model) => model.id.startsWith("oc/"))).toBe(true);
    expect(models.some((model) => model.id.startsWith("edge-tts/"))).toBe(false);
  });

  it("includes connected providers beyond a restricted client's assignments", async () => {
    mocks.connections = [
      { ...ownConnection, provider: "groq", id: "client-groq" },
      masterConnection,
    ];
    const response = await modelsRoute.GET(new Request("https://busbar.local/api/v1/models", {
      headers: { Authorization: `Bearer ${client.apiKey}` },
    }));
    const payload = await response.json();

    expect(payload.data.some((model) => model.id.startsWith("groq/"))).toBe(true);
    expect(payload.data.some((model) => model.id.startsWith("anthropic/"))).toBe(false);
  });

  it("filters restricted client catalog to assigned providers plus already-connected providers", () => {
    const source = fs.readFileSync(new URL("../../src/app/(dashboard)/dashboard/providers/page.js", import.meta.url), "utf8");

    expect(source).toContain("filterClientProviderEntries(");
    expect(source).toContain("assignedModels.map(providerIdFromAssignment)");
    expect(source).toContain("allowed.add(connection.provider)");
  });

  it("shows full catalog to clients without assignments", () => {
    const source = fs.readFileSync(new URL("../../src/app/(dashboard)/dashboard/providers/page.js", import.meta.url), "utf8");

    expect(source).toContain("if (!isClientSession || !assignedModels?.length) return entries");
  });
});
