import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getDashboardAuthSession } from "@/lib/auth/dashboardSession";
import { getApiKeyById, getSettings, updateApiKey, updateSettings } from "@/lib/localDb";
import { applyOutboundProxyEnv } from "@/lib/network/outboundProxy";
import { resetComboRotation } from "open-sse/services/combo.js";
import bcrypt from "bcryptjs";
import fs from "node:fs";
import path from "node:path";
import { DATA_DIR } from "@/lib/dataDir.js";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const SETTINGS_RESPONSE_HEADERS = {
  "Cache-Control": "no-store"
};

const CLIENT_TOKEN_SAVER_KEYS = [
  "rtkEnabled", "headroomEnabled", "headroomUrl", "headroomCompressUserMessages",
  "headroomTimeoutMs", "cavemanEnabled", "cavemanLevel", "ponytailEnabled",
  "ponytailLevel", "customPromptEnabled", "customPrompt", "pxpipeEnabled",
  "pxpipeMinChars", "pxpipeTimeoutMs",
];

function pickClientTokenSaverSettings(settings) {
  return Object.fromEntries(CLIENT_TOKEN_SAVER_KEYS
    .filter((key) => Object.prototype.hasOwnProperty.call(settings || {}, key))
    .map((key) => [key, settings[key]]));
}

async function getClientSession() {
  const cookieStore = await cookies();
  return getDashboardAuthSession(cookieStore.get("auth_token")?.value);
}

// Secrets must never be mass-assigned from request body (CWE-915)
const PROTECTED_SETTING_KEYS = ["password", "mitmSudoEncrypted"];

export async function GET() {
  try {
    const settings = await getSettings();
    const session = await getClientSession();
    if (session?.role === "client" && session.apiKeyId) {
      const keyRecord = await getApiKeyById(session.apiKeyId);
      return NextResponse.json({
        ...pickClientTokenSaverSettings(settings),
        ...pickClientTokenSaverSettings(keyRecord?.tokenSaverSettings),
        isClientSession: true,
      }, { headers: SETTINGS_RESPONSE_HEADERS });
    }
    const { password, oidcClientSecret, ...safeSettings } = settings;
    safeSettings.oidcConfigured = !!(safeSettings.oidcIssuerUrl && safeSettings.oidcClientId && oidcClientSecret);
    
    const enableRequestLogs = process.env.ENABLE_REQUEST_LOGS === "true";
    const enableTranslator = process.env.ENABLE_TRANSLATOR === "true";
    
    return NextResponse.json({ 
      ...safeSettings, 
      enableRequestLogs,
      enableTranslator,
      hasPassword: !!password
    }, { headers: SETTINGS_RESPONSE_HEADERS });
  } catch (error) {
    console.log("Error getting settings:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const body = await request.json();
    const session = await getClientSession();
    if (session?.role === "client" && session.apiKeyId) {
      const patch = pickClientTokenSaverSettings(body);
      const keyRecord = await updateApiKey(session.apiKeyId, { tokenSaverSettings: patch });
      const settings = await getSettings();
      return NextResponse.json({
        ...pickClientTokenSaverSettings(settings),
        ...pickClientTokenSaverSettings(keyRecord?.tokenSaverSettings),
        isClientSession: true,
      }, { headers: SETTINGS_RESPONSE_HEADERS });
    }

    // Strip protected secrets before any internal handling sets them
    for (const key of PROTECTED_SETTING_KEYS) delete body[key];

    // If updating password, hash it
    if (body.newPassword) {
      const settings = await getSettings();
      const currentHash = settings.password;

      // Verify current password if it exists
      if (currentHash) {
        if (!body.currentPassword) {
          return NextResponse.json({ error: "Current password required" }, { status: 400 });
        }
        const isValid = await bcrypt.compare(body.currentPassword, currentHash);
        if (!isValid) {
          return NextResponse.json({ error: "Invalid current password" }, { status: 401 });
        }
      } else {
        // First time setting password, no current password needed
        // Allow empty currentPassword or default "123456"
        if (body.currentPassword && body.currentPassword !== "123456") {
           return NextResponse.json({ error: "Invalid current password" }, { status: 401 });
        }
      }

      const salt = await bcrypt.genSalt(10);
      body.password = await bcrypt.hash(body.newPassword, salt);
      delete body.newPassword;
      delete body.currentPassword;
    }

    if (Object.prototype.hasOwnProperty.call(body, "oidcClientSecret")) {
      if (!body.oidcClientSecret || !String(body.oidcClientSecret).trim()) {
        delete body.oidcClientSecret;
      }
    }

    if (Object.prototype.hasOwnProperty.call(body, "serverPort")) {
      const n = Number(body.serverPort);
      if (!Number.isInteger(n) || n < 1 || n > 65535) {
        return NextResponse.json({ error: "serverPort must be an integer between 1 and 65535" }, { status: 400 });
      }
      body.serverPort = n;
    }

    if (Object.prototype.hasOwnProperty.call(body, "autoUpdate")) {
      if (typeof body.autoUpdate !== "boolean") {
        return NextResponse.json({ error: "autoUpdate must be a boolean" }, { status: 400 });
      }
    }

    const settings = await updateSettings(body);

    // Thin CLI reads port.json at startup (no SQLite driver needed there)
    if (body.serverPort !== undefined) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(path.join(DATA_DIR, "port.json"), JSON.stringify({ port: body.serverPort }));
    }

    // Apply outbound proxy settings immediately (no restart required)
    if (
      Object.prototype.hasOwnProperty.call(body, "outboundProxyEnabled") ||
      Object.prototype.hasOwnProperty.call(body, "outboundProxyUrl") ||
      Object.prototype.hasOwnProperty.call(body, "outboundNoProxy")
    ) {
      applyOutboundProxyEnv(settings);
    }

    // Invalidate combo rotation state when strategy settings change
    if (
      Object.prototype.hasOwnProperty.call(body, "comboStrategy") ||
      Object.prototype.hasOwnProperty.call(body, "comboStickyRoundRobinLimit") ||
      Object.prototype.hasOwnProperty.call(body, "comboStrategies")
    ) {
      resetComboRotation();
    }

    if (
      Object.prototype.hasOwnProperty.call(body, "claudeAutoPing") ||
      Object.prototype.hasOwnProperty.call(body, "codexAutoPing")
    ) {
      // Keep the scheduler absent when no account opted in; load its provider graph only on demand.
      import("@/shared/services/quotaAutoPing")
        .then(({ configureQuotaAutoPing }) => {
          configureQuotaAutoPing(settings);
        })
        .catch((error) => console.warn("[AutoPing] settings update failed:", error.message));
    }

    const { password, oidcClientSecret, ...safeSettings } = settings;
    safeSettings.oidcConfigured = !!(safeSettings.oidcIssuerUrl && safeSettings.oidcClientId && oidcClientSecret);
    return NextResponse.json(safeSettings, { headers: SETTINGS_RESPONSE_HEADERS });
  } catch (error) {
    console.log("Error updating settings:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
