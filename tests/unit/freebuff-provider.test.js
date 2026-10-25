import { describe, it, expect, vi, beforeEach } from "vitest";

const { proxyFetchMock } = vi.hoisted(() => ({ proxyFetchMock: vi.fn() }));
vi.mock("open-sse/utils/proxyFetch.js", async (orig) => ({
  ...(await orig()),
  proxyAwareFetch: (...a) => proxyFetchMock(...a),
}));

const { PROVIDERS } = await import("open-sse/config/providers.js");
const { AI_PROVIDERS, ALIAS_TO_ID } = await import("@/shared/constants/providers.js");
const { FreebuffExecutor, resetFreebuffForTests, withBuffySystem } = await import("open-sse/executors/freebuff.js");
const registry = (await import("open-sse/providers/registry/freebuff.js")).default;
const svcMod = await import("open-sse/services/freebuffModels.js");
const freebuffOauth = (await import("@/lib/oauth/providers/freebuff.js")).default;

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

let fetchMock;
const CATALOG = {
  protocol: 1, version: "v", issuedAt: 5, refreshAt: 9, plansUrl: "x", fetchId: "fetch-1",
  rows: [
    { key: "m-aaaa", handle: "fbm1.glm", displayName: "GLM 5.3 Flash", access: "open", legacyDigests: [svcMod.legacyDigest("z-ai/glm-5.3-flash")] },
    { key: "m-bbbb", handle: "fbm1.sol", displayName: "GPT-6.1 Sol", access: "locked" },
    { key: "m-cccc", handle: "fbm1.new", displayName: "Brand New", access: "open" },
    { key: "m-dddd", handle: "fbm1.soon", displayName: "Soon", access: "open", opensAt: 99 },
  ],
};

beforeEach(() => {
  resetFreebuffForTests();
  svcMod.resetFreebuffModelsForTests();
  proxyFetchMock.mockReset();
  fetchMock = vi.fn(async (url) => {
    const u = String(url);
    if (u.endsWith("/freebuff/models")) return json(CATALOG);
    if (u.endsWith("/session/admission")) return json({ status: "active", instanceId: "cli:abc", expiresAt: new Date(Date.now() + 3600e3).toISOString() });
    if (u.endsWith("/agent-runs")) return json({ runId: "run-1" });
    return json({});
  });
  vi.stubGlobal("fetch", fetchMock);
});

describe("freebuff registry", () => {
  it("registers with alias fb, a unique slug id per model, and a risk warning", () => {
    expect(AI_PROVIDERS.freebuff).toBeDefined();
    expect(PROVIDERS.freebuff).toBeDefined();
    expect(ALIAS_TO_ID.fb).toBe("freebuff");
    expect(new Set(registry.models.map((m) => m.id)).size).toBe(registry.models.length);
    expect(registry.models.length).toBeGreaterThan(40);
    expect(registry.display.deprecated).toBe(true);
    expect(registry.display.deprecationNotice).not.toContain("—");
  });
});

