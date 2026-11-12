// Per-API-key RPM and USD budget limits for /v1/* requests.
// RPM is a sliding window kept in memory (per process). Budget spend is summed
// from usageHistory and cached for a few seconds so hot keys don't hit SQLite
// on every request.
import { getAdapter } from "@/lib/db/driver.js";

const WINDOW_MS = 60_000;
const SPEND_CACHE_TTL_MS = 5000;

const rpmWindows = new Map(); // keyId -> number[] (ms timestamps)
const spendCache = new Map(); // `${apiKey}|${period}` -> { value, expiresAt }

export function checkKeyRpmLimit(keyRecord, now = Date.now()) {
  const limit = keyRecord?.limits?.maxRequestsPerMinute;
  if (!limit) return { allowed: true };
  const id = keyRecord.id;
  const timestamps = (rpmWindows.get(id) || []).filter((t) => t > now - WINDOW_MS);
  if (timestamps.length >= limit) {
    rpmWindows.set(id, timestamps);
    const retryAfterSec = Math.max(1, Math.ceil((timestamps[0] + WINDOW_MS - now) / 1000));
    return {
      allowed: false,
      retryAfterSec,
      message: `API key rate limit exceeded (${limit} requests/min). Retry after ${retryAfterSec}s.`,
    };
  }
  timestamps.push(now);
  rpmWindows.set(id, timestamps);
  return { allowed: true };
}

function periodStart(period, now) {
  if (period === "monthly") return new Date(now).toISOString().slice(0, 7) + "-01T00:00:00.000Z";
  return new Date(now).toISOString().slice(0, 10) + "T00:00:00.000Z";
}

export async function getKeySpendUsd(apiKeyStr, period = "daily", now = Date.now()) {
  const cacheKey = `${apiKeyStr}|${period}`;
  const cached = spendCache.get(cacheKey);
  if (cached && cached.expiresAt > now) return cached.value;

  const db = await getAdapter();
  let row;
  if (period === "total") {
    row = db.get(`SELECT COALESCE(SUM(cost), 0) AS total FROM usageHistory WHERE apiKey = ?`, [apiKeyStr]);
  } else {
    row = db.get(
      `SELECT COALESCE(SUM(cost), 0) AS total FROM usageHistory WHERE apiKey = ? AND timestamp >= ?`,
      [apiKeyStr, periodStart(period, now)]
    );
  }
  const value = Number(row?.total) || 0;
  spendCache.set(cacheKey, { value, expiresAt: now + SPEND_CACHE_TTL_MS });
  return value;
}

export function resetKeyLimitsCacheForTests() {
  rpmWindows.clear();
  spendCache.clear();
}

function limitResponse(status, body, headers) {
  return Response.json(body, { status, headers });
}

export async function enforceKeyLimits(keyRecord) {
  if (!keyRecord) return null;

  const rpm = checkKeyRpmLimit(keyRecord);
  if (!rpm.allowed) {
    return limitResponse(
      429,
      { error: { message: rpm.message, type: "rate_limit_error", code: "key_rate_limit_exceeded" } },
      { "Retry-After": String(rpm.retryAfterSec) }
    );
  }

  if (keyRecord.limits?.maxBudgetUsd != null) {
    const period = keyRecord.limits.budgetResetPeriod;
    const spent = await getKeySpendUsd(keyRecord.key, period);
    if (spent >= keyRecord.limits.maxBudgetUsd) {
      return limitResponse(429, {
        error: {
          message: `API key budget exhausted ($${spent.toFixed(4)} / $${keyRecord.limits.maxBudgetUsd.toFixed(2)} ${period}).`,
          type: "quota_error",
          code: "key_budget_exceeded",
        },
      });
    }
  }

  return null;
}
