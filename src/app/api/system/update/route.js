import { NextResponse } from "next/server";
import { getSettings } from "@/lib/localDb";
import { checkForUpdate, runSelfUpdate, dismissChangelog } from "@/lib/system/autoUpdater";

export const dynamic = "force-dynamic";

export async function GET() {
  const { autoUpdate } = await getSettings();
  return NextResponse.json(await checkForUpdate({ autoUpdate: !!autoUpdate }), { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  if (body?.action === "dismiss-changelog") {
    dismissChangelog();
    return NextResponse.json({ success: true });
  }
  const result = await runSelfUpdate();
  return NextResponse.json(result, { status: result.success ? 200 : 500 });
}

export async function DELETE() {
  dismissChangelog();
  return NextResponse.json({ success: true });
}