describe("FreebuffExecutor", () => {
  const creds = { accessToken: "tok-1" };
  const args = { model: "glm-5.3-flash", body: { messages: [{ role: "user", content: "hi" }] }, stream: false, credentials: creds };

  it("admits a session, starts a run, and injects codebuff_metadata + bearer", async () => {
    proxyFetchMock.mockResolvedValue(json({ ok: true }));
    const { response } = await new FreebuffExecutor().execute(args);
    expect(response.status).toBe(200);
    const adm = fetchMock.mock.calls.find((c) => String(c[0]).endsWith("/session/admission"));
    expect(adm[1].headers["x-freebuff-model"]).toBe("fbm1.glm");
    expect(adm[1].headers["x-freebuff-catalog-fetch"]).toBe("fetch-1");
    expect(adm[1].headers.Authorization).toBe("Bearer tok-1");
    const run = fetchMock.mock.calls.find((c) => String(c[0]).endsWith("/agent-runs"));
    expect(JSON.parse(run[1].body).agentId).toBe("base3-free-catalog");
    const [url, init] = proxyFetchMock.mock.calls[0];
    expect(String(url)).toBe("https://www.codebuff.com/api/v1/chat/completions");
    expect(init.headers.Authorization).toBe("Bearer tok-1");
    expect(init.headers["x-freebuff-sse-gzip-recovery"]).toBe("1");
    expect(init.headers["x-freebuff-catalog-fetch"]).toBe("fetch-1");
    const body = JSON.parse(init.body);
    expect(body.model).toBe("fbm1.glm");
    expect(body.messages[0]).toEqual({ role: "system", content: "You are Buffy, the coding agent behind Codebuff." });
    expect(body.codebuff_metadata).toMatchObject({ run_id: "run-1", cost_mode: "free", freebuff_instance_id: "cli:abc" });
  });

  it("accepts legacy model ids, rejects locked or unknown ones", async () => {
    proxyFetchMock.mockResolvedValue(json({ ok: true }));
    const ex = new FreebuffExecutor();
    expect((await ex.execute({ ...args, model: "z-ai/glm-5.3-flash" })).response.status).toBe(200);
    expect((await ex.execute({ ...args, model: "gpt-6.1-sol" })).response.status).toBe(404);
    expect((await ex.execute({ ...args, model: "soon" })).response.status).toBe(404);
    expect((await ex.execute({ ...args, model: "brand-new" })).response.status).toBe(200);
  });

  it("releases the held session on 409 purchase_capacity and re-admits", async () => {
    let n = 0;
    fetchMock.mockImplementation(async (url, init) => {
      const u = String(url);
      if (u.endsWith("/freebuff/models")) return json(CATALOG);
      if (u.endsWith("/session/admission")) return n++ === 0 ? json({ status: "purchase_capacity", currentInstanceId: "cli:old" }, 409) : json({ status: "active", instanceId: "cli:new" });
      if (u.endsWith("/agent-runs")) return json({ runId: "r2" });
      return json({});
    });
    proxyFetchMock.mockResolvedValue(json({ ok: true }));
    expect((await new FreebuffExecutor().execute(args)).response.status).toBe(200);
    const del = fetchMock.mock.calls.find((c) => c[1].method === "DELETE");
    expect(del[1].headers["x-freebuff-instance-id"]).toBe("cli:old");
  });

  it("collapses client system messages behind the Buffy prefix", () => {
    const out = withBuffySystem([{ role: "system", content: "A" }, { role: "developer", content: [{ type: "text", text: "B" }] }, { role: "user", content: "x" }, { role: "system", content: "late" }]);
    expect(out.map((m) => m.role)).toEqual(["system", "user", "system"]);
    expect(out[0].content).toBe("You are Buffy, the coding agent behind Codebuff.\n\nA\n\nB");
  });

  it("reuses the session across requests", async () => {
    proxyFetchMock.mockResolvedValue(json({ ok: true }));
    const ex = new FreebuffExecutor();
    await ex.execute(args);
    await ex.execute(args);
    expect(fetchMock.mock.calls.filter((c) => String(c[0]).endsWith("/session/admission")).length).toBe(1);
  });

  it("returns the admission refusal without calling chat", async () => {
    fetchMock.mockImplementation(async (url) =>
      String(url).endsWith("/freebuff/models") ? json(CATALOG) : json({ status: "rate_limited", message: "daily limit" }, 200),
    );
    const { response } = await new FreebuffExecutor().execute(args);
    expect(response.status).toBe(403);
    expect((await response.json()).error.message).toBe("daily limit");
    expect(proxyFetchMock).not.toHaveBeenCalled();
  });

  it("re-admits once when chat says the session ended", async () => {
    proxyFetchMock
      .mockResolvedValueOnce(json({ error: "session_superseded" }, 403))
      .mockResolvedValueOnce(json({ ok: true }));
    const { response } = await new FreebuffExecutor().execute(args);
    expect(response.status).toBe(200);
    expect(fetchMock.mock.calls.filter((c) => String(c[0]).endsWith("/session/admission")).length).toBe(2);
  });
});

describe("freebuff oauth", () => {
  it("requests a login code and polls until authToken appears", async () => {
    fetchMock.mockImplementation(async (url) =>
      String(url).includes("/cli/code")
        ? json({ fingerprintId: "f", fingerprintHash: "h", loginUrl: "https://freebuff.com/login?auth_code=ABCDEFGHIJ", expiresAt: 5, expiresInMs: 3600000 })
        : json({ user: { id: "u1", email: "a@b.c", authToken: "tok" } }),
    );
    const d = await freebuffOauth.requestDeviceCode(freebuffOauth.config);
    expect(d.verification_uri_complete).toContain("auth_code=");
    expect(d.device_code.startsWith("f|h|5")).toBe(true);
    const p = await freebuffOauth.pollToken(freebuffOauth.config, d.device_code);
    expect(freebuffOauth.mapTokens(p.data)).toMatchObject({ accessToken: "tok", email: "a@b.c" });
    fetchMock.mockImplementation(async () => json({}, 401));
    expect((await freebuffOauth.pollToken(freebuffOauth.config, d.device_code)).data.error).toBe("authorization_pending");
  });
});

