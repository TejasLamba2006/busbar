import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getDashboardAuthSession } from "@/lib/auth/dashboardSession";
import { getAdapter } from "@/lib/db/driver.js";
import { statusKind } from "@/app/(dashboard)/dashboard/console-log/timeline/timelineUtils.js";

// usageHistory is always on (requestDetails logging is optional and body-heavy). Latency lives in
// meta {ms, ttft}, written by saveRequestUsage; rows from before that have none and render min-width.
const SQL_FULL = `SELECT id, timestamp, provider, model, connectionId, status, promptTokens AS pt, completionTokens AS ct,
  json_extract(meta,'$.ms') AS total, json_extract(meta,'$.ttft') AS ttft
  FROM usageHistory WHERE timestamp >= ? ORDER BY timestamp DESC LIMIT ?`;
// ponytail: fallback if json_extract is unavailable (no durations), bars render min-width
const SQL_BASIC = `SELECT id, timestamp, provider, model, connectionId, status, promptTokens AS pt, completionTokens AS ct
  FROM usageHistory WHERE timestamp >= ? ORDER BY timestamp DESC LIMIT ?`;

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

export async function GET(request) {
  try {
    const cookieStore = await cookies();
    const session = await getDashboardAuthSession(cookieStore.get("auth_token")?.value);
    if (session?.role === "client") {
      return NextResponse.json({ error: "Master only" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const now = Date.now();
    const sinceRaw = Number(searchParams.get("sinceMs"));
    const sinceMs = Number.isFinite(sinceRaw) && sinceRaw > 0 ? sinceRaw : now - 3600_000;
    const limitRaw = parseInt(searchParams.get("limit"), 10);
    const limit = Math.min(Math.max(Number.isNaN(limitRaw) ? 1000 : limitRaw, 1), 2000);

    const db = await getAdapter();
    const args = [new Date(sinceMs).toISOString(), limit];
    let raw;
    try {
      raw = db.all(SQL_FULL, args);
    } catch {
      raw = db.all(SQL_BASIC, args);
    }

    // Failed requests never reach usageHistory; surface them from the activity log as zero-width red ticks.
    let errs = [];
    try {
      errs = db.all(`SELECT id, ts, meta FROM activityLog WHERE type = 'request.error' AND ts >= ? ORDER BY ts DESC LIMIT 300`, [sinceMs]);
    } catch { /* table may not exist yet on a fresh upgrade */ }

    // usageHistory.timestamp is the END time (written when the request completes), so start = end - total.
    const rows = raw.map((r) => {
      const end = Date.parse(r.timestamp);
      const durationMs = Math.max(0, num(r.total));
      const ttft = num(r.ttft);
      return {
        id: `u${r.id}`,
        ts: end - durationMs,
        durationMs,
        // non-streaming handlers set ttft == total; that is not a real first-byte time
        ttftMs: ttft > 0 && ttft < durationMs ? ttft : null,
        status: statusKind(r.status) === "unknown" ? (r.status || "unknown") : statusKind(r.status),
        provider: r.provider || null,
        model: r.model || null,
        connectionId: r.connectionId || null,
        promptTokens: num(r.pt),
        completionTokens: num(r.ct),
      };
    }).filter((r) => Number.isFinite(r.ts));

    for (const e of errs) {
      let meta = {};
      try { meta = JSON.parse(e.meta || "{}") || {}; } catch { /* keep empty */ }
      rows.push({
        id: `e${e.id}`, ts: Number(e.ts), durationMs: 0, ttftMs: null, status: "error",
        provider: meta.provider || null, model: meta.model || null, connectionId: null,
        promptTokens: 0, completionTokens: 0,
      });
    }

    return NextResponse.json({ rows, now });
  } catch (error) {
    console.error("[API ERROR] /api/usage/request-timeline failed:", error);
    return NextResponse.json({ error: "Failed to fetch timeline" }, { status: 500 });
  }
}
