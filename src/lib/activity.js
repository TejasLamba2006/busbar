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

// Changed key names only, never values.
export function describeSettingsChange(body) {
  const keys = Object.keys(body || {}).sort();
  const names = keys.join(", ");
  return { target: names || null, summary: `Updated settings: ${names || "none"}`, meta: { keys } };
}
