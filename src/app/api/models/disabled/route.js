import { NextResponse } from "next/server";
import { getRequestDashboardSession } from "@/lib/auth/dashboardSession";
import { getDisabledModels } from "@/lib/disabledModelsDb";
import { disableCanonicalModels, enableCanonicalModels, getDisabledModelIds } from "@/sse/services/modelVisibility";

export const dynamic = "force-dynamic";

// GET /api/models/disabled?providerAlias=xxx
export async function GET(request) {
  try {
    const session = await getRequestDashboardSession(request);
    const ownerKeyId = session?.role === "client" ? session.apiKeyId : null;
    const { searchParams } = new URL(request.url);
    const providerAlias = searchParams.get("providerAlias");
    const all = await getDisabledModels(ownerKeyId);
    if (providerAlias) return NextResponse.json({ ids: await getDisabledModelIds(providerAlias, null, ownerKeyId) });
    return NextResponse.json({ disabled: all });
  } catch (error) {
    console.log("Error fetching disabled models:", error);
    return NextResponse.json({ error: "Failed to fetch disabled models" }, { status: 500 });
  }
}

// POST /api/models/disabled  body: { providerAlias, ids: [...] }
export async function POST(request) {
  try {
    const session = await getRequestDashboardSession(request);
    const ownerKeyId = session?.role === "client" ? session.apiKeyId : null;
    const { providerAlias, ids } = await request.json();
    if (!providerAlias || !Array.isArray(ids)) {
      return NextResponse.json({ error: "providerAlias and ids[] required" }, { status: 400 });
    }
    await disableCanonicalModels(providerAlias, ids, ownerKeyId);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error?.message === "Invalid disabled model input") {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.log("Error disabling models:", error);
    return NextResponse.json({ error: "Failed to disable models" }, { status: 500 });
  }
}

// DELETE /api/models/disabled?providerAlias=xxx[&id=yyy]
export async function DELETE(request) {
  try {
    const session = await getRequestDashboardSession(request);
    const ownerKeyId = session?.role === "client" ? session.apiKeyId : null;
    const { searchParams } = new URL(request.url);
    const providerAlias = searchParams.get("providerAlias");
    const id = searchParams.get("id");
    if (!providerAlias) {
      return NextResponse.json({ error: "providerAlias required" }, { status: 400 });
    }
    await enableCanonicalModels(providerAlias, id ? [id] : [], ownerKeyId);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error?.message === "Invalid disabled model input") {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.log("Error enabling models:", error);
    return NextResponse.json({ error: "Failed to enable models" }, { status: 500 });
  }
}
