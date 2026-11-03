"use client";

import { memo, useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Card, Button } from "@/shared/components";
import SegmentedControl from "@/shared/components/SegmentedControl";

const PAGE = 200;
const REFRESH_MS = 10000;

const FILTERS = [
  { value: "", label: "All" },
  { value: "key", label: "Keys" },
  { value: "provider", label: "Providers" },
  { value: "combo", label: "Combos" },
  { value: "settings", label: "Settings" },
  { value: "proxy-pool", label: "Proxy pools" },
  { value: "auth", label: "Auth" },
  { value: "account", label: "Cooldowns" },
  { value: "request", label: "Errors" },
];

const FAMILY = {
  key: { icon: "vpn_key", cls: "text-amber-400 bg-amber-500/10 border-amber-500/30" },
  provider: { icon: "hub", cls: "text-blue-400 bg-blue-500/10 border-blue-500/30" },
  combo: { icon: "account_tree", cls: "text-purple-400 bg-purple-500/10 border-purple-500/30" },
  settings: { icon: "tune", cls: "text-slate-300 bg-slate-500/10 border-slate-500/30" },
  "proxy-pool": { icon: "lan", cls: "text-cyan-400 bg-cyan-500/10 border-cyan-500/30" },
  auth: { icon: "login", cls: "text-green-400 bg-green-500/10 border-green-500/30" },
  account: { icon: "timer_pause", cls: "text-orange-400 bg-orange-500/10 border-orange-500/30" },
  request: { icon: "error", cls: "text-red-400 bg-red-500/10 border-red-500/30" },
};
const FAILED = { icon: "gpp_bad", cls: "text-red-400 bg-red-500/10 border-red-500/30" };
const FALLBACK = { icon: "history", cls: "text-text-muted bg-surface-2 border-border-subtle" };

const styleOf = (type) =>
  type === "auth.login_failed" ? FAILED : FAMILY[String(type).split(".")[0]] || FALLBACK;

const dayKey = (ts) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

function dayLabel(key, now) {
  if (key === dayKey(now)) return "Today";
  if (key === dayKey(now - 86400000)) return "Yesterday";
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "short", month: "short", day: "numeric", year: "numeric",
  });
}

function relTime(ts, now) {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 45) return "just now";
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

const fmtVal = (v) => {
  const s = typeof v === "object" && v !== null ? JSON.stringify(v) : String(v);
  return s.length > 80 ? `${s.slice(0, 80)}…` : s;
};

const metaEntries = (meta) =>
  meta && typeof meta === "object" ? Object.entries(meta).filter(([, v]) => v != null) : [];

