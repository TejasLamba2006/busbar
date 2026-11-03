// Pure helpers for the request timeline (no React, no DOM).

export const MAX_ROWS = 2000;

const STEPS = [1e3, 2e3, 5e3, 1e4, 15e3, 3e4, 6e4, 12e4, 3e5, 6e5, 9e5, 18e5, 36e5, 72e5];

// "ok" | "error" | "unknown"
export function statusKind(status) {
  const s = String(status ?? "").toLowerCase();
  if (s === "ok" || s === "success" || s === "completed") return "ok";
  if (/^[23]\d\d$/.test(s)) return "ok";
  if (s === "error" || s === "failed" || s === "failure" || /^[45]\d\d$/.test(s)) return "error";
  return "unknown";
}

// Greedy lane packing: earliest-start first, reuse first lane that is free.
// minMs pads short bars so near-touching bars do not visually overlap.
export function allocateLanes(rows, minMs = 1000) {
  const sorted = [...rows].sort((a, b) => a.ts - b.ts);
  const laneEnds = [];
  const lanes = new Map();
  for (const r of sorted) {
    let i = laneEnds.findIndex((end) => end <= r.ts);
    if (i < 0) i = laneEnds.length;
    laneEnds[i] = r.ts + Math.max(r.durationMs || 0, minMs);
    lanes.set(r.id, i);
  }
  return { lanes, laneCount: laneEnds.length };
}

// Merge by id (incoming wins), keep newest `cap` by start time.
export function mergeRows(existing, incoming, cap = MAX_ROWS) {
  const map = new Map(existing.map((r) => [r.id, r]));
  for (const r of incoming) map.set(r.id, r);
  const all = [...map.values()];
  if (all.length > cap) {
    all.sort((a, b) => b.ts - a.ts);
    all.length = cap;
  }
  return all;
}

export function visibleRows(rows, start, end) {
  return rows.filter((r) => r.ts <= end && r.ts + (r.durationMs || 0) >= start);
}

// Tick timestamps aligned to a "nice" step, about `target` ticks across the span.
export function axisTicks(start, end, target = 6) {
  const span = end - start;
  if (!(span > 0)) return { step: STEPS[0], ticks: [] };
  const want = span / target;
  const step = STEPS.find((s) => s >= want) ?? STEPS[STEPS.length - 1];
  const ticks = [];
  for (let t = Math.ceil(start / step) * step; t <= end; t += step) ticks.push(t);
  return { step, ticks };
}

const p2 = (n) => String(n).padStart(2, "0");
export function formatTick(ts, step) {
  const d = new Date(ts);
  const hm = `${p2(d.getHours())}:${p2(d.getMinutes())}`;
  return step < 6e4 ? `${hm}:${p2(d.getSeconds())}` : hm;
}

export function formatMs(ms) {
  if (ms == null) return "—";
  return ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(ms < 10000 ? 2 : 1)}s`;
}
