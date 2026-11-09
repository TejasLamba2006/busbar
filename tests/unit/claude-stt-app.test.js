import { it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  refresh: vi.fn(),
  core: vi.fn(),
  clear: vi.fn(),
  mark: vi.fn(),
  access: vi.fn(),
  proxy: vi.fn(),
  modelInfo: vi.fn(),
}));

vi.mock("@/sse/services/auth.js", () => ({
  extractApiKey: () => null,
  isValidApiKey: vi.fn(),
  getProviderCredentials: mocks.get,
  clearAccountError: mocks.clear,
  markAccountUnavailable: mocks.mark,
}));
vi.mock("@/lib/localDb", () => ({
  getSettings: async () => ({}),
  getCustomModels: async () => [],
  getProviderNodes: async () => [],
}));
vi.mock("@/sse/services/modelVisibility.js", () => ({
  enforceModelEnabled: async () => null,
}));
vi.mock("@/sse/services/model.js", () => ({
  getModelInfo: mocks.modelInfo,
}));
vi.mock("@/sse/services/keyAccess.js", () => ({
  getKeyAccessContext: async () => ({}),
  enforceKeyAccessResolved: mocks.access,
}));
vi.mock("@/sse/services/tokenRefresh.js", () => ({
  checkAndRefreshToken: mocks.refresh,
}));
vi.mock("@/lib/network/connectionProxy.js", () => ({
  resolveConnectionProxyConfig: mocks.proxy,
}));
vi.mock("open-sse/handlers/sttCore.js", () => ({
  customNodeSttConfig: () => null,
  handleSttCore: mocks.core,
}));

import { handleStt } from "@/sse/handlers/stt.js";

const credentials = {
  authType: "oauth",
  accessToken: "initial-cc-token",
  refreshToken: "cc-refresh-token",
  connectionId: "cc-conn-1",
  connectionName: "Account 4",
  providerSpecificData: {},
};

function makeRequest(model = "cc/transcribe") {
  const form = new FormData();
  form.set("model", model);
  form.set("file", new File(["test"], "a.webm", { type: "audio/webm" }));
  return new Request("http://localhost/v1/audio/transcriptions", { method: "POST", body: form });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.modelInfo.mockImplementation(async (m) => {
    const [, mod = "transcribe"] = String(m).split("/");
    return { provider: "claude", model: mod };
  });
  mocks.get.mockResolvedValue(credentials);
  mocks.refresh.mockImplementation(async (_provider, creds, options) => ({
    ...creds,
    accessToken: options?.force ? "retried-cc-token" : "refreshed-cc-token",
  }));
  mocks.proxy.mockResolvedValue({ source: "none", strictProxy: false });
  mocks.access.mockResolvedValue(null);
  mocks.core.mockResolvedValue({ success: true, response: Response.json({ text: "hello from claude stt" }) });
});

it("refreshes Claude OAuth credentials and clears account error on success", async () => {
  const req = makeRequest("cc/transcribe");
  const res = await handleStt(req);
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ text: "hello from claude stt" });
  expect(mocks.refresh).toHaveBeenCalledWith("claude", credentials);
  expect(mocks.core.mock.calls[0][0]).toMatchObject({
    provider: "claude",
    model: "transcribe",
    credentials: { accessToken: "refreshed-cc-token" },
  });
  expect(mocks.clear).toHaveBeenCalledWith("cc-conn-1", expect.objectContaining({ accessToken: "refreshed-cc-token" }), "transcribe");
});

it("retries one 401 with forced Claude OAuth token refresh", async () => {
  mocks.core.mockResolvedValueOnce({ success: false, status: 401, error: "Claude voice stream rejected with HTTP 401" });
  const res = await handleStt(makeRequest("cc/transcribe"));
  expect(res.status).toBe(200);
  expect(mocks.refresh).toHaveBeenLastCalledWith(
    "claude",
    expect.objectContaining({ accessToken: "refreshed-cc-token" }),
    { force: true }
  );
  expect(mocks.core).toHaveBeenCalledTimes(2);
});

it("rejects non-transcribe Claude model IDs on /v1/audio/transcriptions", async () => {
  const res = await handleStt(makeRequest("cc/claude-sonnet-5-5"));
  expect(res.status).toBe(400);
  expect(await res.text()).toContain("Use model cc/transcribe for Claude STT");
  expect(mocks.get).not.toHaveBeenCalled();
});