const ActivityItem = memo(function ActivityItem({ ev, now }) {
  const [open, setOpen] = useState(false);
  const st = styleOf(ev.type);
  const entries = metaEntries(ev.meta);
  const hasMeta = entries.length > 0;
  const isMaster = ev.actor === "master";

  return (
    <div className="border-b border-border-subtle last:border-b-0">
      <div
        className={`flex items-start gap-3 px-4 py-2.5 ${hasMeta ? "cursor-pointer hover:bg-surface-2/50" : ""}`}
        onClick={hasMeta ? () => setOpen((o) => !o) : undefined}
      >
        <span className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border ${st.cls}`}>
          <span className="material-symbols-outlined text-[16px]">{st.icon}</span>
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-sm text-text-main break-words">{ev.summary}</span>
            <span
              className={`px-1.5 py-0.5 rounded-full border text-[10px] font-medium ${
                isMaster
                  ? "text-text-muted border-border-subtle bg-surface-2"
                  : "text-indigo-400 border-indigo-500/30 bg-indigo-500/10"
              }`}
              title={isMaster ? "Master account" : "Client"}
            >
              {isMaster ? "master" : ev.actor}
            </span>
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-text-muted">
            <span className="font-mono">{ev.type}</span>
            {ev.target && <span className="font-mono truncate max-w-[320px]">{ev.target}</span>}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1 text-[11px] text-text-muted">
          <span title={new Date(ev.ts).toLocaleString()}>{relTime(ev.ts, now)}</span>
          {hasMeta && (
            <span className="material-symbols-outlined text-[16px]">
              {open ? "expand_less" : "expand_more"}
            </span>
          )}
        </div>
      </div>
      {hasMeta && open && (
        <div className="flex flex-wrap gap-1.5 px-4 pb-3 pl-14">
          {entries.map(([k, v]) => (
            <span
              key={k}
              className="px-2 py-0.5 rounded-md border border-border-subtle bg-surface-2 text-[11px] text-text-muted"
            >
              {k}: <span className="text-text-main">{fmtVal(v)}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
});

const DayHeader = memo(function DayHeader({ label, count }) {
  return (
    <div className="sticky top-0 z-10 flex items-center gap-3 px-4 py-1.5 bg-surface border-b border-border-subtle">
      <span className="text-xs font-semibold uppercase tracking-widest text-text-muted">{label}</span>
      <span className="text-[11px] text-text-muted opacity-70">{count}</span>
      <div className="h-px flex-1 bg-border-subtle" />
    </div>
  );
});

export default function ActivityFeedClient() {
  const [events, setEvents] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [filter, setFilter] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState("");
  const [now, setNow] = useState(() => Date.now());

  const filterRef = useRef(filter);
  const eventsRef = useRef(events);
  const seqRef = useRef(0); // bumps on filter change to drop stale responses
  eventsRef.current = events;

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim().toLowerCase()), 150);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  // Returns parsed body or null (sets forbidden/error as side effect).
  const fetchPage = useCallback(async (beforeId) => {
    const p = new URLSearchParams({ limit: String(PAGE) });
    if (beforeId != null) p.set("beforeId", String(beforeId));
    if (filterRef.current) p.set("type", filterRef.current);
    const res = await fetch(`/api/usage/activity?${p}`, { cache: "no-store" });
    if (res.status === 403) { setForbidden(true); return null; }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    setForbidden(false);
    return res.json();
  }, []);

  // Merge by id, newest first; keeps already-loaded older pages.
  const merge = (prev, incoming) => {
    const map = new Map(prev.map((e) => [e.id, e]));
    for (const e of incoming) map.set(e.id, e);
    return [...map.values()].sort((a, b) => b.id - a.id);
  };

  const refresh = useCallback(async (reset = false) => {
    const seq = seqRef.current;
    try {
      const data = await fetchPage();
      if (!data || seq !== seqRef.current) return;
      const list = data.events || [];
      setError("");
      if (reset || eventsRef.current.length === 0) {
        setEvents(list);
        setHasMore(!!data.hasMore);
      } else {
        setEvents((prev) => merge(prev, list));
      }
    } catch (err) {
      if (seq === seqRef.current) setError(err.message || "Failed to load");
    } finally {
      if (seq === seqRef.current) setLoading(false);
    }
  }, [fetchPage]);

  // Initial load + filter change: reset.
  useEffect(() => {
    filterRef.current = filter;
    seqRef.current++;
    setEvents([]);
    setHasMore(false);
    setLoading(true);
    refresh(true);
  }, [filter, refresh]);

  // Quiet auto-refresh while tab visible.
  useEffect(() => {
    if (forbidden) return;
    const t = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, REFRESH_MS);
    return () => clearInterval(t);
  }, [refresh, forbidden]);

  const loadMore = async () => {
    const last = eventsRef.current[eventsRef.current.length - 1];
    if (!last || loadingMore) return;
    const seq = seqRef.current;
    setLoadingMore(true);
    try {
      const data = await fetchPage(last.id);
      if (!data || seq !== seqRef.current) return;
      setEvents((prev) => merge(prev, data.events || []));
      setHasMore(!!data.hasMore);
    } catch (err) {
      setError(err.message || "Failed to load more");
    } finally {
      setLoadingMore(false);
    }
  };

  const handleClear = async () => {
    if (!window.confirm("Clear all activity history? This cannot be undone.")) return;
    try {
      const res = await fetch("/api/usage/activity", { method: "DELETE" });
      if (res.status === 403) { setForbidden(true); return; }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      seqRef.current++;
      setEvents([]);
      setHasMore(false);
      setError("");
    } catch (err) {
      setError(err.message || "Failed to clear");
    }
  };

  const filtered = useMemo(() => {
    if (!search) return events;
    return events.filter((e) =>
      `${e.summary || ""} ${e.target || ""} ${e.actor || ""}`.toLowerCase().includes(search)
    );
  }, [events, search]);

  const groups = useMemo(() => {
    const out = [];
    for (const e of filtered) {
      const k = dayKey(e.ts);
      const last = out[out.length - 1];
      if (last && last.key === k) last.items.push(e);
      else out.push({ key: k, items: [e] });
    }
    return out;
  }, [filtered]);

  if (forbidden) {
    return (
      <Card padding="sm">
        <div className="flex flex-col items-center justify-center gap-2 py-16 text-text-muted">
          <span className="material-symbols-outlined text-[40px]">lock</span>
          <span className="text-sm font-medium text-text-main">Master account only</span>
          <span className="text-xs">Activity history is visible to the master account.</span>
        </div>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <Card padding="sm">
        <div className="flex flex-wrap items-center gap-3">
          <SegmentedControl size="sm" options={FILTERS} value={filter} onChange={setFilter} />
          <div className="relative flex-1 min-w-[160px] max-w-xs">
            <span className="material-symbols-outlined absolute left-2 top-1/2 -translate-y-1/2 text-[16px] text-text-muted">
              search
            </span>
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search loaded events..."
              className="w-full h-7 pl-8 pr-2 text-xs rounded-[8px] bg-surface-2 border border-border-subtle text-text-main placeholder:text-text-muted outline-none focus:border-brand-500/50"
            />
          </div>
          <Button size="sm" variant="outline" icon="refresh" onClick={() => refresh()}>
            Refresh
          </Button>
          <Button size="sm" variant="outline" icon="delete" onClick={handleClear} disabled={!events.length}>
            Clear history
          </Button>
          <span className="ml-auto text-xs text-text-muted">
            {filtered.length} shown / {events.length} loaded
          </span>
        </div>
      </Card>

      {error && (
        <div className="px-3 py-2 rounded-[10px] border border-red-500/30 bg-red-500/10 text-xs text-red-400">
          {error}
        </div>
      )}

      <Card padding="none">
        <div className="h-[calc(100vh-300px)] min-h-[240px] overflow-y-auto">
          {loading && events.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-text-muted">Loading...</div>
          ) : groups.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-text-muted">
              <span className="material-symbols-outlined text-[40px]">history</span>
              <span className="text-sm">{events.length ? "No events match the search." : "No activity yet."}</span>
            </div>
          ) : (
            <>
              {groups.map((g) => (
                <section key={g.key}>
                  <DayHeader label={dayLabel(g.key, now)} count={g.items.length} />
                  {g.items.map((ev) => (
                    <ActivityItem key={ev.id} ev={ev} now={now} />
                  ))}
                </section>
              ))}
              {hasMore && (
                <div className="flex justify-center p-3">
                  <Button size="sm" variant="outline" onClick={loadMore} disabled={loadingMore}>
                    {loadingMore ? "Loading..." : "Load more"}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </Card>
    </div>
  );
}
