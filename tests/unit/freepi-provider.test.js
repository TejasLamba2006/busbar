import { describe, it, expect, vi, beforeEach } from "vitest";

const { proxyFetchMock } = vi.hoisted(() => ({ proxyFetchMock: vi.fn() }));
vi.mock("open-sse/utils/proxyFetch.js", async (orig) => ({
  ...(await orig()),
  proxyAwareFetch: (...a) => proxyFetchMock(...a),
}));

const { PROVIDERS } = await import("open-sse/config/providers.js");
const { AI_PROVIDERS, ALIAS_TO_ID } = await import("@/shared/constants/providers.js");
const { FreepiExecutor, resetFreepiAdsForTests } = await import("open-sse/executors/freepi.js");
const { resolveFreepiModels, getCachedFreepiVersion, resetFreepiCacheForTests } = await import(
  "open-sse/services/freepiModels.js"
);
const registry = (await import("open-sse/providers/registry/freepi.js")).default;

const CV = {
  min: "0.4.10",
  latest: "0.6.1",
  models: [
    { id: "gemini-4-argon", name: "Gemini 4 Argon · premium" },
    { id: "deepseek-v4-flash", name: "DeepSeek V4 Flash · 1x usage" },
  ],
};
const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

let fetchMock;
beforeEach(() => {
  resetFreepiCacheForTests();
  resetFreepiAdsForTests();
  proxyFetchMock.mockReset();
  fetchMock = vi.fn(async (url) => (String(url).endsWith("/client-version") ? json(CV) : json({ ok: true })));
  vi.stubGlobal("fetch", fetchMock);
});

describe("freepi registry", () => {
  it("is registered with alias fp and the full model list", () => {
    expect(AI_PROVIDERS.freepi).toBeDefined();
    expect(PROVIDERS.freepi).toBeDefined();
    expect(ALIAS_TO_ID.fp).toBe("freepi");
    expect(registry.models.length).toBe(27);
    expect(registry.models.map((m) => m.id)).toContain("claude-sonnet-5.5");
  });
});

