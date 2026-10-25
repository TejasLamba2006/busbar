import https from "node:https";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import pkg from "../../../package.json" with { type: "json" };
import { DATA_DIR } from "@/lib/dataDir.js";

const PKG = "busbar-ai";
const REPO = "TejasLamba2006/busbar";
const CHECK_EVERY_MS = 30 * 60 * 1000;
const state = (globalThis.__busbarUpdate ??= {
  latestVersion: null, lastCheckedAt: null, lastUpdateError: null, status: "idle", timer: null,
});

export function compareVersions(a, b) {
  const pa = String(a).split(".").map(Number);
  const pb = String(b).split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) > (pb[i] || 0)) return 1;
    if ((pa[i] || 0) < (pb[i] || 0)) return -1;
  }
  return 0;
}

// npm unpacks big tarballs async: `latest` can briefly show 0.0.0-stage or a version without a tarball.
export function isInstallableEntry(entry, expectedVersion) {
  return !!entry && entry.version === expectedVersion && expectedVersion !== "0.0.0-stage" &&
    /^\d+\.\d+\.\d+$/.test(expectedVersion) && !!entry.dist?.tarball;
}

function getJson(url, headers = {}) {
  return new Promise((resolve) => {
    const req = https.get(url, { timeout: 5000, headers: { "User-Agent": "busbar-updater", ...headers } }, (res) => {
      let d = "";
      res.on("data", (c) => (d += c));
      res.on("end", () => { try { resolve(JSON.parse(d)); } catch { resolve(null); } });
    });
    req.on("error", () => resolve(null));
    req.on("timeout", () => { req.destroy(); resolve(null); });
  });
}

// GitHub release body for vX.Y.Z (cached on success only).
const notesCache = new Map();
export async function fetchReleaseNotes(version) {
  if (!version) return null;
  if (notesCache.has(version)) return notesCache.get(version);
  const rel = await getJson(`https://api.github.com/repos/${REPO}/releases/tags/v${version}`, { Accept: "application/vnd.github+json" });
  const body = typeof rel?.body === "string" ? rel.body.trim().slice(0, 8000) : null;
  if (body) notesCache.set(version, body);
  return body;
}

// All GitHub releases, newest first (cached 5 min on success only).
let releasesCache = { at: 0, list: null };
export async function fetchAllReleases() {
  if (releasesCache.list && Date.now() - releasesCache.at < 5 * 60 * 1000) return releasesCache.list;
  const rels = await getJson(`https://api.github.com/repos/${REPO}/releases?per_page=30`, {
    Accept: "application/vnd.github+json", "User-Agent": "busbar-ai",
  });
  if (!Array.isArray(rels)) return releasesCache.list || [];
  const list = rels.map((r) => ({
    tag: r.tag_name,
    version: String(r.tag_name || "").replace(/^v/, ""),
    title: r.name || r.tag_name,
    notes: r.body || "",
    publishedAt: r.published_at,
    url: r.html_url,
  }));
  releasesCache = { at: Date.now(), list };
  return list;
}

// ---- update-status.json (written by the detached worker) -----------------------
const statusPath = (dir = DATA_DIR) => path.join(dir, "update-status.json");

export function readUpdateStatus(dir = DATA_DIR) {
  try { return JSON.parse(fs.readFileSync(statusPath(dir), "utf8")); } catch { return null; }
}

function writeUpdateStatus(patch, dir = DATA_DIR) {
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(statusPath(dir), JSON.stringify({ ...(readUpdateStatus(dir) || {}), ...patch, updatedAt: new Date().toISOString() }));
  } catch { /* best effort */ }
}

export function dismissChangelog(dir = DATA_DIR) {
  if (readUpdateStatus(dir)?.justUpdated) writeUpdateStatus({ justUpdated: false }, dir);
}

export async function fetchInstallableLatest() {
  const latest = await getJson(`https://registry.npmjs.org/${PKG}/latest`);
  const v = latest?.version;
  if (!v || v === "0.0.0-stage") return null;
  const entry = await getJson(`https://registry.npmjs.org/${PKG}/${v}`);
  return isInstallableEntry(entry, v) ? v : null;
}

export async function checkForUpdate({ autoUpdate = false } = {}) {
  const v = await fetchInstallableLatest();
  state.lastCheckedAt = new Date().toISOString();
  if (v) state.latestVersion = v;
  const latestVersion = state.latestVersion;
  const updateAvailable = !!latestVersion && compareVersions(latestVersion, pkg.version) > 0;
  const file = readUpdateStatus();
  const fresh = !!file?.updatedAt && Date.now() - Date.parse(file.updatedAt) < 5 * 60 * 1000;
  const inFlight = fresh && (file.status === "updating" || file.status === "restarting");
  const justAutoUpdatedTo = file?.justUpdated && file.updatedTo === pkg.version ? pkg.version : null;
  const [latestReleaseNotes, currentReleaseNotes, releases] = await Promise.all([
    updateAvailable ? fetchReleaseNotes(latestVersion) : null,
    justAutoUpdatedTo ? fetchReleaseNotes(pkg.version) : null,
    fetchAllReleases(),
  ]);
  return {
    currentVersion: pkg.version,
    latestVersion,
    updateAvailable,
    autoUpdate,
    status: inFlight ? file.status : state.status,
    lastCheckedAt: state.lastCheckedAt,
    lastUpdateError: state.lastUpdateError || (fresh && file.status === "error" ? file.error : null),
    latestReleaseNotes,
    currentReleaseNotes,
    justAutoUpdatedTo,
    releases,
  };
}

