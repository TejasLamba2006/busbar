import { describe, it, expect, vi, beforeEach } from "vitest";

const dbState = { total: 0, calls: [] };

vi.mock("@/lib/db/driver.js", () => ({
  getAdapter: async () => ({
    get: (sql, params) => {
      dbState.calls.push({ sql, params });
      return { total: dbState.total };
    },
  }),
}));

const { normalizeKeyLimits } = await import("@/lib/db/repos/apiKeysRepo.js");
const { checkKeyRpmLimit, enforceKeyLimits, getKeySpendUsd, resetKeyLimitsCacheForTests } =
  await import("@/sse/services/keyLimits.js");

const NOW = Date.UTC(2026, 10, 13, 12, 0, 0); // 2026-11-13T12:00:00Z

function keyRecord(limits, id = "key-1", key = "sk-test-1") {
  return { id, key, limits };
}

beforeEach(() => {
  dbState.total = 0;
  dbState.calls = [];
  resetKeyLimitsCacheForTests();
});

describe("normalizeKeyLimits", () => {
  it("returns defaults for missing or non-object input", () => {
    const defaults = { maxBudgetUsd: null, budgetResetPeriod: "daily", maxRequestsPerMinute: null };
    expect(normalizeKeyLimits(undefined)).toEqual(defaults);
    expect(normalizeKeyLimits(null)).toEqual(defaults);
    expect(normalizeKeyLimits("nope")).toEqual(defaults);
  });

  it("parses valid numeric values", () => {
    expect(normalizeKeyLimits({ maxBudgetUsd: "5.5", budgetResetPeriod: "monthly", maxRequestsPerMinute: "60" }))
      .toEqual({ maxBudgetUsd: 5.5, budgetResetPeriod: "monthly", maxRequestsPerMinute: 60 });
  });

  it("floors RPM and rejects non-positive or non-finite values", () => {
    expect(normalizeKeyLimits({ maxRequestsPerMinute: 12.9 }).maxRequestsPerMinute).toBe(12);
    expect(normalizeKeyLimits({ maxRequestsPerMinute: 0 }).maxRequestsPerMinute).toBeNull();
    expect(normalizeKeyLimits({ maxRequestsPerMinute: -3 }).maxRequestsPerMinute).toBeNull();
    expect(normalizeKeyLimits({ maxRequestsPerMinute: "abc" }).maxRequestsPerMinute).toBeNull();
    expect(normalizeKeyLimits({ maxRequestsPerMinute: "" }).maxRequestsPerMinute).toBeNull();
  });

  it("rejects negative or empty budgets and falls back to daily for unknown periods", () => {
    const out = normalizeKeyLimits({ maxBudgetUsd: -1, budgetResetPeriod: "weekly" });
    expect(out.maxBudgetUsd).toBeNull();
    expect(out.budgetResetPeriod).toBe("daily");
    expect(normalizeKeyLimits({ maxBudgetUsd: "" }).maxBudgetUsd).toBeNull();
    expect(normalizeKeyLimits({ maxBudgetUsd: 0 }).maxBudgetUsd).toBe(0);
  });
});

describe("checkKeyRpmLimit", () => {
  it("allows requests up to the limit then rejects the next with Retry-After", () => {
    const rec = keyRecord({ maxRequestsPerMinute: 3 });
    expect(checkKeyRpmLimit(rec, NOW)).toEqual({ allowed: true });
    expect(checkKeyRpmLimit(rec, NOW + 1000)).toEqual({ allowed: true });
    expect(checkKeyRpmLimit(rec, NOW + 2000)).toEqual({ allowed: true });

    const denied = checkKeyRpmLimit(rec, NOW + 3000);
    expect(denied.allowed).toBe(false);
    // oldest request at NOW, window ends NOW+60s, now is NOW+3s => 57s left
    expect(denied.retryAfterSec).toBe(57);
    expect(denied.message).toBe("API key rate limit exceeded (3 requests/min). Retry after 57s.");
  });

  it("frees capacity once timestamps age out of the 60s window", () => {
    const rec = keyRecord({ maxRequestsPerMinute: 1 }, "rpm-window");
    expect(checkKeyRpmLimit(rec, NOW).allowed).toBe(true);
    expect(checkKeyRpmLimit(rec, NOW + 10_000).allowed).toBe(false);
    expect(checkKeyRpmLimit(rec, NOW + 60_001).allowed).toBe(true);
  });

  it("is unlimited when no RPM limit is set", () => {
    const rec = keyRecord({ maxRequestsPerMinute: null }, "no-rpm");
    for (let i = 0; i < 100; i++) expect(checkKeyRpmLimit(rec, NOW).allowed).toBe(true);
  });
});

