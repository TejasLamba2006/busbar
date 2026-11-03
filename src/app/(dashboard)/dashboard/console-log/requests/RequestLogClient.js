"use client";

import { memo, useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Card, Button } from "@/shared/components";
import Drawer from "@/shared/components/Drawer";
import SegmentedControl from "@/shared/components/SegmentedControl";
import { useCopyToClipboard } from "@/shared/hooks/useCopyToClipboard";
import PayloadViewer, { isEmptyPayload } from "./PayloadViewer";

const API = "/api/usage/request-log";
const PAGE_SIZE = 50;
const POLL_MS = 5000;
const CAPS = [16, 64, 256, 1024];
const RECORDS = [200, 500, 1000, 2000];
const SELECT_CLS =
  "h-7 px-2 text-xs rounded-[8px] bg-surface-2 border border-border-subtle text-text-main outline-none focus:border-brand-500/50";
const STATUS_OPTIONS = [
  { value: "", label: "All status" },
  { value: "success", label: "Success" },
  { value: "error", label: "Error" },
];
const TABS = [
  { value: "messages", label: "Messages", key: null },
  { value: "request", label: "Request", key: "request" },
  { value: "providerRequest", label: "Provider request", key: "providerRequest" },
  { value: "providerResponse", label: "Provider response", key: "providerResponse" },
  { value: "response", label: "Response", key: "response" },
];

const fmtMs = (ms) => {
  if (ms == null) return "-";
  if (ms >= 1000) return `${(ms / 1000).toFixed(ms >= 10000 ? 1 : 2)}s`;
  return `${Math.round(ms)}ms`;
};
const fmtTime = (ts) => new Date(ts).toLocaleTimeString([], { hour12: false });
function fmtRel(ts) {
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
const fmtNum = (n) => (n || 0).toLocaleString();

function StatusPill({ status }) {
  const ok = status === "success";
  const cls = ok
    ? "text-green-400 border-green-500/30 bg-green-500/10"
    : "text-red-400 border-red-500/30 bg-red-500/10";
  return <span className={`px-2 py-0.5 rounded-full border font-mono text-xs ${cls}`}>{status || "?"}</span>;
}

const Row = memo(function Row({ e, maxDur, onOpen }) {
  const w = maxDur > 0 ? Math.max(2, Math.round((e.durationMs / maxDur) * 100)) : 0;
  return (
    <tr
      tabIndex={0}
      onClick={() => onOpen(e.id)}
      onKeyDown={(ev) => ev.key === "Enter" && onOpen(e.id)}
      className="cursor-pointer border-t border-border-subtle hover:bg-surface-2/60 focus:bg-surface-2/60 focus:outline-none"
    >
      <td className="px-3 py-1.5 whitespace-nowrap">
        <div className="font-mono text-text-main">{fmtTime(e.ts)}</div>
        <div className="text-[10px] text-text-muted">{fmtRel(e.ts)}</div>
      </td>
      <td className="px-3 py-1.5"><StatusPill status={e.status} /></td>
      <td className="px-3 py-1.5">
        <div className="font-mono text-text-main">{e.model}</div>
        <div className="text-[10px] text-text-muted">{e.provider}</div>
      </td>
      <td className="px-3 py-1.5 whitespace-nowrap font-mono text-text-main">
        {fmtNum(e.promptTokens)} / {fmtNum(e.completionTokens)}
        {e.cachedTokens > 0 && <div className="text-[10px] text-text-muted">{fmtNum(e.cachedTokens)} cached</div>}
      </td>
      <td className="px-3 py-1.5 min-w-[110px]">
        <div className="font-mono text-text-main">
          {fmtMs(e.durationMs)}
          {e.ttftMs != null && <span className="ml-1 text-[10px] text-text-muted">TTFB {fmtMs(e.ttftMs)}</span>}
        </div>
        <div className="h-1 mt-0.5 rounded bg-surface-2">
          <div className={`h-1 rounded ${e.status === "success" ? "bg-green-500/70" : "bg-red-500/70"}`} style={{ width: `${w}%` }} />
        </div>
      </td>
      <td className="px-3 py-1.5 max-w-[280px] truncate text-text-muted" title={e.preview || ""}>
        {!e.hasPayload && <span className="material-symbols-outlined mr-1 align-middle text-[14px]" title="No payload stored">unfold_less</span>}
        {e.preview || ""}
      </td>
    </tr>
  );
});

const Chip = ({ label, value }) => (
  <span className="inline-flex items-center gap-1 rounded-full border border-border-subtle bg-surface-2 px-2 py-0.5 text-[11px]">
    <span className="text-text-muted">{label}</span>
    <span className="font-mono text-text-main">{value}</span>
  </span>
);

function DetailBody({ id, maxJsonKB, onForbidden }) {
  const { copied, copy } = useCopyToClipboard(1500);
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState("messages");

  useEffect(() => {
    const ac = new AbortController();
    setDetail(null);
    setError(null);
    setTab("messages");
    fetch(`${API}/${encodeURIComponent(id)}`, { cache: "no-store", signal: ac.signal })
      .then(async (res) => {
        if (res.status === 403) { onForbidden(); return; }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setDetail((await res.json()).detail || {});
      })
      .catch((err) => err.name !== "AbortError" && setError(err.message || "fetch failed"));
    return () => ac.abort();
  }, [id, onForbidden]);

  const tabs = useMemo(() => {
    if (!detail) return [];
    return TABS.map((t) => ({
      value: t.value,
      label: t.label,
      disabled: t.key ? isEmptyPayload(detail[t.key]) : isEmptyPayload(detail.request) && isEmptyPayload(detail.response),
    })).filter((t) => !t.disabled); // SegmentedControl has no disabled prop: hide empty tabs
  }, [detail]);

  useEffect(() => {
    if (tabs.length && !tabs.some((t) => t.value === tab)) setTab(tabs[0].value);
  }, [tabs, tab]);

  if (error) return <div className="text-sm text-red-400">Failed to load: {error}</div>;
  if (!detail) return <div className="text-sm text-text-muted">Loading...</div>;

  const tk = detail.tokens || {};
  const tabKey = TABS.find((t) => t.value === tab)?.key;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-sm text-text-main">{detail.model}</span>
        <StatusPill status={detail.status} />
        <span className="text-xs text-text-muted">{detail.timestamp ? new Date(detail.timestamp).toLocaleString() : ""}</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Chip label="provider" value={detail.provider || "-"} />
        <Chip label="conn" value={String(detail.connectionId || "-").slice(0, 8)} />
        <Chip label="duration" value={fmtMs(detail.latency?.total)} />
        {detail.latency?.ttft != null && <Chip label="TTFB" value={fmtMs(detail.latency.ttft)} />}
        <Chip label="in" value={fmtNum(tk.prompt_tokens)} />
        <Chip label="out" value={fmtNum(tk.completion_tokens)} />
        {tk.cached_tokens > 0 && <Chip label="cached" value={fmtNum(tk.cached_tokens)} />}
      </div>
      {tabs.length ? (
        <>
          <SegmentedControl size="sm" options={tabs} value={tab} onChange={setTab} />
          <PayloadViewer
            key={tab}
            mode={tab === "messages" ? "messages" : "json"}
            value={tab === "messages" ? detail : detail[tabKey]}
            maxJsonKB={maxJsonKB}
          />
        </>
      ) : (
        <div className="text-xs text-text-muted">No payload stored for this request.</div>
      )}
      <div className="sticky bottom-0 -mx-6 -mb-6 flex justify-end border-t border-border-subtle bg-surface px-6 py-3">
        <Button size="sm" variant="outline" icon={copied ? "check" : "content_copy"} onClick={() => copy(JSON.stringify(detail, null, 2))}>
          Copy all as JSON
        </Button>
      </div>
    </div>
  );
}

