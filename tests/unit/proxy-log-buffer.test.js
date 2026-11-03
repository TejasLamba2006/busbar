import { describe, expect, it, vi, beforeEach } from "vitest";
import { recordProxyLog, getProxyLogs, clearProxyLogs, maskProxyUrl } from "../../src/lib/proxyLogBuffer.js";

const fetchMock = vi.fn();
globalThis.fetch = fetchMock;
const { proxyAwareFetch } = await import("../../open-sse/utils/proxyFetch.js");

beforeEach(() => { clearProxyLogs(); fetchMock.mockReset(); });

describe("proxyLogBuffer", () => {
  it("maskProxyUrl strips credentials and path", () => {
    expect(maskProxyUrl("http://user:pw@proxy.local:8080/a?b=1")).toBe("http://proxy.local:8080");
    expect(maskProxyUrl("not a url")).toBe("invalid");
  });
  it("caps ring at 1000", () => {
    for (let i = 0; i < 1100; i++) recordProxyLog({ via: "env" });
    const r = getProxyLogs({ limit: 5000 });
    expect(r.total).toBe(1000);
    expect(r.logs.length).toBe(1000);
  });
  it("sinceId filters, oldest first; clear empties", () => {
    const a = recordProxyLog({ via: "env" });
    const b = recordProxyLog({ via: "env", error: "x".repeat(300) });
    const r = getProxyLogs({ sinceId: a.id });
    expect(r.logs.map((l) => l.id)).toEqual([b.id]);
    expect(r.logs[0].error.length).toBe(200);
    clearProxyLogs();
    expect(getProxyLogs().total).toBe(0);
  });
});

describe("proxyAwareFetch wrapper", () => {
  it("connection proxy logs once, no credentials", async () => {
    fetchMock.mockResolvedValue(new Response("ok", { status: 201 }));
    const res = await proxyAwareFetch("https://api.example.com/v1/x?k=1", {}, {
      connectionProxyEnabled: true, connectionProxyUrl: "http://u:p@127.0.0.1:9", connectionId: "c1",
    });
    expect(res.status).toBe(201);
    const { logs } = getProxyLogs();
    expect(logs.length).toBe(1);
    expect(logs[0]).toMatchObject({ via: "connection", proxy: "http://127.0.0.1:9", host: "api.example.com", status: 201, ok: true, connectionId: "c1" });
  });
  it("proxy failure logs error and rethrows", async () => {
    fetchMock.mockRejectedValue(new Error("boom"));
    await expect(proxyAwareFetch("https://api.example.com/", {}, {
      connectionProxyEnabled: true, connectionProxyUrl: "http://127.0.0.1:9", strictProxy: true,
    })).rejects.toThrow();
    expect(getProxyLogs().logs.length).toBe(1);
    expect(getProxyLogs().logs[0].ok).toBe(false);
  });
  it("direct call logs nothing", async () => {
    for (const k of ["HTTPS_PROXY","https_proxy","HTTP_PROXY","http_proxy","ALL_PROXY","all_proxy"]) delete process.env[k];
    fetchMock.mockResolvedValue(new Response("ok"));
    await proxyAwareFetch("https://api.example.com/", {}, null);
    expect(getProxyLogs().total).toBe(0);
  });
});
