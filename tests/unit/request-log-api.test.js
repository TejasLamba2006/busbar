import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

let session = { role: "master" };
vi.mock("@/lib/auth/dashboardSession", () => ({ getDashboardAuthSession: async () => session }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));

let tmp, list, detail, db;
const get = (qs = "") => list.GET(new Request(`http://x/api/usage/request-log${qs}`));
const post = (body) => list.POST(new Request("http://x/api/usage/request-log", { method: "POST", body: JSON.stringify(body) }));

function insert(i, over = {}) {
  const rec = {
    id: `id-${i}`, provider: "openai", model: "gpt-4", connectionId: "c1",
    timestamp: new Date(1700000000000 + i * 1000).toISOString(), status: "success",
    latency: { ttft: 50, total: 200 }, tokens: { prompt_tokens: 3, completion_tokens: 4, cached_tokens: 1 },
    request: { messages: [{ role: "user", content: "hello " + i }] },
    providerRequest: { a: 1 }, providerResponse: { b: 2 }, response: { content: "x" },
    ...over,
  };
  db.run(`INSERT INTO requestDetails(id,timestamp,provider,model,connectionId,status,data) VALUES(?,?,?,?,?,?,?)`,
    [rec.id, rec.timestamp, rec.provider, rec.model, rec.connectionId, rec.status, JSON.stringify(rec)]);
}

beforeAll(async () => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "reqlog-"));
  process.env.DATA_DIR = tmp;
  delete process.env.ENABLE_REQUEST_LOGS;
  db = await (await import("@/lib/db/driver.js")).getAdapter();
  list = await import("@/app/api/usage/request-log/route.js");
  detail = await import("@/app/api/usage/request-log/[id]/route.js");
});
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));
beforeEach(() => { session = { role: "master" }; db.run(`DELETE FROM requestDetails`); });

describe("request-log API", () => {
  it("paginates newest first and filters", async () => {
    for (let i = 0; i < 5; i++) insert(i, i % 2 ? { provider: "anthropic", model: "claude_x" } : {});
    const r = await (await get("?page=1&pageSize=2")).json();
    expect(r.items.map((x) => x.id)).toEqual(["id-4", "id-3"]);
    expect(r.pagination).toEqual({ page: 1, pageSize: 2, totalItems: 5, totalPages: 3 });
    expect(r.observability.total).toBe(5);
    expect((await (await get("?provider=anthropic")).json()).pagination.totalItems).toBe(2);
    expect((await (await get("?q=claude_x")).json()).pagination.totalItems).toBe(2);
    expect((await (await get("?q=claude%25")).json()).pagination.totalItems).toBe(0); // % escaped
    expect((await (await get("?pageSize=999")).json()).pagination.pageSize).toBe(100);
  });

  it("maps fields, preview for string and array content, hasPayload", async () => {
    insert(1);
    insert(2, { request: { messages: [{ role: "user", content: [{ type: "text", text: "part A" }, { type: "image" }] }, { role: "assistant", content: "ok" }] } });
    insert(3, { request: { _truncated: true, _originalSize: 9e9, _preview: "x" } });
    insert(4, { latency: { ttft: 300, total: 200 } });
    const items = Object.fromEntries((await (await get()).json()).items.map((x) => [x.id, x]));
    expect(items["id-1"]).toMatchObject({ preview: "hello 1", hasPayload: true, ttftMs: 50, durationMs: 200, promptTokens: 3, completionTokens: 4, cachedTokens: 1, ts: 1700000001000 });
    expect(items["id-2"].preview).toBe("part A");
    expect(items["id-3"].hasPayload).toBe(false);
    expect(items["id-3"].preview).toBe("");
    expect(items["id-4"].ttftMs).toBeNull();
  });

  it("list never leaks payload keys", async () => {
    insert(1);
    const txt = await (await get()).text();
    for (const k of ["providerRequest", "providerResponse", "\"response\"", "\"messages\""]) expect(txt).not.toContain(k);
  });

  it("detail returns record or 404", async () => {
    insert(1);
    const ok = await detail.GET(new Request("http://x"), { params: Promise.resolve({ id: "id-1" }) });
    expect((await ok.json()).detail.providerRequest).toEqual({ a: 1 });
    const nf = await detail.GET(new Request("http://x"), { params: Promise.resolve({ id: "nope" }) });
    expect(nf.status).toBe(404);
  });

  it("detail truncates huge payload", async () => {
    insert(1, { response: { content: "z".repeat(9 * 1024 * 1024) } });
    const r = await (await detail.GET(new Request("http://x"), { params: Promise.resolve({ id: "id-1" }) })).json();
    expect(r.detail.response._truncated).toBe(true);
  });

  it("client session gets 403 everywhere", async () => {
    session = { role: "client" };
    expect((await get()).status).toBe(403);
    expect((await post({ enabled: true })).status).toBe(403);
    expect((await list.DELETE()).status).toBe(403);
    expect((await detail.GET(new Request("http://x"), { params: Promise.resolve({ id: "a" }) })).status).toBe(403);
  });

  it("POST updates settings with clamps and resets cache; DELETE clears", async () => {
    const r = await (await post({ enabled: true, maxJsonKB: 99999, maxRecords: 1 })).json();
    expect(r).toMatchObject({ enabled: true, maxJsonKB: 1024, maxRecords: 50 });
    const r2 = await (await post({ enabled: false, maxJsonKB: 2 })).json();
    expect(r2).toMatchObject({ enabled: false, maxJsonKB: 4, maxRecords: 50 });
    insert(1); insert(2);
    expect(await (await list.DELETE()).json()).toEqual({ success: true, deleted: 2 });
  });

  it("env override locks enabled", async () => {
    process.env.ENABLE_REQUEST_LOGS = "true";
    try {
      expect((await post({ enabled: false })).status).toBe(409);
      expect((await (await post({ maxRecords: 100 })).json()).lockedByEnv).toBe(true);
    } finally { delete process.env.ENABLE_REQUEST_LOGS; }
  });
});