// Supervisors (systemd etc.) restart us; POSIX lets npm replace files of a running process.
const isSupervisedPosix = () =>
  process.platform !== "win32" && !!(process.env.INVOCATION_ID || process.env.pm_id || process.env.SUPERVISOR_ENABLED);

export function scheduleRestart() {
  setTimeout(() => process.exit(0), 1000);
}

// Install dir of the global busbar-ai package (set by cli.js; cwd of the server is <root>/app).
export function resolveInstallRoot() {
  const cands = [process.env.BUSBAR_CLI_DIR, path.resolve(process.cwd(), "..")].filter(Boolean);
  return cands.find((c) => {
    try { return JSON.parse(fs.readFileSync(path.join(c, "package.json"), "utf8")).name === PKG; } catch { return false; }
  }) || null;
}

// Copy the worker out of node_modules and start it detached (cwd=tmp) so it can kill us and replace the install dir.
export function launchUpdaterWorker(version, { installRoot = resolveInstallRoot(), dataDir = DATA_DIR } = {}) {
  const src = installRoot && path.join(installRoot, "hooks", "updater-worker.cjs");
  if (!src || !fs.existsSync(src)) throw new Error("Updater worker not found; reinstall with: npm i -g busbar-ai@latest");
  fs.mkdirSync(dataDir, { recursive: true });
  const worker = path.join(dataDir, "updater-worker.cjs");
  fs.copyFileSync(src, worker);
  const cfg = {
    version, dataDir, installRoot, nodeExe: process.execPath,
    pids: [process.pid, process.ppid], port: process.env.PORT || "20128", host: process.env.HOSTNAME || "0.0.0.0", restart: true,
  };
  writeUpdateStatus({ status: "updating", updatedTo: version, error: null, justUpdated: false }, dataDir);
  spawn(process.execPath, [worker, Buffer.from(JSON.stringify(cfg)).toString("base64")], {
    cwd: os.tmpdir(), detached: true, stdio: "ignore", windowsHide: true,
  }).unref();
}

function run(cmd, args) {
  return new Promise((resolve) => {
    let err = "";
    const c = spawn(cmd, args, { shell: process.platform === "win32", windowsHide: true, stdio: ["ignore", "ignore", "pipe"] });
    c.stderr.on("data", (d) => (err += d));
    c.on("error", (e) => resolve({ code: 1, err: e.message }));
    c.on("close", (code) => resolve({ code, err }));
  });
}

async function installInPlace(version) {
  const args = ["install", "-g", `${PKG}@${version}`];
  let r = await run("npm", args);
  const canSudo = process.platform === "linux" && typeof process.getuid === "function" && process.getuid() !== 0;
  if (r.code !== 0 && canSudo && /EACCES|EPERM/.test(r.err)) r = await run("sudo", ["-n", "npm", ...args]);
  return r;
}

export async function runSelfUpdate() {
  if (state.status === "updating" || state.status === "restarting") return { success: false, error: "Update already in progress" };
  const latestVersion = await fetchInstallableLatest();
  if (!latestVersion) return { success: false, error: "No installable version on npm yet" };
  if (compareVersions(latestVersion, pkg.version) <= 0) return { success: false, error: "Already up to date" };
  state.status = "updating";
  state.lastUpdateError = null;
  if (isSupervisedPosix()) {
    const r = await installInPlace(latestVersion);
    if (r.code !== 0) {
      state.status = "idle";
      state.lastUpdateError = (r.err || `npm exited with ${r.code}`).trim().slice(-500);
      return { success: false, error: state.lastUpdateError };
    }
    writeUpdateStatus({ status: "idle", updatedTo: latestVersion, error: null, justUpdated: true });
    state.status = "restarting";
    scheduleRestart();
    return { success: true, updatedTo: latestVersion, restarting: true };
  }
  try {
    launchUpdaterWorker(latestVersion);
  } catch (e) {
    state.status = "idle";
    state.lastUpdateError = e.message;
    return { success: false, error: e.message };
  }
  state.status = "restarting";
  // Let the HTTP response flush, then get out of the way: the worker kills whatever is left.
  setTimeout(() => process.exit(0), 400);
  return { success: true, updatedTo: latestVersion, restarting: true };
}

async function tick() {
  try {
    const { getSettings } = await import("@/lib/localDb");
    const s = await getSettings();
    if (!s.autoUpdate) return;
    const info = await checkForUpdate({ autoUpdate: true });
    if (info.updateAvailable) await runSelfUpdate();
  } catch (e) {
    state.lastUpdateError = e.message;
  }
}

export function startAutoUpdater() {
  if (state.timer) return;
  state.timer = setInterval(tick, CHECK_EVERY_MS);
  state.timer.unref?.();
  setTimeout(tick, 60_000).unref?.();
}
