/**
 * Freebuff device-key signing + live model catalog (mirrors CodebuffAI/freebuff
 * common/src/util/freebuff-device-signing.ts and cli/src/utils/freebuff-model-catalog.ts).
 * One Ed25519 key pair per install, public key registered once per (host, account token),
 * every signed request carries x-freebuff-device-{key,ts,sig}.
 * Payload: "freebuff-device-v1\nMETHOD\npath\nts\nbodySha256hex\nfetchId".
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DATA_DIR } from "@/lib/dataDir.js";

export const FREEBUFF_API = "https://www.codebuff.com";
const KEYS_PATH = "/api/v1/freebuff/device-keys";
const CATALOG_PATH = "/api/v1/freebuff/models";
const TTL_MS = 30 * 60 * 1000;
const TIMEOUT_MS = 10_000;

let keyFile = path.join(DATA_DIR, "freebuff-device-key.json");
let record = null; // { publicKey, privateKey (pkcs8 b64url), registrations: { scope: keyId } }
let catalogCache = null; // { at, models, fetchId }
let inflight = null;

export const b64url = (buf) => Buffer.from(buf).toString("base64url");
const sha256Hex = (s) => crypto.createHash("sha256").update(s).digest("hex");
const scopeFor = (token) => `${FREEBUFF_API} token:${sha256Hex(token).slice(0, 32)}`;

function persist() {
  try {
    fs.mkdirSync(path.dirname(keyFile), { recursive: true });
    fs.writeFileSync(keyFile, JSON.stringify(record), { mode: 0o600 });
  } catch {
    // memory-only is fine: costs one re-registration next launch
  }
}

function loadKey() {
  if (record) return record;
  try {
    const r = JSON.parse(fs.readFileSync(keyFile, "utf8"));
    if (r?.version === 1 && r.publicKey && r.privateKey) record = { ...r, registrations: r.registrations || {} };
  } catch {}
  if (!record) {
    const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
    record = {
      version: 1,
      // raw 32-byte public key = last 32 bytes of the SPKI DER
      publicKey: b64url(publicKey.export({ type: "spki", format: "der" }).subarray(-32)),
      privateKey: b64url(privateKey.export({ type: "pkcs8", format: "der" })),
      registrations: {},
    };
    persist();
  }
  return record;
}

/** Register the device key for this account (once); resolves keyId or null. Never throws. */
export async function ensureFreebuffDeviceKey(token) {
  try {
    const r = loadKey();
    const scope = scopeFor(token);
    if (r.registrations[scope]) return r.registrations[scope];
    const res = await fetch(`${FREEBUFF_API}${KEYS_PATH}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ publicKey: r.publicKey, client: "cli" }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const keyId = (await res.json().catch(() => null))?.keyId;
    if (typeof keyId !== "string" || !keyId) return null;
    r.registrations[scope] = keyId;
    persist();
    return keyId;
  } catch {
    return null;
  }
}

export function forgetFreebuffDeviceKey(token) {
  if (!record) return;
  delete record.registrations[scopeFor(token)];
  persist();
}

/** Sync signing headers; {} when this account has no registered key yet. `body` must be the exact bytes sent. */
export function freebuffDeviceHeaders(token, { method, url, body = "", fetchId = "" }, now = Date.now()) {
  try {
    const r = loadKey();
    const keyId = r.registrations[scopeFor(token)];
    if (!keyId) return {};
    const payload = ["freebuff-device-v1", method.toUpperCase(), new URL(url).pathname, String(now), sha256Hex(body || ""), fetchId || ""].join("\n");
    const key = crypto.createPrivateKey({ key: Buffer.from(r.privateKey, "base64url"), format: "der", type: "pkcs8" });
    return {
      "x-freebuff-device-key": keyId,
      "x-freebuff-device-ts": String(now),
      "x-freebuff-device-sig": b64url(crypto.sign(null, Buffer.from(payload), key)),
    };
  } catch {
    return {};
  }
}

/**
 * Live catalog: GET /api/v1/freebuff/models (signed). Rows carry an opaque, per-fetch `handle`
 * that goes wherever a model id used to (x-freebuff-model, chat `model`). Busbar model ids are
 * slugs of the display name; ids from the old static list still resolve through legacyDigests.
 */
export function legacyDigest(modelId) {
  const input = `freebuff-legacy-model:${modelId}`;
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193 ^ 0x5bd1e995;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ c, 0x5bd1e995) >>> 0;
  }
  return h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0");
}

const slug = (name) => String(name).toLowerCase().replace(/[^a-z0-9.]+/g, "-").replace(/^-+|-+$/g, "");

async function loadCatalog(token, force = false) {
  if (!force && catalogCache && Date.now() - catalogCache.at < TTL_MS) return catalogCache;
  if (inflight) return inflight;
  inflight = (async () => {
    const stale = catalogCache;
    try {
      const url = `${FREEBUFF_API}${CATALOG_PATH}`;
      await ensureFreebuffDeviceKey(token);
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          "x-freebuff-catalog-protocol": "1",
          "x-freebuff-client": "cli",
          ...freebuffDeviceHeaders(token, { method: "GET", url }),
        },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const cat = await res.json();
      if (cat?.protocol !== 1 || !Array.isArray(cat.rows)) throw new Error("not a catalog");
      const issuedAt = cat.issuedAt ?? Date.now();
      const seen = new Set();
      const rows = [];
      for (const row of cat.rows) {
        if (!row.handle || !row.displayName) continue;
        let id = slug(row.displayName);
        if (seen.has(id)) id += `-${String(row.key || "").replace(/^m-/, "").slice(0, 4)}`;
        seen.add(id);
        const locked = row.access === "locked" || (row.opensAt !== undefined && row.opensAt > issuedAt);
        rows.push({ id, name: row.displayName, handle: row.handle, locked, digests: row.legacyDigests || [] });
      }
      catalogCache = { at: Date.now(), rows, fetchId: cat.fetchId || "" };
    } catch {
      catalogCache = { at: Date.now(), rows: stale?.rows || [], fetchId: stale?.fetchId || "" };
    } finally {
      inflight = null;
    }
    return catalogCache;
  })();
  return inflight;
}

/** Unlocked live models or null -> static fallback. */
export async function resolveFreebuffModels(token) {
  if (!token) return null;
  const { rows } = await loadCatalog(token);
  const models = rows.filter((r) => !r.locked).map((r) => ({ id: r.id, name: r.name }));
  return models.length ? { models } : null;
}

/** Live { handle, fetchId, name } for a model id (slug or legacy id), refetching once if unknown; null if absent or locked. */
export async function resolveFreebuffRow(token, modelId) {
  const find = (c) => {
    const d = legacyDigest(modelId);
    return c.rows.find((r) => r.id === modelId) || c.rows.find((r) => r.digests.includes(d));
  };
  let cat = await loadCatalog(token);
  let row = find(cat);
  if (!row) {
    cat = await loadCatalog(token, true);
    row = find(cat);
  }
  return row && !row.locked ? { handle: row.handle, fetchId: cat.fetchId, name: row.name } : null;
}

/** Drop the cached catalog so the next call refetches (stale handle). */
export function invalidateFreebuffCatalog() {
  catalogCache = null;
}

export function resetFreebuffModelsForTests(file) {
  record = null;
  catalogCache = null;
  inflight = null;
  if (file) keyFile = file;
}
