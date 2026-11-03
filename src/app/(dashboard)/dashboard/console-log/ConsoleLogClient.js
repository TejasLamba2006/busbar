"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Card, Button } from "@/shared/components";
import SegmentedControl from "@/shared/components/SegmentedControl";
import { useCopyToClipboard } from "@/shared/hooks/useCopyToClipboard";
import { CONSOLE_LOG_CONFIG } from "@/shared/constants/config";
import ConsoleLogRow, { LEVEL_ORDER, formatEntryText } from "./ConsoleLogRow";

const MAX_KEPT = CONSOLE_LOG_CONFIG.maxLines;
const MAX_RENDERED = 400;
const LEVEL_KEY = "busbar:console-log:level";
const LEVEL_OPTIONS = [
  { value: "debug", label: "All" },
  { value: "debug+", label: "Debug+" },
  { value: "info", label: "Info+" },
  { value: "warn", label: "Warn+" },
  { value: "error", label: "Error+" },
];
// "All" and "Debug+" are the same threshold; keep both labels for parity, map to a level.
const toLevel = (v) => (v === "debug+" ? "debug" : v);
const BOTTOM_SLACK = 40;

export default function ConsoleLogClient() {
  const [entries, setEntries] = useState([]);
  const [connected, setConnected] = useState(false);
  const [level, setLevel] = useState("info");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [follow, setFollow] = useState(true);
  const [showJump, setShowJump] = useState(false);
  const { copied, copy } = useCopyToClipboard(1500);

  const entriesRef = useRef([]);
  const rafRef = useRef(0);
  const scrollRef = useRef(null);
  const atBottomRef = useRef(true);
  const followRef = useRef(true);
  const lastIdRef = useRef(null);

  // Restore persisted level after mount (avoids hydration mismatch).
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LEVEL_KEY);
      if (saved && LEVEL_OPTIONS.some((o) => o.value === saved)) setLevel(saved);
    } catch {}
  }, []);

  const changeLevel = useCallback((v) => {
    setLevel(v);
    try { localStorage.setItem(LEVEL_KEY, v); } catch {}
  }, []);

  // Debounce search.
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim().toLowerCase()), 150);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => { followRef.current = follow; }, [follow]);

  // SSE: mutate ref array, coalesce commits to one setState per frame.
  useEffect(() => {
    const schedule = () => {
      if (rafRef.current) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = 0;
        setEntries(entriesRef.current.slice());
      });
    };
    const cap = (arr) => (arr.length > MAX_KEPT ? arr.slice(-MAX_KEPT) : arr);

    const es = new EventSource("/api/translator/console-logs/stream");
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);
    es.onmessage = (e) => {
      let msg;
      try { msg = JSON.parse(e.data); } catch { return; }
      const cur = entriesRef.current;
      if (msg.type === "init") {
        entriesRef.current = cap(msg.logs || []);
      } else if (msg.type === "lines") {
        entriesRef.current = cap(cur.concat(msg.lines || []));
      } else if (msg.type === "bump") {
        for (let i = cur.length - 1; i >= 0; i--) {
          if (cur[i].id === msg.id) {
            cur[i] = { ...cur[i], count: msg.count, ts: msg.ts };
            break;
          }
        }
      } else if (msg.type === "clear") {
        entriesRef.current = [];
      } else return;
      schedule();
    };

    return () => {
      es.close();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    };
  }, []);

  const counts = useMemo(() => {
    const c = { debug: 0, info: 0, warn: 0, error: 0 };
    for (const e of entries) if (e.level in c) c[e.level]++;
    return c;
  }, [entries]);

  const filtered = useMemo(() => {
    const min = LEVEL_ORDER[toLevel(level)] ?? 0;
    return entries.filter((e) => {
      if ((LEVEL_ORDER[e.level] ?? 0) < min) return false;
      if (!search) return true;
      return `${e.tag || ""} ${e.msg}`.toLowerCase().includes(search);
    });
  }, [entries, level, search]);

  const truncated = filtered.length > MAX_RENDERED;
  const visible = useMemo(
    () => (truncated ? filtered.slice(-MAX_RENDERED) : filtered),
    [filtered, truncated]
  );

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
    atBottomRef.current = true;
    setShowJump(false);
  }, []);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < BOTTOM_SLACK;
    atBottomRef.current = atBottom;
    if (atBottom) setShowJump(false);
  }, []);

  // After each commit: pin to bottom if following and reader was at bottom; else offer "Jump to latest".
  useEffect(() => {
    const lastId = visible.length ? visible[visible.length - 1].id : null;
    const isNew = lastId !== lastIdRef.current;
    lastIdRef.current = lastId;
    const el = scrollRef.current;
    if (!el) return;
    if (followRef.current && atBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    } else if (isNew && el.scrollHeight - el.scrollTop - el.clientHeight >= BOTTOM_SLACK) {
      atBottomRef.current = false;
      setShowJump(true);
    }
  }, [visible]);

  const toggleFollow = useCallback(() => {
    setFollow((f) => {
      if (!f) requestAnimationFrame(scrollToBottom);
      return !f;
    });
  }, [scrollToBottom]);

  const handleCopy = useCallback(
    (entry) => copy(formatEntryText(entry), String(entry.id)),
    [copy]
  );

  const handleCopyAll = () => copy(filtered.map(formatEntryText).join("\n"), "all");

  const handleClear = async () => {
    try {
      await fetch("/api/translator/console-logs", { method: "DELETE" });
      // UI cleared via SSE "clear" event
    } catch (err) {
      console.error("Failed to clear console logs:", err);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <Card padding="sm">
        <div className="flex flex-wrap items-center gap-3">
          <SegmentedControl size="sm" options={LEVEL_OPTIONS} value={level} onChange={changeLevel} />
          <div className="relative flex-1 min-w-[160px] max-w-xs">
            <span className="material-symbols-outlined absolute left-2 top-1/2 -translate-y-1/2 text-[16px] text-text-muted">
              search
            </span>
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search logs..."
              className="w-full h-7 pl-8 pr-2 text-xs rounded-[8px] bg-surface-2 border border-border-subtle text-text-main placeholder:text-text-muted outline-none focus:border-brand-500/50"
            />
          </div>
          <Button size="sm" variant={follow ? "primary" : "outline"} icon="vertical_align_bottom" onClick={toggleFollow}>
            Follow
          </Button>
          <Button size="sm" variant="outline" icon={copied === "all" ? "check" : "content_copy"} onClick={handleCopyAll} disabled={!filtered.length}>
            Copy all
          </Button>
          <Button size="sm" variant="outline" icon="delete" onClick={handleClear}>
            Clear
          </Button>

          <div className="ml-auto flex items-center gap-3 text-xs text-text-muted">
            <span className="flex items-center gap-1.5" title={connected ? "Connected" : "Disconnected"}>
              <span className={`size-2 rounded-full ${connected ? "bg-green-500 animate-pulse" : "bg-red-500"}`} />
              {connected ? "Live" : "Offline"}
            </span>
            <span>{filtered.length} shown / {entries.length} total</span>
            {counts.error > 0 && (
              <span className="px-2 py-0.5 rounded-full border text-red-400 border-red-500/30 bg-red-500/10">
                {counts.error} error
              </span>
            )}
            {counts.warn > 0 && (
              <span className="px-2 py-0.5 rounded-full border text-yellow-400 border-yellow-500/30 bg-yellow-500/10">
                {counts.warn} warn
              </span>
            )}
          </div>
        </div>
      </Card>

      <div className="relative rounded-[14px] overflow-hidden border border-border-subtle bg-[#0d1117]">
        <div className="sticky top-0 z-10 flex items-center gap-2 px-4 py-2 bg-[#161b22] border-b border-white/10">
          <span className="size-3 rounded-full bg-[#ff5f56]" />
          <span className="size-3 rounded-full bg-[#ffbd2e]" />
          <span className="size-3 rounded-full bg-[#27c93f]" />
          <span className="ml-2 text-xs font-mono text-gray-400">Busbar console</span>
        </div>
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="h-[calc(100vh-300px)] min-h-[240px] overflow-y-auto p-2 text-xs font-mono"
        >
          {truncated && (
            <div className="px-2 py-1 mb-1 text-center text-[11px] text-gray-500">
              showing latest {MAX_RENDERED}, narrow the filter to see more
            </div>
          )}
          {visible.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center gap-2 text-gray-500">
              <span className="material-symbols-outlined text-[40px]">terminal</span>
              <span>{entries.length ? "No logs match the filter." : "No console logs yet."}</span>
            </div>
          ) : (
            visible.map((entry) => (
              <ConsoleLogRow
                key={entry.id}
                entry={entry}
                copied={copied === String(entry.id)}
                onCopy={handleCopy}
              />
            ))
          )}
        </div>
        {showJump && (
          <button
            onClick={scrollToBottom}
            className="absolute bottom-4 right-6 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs bg-brand-500 text-white shadow-lg hover:opacity-90"
          >
            <span className="material-symbols-outlined text-[16px]">arrow_downward</span>
            Jump to latest
          </button>
        )}
      </div>
    </div>
  );
}
