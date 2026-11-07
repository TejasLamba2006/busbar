import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  verifyToken: vi.fn(),
  next: Symbol("next"),
}));

vi.mock("next/server", () => ({ NextResponse: {
  next: () => mocks.next,
  json: (body, init) => ({ body, status: init?.status || 200 }),
} }));
vi.mock("@/lib/localDb", () => ({
  getSettings: async () => ({ requireLogin: false }),
  validateApiKey: async () => false,
}));
vi.mock("@/shared/utils/machineId", () => ({ getConsistentMachineId: async () => "test-cli-token" }));
vi.mock("@/lib/auth/dashboardSession", () => ({
  getRequestDashboardSession: mocks.session,
  verifyDashboardAuthToken: mocks.verifyToken,
}));
vi.mock("@/lib/auth/trustedPeer", () => ({ hasTrustedPeerHeaders: () => false }));

import { proxy } from "../../src/dashboardGuard.js";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.session.mockResolvedValue(null);
  mocks.verifyToken.mockResolvedValue(false);
});

function request(path, headers = {}) {
  return {
    nextUrl: { pathname: path },
    headers: new Headers(headers),
    cookies: { get: () => undefined },
    url: `https://router.example.com${path}`,
  };
}

for (const provider of ["minimax-code", "minimax-code-global"]) {
  describe(`${provider} desktop lease access`, () => {
    for (const action of ["lease-status", "lease-connect"]) {
      const path = `/api/oauth/${provider}/${action}`;
      it(`denies client ${action} even with CLI token`, async () => {
        mocks.session.mockResolvedValue({ role: "client", apiKeyId: "client-key" });
        const res = await proxy(request(path, { "x-9r-cli-token": "test-cli-token" }));
        expect(res.status).toBe(403);
        expect(res.body.error).toContain("Master account required");
      });
      it(`denies remote master ${action}`, async () => {
        mocks.session.mockResolvedValue({ role: "master" });
        mocks.verifyToken.mockResolvedValue(true);
        expect((await proxy(request(path))).status).toBe(403);
      });
      it(`permits trusted CLI ${action}`, async () => {
        expect(await proxy(request(path, { "x-9r-cli-token": "test-cli-token" }))).toBe(mocks.next);
      });
    }
  });
}
