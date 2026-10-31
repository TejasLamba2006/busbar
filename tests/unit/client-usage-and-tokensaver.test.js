import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const routeMocks = vi.hoisted(() => ({
  cookies: vi.fn(),
  getDashboardAuthSession: vi.fn(),
  json: vi.fn((body, init) => ({ body, status: init?.status || 200, headers: init?.headers })),
}));

vi.mock("next/headers", () => ({ cookies: routeMocks.cookies }));
vi.mock("next/server", () => ({ NextResponse: { json: routeMocks.json } }));
vi.mock("@/lib/auth/dashboardSession", () => ({
  getDashboardAuthSession: routeMocks.getDashboardAuthSession,
}));
vi.mock("@/lib/network/outboundProxy", () => ({ applyOutboundProxyEnv: vi.fn() }));
vi.mock("open-sse/services/combo.js", () => ({ resetComboRotation: vi.fn() }));

const originalDataDir = process.env.DATA_DIR;
let tempDir;
let db;
let settingsRoute;
let clientKey;

beforeAll(async () => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "9router-client-isolation-"));
  process.env.DATA_DIR = tempDir;
  delete global._dbAdapter;
  vi.resetModules();
  db = await import("@/lib/db/index.js");
  settingsRoute = await import("../../src/app/api/settings/route.js");
  await db.initDb();
  clientKey = await db.createApiKey("Client A", "client-a-machine-123456", [], {
    clientEmail: "client-a@example.com",
  });
});

afterAll(() => {
  delete global._dbAdapter;
  if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true });
  if (originalDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = originalDataDir;
});

beforeEach(() => {
  vi.clearAllMocks();
  routeMocks.cookies.mockResolvedValue({ get: vi.fn(() => ({ value: "client-session" })) });
  routeMocks.getDashboardAuthSession.mockResolvedValue({
    role: "client",
    apiKeyId: clientKey.id,
    apiKey: clientKey.key,
  });
});

describe("per-client usage isolation", () => {
  it("filters usage history and every stats aggregate by apiKey", async () => {
    const now = Date.now();
    await db.saveRequestUsage({
      timestamp: new Date(now - 3000).toISOString(),
      provider: "openai",
      model: "client-a-model",
      connectionId: "client-a-connection",
      apiKey: clientKey.key,
      endpoint: "/v1/chat/completions",
      tokens: { prompt_tokens: 10, completion_tokens: 2, cached_tokens: 3 },
    });
    await db.saveRequestUsage({
      timestamp: new Date(now - 2000).toISOString(),
      provider: "anthropic",
      model: "client-b-model",
      connectionId: "client-b-connection",
      apiKey: "sk-client-b",
      endpoint: "/v1/messages",
      tokens: { prompt_tokens: 100, completion_tokens: 20 },
    });
    await db.saveRequestUsage({
      timestamp: new Date(now - 1000).toISOString(),
      provider: "google",
      model: "master-model",
      connectionId: "master-connection",
      endpoint: "/v1/chat/completions",
      tokens: { prompt_tokens: 1000, completion_tokens: 200 },
    });

    const history = await db.getUsageHistory({ apiKey: clientKey.key });
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ provider: "openai", model: "client-a-model" });

    const stats = await db.getUsageStats("all", { apiKey: clientKey.key });
    expect(stats.totalRequests).toBe(1);
    expect(stats.totalPromptTokens).toBe(10);
    expect(stats.totalCompletionTokens).toBe(2);
    expect(stats.totalCachedTokens).toBe(3);
    expect(Object.keys(stats.byProvider)).toEqual(["openai"]);
    expect(Object.values(stats.byModel).map((entry) => entry.rawModel)).toEqual(["client-a-model"]);
    expect(Object.values(stats.byAccount).map((entry) => entry.connectionId)).toEqual(["client-a-connection"]);
    expect(Object.values(stats.byApiKey)).toHaveLength(1);
    expect(Object.values(stats.byEndpoint).map((entry) => entry.endpoint)).toEqual(["/v1/chat/completions"]);
    expect(stats.recentRequests.map((entry) => entry.model)).toEqual(["client-a-model"]);
  });
});

describe("client token saver settings route", () => {
  it("GET overlays per-key settings without exposing global settings", async () => {
    await db.updateSettings({
      rtkEnabled: false,
      cavemanLevel: "full",
      customPrompt: "global prompt",
      requireApiKey: true,
      password: "secret-hash",
    });
    await db.updateApiKey(clientKey.id, {
      tokenSaverSettings: { rtkEnabled: true, customPrompt: "client prompt" },
    });

    const response = await settingsRoute.GET();

    expect(response.body).toMatchObject({
      isClientSession: true,
      rtkEnabled: true,
      cavemanLevel: "full",
      customPrompt: "client prompt",
    });
    expect(response.body).not.toHaveProperty("password");
    expect(response.body).not.toHaveProperty("requireApiKey");
  });

  it("PATCH updates only apiKeys.tokenSaverSettings and leaves global settings untouched", async () => {
    await db.updateSettings({ rtkEnabled: false, customPrompt: "master prompt", requireApiKey: true });
    const globalBefore = await db.getSettings();

    const response = await settingsRoute.PATCH({
      json: async () => ({
        rtkEnabled: true,
        customPromptEnabled: true,
        customPrompt: "client-only prompt",
        requireApiKey: false,
        password: "overwrite-attempt",
      }),
    });

    expect(response.body).toMatchObject({
      isClientSession: true,
      rtkEnabled: true,
      customPromptEnabled: true,
      customPrompt: "client-only prompt",
    });
    const keyRecord = await db.getApiKeyById(clientKey.id);
    expect(keyRecord.tokenSaverSettings).toMatchObject({
      rtkEnabled: true,
      customPromptEnabled: true,
      customPrompt: "client-only prompt",
    });
    expect(await db.getSettings()).toEqual(globalBefore);
  });
});