describe("freebuff device signing + catalog", () => {
  it("registers an Ed25519 key and signs requests verifiably", async () => {
    const os = await import("node:os"), path = await import("node:path"), crypto = await import("node:crypto");
    const svc = await import("open-sse/services/freebuffModels.js");
    svc.resetFreebuffModelsForTests(path.join(os.tmpdir(), `fb-key-${Date.now()}.json`));
    let pub;
    fetchMock.mockImplementation(async (url, init) => {
      if (String(url).endsWith("/device-keys")) { pub = JSON.parse(init.body).publicKey; return json({ keyId: "k1" }); }
      return json({});
    });
    expect(svc.freebuffDeviceHeaders("t", { method: "POST", url: "https://x.test/a" })).toEqual({});
    expect(await svc.ensureFreebuffDeviceKey("t")).toBe("k1");
    const h = svc.freebuffDeviceHeaders("t", { method: "post", url: "https://x.test/a/b?q=1", body: '{"a":1}' }, 1234);
    expect(h["x-freebuff-device-key"]).toBe("k1");
    expect(h["x-freebuff-device-ts"]).toBe("1234");
    const payload = ["freebuff-device-v1", "POST", "/a/b", "1234", crypto.createHash("sha256").update('{"a":1}').digest("hex"), ""].join("\n");
    const spki = Buffer.concat([Buffer.from("302a300506032b6570032100", "hex"), Buffer.from(pub, "base64url")]);
    const key = crypto.createPublicKey({ key: spki, format: "der", type: "spki" });
    expect(crypto.verify(null, Buffer.from(payload), key, Buffer.from(h["x-freebuff-device-sig"], "base64url"))).toBe(true);
  });

  it("signs session and agent-run calls and the chat request", async () => {
    const os = await import("node:os"), path = await import("node:path");
    const svc = await import("open-sse/services/freebuffModels.js");
    svc.resetFreebuffModelsForTests(path.join(os.tmpdir(), `fb-key2-${Date.now()}.json`));
    fetchMock.mockImplementation(async (url) => {
      const u = String(url);
      if (u.endsWith("/device-keys")) return json({ keyId: "k2" });
      if (u.endsWith("/freebuff/models")) return json(CATALOG);
      if (u.endsWith("/session/admission")) return json({ status: "active", instanceId: "cli:z" });
      if (u.endsWith("/agent-runs")) return json({ runId: "r" });
      return json({});
    });
    proxyFetchMock.mockResolvedValue(json({ ok: true }));
    await new FreebuffExecutor().execute({ model: "glm-5.3-flash", body: { messages: [] }, stream: false, credentials: { accessToken: "t2" } });
    const adm = fetchMock.mock.calls.find((c) => String(c[0]).endsWith("/session/admission"));
    expect(adm[1].headers["x-freebuff-device-sig"]).toBeTruthy();
    expect(proxyFetchMock.mock.calls[0][1].headers["x-freebuff-device-key"]).toBe("k2");
  });

  it("lists unlocked, opened rows as slug ids and falls back to null", async () => {
    const os = await import("node:os"), path = await import("node:path");
    svcMod.resetFreebuffModelsForTests(path.join(os.tmpdir(), `fb-key3-${Date.now()}.json`));
    fetchMock.mockImplementation(async (url) => (String(url).endsWith("/device-keys") ? json({ keyId: "k3" }) : json(CATALOG)));
    const live = await svcMod.resolveFreebuffModels("t3");
    expect(live.models).toEqual([{ id: "glm-5.3-flash", name: "GLM 5.3 Flash" }, { id: "brand-new", name: "Brand New" }]);
    svcMod.resetFreebuffModelsForTests();
    fetchMock.mockImplementation(async () => json({}, 404));
    expect(await svcMod.resolveFreebuffModels("t3")).toBeNull();
  });
});