export default function RequestLogClient() {
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, totalItems: 0 });
  const [obs, setObs] = useState(null);
  const [forbidden, setForbidden] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [q, setQ] = useState("");
  const [provider, setProvider] = useState("");
  const [status, setStatus] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [busy, setBusy] = useState(false);
  const [providers, setProviders] = useState([]);
  const acRef = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => { setQ(searchInput.trim()); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const load = useCallback(async () => {
    acRef.current?.abort();
    const ac = new AbortController();
    acRef.current = ac;
    try {
      const sp = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE), provider, model: "", status, q });
      const res = await fetch(`${API}?${sp}`, { cache: "no-store", signal: ac.signal });
      if (res.status === 403) { setForbidden(true); return; }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setError(null);
      setLoaded(true);
      setItems(data.items || []);
      if (data.pagination) setPagination(data.pagination);
      if (data.observability) setObs(data.observability);
      setProviders((prev) => {
        const next = new Set(prev);
        (data.items || []).forEach((i) => i.provider && next.add(i.provider));
        return next.size === prev.length ? prev : [...next].sort();
      });
    } catch (err) {
      if (err.name !== "AbortError") setError(err.message || "fetch failed");
    }
  }, [page, provider, status, q]);

  useEffect(() => { load(); return () => acRef.current?.abort(); }, [load]);

  useEffect(() => {
    if (page !== 1) return undefined;
    const t = setInterval(() => document.visibilityState === "visible" && load(), POLL_MS);
    return () => clearInterval(t);
  }, [page, load]);

  const closeDetail = useCallback(() => setSelectedId(null), []);
  const onForbidden = useCallback(() => setForbidden(true), []);

  const saveObs = async (body) => {
    setBusy(true);
    try {
      const res = await fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (res.status === 403) { setForbidden(true); return; }
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
      setObs(await res.json());
      setError(null);
    } catch (err) {
      setError(err.message || "save failed");
    } finally {
      setBusy(false);
    }
  };

  const clearAll = async () => {
    if (!window.confirm("Delete all stored request logs? This cannot be undone.")) return;
    setBusy(true);
    try {
      const res = await fetch(API, { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setPage(1);
      await load();
    } catch (err) {
      setError(err.message || "clear failed");
    } finally {
      setBusy(false);
    }
  };

  const maxDur = useMemo(() => items.reduce((m, i) => Math.max(m, i.durationMs || 0), 0), [items]);
  const providerOptions = useMemo(() => {
    const s = new Set(providers);
    if (provider) s.add(provider);
    return [...s];
  }, [providers, provider]);

  if (forbidden) {
    return (
      <Card padding="md">
        <div className="flex flex-col items-center gap-2 py-10 text-center">
          <span className="material-symbols-outlined text-[32px] text-text-muted">lock</span>
          <div className="text-sm font-medium text-text-main">Master account only</div>
          <div className="text-xs text-text-muted">Request logs are visible to the master account.</div>
        </div>
      </Card>
    );
  }

  const locked = !!obs?.lockedByEnv;
  return (
    <div className="flex flex-col gap-3">
      {obs && obs.enabled === false && (
        <Card padding="sm">
          <div className="flex flex-wrap items-center gap-3">
            <span className="material-symbols-outlined text-[20px] text-text-muted">receipt_long</span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-text-main">Request logging is off. Turn it on to capture prompts and responses.</div>
              <div className="text-xs text-text-muted">
                Stores full prompts and responses (up to 64 KB per payload; long text is trimmed to fit) on this server, including requests from client accounts.
              </div>
              {locked && <div className="text-xs text-yellow-400">Set by environment; cannot be changed here.</div>}
            </div>
            <Button size="sm" icon="play_arrow" disabled={locked} loading={busy} onClick={() => saveObs({ enabled: true, maxJsonKB: 64, maxRecords: 500 })}>
              Enable
            </Button>
          </div>
        </Card>
      )}
      {obs && obs.enabled !== false && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
          <span className="h-2 w-2 rounded-full bg-green-500" />
          <span>Logging on · {obs.total}/{obs.maxRecords} stored · payload cap {obs.maxJsonKB} KB</span>
          {locked && <span className="text-yellow-400">(set by environment)</span>}
          <div className="ml-auto flex items-center gap-2">
            <Button size="sm" variant="ghost" icon="tune" onClick={() => setShowSettings((s) => !s)}>Settings</Button>
            <Button size="sm" variant="outline" disabled={locked || busy} onClick={() => saveObs({ enabled: false })}>Disable</Button>
            <Button size="sm" variant="outline" icon="delete" disabled={busy} onClick={clearAll}>Clear all</Button>
          </div>
          {showSettings && (
            <div className="flex w-full items-center gap-3 rounded-[10px] bg-surface-2 p-2">
              <label className="flex items-center gap-1">Payload cap
                <select className={SELECT_CLS} disabled={locked || busy} value={obs.maxJsonKB} onChange={(e) => saveObs({ maxJsonKB: Number(e.target.value) })}>
                  {[...new Set([...CAPS, obs.maxJsonKB])].sort((a, b) => a - b).map((n) => <option key={n} value={n}>{n} KB</option>)}
                </select>
              </label>
              <label className="flex items-center gap-1">Max records
                <select className={SELECT_CLS} disabled={locked || busy} value={obs.maxRecords} onChange={(e) => saveObs({ maxRecords: Number(e.target.value) })}>
                  {[...new Set([...RECORDS, obs.maxRecords])].sort((a, b) => a - b).map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
            </div>
          )}
        </div>
      )}

      <Card padding="sm">
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search model, preview..."
            className="h-7 w-56 rounded-[8px] border border-border-subtle bg-surface-2 px-2 text-xs text-text-main outline-none focus:border-brand-500/50"
          />
          <select className={SELECT_CLS} value={provider} onChange={(e) => { setProvider(e.target.value); setPage(1); }}>
            <option value="">All providers</option>
            {providerOptions.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <select className={SELECT_CLS} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <Button size="sm" variant="outline" icon="refresh" onClick={load}>Refresh</Button>
          <div className="ml-auto flex items-center gap-2 text-xs text-text-muted">
            <Button size="sm" variant="ghost" icon="chevron_left" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} aria-label="Previous page" />
            <span>page {pagination.page || page} of {pagination.totalPages || 1}</span>
            <Button size="sm" variant="ghost" icon="chevron_right" disabled={page >= (pagination.totalPages || 1)} onClick={() => setPage((p) => p + 1)} aria-label="Next page" />
          </div>
        </div>
        {error && <div className="mt-2 text-xs text-red-400">{error}</div>}
      </Card>

      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-text-muted">
                {["Time", "Status", "Provider / Model", "Tokens (in / out)", "Duration", "Preview"].map((h) => (
                  <th key={h} className="px-3 py-2 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((e) => <Row key={e.id} e={e} maxDur={maxDur} onOpen={setSelectedId} />)}
              {!items.length && (
                <tr>
                  <td colSpan={6} className="px-3 py-10 text-center text-text-muted">
                    {loaded ? "No requests logged." : "Loading..."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Drawer isOpen={!!selectedId} onClose={closeDetail} title="Request" width="xl">
        {selectedId && <DetailBody id={selectedId} maxJsonKB={obs?.maxJsonKB} onForbidden={onForbidden} />}
      </Drawer>
    </div>
  );
}
