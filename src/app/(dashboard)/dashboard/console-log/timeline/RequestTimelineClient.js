"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Card, Button } from "@/shared/components";
import Drawer from "@/shared/components/Drawer";
import SegmentedControl from "@/shared/components/SegmentedControl";
import { cn } from "@/shared/utils/cn";
import { DetailBody } from "../requests/RequestLogClient";
import {
  MAX_ROWS, statusKind, allocateLanes, mergeRows, visibleRows, axisTicks, formatTick, formatMs,
} from "./timelineUtils";

const POLL_MS = 3000;
const OVERLAP_MS = 5000;
const INITIAL_LOOKBACK_MS = 3600_000;
const FRAME_MS = 100;
const LANE_H = 22;
const BAR_H = 16;
const MIN_SPAN = 10_000;
const MAX_SPAN = 6 * 3600_000;
const PRESETS = [
  { value: "60000", label: "1m" },
  { value: "300000", label: "5m" },
  { value: "900000", label: "15m" },
  { value: "3600000", label: "1h" },
];
const noop = () => {};
const KIND_BG ={ ok: "bg-green-500", error: "bg-red-500", unknown: "bg-gray-400" };
const KIND_TEXT = { ok: "text-green-500", error: "text-red-500", unknown: "text-text-muted" };

const Bar = memo(function Bar({ row, kind, left, width, lane, selected, onHover, onLeave, onSelect }) {
  const ttftPct = row.ttftMs && row.durationMs ? Math.min(100, (row.ttftMs / row.durationMs) * 100) : 0;
  return (
    <div
      onMouseEnter={(e) => onHover(row, e)}
      onMouseMove={(e) => onHover(row, e)}
      onMouseLeave={onLeave}
      onClick={() => onSelect(row)}
      className={cn(
        "absolute rounded-[3px] overflow-hidden cursor-pointer min-w-[3px]",
        KIND_BG[kind],
        selected && "ring-2 ring-text-main"
      )}
      style={{ left: `${left}%`, width: `${width}%`, top: lane * LANE_H + (LANE_H - BAR_H) / 2, height: BAR_H }}
    >
      {ttftPct > 0 && <div className="absolute inset-y-0 left-0 bg-black/30" style={{ width: `${ttftPct}%` }} />}
      <span className="relative block truncate px-1 text-[10px] leading-4 font-medium text-white/90 pointer-events-none">{row.model || row.provider}</span>
    </div>
  );
});

