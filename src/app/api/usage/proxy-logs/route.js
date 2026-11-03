import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getDashboardAuthSession } from "@/lib/auth/dashboardSession";
import { getProxyLogs, clearProxyLogs } from "@/lib/proxyLogBuffer";

async function masterOnly() {
  const cookieStore = await cookies();
  const session = await getDashboardAuthSession(cookieStore.get("auth_token")?.value);
  return session?.role === "client" ? NextResponse.json({ error: "Master only" }, { status: 403 }) : null;
}

export async function GET(request) {
  const denied = await masterOnly();
  if (denied) return denied;
  const sp = new URL(request.url).searchParams;
  return NextResponse.json(getProxyLogs({ limit: sp.get("limit"), sinceId: sp.get("sinceId") }));
}

export async function DELETE() {
  const denied = await masterOnly();
  if (denied) return denied;
  clearProxyLogs();
  return NextResponse.json({ success: true });
}
