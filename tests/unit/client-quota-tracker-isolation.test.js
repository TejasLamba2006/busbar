import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  session: null,
  connections: [],
  cookies: vi.fn(),
  getDashboardAuthSession: vi.fn(),
  getProviderConnections: vi.fn(),
}));

vi.mock("next/headers", () => ({ cookies: mocks.cookies }));
vi.mock("@/lib/auth/dashboardSession", () => ({
  getDashboardAuthSession: mocks.getDashboardAuthSession,
}));
vi.mock("@/lib/localDb", () => ({
  getProviderConnections: mocks.getProviderConnections,
}));
vi.mock("@/lib/oauth/providers", () => ({ backfillCodexEmails: vi.fn() }));

const route = await import("@/app/api/providers/client/route.js");

beforeEach(() => {
  vi.clearAllMocks();
  mocks.cookies.mockResolvedValue({ get: vi.fn(() => ({ value: "session" })) });
  mocks.getDashboardAuthSession.mockImplementation(() => Promise.resolve(mocks.session));
  mocks.getProviderConnections.mockImplementation(() => Promise.resolve(mocks.connections));
});

describe("Quota Tracker tenant isolation", () => {
  it("returns only the logged-in client's owned accounts", async () => {
    mocks.session = { role: "client", apiKeyId: "client-a" };
    mocks.connections = [
      { id: "master", provider: "agentrouter", authType: "apikey", isActive: true, providerSpecificData: {} },
      { id: "own", provider: "agentrouter", authType: "apikey", isActive: false, providerSpecificData: { ownerKeyId: "client-a", clientActive: true } },
      { id: "other", provider: "agentrouter", authType: "apikey", isActive: false, providerSpecificData: { ownerKeyId: "client-b", clientActive: true } },
    ];

    const response = await route.GET(new Request("https://busbar.local/api/providers/client?page=1&pageSize=20"));
    const payload = await response.json();

    expect(payload.connections.map((connection) => connection.id)).toEqual(["own"]);
    expect(payload.totals.eligibleConnections).toBe(1);
    expect(payload.providerOptions).toEqual(["agentrouter"]);
  });
});