describe("getKeySpendUsd", () => {
  it("sums daily spend from the start of the UTC day", async () => {
    dbState.total = 1.25;
    const spent = await getKeySpendUsd("sk-daily", "daily", NOW);
    expect(spent).toBe(1.25);
    expect(dbState.calls[0].sql).toContain("SUM(cost)");
    expect(dbState.calls[0].params).toEqual(["sk-daily", "2026-11-13T00:00:00.000Z"]);
  });

  it("sums monthly spend from the start of the UTC month", async () => {
    dbState.total = 2;
    await getKeySpendUsd("sk-monthly", "monthly", NOW);
    expect(dbState.calls[0].params).toEqual(["sk-monthly", "2026-11-01T00:00:00.000Z"]);
  });

  it("sums lifetime spend without a time bound", async () => {
    dbState.total = 9;
    await getKeySpendUsd("sk-total", "total", NOW);
    expect(dbState.calls[0].sql).not.toContain("timestamp");
    expect(dbState.calls[0].params).toEqual(["sk-total"]);
  });

  it("caches per (key, period) for 5 seconds", async () => {
    dbState.total = 1;
    await getKeySpendUsd("sk-cache", "daily", NOW);
    dbState.total = 99;
    expect(await getKeySpendUsd("sk-cache", "daily", NOW + 4000)).toBe(1);
    expect(await getKeySpendUsd("sk-cache", "daily", NOW + 6000)).toBe(99);
    expect(dbState.calls).toHaveLength(2);
  });
});

describe("enforceKeyLimits", () => {
  it("returns null for a missing key record", async () => {
    expect(await enforceKeyLimits(null)).toBeNull();
  });

  it.each(["daily", "monthly", "total"])(
    "blocks with 429 when %s spend meets the budget",
    async (period) => {
      dbState.total = 5;
      const rec = keyRecord({ maxBudgetUsd: 5, budgetResetPeriod: period, maxRequestsPerMinute: null }, `budget-${period}`, `sk-${period}-hit`);
      const res = await enforceKeyLimits(rec);
      expect(res).not.toBeNull();
      expect(res.status).toBe(429);
      const body = await res.json();
      expect(body.error.code).toBe("key_budget_exceeded");
      expect(body.error.type).toBe("quota_error");
      expect(body.error.message).toBe(`API key budget exhausted ($5.0000 / $5.00 ${period}).`);
    }
  );

  it.each(["daily", "monthly", "total"])(
    "allows when %s spend is under the budget",
    async (period) => {
      dbState.total = 4.99;
      const rec = keyRecord({ maxBudgetUsd: 5, budgetResetPeriod: period, maxRequestsPerMinute: null }, `under-${period}`, `sk-${period}-under`);
      expect(await enforceKeyLimits(rec)).toBeNull();
    }
  );

  it("returns 429 with Retry-After when RPM is exceeded", async () => {
    const rec = keyRecord({ maxBudgetUsd: null, budgetResetPeriod: "daily", maxRequestsPerMinute: 1 }, "enforce-rpm", "sk-rpm");
    expect(await enforceKeyLimits(rec)).toBeNull();
    const res = await enforceKeyLimits(rec);
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toMatch(/^\d+$/);
    const body = await res.json();
    expect(body.error.code).toBe("key_rate_limit_exceeded");
    expect(body.error.type).toBe("rate_limit_error");
  });
});
