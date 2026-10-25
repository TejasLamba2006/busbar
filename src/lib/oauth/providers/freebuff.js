import { randomUUID } from "node:crypto";
import { PROVIDER_OAUTH } from "open-sse/providers/index.js";

const CONFIG = { ...PROVIDER_OAUTH["freebuff"] };

// Freebuff CLI login: POST /api/auth/cli/code, user opens loginUrl, we poll /api/auth/cli/status.
// device_code packs "fingerprintId|fingerprintHash|expiresAt" because the poll needs all three.
const freebuff = {
  config: CONFIG,
  flowType: "device_code",
  requestDeviceCode: async (config) => {
    const fingerprintId = `busbar-${randomUUID()}`;
    const res = await fetch(config.codeUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fingerprintId }),
    });
    if (!res.ok) throw new Error(`Freebuff login code failed: HTTP ${res.status}`);
    const d = await res.json();
    const authCode = new URL(d.loginUrl).searchParams.get("auth_code") || "";
    return {
      device_code: `${d.fingerprintId}|${d.fingerprintHash}|${d.expiresAt}`,
      user_code: authCode.slice(0, 8),
      verification_uri: d.loginUrl,
      verification_uri_complete: d.loginUrl,
      interval: 5,
      expires_in: Math.floor((d.expiresInMs || 3600000) / 1000),
    };
  },
  pollToken: async (config, deviceCode) => {
    const [fingerprintId, fingerprintHash, expiresAt] = String(deviceCode).split("|");
    const qs = new URLSearchParams({ fingerprintId, fingerprintHash, expiresAt });
    const res = await fetch(`${config.statusUrl}?${qs}`, { headers: { Accept: "application/json" } });
    const data = await res.json().catch(() => ({}));
    const user = data?.user;
    if (res.ok && user?.authToken) return { ok: true, data: { access_token: user.authToken, user } };
    // 401 / no user yet = still waiting
    return { ok: true, data: { error: "authorization_pending" } };
  },
  mapTokens: (tokens) => ({
    accessToken: tokens.access_token,
    apiKey: tokens.access_token,
    expiresIn: 90 * 86400,
    email: tokens.user?.email,
    displayName: tokens.user?.name || tokens.user?.email,
    providerSpecificData: { userId: tokens.user?.id },
  }),
};

export default freebuff;