describe("resolveFreepiModels", () => {
  it("parses /client-version models and caches the client version", async () => {
    const r = await resolveFreepiModels();
    expect(r.models).toEqual([
      { id: "gemini-4-argon", name: "Gemini 4 Argon" },
      { id: "deepseek-v4-flash", name: "DeepSeek V4 Flash" },
    ]);
    expect(getCachedFreepiVersion()).toBe("0.6.1");
    await resolveFreepiModels();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("FreepiExecutor", () => {
  const creds = { accessToken: "jwt-abc", connectionId: "conn-1" };
  const args = { model: "gemini-4-argon", body: { messages: [] }, stream: false, credentials: creds };

  it("injects bearer, client version, and a stable session id", async () => {
    proxyFetchMock.mockResolvedValue(json({ ok: true }));
    const ex = new FreepiExecutor();
    await ex.execute(args);
    await ex.execute(args);
    const [h1, h2] = proxyFetchMock.mock.calls.map((c) => c[1].headers);
    expect(h1.Authorization).toBe("Bearer jwt-abc");
    expect(h1["x-client-version"]).toBe("0.6.1");
    expect(h1["x-session-id"]).toMatch(/^[0-9a-f-]{36}$/);
    expect(h1["x-session-id"]).toBe(h2["x-session-id"]);
  });

  it("calls /session/reset and retries once on 409", async () => {
    proxyFetchMock
      .mockResolvedValueOnce(json({ message: "another active session" }, 409))
      .mockResolvedValueOnce(json({ ok: true }));
    const { response } = await new FreepiExecutor().execute(args);
    expect(response.status).toBe(200);
    expect(proxyFetchMock).toHaveBeenCalledTimes(2);
    const reset = fetchMock.mock.calls.find((c) => String(c[0]).endsWith("/session/reset"));
    expect(reset[1].method).toBe("POST");
    expect(reset[1].headers.Authorization).toBe("Bearer jwt-abc");
  });

  it("pings /ads/next (banner+inline) and /ads/impression before first chat, throttled", async () => {
    const calls = [];
    fetchMock.mockImplementation(async (url, init) => {
      const u = String(url);
      calls.push([u, init?.method || "GET", init?.headers]);
      if (u.includes("/ads/next")) return json({ ad_id: "a1", click_token: "t1", source: "own" });
      if (u.endsWith("/client-version")) return json(CV);
      return json({ ok: true });
    });
    proxyFetchMock.mockResolvedValue(json({ ok: true }));
    const ex = new FreepiExecutor();
    await ex.execute(args);
    await ex.execute(args);
    const ads = calls.filter(([u]) => u.includes("/ads/"));
    expect(ads.map(([u, m]) => `${m} ${u.replace("https://api.freepi.ai", "")}`)).toEqual([
      "GET /ads/next?slot=banner",
      "POST /ads/impression",
      "GET /ads/next?slot=inline",
      "POST /ads/impression",
    ]);
    expect(ads[0][2].Authorization).toBe("Bearer jwt-abc");
    expect(ads[0][2]["x-session-id"]).toMatch(/^[0-9a-f-]{36}$/);
    expect(ads[0][2]["x-client-version"]).toBe("0.6.1");
    const ctx = JSON.parse(Buffer.from(ads[0][2]["x-gravity-context"], "base64url").toString());
    expect(ctx.sessionId).toBe(ads[0][2]["x-session-id"]);
  });

  it("re-pings ads and retries once on 403 ads_required", async () => {
    const urls = [];
    fetchMock.mockImplementation(async (url) => {
      urls.push(String(url));
      return String(url).endsWith("/client-version") ? json(CV) : json({}, 204);
    });
    proxyFetchMock
      .mockResolvedValueOnce(json({ code: "ads_required", message: "ads aren't displaying" }, 403))
      .mockResolvedValueOnce(json({ ok: true }));
    const { response } = await new FreepiExecutor().execute(args);
    expect(response.status).toBe(200);
    expect(proxyFetchMock).toHaveBeenCalledTimes(2);
    expect(urls.filter((u) => u.includes("/ads/next")).length).toBe(4); // preflight + forced
  });
});

describe("FreepiExecutor ads details", () => {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const jwt = `h.${b64({ sub: "user-1" })}.s`;
  const creds = { accessToken: jwt, connectionId: "conn-2" };
  const args = { model: "m", body: { messages: [] }, stream: false, credentials: creds };

  it("sends x-gravity-context with sha256(sub) userId and dedupes impressions by click_token", async () => {
    const calls = [];
    fetchMock.mockImplementation(async (url, init) => {
      const u = String(url);
      calls.push([u, init]);
      if (u.includes("/ads/next")) return json({ ad_id: "a", click_token: "same", source: "own" });
      return u.endsWith("/client-version") ? json(CV) : json({});
    });
    proxyFetchMock.mockResolvedValue(json({ ok: true }));
    const ex = new FreepiExecutor();
    await ex.execute(args);
    const next = calls.find(([u]) => u.includes("slot=banner"));
    const ctx = JSON.parse(Buffer.from(next[1].headers["x-gravity-context"], "base64url").toString());
    const { createHash } = await import("node:crypto");
    expect(ctx.userId).toBe(createHash("sha256").update("user-1").digest("hex"));
    // banner and inline share click_token "same" but are tracked per slot -> 2 impressions
    expect(calls.filter(([u]) => u.endsWith("/ads/impression")).length).toBe(2);
    // forced refresh clears dedupe, so both impressions post again
    proxyFetchMock
      .mockResolvedValueOnce(json({ code: "ads_required" }, 403))
      .mockResolvedValueOnce(json({ ok: true }));
    await ex.execute(args);
    expect(calls.filter(([u]) => u.endsWith("/ads/impression")).length).toBe(4);
  });

  it("does not re-post an unchanged click_token for a slot", async () => {
    const calls = [];
    fetchMock.mockImplementation(async (url) => {
      const u = String(url);
      calls.push(u);
      if (u.includes("/ads/next")) return json({ ad_id: "a", click_token: "t", source: "own" });
      return u.endsWith("/client-version") ? json(CV) : json({});
    });
    proxyFetchMock.mockResolvedValue(json({ ok: true }));
    const ex = new FreepiExecutor();
    await ex.execute(args);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + 61_000);
    await ex.execute(args); // turn 2: banner refetched, same token -> no impression
    vi.useRealTimers();
    expect(calls.filter((u) => u.includes("slot=banner")).length).toBe(2);
    expect(calls.filter((u) => u.endsWith("/ads/impression")).length).toBe(2);
  });
});

describe("getFreepiUsage", () => {
  it("maps credits and bonus", async () => {
    const { getFreepiUsage } = await import("open-sse/services/usage/freepi.js");
    proxyFetchMock.mockResolvedValue(
      json({ allowance_credits: 15000, remaining_credits_today: 10857, bonus_credits: 2000, bonus_wallet_credits: 0, refill_at: "2026-10-26T00:00:00.000Z", lane: "fast" }),
    );
    const r = await getFreepiUsage("tok");
    expect(r.plan).toBe("FreePi (fast) +2,000 bonus");
    expect(r.quotas["Daily Credits"]).toMatchObject({ total: 15000, remaining: 10857, used: 4143, unit: "credits", resetAt: "2026-10-26T00:00:00.000Z" });
    expect(r.quotas["Bonus Credits"]).toMatchObject({ total: 2000, remaining: 2000, used: 0, unit: "credits" });
  });

  it("falls back to USD fields", async () => {
    const { getFreepiUsage } = await import("open-sse/services/usage/freepi.js");
    proxyFetchMock.mockResolvedValue(json({ cap_usd_today: 1, remaining_usd_today: 0.25 }));
    const r = await getFreepiUsage("tok");
    expect(r.quotas["Daily allowance (USD)"].remainingPercentage).toBe(25);
  });
});
