import https from "node:https";
import { spawn } from "node:child_process";
import pkg from "../../../package.json" with { type: "json" };

const PKG = "busbar-ai";
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

function getJson(url) {
  return new Promise((resolve) => {
    const req = https.get(url, { timeout: 5000 }, (res) => {
      let d = "";
      res.on("data", (c) => (d += c));
      res.on("end", () => { try { resolve(JSON.parse(d)); } catch { resolve(null); } });
    });
    req.on("error", () => resolve(null));
    req.on("timeout", () => { req.destroy(); resolve(null); });
  });
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
  return {
    currentVersion: pkg.version,
    latestVersion,
    updateAvailable: !!latestVersion && compareVersions(latestVersion, pkg.version) > 0,
    autoUpdate,
    status: state.status,
    lastCheckedAt: state.lastCheckedAt,
    lastUpdateError: state.lastUpdateError,
  };
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

async function installGlobal(version) {
  const args = ["install", "-g", `${PKG}@${version}`];
  let r = await run("npm", args);
  const canSudo = process.platform === "linux" && typeof process.getuid === "function" && process.getuid() !== 0;
  if (r.code !== 0 && canSudo && /EACCES|EPERM/.test(r.err)) r = await run("sudo", ["-n", "npm", ...args]);
  return r;
}

export function scheduleRestart() {
  setTimeout(() => {
    const managed = process.env.INVOCATION_ID || process.env.pm_id || process.env.SUPERVISOR_ENABLED;
    if (!managed) {
      // Not supervised: start a detached replacement after we release the port.
      const port = process.env.PORT || "20128";
      const host = process.env.HOSTNAME || "0.0.0.0";
      const code = `setTimeout(()=>require("child_process").spawn("busbar",["--host",${JSON.stringify(host)},"--port",${JSON.stringify(port)},"--no-browser","--skip-update"],{detached:true,stdio:"ignore",shell:true,windowsHide:true}).unref(),3000)`;
      spawn(process.execPath, ["-e", code], { detached: true, stdio: "ignore", windowsHide: true }).unref();
    }
    process.exit(0);
  }, 1000);
}

export async function runSelfUpdate() {
  if (state.status === "updating") return { success: false, error: "Update already in progress" };
  const latestVersion = await fetchInstallableLatest();
  if (!latestVersion) return { success: false, error: "No installable version on npm yet" };
  if (compareVersions(latestVersion, pkg.version) <= 0) return { success: false, error: "Already up to date" };
  state.status = "updating";
  state.lastUpdateError = null;
  const r = await installGlobal(latestVersion);
  if (r.code !== 0) {
    state.status = "idle";
    state.lastUpdateError = (r.err || `npm exited with ${r.code}`).trim().slice(-500);
    return { success: false, error: state.lastUpdateError };
  }
  state.status = "restarting";
  scheduleRestart();
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
