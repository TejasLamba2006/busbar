"use client";

import { memo, useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Card, Button } from "@/shared/components";
import { useCopyToClipboard } from "@/shared/hooks/useCopyToClipboard";

const MAX_KEPT = 1000;
const MAX_RENDERED = 300;
const POLL_MS = 3000;
const VIA_OPTIONS = ["all", "connection", "env", "relay"];
const STATUS_OPTIONS = [
  { value: "all", label: "All status" },
  { value: "ok", label: "OK" },
  { value: "failed", label: "Failed" },
];
const VIA_STYLE = {
  connection: "text-blue-400 border-blue-500/30 bg-blue-500/10",
  env: "text-purple-400 border-purple-500/30 bg-purple-500/10",
  relay: "text-amber-400 border-amber-500/30 bg-amber-500/10",
};
const SELECT_CLS =
  "h-7 px-2 text-xs rounded-[8px] bg-surface-2 border border-border-subtle text-text-main outline-none focus:border-brand-500/50";

function statusStyle(e) {
  if (e.ok) return "text-green-400 border-green-500/30 bg-green-500/10";
  if (e.status && e.status >= 400 && e.status < 500) return "text-yellow-400 border-yellow-500/30 bg-yellow-500/10";
  return "text-red-400 border-red-500/30 bg-red-500/10";
}
const statusLabel = (e) => (e.status ?? (e.ok ? "OK" : "ERR"));

function fmtLatency(ms) {
  if (ms == null) return "-";
  if (ms >= 1000) return `${(ms / 1000).toFixed(ms >= 10000 ? 1 : 2)}s`;
  return `${Math.round(ms)}ms`;
}
const fmtTime = (ts) => new Date(ts).toLocaleTimeString([], { hour12: false });
function pct(sorted, p) {
  if (!sorted.length) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
}

const Row = memo(function Row({ e, maxLat, onOpen }) {
  const w = maxLat > 0 ? Math.max(2, Math.round((e.latencyMs / maxLat) * 100)) : 0;
  return (
    <tr onClick={() => onOpen(e)} className="cursor-pointer border-t border-border-subtle hover:bg-surface-2/60">
      <td className="px-3 py-1.5 whitespace-nowrap text-text-muted font-mono">{fmtTime(e.ts)}</td>
      <td className="px-3 py-1.5">
        <span className={`px-2 py-0.5 rounded-full border font-mono ${statusStyle(e)}`}>{statusLabel(e)}</span>
      </td>
      <td className="px-3 py-1.5 font-mono text-text-main">{e.proxy}</td>
      <td className="px-3 py-1.5 font-mono text-text-main">{e.host}</td>
      <td className="px-3 py-1.5">
        <span className={`px-2 py-0.5 rounded-full border ${VIA_STYLE[e.via] || "text-text-muted border-border-subtle"}`}>{e.via}</span>
      </td>
      <td className="px-3 py-1.5 min-w-[110px]">
        <div className="font-mono text-text-main">{fmtLatency(e.latencyMs)}</div>
        <div className="h-1 mt-0.5 rounded bg-surface-2">
          <div className={`h-1 rounded ${e.ok ? "bg-green-500/70" : "bg-red-500/70"}`} style={{ width: `${w}%` }} />
        </div>
      </td>
      <td className="px-3 py-1.5 max-w-[260px] truncate text-red-400" title={e.error || ""}>{e.error || ""}</td>
    </tr>
  );
});

