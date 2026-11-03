"use client";

import { memo, useState } from "react";

export const LEVEL_ORDER = { debug: 0, info: 1, warn: 2, error: 3 };

const LEVEL_BADGE = {
  debug: "text-gray-400 border-gray-500/30 bg-gray-500/10",
  info: "text-cyan-400 border-cyan-500/30 bg-cyan-500/10",
  warn: "text-yellow-400 border-yellow-500/30 bg-yellow-500/10",
  error: "text-red-400 border-red-500/30 bg-red-500/10",
};

// Same tag always maps to same chip color.
const TAG_PALETTE = [
  "text-purple-400 bg-purple-500/10 border-purple-500/30",
  "text-sky-400 bg-sky-500/10 border-sky-500/30",
  "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
  "text-amber-400 bg-amber-500/10 border-amber-500/30",
  "text-pink-400 bg-pink-500/10 border-pink-500/30",
  "text-teal-400 bg-teal-500/10 border-teal-500/30",
  "text-orange-400 bg-orange-500/10 border-orange-500/30",
  "text-indigo-400 bg-indigo-500/10 border-indigo-500/30",
];

function tagClass(tag) {
  let h = 0;
  for (let i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) | 0;
  return TAG_PALETTE[Math.abs(h) % TAG_PALETTE.length];
}

const TIME_FMT = new Intl.DateTimeFormat("en-GB", {
  hour12: false,
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

function formatTime(ts) {
  const ms = String(Math.floor(ts) % 1000).padStart(3, "0");
  return `${TIME_FMT.format(ts)}.${ms}`;
}

export function formatEntryText(entry) {
  const tag = entry.tag ? ` [${entry.tag}]` : "";
  const count = entry.count > 1 ? ` (x${entry.count})` : "";
  return `${formatTime(entry.ts)} ${entry.level.toUpperCase()}${tag} ${entry.msg}${count}`;
}

function isLong(msg) {
  return msg.length > 300 || msg.includes("\n");
}

function ConsoleLogRow({ entry, copied, onCopy }) {
  const [expanded, setExpanded] = useState(false);
  const { ts, level, tag, msg, count } = entry;
  const long = isLong(msg);

  return (
    <div
      className={`group relative flex items-start gap-2 px-2 py-0.5 font-mono text-xs leading-relaxed hover:bg-white/5 ${
        level === "error" ? "bg-red-500/5" : ""
      }`}
    >
      <span className="shrink-0 text-[#484f58] tabular-nums">{formatTime(ts)}</span>
      <span
        className={`shrink-0 rounded border px-1 text-[10px] font-semibold uppercase ${
          LEVEL_BADGE[level] || LEVEL_BADGE.debug
        }`}
      >
        {level}
      </span>
      {tag && (
        <span className={`shrink-0 rounded border px-1 text-[10px] ${tagClass(tag)}`}>[{tag}]</span>
      )}
      {count > 1 && (
        <span className="shrink-0 rounded-full bg-white/10 px-1.5 text-[10px] text-text-muted">
          x{count}
        </span>
      )}
      <div className="min-w-0 flex-1 pr-6">
        <span
          className={`block whitespace-pre-wrap break-words text-[#c9d1d9] ${
            long && !expanded ? "line-clamp-3" : ""
          }`}
        >
          {msg}
        </span>
        {long && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className="text-[10px] text-text-muted hover:text-[#c9d1d9]"
          >
            {expanded ? "show less" : "show more"}
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={() => onCopy(entry)}
        aria-label="Copy log line"
        className="absolute right-1 top-0.5 rounded p-0.5 text-text-muted opacity-0 hover:text-[#c9d1d9] focus-visible:opacity-100 group-hover:opacity-100"
      >
        <span className="material-symbols-outlined text-[14px]">
          {copied ? "check" : "content_copy"}
        </span>
      </button>
      {copied && (
        <span role="status" className="sr-only">
          Copied
        </span>
      )}
    </div>
  );
}

export default memo(ConsoleLogRow);
