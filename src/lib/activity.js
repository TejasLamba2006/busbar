// Audit "Activity" log helpers. Never store secrets: only names/ids and changed setting KEY NAMES.
export function recordActivity(evt) {
  // Fire-and-forget: never throws, never blocks caller.
  (async () => {
    try {
      const { insertActivity } = await import("@/lib/db/repos/activityRepo.js");
      await insertActivity({ ...evt, actor: evt.actor || "master" });
    } catch (e) {
      console.warn("[activity] record failed:", e?.message);
    }
  })();
}

export async function actorFromRequest() {
  try {
    const { cookies } = await import("next/headers");
    const { getDashboardAuthSession } = await import("@/lib/auth/dashboardSession");
    const session = await getDashboardAuthSession((await cookies()).get("auth_token")?.value);
    return session?.role === "client" && session.clientEmail ? String(session.clientEmail) : "master";
  } catch {
    return "master";
  }
}

// Hook shorthand: resolves actor then records. Safe to call without await.
export function logActivity(type, summary, target = null, meta = null) {
  (async () => recordActivity({ type, actor: await actorFromRequest(), target, summary, meta }))().catch(() => {});
}

// Gateway-side events (cooldowns, failed upstream requests). Deduped per key so a retry storm is one row.
const recentSystem = new Map();
const SECRET_RE = /\b(?:sk|pk|rk|ak|xai|gsk|AIza|ghp|gho|ABSK)[-_A-Za-z0-9]{8,}|Bearer\s+[A-Za-z0-9._~+\/=-]{8,}|(?:key|token|secret)["']?\s*[:=]\s*["']?[A-Za-z0-9._-]{8,}/gi;
export const maskSecrets = (s) => String(s ?? "").replace(SECRET_RE, "[redacted]");
// Provider errors arrive as raw JSON blobs; show just the human message, one line.
export const briefError = (text, max = 140) => {
  const s = String(text ?? "");
  const m = s.match(/"message"\s*:\s*"((?:[^"\\]|\\.)*)/);
  return (m ? m[1].replace(/\\"/g, '"') : s).replace(/\s+/g, " ").trim().slice(0, max);
};

export function recordSystemActivity({ type, summary, target = null, meta = null, dedupeKey, windowMs = 60000 }) {
  try {
    const now = Date.now();
    const key = dedupeKey || `${type}|${summary}`;
    if (now - (recentSystem.get(key) || 0) < windowMs) return;
    recentSystem.set(key, now);
    if (recentSystem.size > 500) for (const [k, t] of recentSystem) if (now - t > windowMs) recentSystem.delete(k);
    recordActivity({ type, actor: "system", target, summary: maskSecrets(summary).slice(0, 300), meta });
  } catch { /* never block the request path */ }
}

// Changed key names only, never values.
export function describeSettingsChange(body) {
  const keys = Object.keys(body || {}).sort();
  const names = keys.join(", ");
  return { target: names || null, summary: `Updated settings: ${names || "none"}`, meta: { keys } };
}