function DetailModal({ entry, onClose }) {
  const { copied, copy } = useCopyToClipboard(1500);
  useEffect(() => {
    const k = (ev) => ev.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  const fields = [
    ["ID", entry.id],
    ["Time", new Date(entry.ts).toLocaleString()],
    ["Status", statusLabel(entry)],
    ["OK", String(entry.ok)],
    ["Proxy", entry.proxy],
    ["Host", entry.host],
    ["Via", entry.via],
    ["Latency", fmtLatency(entry.latencyMs)],
    ["Connection", entry.connectionId || "-"],
    ["Error", entry.error || "-"],
  ];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-lg" onClick={(ev) => ev.stopPropagation()}>
        <Card padding="sm">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm font-semibold text-text-main">Proxy request #{entry.id}</span>
            <div className="ml-auto flex gap-2">
              <Button size="sm" variant="outline" icon={copied ? "check" : "content_copy"} onClick={() => copy(JSON.stringify(entry, null, 2))}>
                Copy JSON
              </Button>
              <Button size="sm" variant="outline" icon="close" onClick={onClose}>Close</Button>
            </div>
          </div>
          <dl className="grid grid-cols-[110px_1fr] gap-y-1.5 text-xs">
            {fields.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-text-muted">{k}</dt>
                <dd className="font-mono text-text-main break-all">{String(v)}</dd>
              </div>
            ))}
          </dl>
        </Card>
      </div>
    </div>
  );
}

