import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import {
  createDashboardAuthToken,
  getDashboardAuthSession,
} from "../../src/lib/auth/dashboardSession.js";
import { createApiKey, deleteApiKey } from "../../src/lib/db/repos/apiKeysRepo.js";
import { proxy } from "../../src/dashboardGuard.js";

describe("Master vs Client dashboard session & guard", () => {
  const createdIds = [];

  beforeEach(async () => {
    while (createdIds.length) {
      const id = createdIds.pop();
      await deleteApiKey(id).catch(() => {});
    }
  });

  it("encodes and verifies client session claims", async () => {
    const key = await createApiKey("Client Test", "machine-test-12345678", [], {
      clientEmail: "client@test.com",
    });
    createdIds.push(key.id);

    const token = await createDashboardAuthToken({
      role: "client",
      apiKeyId: key.id,
      apiKey: key.key,
      clientEmail: key.clientEmail,
    });

    const session = await getDashboardAuthSession(token);
    expect(session.role).toBe("client");
    expect(session.apiKeyId).toBe(key.id);
    expect(session.clientEmail).toBe("client@test.com");
  });

  it("blocks client sessions from Master-only API routes (/api/keys, /api/proxy-pools, /api/combos) while allowing /api/providers, /api/usage, /api/settings", async () => {
    const key = await createApiKey("Client Test", "machine-test-12345678", [], {
      clientEmail: "client@test.com",
    });
    createdIds.push(key.id);

    const clientToken = await createDashboardAuthToken({
      role: "client",
      apiKeyId: key.id,
      apiKey: key.key,
      clientEmail: key.clientEmail,
    });

    const makeReq = (pathname, token = clientToken) =>
      new NextRequest(`http://example.com${pathname}`, {
        headers: {
          cookie: `auth_token=${token}`,
          "x-9r-via-proxy": "1",
        },
      });

    // Master-only routes blocked with 403 for clients
    const keysRes = await proxy(makeReq("/api/keys"));
    expect(keysRes.status).toBe(403);

    const poolsRes = await proxy(makeReq("/api/proxy-pools"));
    expect(poolsRes.status).toBe(403);

    const combosRes = await proxy(makeReq("/api/combos"));
    expect(combosRes.status).toBe(403);

    // Client-allowed routes pass through (200 next)
    const providersRes = await proxy(makeReq("/api/providers"));
    expect(providersRes.status).toBe(200);

    const usageRes = await proxy(makeReq("/api/usage/stats"));
    expect(usageRes.status).toBe(200);

    const settingsRes = await proxy(makeReq("/api/settings"));
    expect(settingsRes.status).toBe(200);

    // Master session allowed everywhere
    const masterToken = await createDashboardAuthToken({ role: "master" });
    const masterKeysRes = await proxy(makeReq("/api/keys", masterToken));
    expect(masterKeysRes.status).toBe(200);
  });
});