export default function RequestTimelineClient() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState(null);
  const [spanMs, setSpanMs] = useState(300_000);
  const [follow, setFollow] = useState(true);
  // 0 until mounted: Date.now() and local-time tick labels differ between server and client render (hydration error #418)
  const [now, setNow] = useState(0);
  const [pausedEnd, setPausedEnd] = useState(0);
  const [provider, setProvider] = useState("");
  const [errorsOnly, setErrorsOnly] = useState(false);
  const [tip, setTip] = useState(null);
  const [selected, setSelected] = useState(null);

  const trackRef = useRef(null);
  const rowsRef = useRef([]);
  const dragRef = useRef(null);
  const movedRef = useRef(false);
  const viewRef = useRef({});

  const ready = now > 0;
  const end = follow ? now : pausedEnd;
  const start = end - spanMs;
  viewRef.current = { follow, end, spanMs };

  useEffect(() => { const t = Date.now(); setNow(t); setPausedEnd(t); }, []);

  // Polling: incremental fetch with small overlap, paused while tab hidden.
  useEffect(() => {
    let stopped = false;
    const poll = async () => {
      if (document.hidden) return;
      const last = rowsRef.current.reduce((m, r) => Math.max(m, r.ts + r.durationMs), 0);
      const since = last ? last - OVERLAP_MS : Date.now() - INITIAL_LOOKBACK_MS;
      try {
        const res = await fetch(`/api/usage/request-timeline?sinceMs=${Math.floor(since)}&limit=1000`);
        if (!res.ok) throw new Error(res.status === 403 ? "Master only" : `HTTP ${res.status}`);
        const data = await res.json();
        if (stopped) return;
        rowsRef.current = mergeRows(rowsRef.current, data.rows || [], MAX_ROWS);
        setRows(rowsRef.current);
        setError(null);
      } catch (e) {
        if (!stopped) setError(e.message);
      }
    };
    poll();
    const id = setInterval(poll, POLL_MS);
    const onVis = () => { if (!document.hidden) poll(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { stopped = true; clearInterval(id); document.removeEventListener("visibilitychange", onVis); };
  }, []);

  // Follow-live: advance "now" via rAF, throttled.
  useEffect(() => {
    if (!follow) return;
    let raf = 0;
    let lastT = 0;
    const tick = (t) => {
      if (t - lastT >= FRAME_MS) { lastT = t; setNow(Date.now()); }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [follow]);

  const zoom = useCallback((factor, frac = 1) => {
    const { follow: f, end: e, spanMs: s } = viewRef.current;
    const next = Math.min(MAX_SPAN, Math.max(MIN_SPAN, s * factor));
    if (!f) setPausedEnd(e - (1 - frac) * s + (1 - frac) * next); // keep time under cursor fixed
    setSpanMs(next);
  }, []);

  // Native non-passive listener so ctrl+wheel can preventDefault browser zoom.
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const onWheel = (e) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      zoom(e.deltaY > 0 ? 1.25 : 0.8, (e.clientX - rect.left) / rect.width);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoom]);

  const onPointerDown = (e) => {
    if (e.button !== 0) return;
    movedRef.current = false;
    dragRef.current = { x: e.clientX, end: viewRef.current.end, moved: false };
  };
  const onPointerMove = (e) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    if (!d.moved && Math.abs(dx) < 3) return;
    if (!d.moved) e.currentTarget.setPointerCapture?.(e.pointerId);
    d.moved = true;
    movedRef.current = true;
    const w = trackRef.current?.clientWidth || 1;
    setFollow(false);
    setPausedEnd(d.end - (dx / w) * viewRef.current.spanMs);
    setTip(null);
  };
  const onPointerUp = () => { dragRef.current = null; };

  const providers = useMemo(() => [...new Set(rows.map((r) => r.provider).filter(Boolean))].sort(), [rows]);

  const filtered = useMemo(
    () => rows.filter((r) => (!provider || r.provider === provider) && (!errorsOnly || statusKind(r.status) === "error")),
    [rows, provider, errorsOnly]
  );
  // Lanes over all filtered rows so bars keep their lane while panning.
  const { lanes, laneCount } = useMemo(() => allocateLanes(filtered), [filtered]);
  const visible = useMemo(() => (ready ? visibleRows(filtered, start, end) : []), [ready, filtered, start, end]);
  const { step, ticks } = useMemo(() => (ready ? axisTicks(start, end) : { step: 0, ticks: [] }), [ready, start, end]);

  const onHover = useCallback((row, e) => setTip({ row, x: e.clientX, y: e.clientY }), []);
  const onLeave = useCallback(() => setTip(null), []);
  const onSelect = useCallback((row) => { if (!movedRef.current) setSelected(row); }, []);

  const pct = (t) => ((t - start) / spanMs) * 100;
  const errCount = useMemo(() => rows.filter((r) => statusKind(r.status) === "error").length, [rows]);

  return (
    <div className="flex flex-col gap-3">
      <Card padding="sm">
        <div className="flex flex-wrap items-center gap-3">
          <SegmentedControl
            size="sm"
            options={PRESETS}
            value={PRESETS.some((p) => Number(p.value) === spanMs) ? String(spanMs) : ""}
            onChange={(v) => { setSpanMs(Number(v)); setNow(Date.now()); setFollow(true); }}
          />
          <div className="flex items-center gap-1">
            <Button size="sm" variant="outline" icon="remove" onClick={() => zoom(1.5)} aria-label="Zoom out" />
            <Button size="sm" variant="outline" icon="add" onClick={() => zoom(1 / 1.5)} aria-label="Zoom in" />
          </div>
          <Button
            size="sm"
            variant={follow ? "primary" : "outline"}
            icon={follow ? "pause" : "play_arrow"}
            onClick={() => { setNow(Date.now()); setPausedEnd(Date.now()); setFollow((f) => !f); }}
          >
            {follow ? "Live" : "Follow live"}
          </Button>
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            className="h-7 px-2 text-xs rounded-[8px] bg-surface-2 border border-border-subtle text-text-main outline-none focus:border-brand-500/50"
          >
            <option value="">All providers</option>
            {providers.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <Button size="sm" variant={errorsOnly ? "primary" : "outline"} icon="error" onClick={() => setErrorsOnly((v) => !v)}>
            Errors only
          </Button>

          <div className="ml-auto flex items-center gap-3 text-xs text-text-muted">
            <span className="flex items-center gap-1"><i className="size-2.5 rounded-sm bg-green-500" />ok</span>
            <span className="flex items-center gap-1"><i className="size-2.5 rounded-sm bg-red-500" />error</span>
            <span className="flex items-center gap-1"><i className="size-2.5 rounded-sm bg-gray-400" />unknown</span>
            <span className="flex items-center gap-1"><i className="size-2.5 rounded-sm bg-black/30 border border-border-subtle" />TTFB</span>
            <span>{visible.length} shown / {rows.length} loaded</span>
            {errCount > 0 && (
              <span className="px-2 py-0.5 rounded-full border text-red-400 border-red-500/30 bg-red-500/10">{errCount} error</span>
            )}
          </div>
        </div>
      </Card>

      {error && <div className="text-xs text-red-400 px-1">Timeline fetch failed: {error}</div>}

      <Card padding="none" className="overflow-hidden">
        <div className="relative h-6 border-b border-border-subtle bg-surface-2 text-[10px] text-text-muted select-none">
          {ticks.map((t) => (
            <span key={t} className="absolute top-1 -translate-x-1/2 font-mono" style={{ left: `${pct(t)}%` }}>
              {formatTick(t, step)}
            </span>
          ))}
        </div>
        <div className="h-[calc(100vh-340px)] min-h-[240px] overflow-y-auto overflow-x-hidden">
          <div
            ref={trackRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            className="relative w-full cursor-grab active:cursor-grabbing select-none touch-none overflow-hidden"
            style={{ height: Math.max(laneCount, 1) * LANE_H + 8, minHeight: "100%" }}
          >
            {ticks.map((t) => (
              <div key={t} className="absolute inset-y-0 w-px bg-border-subtle" style={{ left: `${pct(t)}%` }} />
            ))}
            {visible.map((r) => (
              <Bar
                key={r.id}
                row={r}
                kind={statusKind(r.status)}
                left={pct(r.ts)}
                width={(r.durationMs / spanMs) * 100}
                lane={lanes.get(r.id) || 0}
                selected={selected?.id === r.id}
                onHover={onHover}
                onLeave={onLeave}
                onSelect={onSelect}
              />
            ))}
            {visible.length === 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-text-muted pointer-events-none">
                <span className="material-symbols-outlined text-[40px]">timeline</span>
                <span>{rows.length ? "No requests in this window." : "No requests yet."}</span>
              </div>
            )}
          </div>
        </div>
      </Card>

      {tip && (
        <div
          className="fixed z-50 pointer-events-none px-2.5 py-1.5 rounded-[8px] bg-surface border border-border-subtle shadow-lg text-xs text-text-main"
          style={{ left: Math.min(tip.x + 12, (typeof window !== "undefined" ? window.innerWidth : 0) - 240), top: tip.y + 14 }}
        >
          <div className="font-medium">{tip.row.provider || "?"} / {tip.row.model || "?"}</div>
          <div className="text-text-muted">
            {formatMs(tip.row.durationMs)}{tip.row.ttftMs != null && ` · TTFB ${formatMs(tip.row.ttftMs)}`}
          </div>
          <div className="text-text-muted">in {tip.row.promptTokens} · out {tip.row.completionTokens}</div>
          <div className={KIND_TEXT[statusKind(tip.row.status)]}>{tip.row.status}</div>
        </div>
      )}

      <Drawer isOpen={!!selected} onClose={() => setSelected(null)} title="Request" width={selected?.detailId ? "xl" : "lg"}>
        {selected && (
          <div className="space-y-3 text-sm">
            {[
              ["ID", <span key="i" className="font-mono break-all">{selected.id}</span>],
              ["Started", new Date(selected.ts).toLocaleString()],
              ["Provider", selected.provider || "—"],
              ["Model", <span key="m" className="font-mono">{selected.model || "—"}</span>],
              ["Connection", <span key="c" className="font-mono break-all">{selected.connectionId || "—"}</span>],
              ["Status", <span key="s" className={KIND_TEXT[statusKind(selected.status)]}>{selected.status}</span>],
              ["Duration", formatMs(selected.durationMs)],
              ["TTFB", formatMs(selected.ttftMs)],
              ["Tokens", `in ${selected.promptTokens} / out ${selected.completionTokens}`],
            ].map(([k, v]) => (
              <div key={k}><span className="text-text-muted">{k}:</span> <span className="text-text-main">{v}</span></div>
            ))}
            {selected.detailId ? (
              <DetailBody id={selected.detailId} maxJsonKB={64} onForbidden={noop} />
            ) : (
              <div className="text-xs text-text-muted">No stored payload for this request.</div>
            )}
            <div className="flex flex-wrap gap-3">
              <Link href="/dashboard/console-log/requests" className="inline-flex items-center gap-1 text-brand-500 hover:underline">
                <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                Open in Requests tab
              </Link>
              <Link href="/dashboard/usage" className="inline-flex items-center gap-1 text-brand-500 hover:underline">
                <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                Full request/response in Usage &rarr; Request Details
              </Link>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