export default function ProxyLogClient() {
  const [entries, setEntries] = useState([]);
  const [forbidden, setForbidden] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(null);
  const [paused, setPaused] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [via, setVia] = useState("all");
  const [status, setStatus] = useState("all");
  const [proxyFilter, setProxyFilter] = useState(null);
  const [selected, setSelected] = useState(null);
  const [lastPoll, setLastPoll] = useState(null);
  const lastIdRef = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim().toLowerCase()), 150);
    return () => clearTimeout(t);
  }, [searchInput]);

  const poll = useCallback(async () => {
    try {
      const res = await fetch(`/api/usage/proxy-logs?limit=500&sinceId=${lastIdRef.current}`, { cache: "no-store" });
      if (res.status === 403) { setForbidden(true); return; }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { logs = [] } = await res.json();
      setError(null);
      setLoaded(true);
      setLastPoll(Date.now());
      if (!logs.length) return;
      lastIdRef.current = Math.max(lastIdRef.current, logs[logs.length - 1].id);
      // backend oldest-first; keep newest-first, dedupe by id via sinceId
      setEntries((prev) => [...logs.slice().reverse(), ...prev].slice(0, MAX_KEPT));
    } catch (err) {
      setError(err.message || "fetch failed");
    }
  }, []);

  useEffect(() => {
    if (paused || forbidden) return;
    const tick = () => document.visibilityState === "visible" && poll();
    tick();
    const t = setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [paused, forbidden, poll]);

  const handleClear = async () => {
    if (!window.confirm("Clear all proxy logs?")) return;
    try {
      await fetch("/api/usage/proxy-logs", { method: "DELETE" });
      setEntries([]);
      setProxyFilter(null);
    } catch (err) {
      setError(err.message || "clear failed");
    }
  };

  const summary = useMemo(() => {
    const lat = entries.map((e) => e.latencyMs).sort((a, b) => a - b);
    const okN = entries.filter((e) => e.ok).length;
    const byProxy = {};
    for (const e of entries) byProxy[e.proxy] = (byProxy[e.proxy] || 0) + 1;
    return {
      total: entries.length,
      rate: entries.length ? Math.round((okN / entries.length) * 100) : 0,
      p50: pct(lat, 50),
      p95: pct(lat, 95),
      proxies: Object.entries(byProxy).sort((a, b) => b[1] - a[1]),
    };
  }, [entries]);

  const filtered = useMemo(
    () =>
      entries.filter((e) => {
        if (via !== "all" && e.via !== via) return false;
        if (status === "ok" && !e.ok) return false;
        if (status === "failed" && e.ok) return false;
        if (proxyFilter && e.proxy !== proxyFilter) return false;
        return !search || `${e.proxy} ${e.host} ${e.error || ""}`.toLowerCase().includes(search);
      }),
    [entries, via, status, proxyFilter, search]
  );

  const visible = useMemo(() => filtered.slice(0, MAX_RENDERED), [filtered]);
  const maxLat = useMemo(() => visible.reduce((m, e) => Math.max(m, e.latencyMs || 0), 0), [visible]);
  const closeModal = useCallback(() => setSelected(null), []);

  if (forbidden) {
    return (
      <Card padding="sm">
        <div className="py-12 flex flex-col items-center gap-2 text-text-muted">
          <span className="material-symbols-outlined text-[40px]">lock</span>
          <span className="text-sm">Master account only</span>
        </div>
      </Card>
    );
  }

  const stat = (label, value) => (
    <div className="flex flex-col">
      <span className="text-[11px] text-text-muted">{label}</span>
      <span className="text-sm font-semibold text-text-main font-mono">{value}</span>
    </div>
  );

  return (
    <div className="flex flex-col gap-3">
      <Card padding="sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[160px] max-w-xs">
            <span className="material-symbols-outlined absolute left-2 top-1/2 -translate-y-1/2 text-[16px] text-text-muted">search</span>
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search proxy, host, error..."
              className="w-full h-7 pl-8 pr-2 text-xs rounded-[8px] bg-surface-2 border border-border-subtle text-text-main placeholder:text-text-muted outline-none focus:border-brand-500/50"
            />
          </div>
          <select className={SELECT_CLS} value={via} onChange={(e) => setVia(e.target.value)}>
            {VIA_OPTIONS.map((v) => <option key={v} value={v}>{v === "all" ? "All via" : v}</option>)}
          </select>
          <select className={SELECT_CLS} value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <Button size="sm" variant={paused ? "primary" : "outline"} icon={paused ? "play_arrow" : "pause"} onClick={() => setPaused((p) => !p)}>
            {paused ? "Resume" : "Pause"}
          </Button>
          <Button size="sm" variant="outline" icon="delete" onClick={handleClear}>Clear</Button>
          <div className="ml-auto flex items-center gap-1.5 text-xs text-text-muted">
            <span className={`size-2 rounded-full ${error ? "bg-red-500" : paused ? "bg-yellow-500" : "bg-green-500 animate-pulse"}`} />
            {error ? `Error: ${error}` : paused ? "Paused" : `Auto-refresh every ${POLL_MS / 1000}s${lastPoll ? `, last ${fmtTime(lastPoll)}` : ""}`}
          </div>
        </div>
      </Card>

      <Card padding="sm">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          {stat("Total", summary.total)}
          {stat("Success", `${summary.rate}%`)}
          {stat("p50", fmtLatency(summary.p50))}
          {stat("p95", fmtLatency(summary.p95))}
          <div className="flex flex-wrap gap-1.5 ml-auto">
            {summary.proxies.map(([p, n]) => (
              <button
                key={p}
                onClick={() => setProxyFilter((cur) => (cur === p ? null : p))}
                title={proxyFilter === p ? "Clear proxy filter" : "Filter by proxy"}
                className={`px-2 py-0.5 rounded-full border text-[11px] font-mono ${
                  proxyFilter === p ? "bg-brand-500 text-white border-brand-500" : "text-text-muted border-border-subtle bg-surface-2 hover:text-text-main"
                }`}
              >
                {p} · {n}
              </button>
            ))}
          </div>
        </div>
      </Card>

      <Card padding="none">
        <div className="overflow-auto max-h-[calc(100vh-380px)] min-h-[240px]">
          {visible.length === 0 ? (
            <div className="py-16 flex flex-col items-center gap-2 text-text-muted">
              <span className="material-symbols-outlined text-[40px]">swap_horiz</span>
              <span className="text-sm">
                {!loaded ? "Loading..." : entries.length ? "No requests match the filter." : "No proxied requests yet."}
              </span>
            </div>
          ) : (
            <table className="w-full text-xs text-left">
              <thead className="sticky top-0 bg-surface-2 text-text-muted">
                <tr>
                  {["Time", "Status", "Proxy", "Host", "Via", "Latency", "Error"].map((h) => (
                    <th key={h} className="px-3 py-2 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((e) => <Row key={e.id} e={e} maxLat={maxLat} onOpen={setSelected} />)}
              </tbody>
            </table>
          )}
        </div>
        {filtered.length > MAX_RENDERED && (
          <div className="px-3 py-1.5 text-center text-[11px] text-text-muted border-t border-border-subtle">
            showing latest {MAX_RENDERED} of {filtered.length}, narrow the filter to see more
          </div>
        )}
      </Card>

      {selected && <DetailModal entry={selected} onClose={closeModal} />}
    </div>
  );
}
