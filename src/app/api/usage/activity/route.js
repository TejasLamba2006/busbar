import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getDashboardAuthSession } from "@/lib/auth/dashboardSession";
import { listActivity, clearActivity } from "@/lib/db/repos/activityRepo.js";

export const dynamic = "force-dynamic";

async function masterOnly() {
  const cookieStore = await cookies();
  const session = await getDashboardAuthSession(cookieStore.get("auth_token")?.value);
  return session?.role === "client" ? NextResponse.json({ error: "Master only" }, { status: 403 }) : null;
}

export async function GET(request) {
  try {
    const denied = await masterOnly();
    if (denied) return denied;
    const sp = new URL(request.url).searchParams;
    return NextResponse.json(await listActivity({
      limit: sp.get("limit") || 200,
      beforeId: sp.get("beforeId"),
      type: sp.get("type") || undefined,
    }));
  } catch (error) {
    console.error("[API ERROR] /api/usage/activity GET failed:", error);
    return NextResponse.json({ error: "Failed to fetch activity" }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const denied = await masterOnly();
    if (denied) return denied;
    await clearActivity();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[API ERROR] /api/usage/activity DELETE failed:", error);
    return NextResponse.json({ error: "Failed to clear activity" }, { status: 500 });
  }
}
