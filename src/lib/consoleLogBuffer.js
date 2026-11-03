import { EventEmitter } from "events";
import { CONSOLE_LOG_CONFIG } from "@/shared/constants/config.js";

const consoleLevels = ["log", "info", "warn", "error", "debug"];

if (!global._consoleLogBufferState) {
  global._consoleLogBufferState = {
    logs: [],
    patched: false,
    originals: {},
    emitter: new EventEmitter(),
  };
  global._consoleLogBufferState.emitter.setMaxListeners(50);
}

const state = global._consoleLogBufferState;

// Ensure emitter exists (handles hot reload with stale global)
if (!state.emitter) {
  state.emitter = new EventEmitter();
  state.emitter.setMaxListeners(50);
}

if (!state.pendingLines) state.pendingLines = [];
if (!state.pendingBumps) state.pendingBumps = new Map();
if (!state.flushTimer) state.flushTimer = null;
if (!state.nextId) state.nextId = 1;
// Drop entries from a stale pre-structured buffer (hot reload)
if (state.logs.length && typeof state.logs[0] === "string") state.logs = [];

const FLUSH_INTERVAL_MS = 100;
const MAX_BATCH_LINES = 50;

function flushPendingLines() {
  state.flushTimer = null;
  if (state.pendingLines.length) {
    const lines = state.pendingLines.splice(0, state.pendingLines.length);
    state.emitter.emit("lines", lines);
  }
  if (state.pendingBumps.size) {
    const bumps = [...state.pendingBumps.values()];
    state.pendingBumps.clear();
    state.emitter.emit("bump", bumps);
  }
}

function scheduleFlush() {
  if (state.flushTimer) return;
  state.flushTimer = setTimeout(flushPendingLines, FLUSH_INTERVAL_MS);
  state.flushTimer?.unref?.();
}

function toLogLine(level, args) {
  return args.map(formatArg).join(" ");
}

// Strip ANSI escape codes so terminal colors don't bleed into UI
const ANSI_RE = /\x1b\[[0-9;]*m/g;

function stripAnsi(str) {
  return str.replace(ANSI_RE, "");
}

function formatArg(arg) {
  if (typeof arg === "string") return stripAnsi(arg);
  if (arg instanceof Error) return stripAnsi(arg.stack || arg.message || String(arg));
  try {
    return stripAnsi(JSON.stringify(arg));
  } catch {
    return stripAnsi(String(arg));
  }
}

const MAX_MSG_CHARS = 4000;
const REQ_DOTS = ["🟢", "🔵", "🟣", "🟡", "🟠", "🔴", "⚪", "🟤"];
// Leading emoji -> [level, fixed tag|null]; null tag means "read [TAG] from message"
const EMOJI_LINES = [
  ["ℹ", "info", null],
  ["⚠", "warn", null],
  ["❌", "error", null],
  ["🔍", "debug", null],
  ["🌊", "info", null],
  ["📥", "info", "REQ"],
  ["📤", "info", "RES"],
  ["💥", "error", "RES"],
];

function fallbackLevel(level) {
  return level === "warn" || level === "error" ? level : "info";
}

// "[HH:MM:SS]" prefix length (incl. trailing space) or 0. Linear scan, no regex.
function timePrefixLen(t) {
  if (t.charCodeAt(0) !== 91) return 0;
  const end = t.indexOf("]", 1);
  if (end < 5 || end > 11) return 0;
  for (let i = 1; i < end; i++) {
    const c = t.charCodeAt(i);
    if (c !== 58 && (c < 48 || c > 57)) return 0;
  }
  return t.charCodeAt(end + 1) === 32 ? end + 2 : end + 1;
}

// Pure: (console method, ANSI-stripped text) -> { level, tag, msg }
export function parseConsoleLine(level, text) {
  let level2 = fallbackLevel(level);
  let tag = null;
  let msg = String(text).trim();
  const p = timePrefixLen(msg);
  if (p) {
    let rest = msg.slice(p).trimStart();
    const dot = REQ_DOTS.find((d) => rest.startsWith(d));
    if (dot) {
      // line()/errorLine(): "<dot> <symbol> message"
      const after = rest.slice(dot.length).trimStart();
      const sp = after.indexOf(" ");
      const sym = sp === -1 ? after : after.slice(0, sp);
      level2 = sym === "✗" ? "error" : sym === "⚡" ? "warn" : "info";
      tag = "REQ";
      msg = sp === -1 ? "" : after.slice(sp + 1).trimStart();
    } else {
      const hit = EMOJI_LINES.find((e) => rest.startsWith(e[0]));
      if (hit) {
        level2 = hit[1];
        tag = hit[2];
        rest = rest.slice(hit[0].length);
        if (rest.charCodeAt(0) === 0xfe0f) rest = rest.slice(1);
        rest = rest.trimStart();
        if (!tag && rest.charCodeAt(0) === 91) {
          const end = rest.indexOf("]");
          if (end > 1) {
            tag = rest.slice(1, end);
            rest = rest.slice(end + 1).trimStart();
          }
        }
        msg = rest;
      }
    }
  }
  if (msg.length > MAX_MSG_CHARS) msg = msg.slice(0, MAX_MSG_CHARS) + " …(truncated)";
  return { level: level2, tag, msg };
}

function appendLine(level, text) {
  const parsed = parseConsoleLine(level, text);
  const now = Date.now();
  const last = state.logs[state.logs.length - 1];
  if (last && last.level === parsed.level && last.tag === parsed.tag && last.msg === parsed.msg) {
    last.count++;
    last.ts = now;
    // Entry not yet sent: the pending "lines" payload already carries the new count/ts
    if (!state.pendingLines.includes(last)) {
      state.pendingBumps.set(last.id, { id: last.id, count: last.count, ts: now });
    }
    scheduleFlush();
    return;
  }
  const entry = { id: state.nextId++, ts: now, level: parsed.level, tag: parsed.tag, msg: parsed.msg, count: 1 };
  state.logs.push(entry);
  const maxLines = CONSOLE_LOG_CONFIG.maxLines;
  if (state.logs.length > maxLines) {
    state.logs.splice(0, state.logs.length - maxLines);
  }
  state.pendingLines.push(entry);
  if (state.pendingLines.length >= MAX_BATCH_LINES) {
    if (state.flushTimer) {
      clearTimeout(state.flushTimer);
      state.flushTimer = null;
    }
    flushPendingLines();
  } else {
    scheduleFlush();
  }
}

export function initConsoleLogCapture() {
  if (state.patched) return;

  for (const level of consoleLevels) {
    state.originals[level] = console[level];
    console[level] = (...args) => {
      appendLine(level, toLogLine(level, args));
      state.originals[level](...args);
    };
  }

  state.patched = true;
}

export function getConsoleLogs() {
  return state.logs;
}

export function clearConsoleLogs() {
  state.logs = [];
  state.pendingLines.length = 0;
  state.pendingBumps.clear();
  state.emitter.emit("clear");
}

export function getConsoleEmitter() {
  return state.emitter;
}
