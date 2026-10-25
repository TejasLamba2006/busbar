import { NextResponse } from "next/server";
import { getSettings } from "@/lib/localDb";
import { checkForUpdate, runSelfUpdate } from "@/lib/system/autoUpdater";

export const dynamic = "force-dynamic";

export async function GET() {
  const { autoUpdate } = await getSettings();
  return NextResponse.json(await checkForUpdate({ autoUpdate: !!autoUpdate }), { headers: { "Cache-Control": "no-store" } });
}

export async function POST() {
  const result = await runSelfUpdate();
  return NextResponse.json(result, { status: result.success ? 200 : 500 });
}
