import { describe, it, expect, beforeEach } from "vitest";
import {
  parseConsoleLine,
  initConsoleLogCapture,
  getConsoleLogs,
  clearConsoleLogs,
  getConsoleEmitter,
} from "../../src/lib/consoleLogBuffer.js";

describe("parseConsoleLine", () => {
  it.each([
    ["log", "[12:00:01] ℹ️  [AUTH] hello {\"a\":1}", "info", "AUTH", "hello {\"a\":1}"],
    ["warn", "[12:00:01] ⚠️  [DB] slow", "warn", "DB", "slow"],
    ["log", "[12:00:01] ❌ [X] boom", "error", "X", "boom"],
    ["log", "[12:00:01] 🔍 [T] dbg", "debug", "T", "dbg"],
    ["log", "[12:00:01] 🌊 [STREAM] chunk", "info", "STREAM", "chunk"],
    ["log", "[12:00:01] 📥 POST /v1/chat", "info", "REQ", "POST /v1/chat"],
    ["log", "[12:00:01] 📤 200 (12ms)", "info", "RES", "200 (12ms)"],
    ["log", "[12:00:01] 💥 500 (12ms)", "error", "RES", "500 (12ms)"],
    ["log", "[12:00:01] 🟢 ▶ openai/gpt · stream", "info", "REQ", "openai/gpt · stream"],
    ["log", "[12:00:01] 🔵 📊 done", "info", "REQ", "done"],
    ["log", "[12:00:01] 🟣 ✗ ERROR 502 · x\n    stack", "error", "REQ", "ERROR 502 · x\n    stack"],
    ["log", "[12:00:01] 🟡 ⚡ ABORTED", "warn", "REQ", "ABORTED"],
  ])("%s %s", (lvl, text, level, tag, msg) => {
    expect(parseConsoleLine(lvl, text)).toEqual({ level, tag, msg });
  });

  it("falls back to console method", () => {
    expect(parseConsoleLine("warn", " plain ")).toEqual({ level: "warn", tag: null, msg: "plain" });
    expect(parseConsoleLine("debug", "x")).toEqual({ level: "info", tag: null, msg: "x" });
    expect(parseConsoleLine("error", "[nope] y")).toEqual({ level: "error", tag: null, msg: "[nope] y" });
  });

  it("truncates long msg", () => {
    const { msg } = parseConsoleLine("log", "a".repeat(5000));
    expect(msg).toBe("a".repeat(4000) + " …(truncated)");
  });
});

describe("buffer", () => {
  const emitted = [];
  beforeEach(() => {
    initConsoleLogCapture();
    clearConsoleLogs();
    emitted.length = 0;
  });

  const wait = () => new Promise((r) => setTimeout(r, 150));

  it("bumps consecutive duplicates after flush, not before", async () => {
    const em = getConsoleEmitter();
    const onLines = (l) => emitted.push(["lines", l]);
    const onBump = (b) => emitted.push(["bump", b]);
    em.on("lines", onLines);
    em.on("bump", onBump);
    console.info("[01:02:03] ℹ️  [A] same");
    console.info("[01:02:04] ℹ️  [A] same"); // merged into pending entry
    await wait();
    console.info("[01:02:05] ℹ️  [A] same");
    console.info("[01:02:06] ℹ️  [A] same");
    await wait();
    em.off("lines", onLines);
    em.off("bump", onBump);
    const logs = getConsoleLogs();
    expect(logs).toHaveLength(1);
    expect(logs[0].count).toBe(4);
    expect(logs[0]).toMatchObject({ level: "info", tag: "A", msg: "same" });
    expect(emitted.map((e) => e[0])).toEqual(["lines", "bump"]);
    expect(emitted[1][1]).toHaveLength(1);
    expect(emitted[1][1][0]).toMatchObject({ id: logs[0].id, count: 4 });
  });

  it("caps ring at maxLines, ids monotonic", () => {
    for (let i = 0; i < 1005; i++) console.log(`line ${i}`);
    const logs = getConsoleLogs();
    expect(logs).toHaveLength(1000);
    expect(logs[0].msg).toBe("line 5");
    expect(logs[999].id).toBeGreaterThan(logs[0].id);
  });

  it("clear empties and emits clear", () => {
    let cleared = 0;
    const em = getConsoleEmitter();
    const f = () => cleared++;
    em.on("clear", f);
    console.log("x");
    clearConsoleLogs();
    em.off("clear", f);
    expect(getConsoleLogs()).toHaveLength(0);
    expect(cleared).toBe(1);
  });
});
