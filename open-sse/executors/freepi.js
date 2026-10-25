import { createHash } from "node:crypto";
import { DefaultExecutor } from "./default.js";
import { getCachedFreepiVersion, getFreepiClientVersion } from "../services/freepiModels.js";

const RESET_URL = "https://api.freepi.ai/session/reset";
const ADS_URL = "https://api.freepi.ai/ads";
const AD_REFRESH_TTL_MS = 10 * 60 * 1000;
const BANNER_MIN_GAP_MS = 60 * 1000;
const ADS_TIMEOUT_MS = 5000;
// per session key: { lastBanner, turnCount, lastClickTokens: { banner, inline } }
const adSessionState = new Map();
const SESSION_RE = /session|lease|another active/i;
const VERSION_RE = /version|outdated|upgrade/i;

// Stable UUID-shaped id per connection so every request shares one session lease.
function stableSessionId(credentials) {
  const seed = credentials?.connectionId || credentials?.accessToken || credentials?.apiKey || "freepi";
  const h = createHash("sha256").update(`freepi:${seed}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

// base64url(JSON({ sessionId, userId? })), userId = sha256(JWT sub), as free-pi-cli sends it.
function gravityContext(token, sessionId) {
  let userId;
  try {
    const sub = JSON.parse(Buffer.from(String(token).split(".")[1], "base64url").toString()).sub;
    if (sub) userId = createHash("sha256").update(String(sub)).digest("hex");
  } catch {
    // opaque token: no userId
  }
  return Buffer.from(JSON.stringify({ sessionId, ...(userId ? { userId } : {}) })).toString("base64url");
}

async function peek(response) {
  try {
    return await response.clone().text();
  } catch {
    return "";
  }
}

export function resetFreepiAdsForTests() {
  adSessionState.clear();
}

// Mirrors free-pi-cli's pi-ads: GET /ads/next, then POST /ads/impression once per click_token
// (plus Gravity's imp_url pixel when source=gravity). Server gates chat on this; never throws.
async function pingAds(credentials, slots, state) {
  const token = credentials?.accessToken || credentials?.apiKey;
  const sessionId = stableSessionId(credentials);
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "x-client-version": getCachedFreepiVersion(),
    "x-session-id": sessionId,
    "x-gravity-context": gravityContext(token, sessionId),
  };
  const signal = () => AbortSignal.timeout(ADS_TIMEOUT_MS);
  for (const slot of slots) {
    try {
      const res = await fetch(`${ADS_URL}/next?slot=${slot}`, { headers, signal: signal() });
      if (res.status !== 200) continue;
      const ad = await res.json();
      if (!ad?.ad_id || !ad?.click_token) continue;
      if (ad.click_token === state.lastClickTokens[slot]) continue;
      state.lastClickTokens[slot] = ad.click_token;
      let impFired = false;
      if (ad.source === "gravity" && /^https:\/\/([^/]*\.)?trygravity\.(ai|com)\//.test(ad.imp_url || "")) {
        fetch(ad.imp_url, { signal: AbortSignal.timeout(3000) }).catch(() => {});
        impFired = true;
      }
      await fetch(`${ADS_URL}/impression`, {
        method: "POST",
        headers,
        signal: signal(),
        body: JSON.stringify({ ad_id: ad.ad_id, click_token: ad.click_token, ...(impFired ? { imp_fired: true } : {}) }),
      });
    } catch {
      // best-effort
    }
  }
}

// Cadence: banner on session start, every 10 min, and at most once per 60s across turns;
// inline every 5th turn. force (403 ads_required) resets dedupe and fetches both.
async function ensureAds(credentials, force = false) {
  const key = credentials?.connectionId || credentials?.accessToken || credentials?.apiKey || "freepi";
  let state = adSessionState.get(key);
  if (!state) {
    state = { lastBanner: 0, turnCount: 0, lastClickTokens: { banner: null, inline: null } };
    adSessionState.set(key, state);
  }
  const now = Date.now();
  const slots = [];
  if (force) {
    state.lastClickTokens = { banner: null, inline: null };
    slots.push("banner", "inline");
  } else {
    state.turnCount += 1;
    const gap = now - state.lastBanner;
    if (state.lastBanner === 0 || gap >= AD_REFRESH_TTL_MS || (gap >= BANNER_MIN_GAP_MS && state.turnCount > 1)) slots.push("banner");
    if (state.turnCount % 5 === 1) slots.push("inline");
  }
  if (slots.includes("banner")) state.lastBanner = now;
  if (slots.length) await pingAds(credentials, slots, state);
}

export class FreepiExecutor extends DefaultExecutor {
  constructor() {
    super("freepi");
  }

  buildHeaders(credentials, stream = true, url, model, body = null) {
    const headers = super.buildHeaders(credentials, stream, url, model, body);
    headers.Authorization = `Bearer ${credentials?.accessToken || credentials?.apiKey}`;
    headers["x-client-version"] = getCachedFreepiVersion();
    headers["x-session-id"] = stableSessionId(credentials);
    return headers;
  }

  async execute(args) {
    await getFreepiClientVersion(false, args.credentials?.accessToken || args.credentials?.apiKey); // warms cache; no-op within TTL
    await ensureAds(args.credentials);
    const result = await super.execute(args);
    const status = result?.response?.status;
    if (![400, 403, 409, 426].includes(status)) return result;

    const text = await peek(result.response);
    const token = args.credentials?.accessToken || args.credentials?.apiKey;
    if (status === 403 && /ads_required/.test(text)) {
      await ensureAds(args.credentials, true);
      return super.execute(args);
    }
    if (status === 426 || (status === 400 && VERSION_RE.test(text) && !SESSION_RE.test(text))) {
      await getFreepiClientVersion(true, token);
      return super.execute(args);
    }
    if (status === 409 || SESSION_RE.test(text)) {
      try {
        await fetch(RESET_URL, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "x-client-version": getCachedFreepiVersion() },
        });
      } catch {
        return result;
      }
      return super.execute(args);
    }
    return result;
  }
}
