import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const stubs = vi.hoisted(() => ({ calls: [] }));

vi.mock("open-sse/utils/proxyFetch.js", () => ({
  proxyAwareFetch: async (url, options, proxyOptions) => {
    stubs.calls.push({ url: String(url), options, proxyOptions });
    if (String(url).includes("fetchAvailableModels")) {
      return Response.json({
        models: {
          "gemini-3.8-flash-high": { displayName: "Gemini 3.8 Flash (High)", isInternal: false },
          "gemini-3.1-flash-image": { displayName: "Gemini 3.1 Flash Image", isInternal: false },
          "chat-internal": { displayName: "Internal", isInternal: true },
        },
        agentModelSorts: [{ groups: [{ modelIds: ["gemini-3.8-flash-high"] }] }],
      });
    }
    return Response.json({ data: [{ id: "claude-opus-5-5", display_name: "Claude Opus 5.5" }] });
  },
}));

const originalDataDir = process.env.DATA_DIR;
let GET;
let createProviderConnection;

beforeAll(async () => {
  process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "9router-provider-model-auth-"));
  vi.resetModules();
  ({ GET } = await import("@/app/api/providers/[id]/models/route.js"));
  ({ createProviderConnection } = await import("@/models/index.js"));
});

beforeEach(() => { stubs.calls.length = 0; });

afterAll(() => {
  try { global._dbAdapter?.instance?.close?.(); } catch {}
  delete global._dbAdapter;
  fs.rmSync(process.env.DATA_DIR, { recursive: true, force: true });
  if (originalDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = originalDataDir;
});

async function getModels(connectionId) {
  return GET(new Request(`http://localhost/api/providers/${connectionId}/models`), {
    params: Promise.resolve({ id: connectionId }),
  });
}

describe("provider model listing authentication", () => {
  it("uses Bearer authentication for Claude OAuth model listing", async () => {
    const connection = await createProviderConnection({
      provider: "claude",
      authType: "oauth",
      accessToken: "oauth-secret",
      name: "claude-oauth",
      testStatus: "active",
    });

    const response = await getModels(connection.id);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.models).toMatchObject([{ id: "claude-opus-5-5", name: "Claude Opus 5.5" }]);
    expect(stubs.calls[0].options.headers.Authorization).toBe("Bearer oauth-secret");
    expect(stubs.calls[0].options.headers).not.toHaveProperty("x-api-key");
    expect(JSON.stringify(body)).not.toContain("oauth-secret");
  });

  it("loads only recommended Antigravity agent models", async () => {
    const connection = await createProviderConnection({
      provider: "antigravity",
      authType: "oauth",
      accessToken: "antigravity-secret",
      name: "antigravity-oauth",
      projectId: "project-1",
      testStatus: "active",
    });

    const response = await getModels(connection.id);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.models).toMatchObject([{ id: "gemini-3.8-flash-high", name: "Gemini 3.8 Flash (High)" }]);
    expect(stubs.calls[0].url).toContain("v1internal:fetchAvailableModels");
    expect(stubs.calls[0].options.headers.Authorization).toBe("Bearer antigravity-secret");
    expect(JSON.parse(stubs.calls[0].options.body)).toEqual({ project: "project-1" });
    expect(JSON.stringify(body)).not.toContain("antigravity-secret");
  });
});
