/**
 * Freebuff usage: GET https://www.codebuff.com/api/v1/freebuff/session (signed).
 * `freebucks`: { balance, daily: { limit, spent, remaining, resetAt }, wallet: { balance }, monthly? }
 */
import { proxyAwareFetch } from "../../utils/proxyFetch.js";
import { ensureFreebuffDeviceKey, freebuffDeviceHeaders, FREEBUFF_API } from "../freebuffModels.js";
import { toFiniteNumber } from "./shared.js";

export async function getFreebuffUsage(token, proxyOptions = null) {
  if (!token) return { message: "Freebuff token not available." };
  try {
    const url = `${FREEBUFF_API}/api/v1/freebuff/session`;
    await ensureFreebuffDeviceKey(token);
    const res = await proxyAwareFetch(
      url,
      { headers: { Authorization: `Bearer ${token}`, Accept: "application/json", ...freebuffDeviceHeaders(token, { method: "GET", url }) } },
      proxyOptions,
    );
    if (res.status === 401 || res.status === 403) return { plan: "Freebuff", message: "Freebuff token invalid or expired. Sign in again." };
    if (!res.ok) return { plan: "Freebuff", message: `Freebuff session error (${res.status})` };
    const d = await res.json().catch(() => null);
    const fb = d?.freebucks;
    if (!fb) return { plan: "Freebuff", message: d?.status ? `Freebuff session: ${d.status}` : "Freebuff connected. No wallet data returned." };

    const quotas = {};
    const daily = fb.daily;
    if (daily && toFiniteNumber(daily.limit, 0) > 0) {
      const total = toFiniteNumber(daily.limit, 0);
      const remaining = Math.max(0, toFiniteNumber(daily.remaining, 0));
      quotas["Daily Freebucks"] = {
        used: Math.max(0, toFiniteNumber(daily.spent, total - remaining)),
        total,
        remaining,
        remainingPercentage: Math.min(100, (remaining / total) * 100),
        resetAt: daily.resetAt || null,
        unlimited: false,
        unit: "Freebucks",
      };
    }
    const wallet = Math.max(0, toFiniteNumber(fb.wallet?.balance, 0));
    quotas["Wallet Balance"] = {
      used: 0,
      total: wallet,
      remaining: wallet,
      remainingPercentage: wallet > 0 ? 100 : 0,
      resetAt: fb.wallet?.nextBonusAt || null,
      unlimited: false,
      unit: "Freebucks",
      isCreditBalance: true,
    };
    const balance = Math.max(0, toFiniteNumber(fb.balance, wallet + (daily ? toFiniteNumber(daily.remaining, 0) : 0)));
    const tier = d.accessTier ? ` (${d.accessTier})` : "";
    const prices = Object.values(fb.prices || {}).map(Number).filter(Number.isFinite);
    const affordable = [...new Set(prices.filter((p) => p <= balance))].sort((x, y) => x - y).map((p) => `${p}-cost`);
    const dailyTxt = daily ? ` | ${toFiniteNumber(daily.remaining, 0)} / ${toFiniteNumber(daily.limit, 0)} Freebucks left` : ` | ${balance} Freebucks available`;
    const models = affordable.length ? ` (${affordable.join(" & ")} models available)` : "";
    const session = d.status === "active" && d.model ? ` | session active${d.expiresAt ? ` until ${d.expiresAt}` : ""}` : "";
    const plan = `Freebuff${tier}${fb.quotaExempt ? " (unmetered)" : ""}${dailyTxt}${models}${session}`;
    return { plan, quotas, totalFreebucks: balance };
  } catch (error) {
    return { message: `Freebuff error: ${error.message}` };
  }
}
