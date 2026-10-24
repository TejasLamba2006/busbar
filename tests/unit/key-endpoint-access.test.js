// Per-API-key endpoint gating (allowedEndpoints).
import { describe, it, expect, vi, beforeEach } from "vitest";

const fx = vi.hoisted(() => ({ keys: {} }));

vi.mock("@/lib/localDb", () => ({
  getModelAliases: async () => ({}),
  getComboByName: async () => null,
  getProviderNodes: async () => [],
}));
vi.mock("@/lib/db/repos/combosRepo.js", () => ({ getCombos: async () => [] }));
vi.mock("@/lib/db/repos/apiKeysRepo.js", () => ({ getApiKeyByKey: async (k) => fx.keys[k] || null }));
vi.mock("@/sse/utils/logger.js", () => ({ warn: vi.fn(), info: vi.fn(), debug: vi.fn(), error: vi.fn() }));

const engine = await import("../../src/sse/services/keyAccess.js");
const helpers = await import("../../src/shared/utils/keyAccess.js");

const key = (id, allowedEndpoints) => {
  fx.keys[`sk-${id}`] = { id, name: id, isActive: true, access: { restricted: false, allow: [] }, allowedEndpoints };
};
// status of the endpoint gate for a key calling a path
async function status(k, path) {
  const ctx = await engine.getKeyAccessContext(new Request(`http://localhost${path}`, { method: "POST", headers: { Authorization: `Bearer ${k}` } }));
  const r = engine.enforceEndpointAccess(ctx);
  return r ? r.status : 200;
}
const ALL = [
  "/v1/chat/completions", "/v1/messages", "/v1/responses", "/v1/models", "/v1/embeddings",
  "/v1/images/generations", "/v1/audio/speech", "/v1/audio/transcriptions",
  "/v1/search", "/v1/web/search", "/v1/web/fetch", "/v1/rerank", "/v1/systemone",
];

beforeEach(() => {
  fx.keys = {};
  key("open", []);
  key("chat", ["chat"]);
  key("mm", ["messages", "models"]);
  key("raw", ["/v1/embeddings"]);
});

describe("endpoint gating", () => {
  it("unrestricted key yields no context and reaches every endpoint", async () => {
    const ctx = await engine.getKeyAccessContext(new Request("http://localhost/v1/messages", { headers: { Authorization: "Bearer sk-open" } }));
    expect(ctx).toBeNull();
    for (const p of ALL) expect(await status("sk-open", p)).toBe(200);
  });

  it("chat-only key: 200 on chat, 403 endpoint_not_allowed elsewhere", async () => {
    expect(await status("sk-chat", "/v1/chat/completions")).toBe(200);
    expect(await status("sk-chat", "/api/v1/chat/completions")).toBe(200); // normalized
    for (const p of ALL.filter((p) => p !== "/v1/chat/completions")) expect(await status("sk-chat", p)).toBe(403);
    const ctx = await engine.getKeyAccessContext(new Request("http://localhost/v1/embeddings", { headers: { Authorization: "Bearer sk-chat" } }));
    const res = engine.enforceEndpointAccess(ctx);
    expect(await res.json()).toEqual({ error: { message: "API key is not authorized for endpoint /v1/embeddings", type: "permission_error", code: "endpoint_not_allowed" } });
  });

  it("messages+models key: allowed there (incl. /v1/models/*), blocked on chat", async () => {
    expect(await status("sk-mm", "/v1/messages")).toBe(200);
    expect(await status("sk-mm", "/v1/models")).toBe(200);
    expect(await status("sk-mm", "/v1/models/image")).toBe(200);
    expect(await status("sk-mm", "/v1/chat/completions")).toBe(403);
    expect(await status("sk-mm", "/v1/messagesx")).toBe(403); // segment match, not substring
  });

  it("raw path entries work", async () => {
    expect(await status("sk-raw", "/v1/embeddings")).toBe(200);
    expect(await status("sk-raw", "/v1/chat/completions")).toBe(403);
  });

  it("enforceKeyAccess gates the endpoint before model checks; model gate stays open when only endpoints restricted", async () => {
    const ctx = await engine.getKeyAccessContext(new Request("http://localhost/v1/responses", { headers: { Authorization: "Bearer sk-chat" } }));
    expect((await engine.enforceKeyAccess(ctx, "openai/x")).status).toBe(403);
    const ok = await engine.getKeyAccessContext(new Request("http://localhost/v1/chat/completions", { headers: { Authorization: "Bearer sk-chat" } }));
    expect(await engine.enforceKeyAccess(ok, "openai/x")).toBeNull();
  });
});

describe("input validation", () => {
  it("accepts scope ids and /v1 paths, rejects junk", () => {
    expect(helpers.validateAllowedEndpointsInput(["chat", "/v1/rerank"]).ok).toBe(true);
    expect(helpers.validateAllowedEndpointsInput(["nope"]).ok).toBe(false);
    expect(helpers.validateAllowedEndpointsInput("chat").ok).toBe(false);
  });
});
