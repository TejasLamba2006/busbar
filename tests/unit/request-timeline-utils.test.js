import { describe, it, expect } from "vitest";
import {
  statusKind, allocateLanes, mergeRows, visibleRows, axisTicks,
} from "../../src/app/(dashboard)/dashboard/console-log/timeline/timelineUtils.js";

describe("request timeline utils", () => {
  it("statusKind", () => {
    expect(statusKind("success")).toBe("ok");
    expect(statusKind("ok")).toBe("ok");
    expect(statusKind("502")).toBe("error");
    expect(statusKind("error")).toBe("error");
    expect(statusKind(null)).toBe("unknown");
  });

  it("allocateLanes stacks overlaps and reuses free lanes", () => {
    const rows = [
      { id: "a", ts: 0, durationMs: 5000 },
      { id: "b", ts: 1000, durationMs: 5000 },
      { id: "c", ts: 6000, durationMs: 100 },
    ];
    const { lanes, laneCount } = allocateLanes(rows);
    expect(lanes.get("a")).toBe(0);
    expect(lanes.get("b")).toBe(1);
    expect(lanes.get("c")).toBe(0);
    expect(laneCount).toBe(2);
  });

  it("allocateLanes pads zero-duration bars", () => {
    const { lanes } = allocateLanes([
      { id: "a", ts: 0, durationMs: 0 },
      { id: "b", ts: 500, durationMs: 0 },
    ]);
    expect(lanes.get("b")).toBe(1);
  });

  it("mergeRows dedupes by id, incoming wins, caps newest", () => {
    const m = mergeRows([{ id: "a", ts: 1, v: 1 }], [{ id: "a", ts: 1, v: 2 }, { id: "b", ts: 2 }]);
    expect(m).toHaveLength(2);
    expect(m.find((r) => r.id === "a").v).toBe(2);
    const capped = mergeRows([], [{ id: "a", ts: 1 }, { id: "b", ts: 3 }, { id: "c", ts: 2 }], 2);
    expect(capped.map((r) => r.id).sort()).toEqual(["b", "c"]);
  });

  it("visibleRows keeps intersecting only", () => {
    const rows = [
      { id: "a", ts: 0, durationMs: 100 },
      { id: "b", ts: 900, durationMs: 200 },
      { id: "c", ts: 2000, durationMs: 10 },
    ];
    expect(visibleRows(rows, 1000, 1500).map((r) => r.id)).toEqual(["b"]);
  });

  it("axisTicks aligned, within range", () => {
    const { step, ticks } = axisTicks(1003, 61003, 6);
    expect(step).toBe(1e4);
    expect(ticks.every((t) => t % step === 0 && t >= 1003 && t <= 61003)).toBe(true);
    expect(axisTicks(5, 5).ticks).toEqual([]);
  });
});
