/**
 * FreePi usage: GET https://api.freepi.ai/me
 * Fields: allowance_credits, remaining_credits_today, bonus_credits, bonus_wallet_credits,
 * refill_at, lane, notice, tier; USD fallback: cap_usd_today, remaining_usd_today, credit_usd
 */
import { proxyAwareFetch } from "../../utils/proxyFetch.js";
import { toFiniteNumber } from "./shared.js";

export async function getFreepiUsage(token, proxyOptions = null) {
  if (!token) return { message: "FreePi token not available." };
  try {
    const res = await proxyAwareFetch(
      "https://api.freepi.ai/me",
      { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } },
      proxyOptions,
    );
    if (res.status === 401 || res.status === 403) {
      return { plan: "FreePi", message: "FreePi token invalid or expired. Sign in again." };
    }
    if (!res.ok) return { plan: "FreePi", message: `FreePi /me error (${res.status})` };
    const d = await res.json().catch(() => null);
    if (!d || typeof d !== "object") return { message: "FreePi /me response was not JSON." };

    const quotas = {};
    const hasCredits = d.allowance_credits != null && d.remaining_credits_today != null;
    const bonus = Math.max(0, toFiniteNumber(d.bonus_credits, 0));
    const bonusWallet = Math.max(0, toFiniteNumber(d.bonus_wallet_credits, 0));
    if (hasCredits) {
      const total = toFiniteNumber(d.allowance_credits, 0);
      const remaining = Math.max(0, toFiniteNumber(d.remaining_credits_today, 0));
      quotas["Daily Credits"] = {
        used: Math.max(0, total - remaining),
        total,
        remaining,
        remainingPercentage: total > 0 ? Math.min(100, (remaining / total) * 100) : 0,
        resetAt: d.refill_at || null,
        unlimited: false,
        unit: "credits",
      };
      if (bonus > 0 || bonusWallet > 0) {
        const bTotal = bonusWallet || bonus;
        quotas["Bonus Credits"] = {
          used: Math.max(0, bTotal - bonus),
          total: bTotal,
          remaining: bonus,
          remainingPercentage: bTotal > 0 ? Math.min(100, (bonus / bTotal) * 100) : 0,
          resetAt: null,
          unlimited: false,
          unit: "credits",
        };
      }
    } else {
      const cap = toFiniteNumber(d.cap_usd_today, 0);
      const remaining = Math.max(0, toFiniteNumber(d.remaining_usd_today, 0));
      if (cap > 0) {
        quotas["Daily allowance (USD)"] = {
          used: Math.max(0, cap - remaining),
          total: cap,
          remainingPercentage: Math.min(100, (remaining / cap) * 100),
          resetAt: d.refill_at || null,
          unlimited: false,
        };
      }
    }
    const credit = toFiniteNumber(d.credit_usd, 0);
    if (credit > 0) {
      quotas["Credit (USD)"] = {
        used: 0,
        total: credit,
        remainingPercentage: 100,
        resetAt: null,
        unlimited: false,
        isCreditBalance: true,
        currency: "USD",
      };
    }
    const lane = d.lane ? `(${d.lane})` : "";
    const plan = ["FreePi", d.tier, lane].filter(Boolean).join(" ") + (bonus > 0 ? ` +${bonus.toLocaleString("en-US")} bonus` : "");
    const out = Object.keys(quotas).length ? { plan, quotas } : { plan, message: "FreePi connected. No allowance data returned." };
    if (d.notice && !out.quotas) out.message = String(d.notice);
    return out;
  } catch (error) {
    return { message: `FreePi error: ${error.message}` };
  }
}
