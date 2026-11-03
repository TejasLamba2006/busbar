import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getDashboardAuthSession } from "@/lib/auth/dashboardSession";
import { getRequestDetailById } from "@/lib/db/repos/requestDetailsRepo.js";

export const dynamic = "force-dynamic";

const MAX_BYTES = 8 * 1024 * 1024;
const PAYLOAD_KEYS = ["request", "providerRequest", "providerResponse", "response"];

function capDetail(detail) {
  let json = JSON.stringify(detail);
  // Truncate largest payload field until under cap.
  const d = { ...detail };
  while (json.length > MAX_BYTES) {
    let big = null, size = 0;
    for (const k of PAYLOAD_KEYS) {
      const s = d[k] && !d[k]._truncated ? JSON.stringify(d[k]).length : 0;
      if (s > size) { big = k; size = s; }
    }
    if (!big) break;
    d[big] = { _truncated: true, _originalSize: size, _preview: JSON.stringify(d[big]).slice(0, 200) };
    json = JSON.stringify(d);
  }
  return d;
}

export async function GET(_request, { params }) {
  try {
    const cookieStore = await cookies();
    const session = await getDashboardAuthSession(cookieStore.get("auth_token")?.value);
    if (session?.role === "client") return NextResponse.json({ error: "Master only" }, { status: 403 });
    const { id } = await params;
    const detail = await getRequestDetailById(id);
    if (!detail) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ detail: capDetail(detail) });
  } catch (error) {
    console.error("[API ERROR] /api/usage/request-log/[id] GET failed:", error);
    return NextResponse.json({ error: "Failed to fetch request detail" }, { status: 500 });
  }
}
