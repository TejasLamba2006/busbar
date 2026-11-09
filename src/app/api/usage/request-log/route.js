import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getDashboardAuthSession } from "@/lib/auth/dashboardSession";
import {
  getObservabilityConfigPublic, resetObservabilityConfigCache, countRequestDetails,
  clearRequestDetails, listRequestLogRows,
} from "@/lib/db/repos/requestDetailsRepo.js";
import { getAdapter } from "@/lib/db/driver.js";
import { createPricingResolver } from "@/lib/db/repos/pricingRepo.js";
import { calculateCostFromTokens } from "open-sse/providers/pricing.js";
import { updateSettings } from "@/lib/db/repos/settingsRepo.js";
import { logActivity } from "@/lib/activity.js";

export const dynamic = "force-dynamic";

async function masterOnly() {
  const cookieStore = await cookies();
  const session = await getDashboardAuthSession(cookieStore.get("auth_token")?.value);
  return session?.role === "client" ? NextResponse.json({ error: "Master only" }, { status: 403 }) : null;
}

async function observability() {
  const cfg = await getObservabilityConfigPublic();
  const out = { enabled: cfg.enabled, maxRecords: cfg.maxRecords, maxJsonKB: cfg.maxJsonKB, total: await countRequestDetails() };
  if (cfg.lockedByEnv) out.lockedByEnv = true;
  return out;
}

function previewOf(messages, r = null) {
  if (Array.isArray(messages)) {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m?.role !== "user") continue;
      const c = m.content;
      const text = typeof c === "string" ? c
        : Array.isArray(c) ? c.map((p) => (typeof p === "string" ? p : p?.text || "")).filter(Boolean).join(" ")
        : "";
      if (text) return text.slice(0, 120);
    }
  }
  if (r) {
    for (const val of [r.reqState, r.reqPrompt, r.reqInput, r.reqQuery, r.reqUrl, r.reqFile]) {
      if (val != null && val !== "") {
        const str = typeof val === "string" ? val : JSON.stringify(val);
        if (str) return str.slice(0, 120);
      }
    }
  }
  return "";
}

const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

export async function GET(request) {
  try {
    const denied = await masterOnly();
    if (denied) return denied;
    const sp = new URL(request.url).searchParams;
    const page = Math.max(1, parseInt(sp.get("page"), 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(sp.get("pageSize"), 10) || 50));
    const { rows, totalItems } = await listRequestLogRows({
      page, pageSize,
      provider: sp.get("provider") || undefined, model: sp.get("model") || undefined,
      status: sp.get("status") || undefined, q: sp.get("q") || undefined,
    });
    const [db, resolvePricing] = await Promise.all([
      getAdapter().catch(() => null),
      createPricingResolver().catch(() => null),
    ]);
    const items = rows.map((r) => {
      let messages = r.messages;
      if (typeof messages === "string") { try { messages = JSON.parse(messages); } catch { messages = null; } }
      const total = num(r.total);
      const ttft = num(r.ttft);
      const promptTokens = num(r.promptTokens);
      const completionTokens = num(r.completionTokens);
      const cachedTokens = num(r.cachedTokens);
      const reasoningTokens = num(r.reasoningTokens);
      const cacheCreationTokens = num(r.cacheCreationTokens);
      let cost = typeof r.mediaCost === "number" && Number.isFinite(r.mediaCost) ? r.mediaCost : 0;
      if (!cost && db && resolvePricing && (promptTokens > 0 || completionTokens > 0)) {
        const rates = resolvePricing(db, r.provider, r.model);
        if (rates) {
          cost = calculateCostFromTokens({
            prompt_tokens: promptTokens,
            completion_tokens: completionTokens,
            cached_tokens: cachedTokens,
            reasoning_tokens: reasoningTokens,
            cache_creation_input_tokens: cacheCreationTokens,
          }, rates);
        }
      }
      return {
        id: r.id,
        ts: Date.parse(r.timestamp) || 0,
        provider: r.provider,
        model: r.model,
        connectionId: r.connectionId,
        status: r.status == null ? "" : String(r.status),
        durationMs: total,
        ttftMs: ttft > 0 && ttft < total ? ttft : null,
        promptTokens,
        completionTokens,
        cachedTokens,
        cost,
        preview: previewOf(messages, r),
        hasPayload: !!r.reqType && !(r.reqTrunc && !r.msgType && !r.reqState && !r.reqPrompt && !r.reqInput && !r.reqQuery && !r.reqUrl && !r.reqFile),
      };
    });
    return NextResponse.json({
      items,
      pagination: { page, pageSize, totalItems, totalPages: Math.ceil(totalItems / pageSize) },
      observability: await observability(),
    });
  } catch (error) {
    console.error("[API ERROR] /api/usage/request-log GET failed:", error);
    return NextResponse.json({ error: "Failed to fetch request log" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const denied = await masterOnly();
    if (denied) return denied;
    const body = await request.json().catch(() => ({}));
    const cfg = await getObservabilityConfigPublic();
    if (body.enabled !== undefined && cfg.lockedByEnv) {
      return NextResponse.json({ error: "Controlled by ENABLE_REQUEST_LOGS env" }, { status: 409 });
    }
    const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, Math.round(Number(v))));
    const updates = {};
    if (typeof body.enabled === "boolean") updates.enableObservability = body.enabled;
    if (Number.isFinite(Number(body.maxJsonKB)) && body.maxJsonKB !== null && body.maxJsonKB !== "") updates.observabilityMaxJsonSize = clamp(body.maxJsonKB, 4, 1024);
    if (Number.isFinite(Number(body.maxRecords)) && body.maxRecords !== null && body.maxRecords !== "") updates.observabilityMaxRecords = clamp(body.maxRecords, 50, 5000);
    if (Object.keys(updates).length) {
      await updateSettings(updates);
      resetObservabilityConfigCache();
      const what = "enableObservability" in updates && Object.keys(updates).length === 1
        ? (updates.enableObservability ? "enabled" : "disabled") : "limits changed";
      logActivity("settings.updated", `Request logging ${what}`, "observability");
    }
    return NextResponse.json(await observability());
  } catch (error) {
    console.error("[API ERROR] /api/usage/request-log POST failed:", error);
    return NextResponse.json({ error: "Failed to update request logging" }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const denied = await masterOnly();
    if (denied) return denied;
    return NextResponse.json({ success: true, deleted: await clearRequestDetails() });
  } catch (error) {
    console.error("[API ERROR] /api/usage/request-log DELETE failed:", error);
    return NextResponse.json({ error: "Failed to clear request log" }, { status: 500 });
  }
}
