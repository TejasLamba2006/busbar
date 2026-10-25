"use strict";
// Out-of-process updater. Copied to <DATA_DIR>/updater-worker.cjs and run detached with
// cwd=os.tmpdir() so nothing here holds a handle inside node_modules/busbar-ai.
// Flow: kill every process living in the install dir -> wait for locks to clear ->
// remove stale .busbar-ai-* temp dirs -> npm install -g (retry on EBUSY) -> respawn busbar.
// Usage: node updater-worker.cjs <base64-json-config>
const fs = require("fs");
const os = require("os");
const path = require("path");
const http = require("http");
const { spawn, spawnSync } = require("child_process");

const IS_WIN = process.platform === "win32";
const PKG = "busbar-ai";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- pure helpers (unit-tested) -------------------------------------------------

const norm = (s) => String(s || "").replace(/\//g, "\\").toLowerCase();

// True when a process command line runs from inside installRoot (node/powershell only).
function matchesInstall(cmdline, installRoot) {
  if (!cmdline || !installRoot) return false;
  // exe path may contain spaces (C:\Program Files\nodejs\node.exe), so match the image name, not the first token
  if (!/^"?(?:[^"]*?\\)?(node|powershell|pwsh|bun)(\.exe)?(["\s]|$)/.test(norm(cmdline))) return false;
  const root = norm(installRoot).replace(/\\+$/, "");
  return norm(cmdline).includes(root + "\\") || norm(cmdline).includes(root + '"');
}

// Directories npm leaves behind when a global install dies mid-rename.
function findStaleTemps(globalRoot) {
  try {
    return fs.readdirSync(globalRoot).filter((n) => n.startsWith(`.${PKG}-`)).map((n) => path.join(globalRoot, n));
  } catch { return []; }
}

function cleanupStaleTemps(globalRoot, log = () => {}) {
  const removed = [];
  for (const dir of findStaleTemps(globalRoot)) {
    try { fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 }); removed.push(dir); log(`removed stale ${dir}`); }
    catch (e) { log(`could not remove ${dir}: ${e.message}`); }
  }
  return removed;
}

// npm from the SAME node install (fnm / nvm-windows / volta each have their own).
function resolveNpm(nodeExe) {
  const dir = path.dirname(nodeExe);
  const cands = IS_WIN
    ? [path.join(dir, "node_modules", "npm", "bin", "npm-cli.js")]
    : [path.join(dir, "..", "lib", "node_modules", "npm", "bin", "npm-cli.js"), path.join(dir, "node_modules", "npm", "bin", "npm-cli.js")];
  const cli = cands.find((c) => fs.existsSync(c));
  if (cli) return { cmd: nodeExe, pre: [cli], shell: false };
  return { cmd: IS_WIN ? "npm.cmd" : "npm", pre: [], shell: IS_WIN };
}

// ---- process scan / kill ---------------------------------------------------------

function listProcesses() {
  try {
    if (IS_WIN) {
      const r = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command",
        "Get-CimInstance Win32_Process | Select-Object ProcessId,CommandLine | ConvertTo-Json -Compress"],
        { encoding: "utf8", windowsHide: true, maxBuffer: 64 * 1024 * 1024 });
      const j = JSON.parse(r.stdout || "[]");
      return (Array.isArray(j) ? j : [j]).map((p) => ({ pid: p.ProcessId, cmd: p.CommandLine || "" }));
    }
    const r = spawnSync("ps", ["-eo", "pid=,args="], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
    return r.stdout.split("\n").map((l) => l.trim().match(/^(\d+)\s+(.*)$/)).filter(Boolean).map((m) => ({ pid: +m[1], cmd: m[2] }));
  } catch { return []; }
}

function holders(installRoot, extraPids) {
  const set = new Set(extraPids.filter(Boolean));
  for (const p of listProcesses()) if (matchesInstall(p.cmd, installRoot)) set.add(p.pid);
  set.delete(process.pid);
  return [...set];
}

function kill(pid) {
  try {
    if (IS_WIN) spawnSync("taskkill", ["/F", "/PID", String(pid)], { windowsHide: true, stdio: "ignore" });
    else process.kill(pid, "SIGKILL");
  } catch { /* already gone */ }
}

const alive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };

// ---- main ------------------------------------------------------------------------

function ping(host, port) {
  return new Promise((resolve) => {
    const req = http.get({ host, port, path: "/api/system/update", timeout: 2000 }, (res) => { res.resume(); resolve(res.statusCode < 500); });
    req.on("error", () => resolve(false));
    req.on("timeout", () => { req.destroy(); resolve(false); });
  });
}

async function main(cfg) {
  const { version, dataDir, installRoot, nodeExe, pids = [], port, host, restart } = cfg;
  const statusFile = path.join(dataDir, "update-status.json");
  const logFile = path.join(dataDir, "updater.log");
  const log = (m) => { try { fs.appendFileSync(logFile, `${new Date().toISOString()} ${m}\n`); } catch {} };
  const status = (s, extra = {}) => {
    try { fs.writeFileSync(statusFile, JSON.stringify({ status: s, updatedTo: version, error: null, updatedAt: new Date().toISOString(), ...extra })); } catch {}
  };
  const respawn = () => {
    const cli = path.join(installRoot, "cli.js");
    const args = ["--dns-result-order=ipv4first", cli, "--no-browser", "--skip-update"];
    if (port) args.push("--port", String(port));
    if (host) args.push("--host", String(host));
    spawn(nodeExe, args, { cwd: os.homedir(), detached: true, stdio: "ignore", windowsHide: true }).unref();
    log(`respawned ${cli}`);
  };

  process.chdir(os.tmpdir());
  status("updating");
  log(`start update to ${version}; root=${installRoot}; pids=${pids.join(",")}`);
  try {
    await sleep(500);
    // Kill everything living in the install dir (server, parent cli.js, tray powershell).
    for (let i = 0; i < 20; i++) {
      const hs = holders(installRoot, pids);
      const pending = hs.filter((p) => alive(p) || IS_WIN);
      if (!hs.length) break;
      log(`killing ${pending.join(",")}`);
      pending.forEach(kill);
      await sleep(500);
      if (!holders(installRoot, []).length && !pids.some(alive)) break;
    }
    await sleep(1000); // let NTFS drop handles on better_sqlite3.node and dir cwd

    const globalRoot = path.basename(installRoot) === PKG ? path.dirname(installRoot) : null;
    if (globalRoot) cleanupStaleTemps(globalRoot, log);

    const npm = cfg.npm || resolveNpm(nodeExe); // cfg.npm: test hook
    const env = { ...process.env, PATH: `${path.dirname(nodeExe)}${path.delimiter}${process.env.PATH || ""}` };
    let ok = false, err = "";
    for (let attempt = 1; attempt <= 3 && !ok; attempt++) {
      const args = [...npm.pre, "install", "-g", `${PKG}@${version}`, "--prefer-online"];
      const r = spawnSync(npm.cmd, args, { cwd: os.tmpdir(), env, encoding: "utf8", shell: npm.shell, windowsHide: true, maxBuffer: 16 * 1024 * 1024 });
      err = `${r.stderr || ""}${r.error ? r.error.message : ""}`;
      ok = r.status === 0;
      log(`npm attempt ${attempt} exit=${r.status}${ok ? "" : ` ${err.slice(-400)}`}`);
      if (!ok) {
        if (!IS_WIN && process.getuid && process.getuid() !== 0 && /EACCES|EPERM/.test(err)) {
          const s = spawnSync("sudo", ["-n", npm.cmd, ...args], { cwd: os.tmpdir(), env, encoding: "utf8" });
          ok = s.status === 0; err = s.stderr || err;
          if (ok) break;
        }
        if (globalRoot) cleanupStaleTemps(globalRoot, log);
        await sleep(1500);
      }
    }
    if (ok) {
      try { ok = JSON.parse(fs.readFileSync(path.join(installRoot, "package.json"), "utf8")).version === version; } catch { ok = false; }
      if (!ok) err = `installed version is not ${version}`;
    }
    if (!ok) {
      status("error", { error: (err || "npm install failed").trim().slice(-500) });
      if (restart) respawn();
      return;
    }
    status("restarting");
    if (restart) {
      respawn();
      for (let i = 0; i < (cfg.pingTries ?? 30); i++) { if (await ping(host === "0.0.0.0" || !host ? "127.0.0.1" : host, port)) break; await sleep(1000); }
    }
    status("idle", { justUpdated: true });
    log("done");
  } catch (e) {
    log(`fatal ${e.stack || e}`);
    status("error", { error: e.message });
    if (restart) respawn();
  }
}

module.exports = { matchesInstall, findStaleTemps, cleanupStaleTemps, resolveNpm, holders, main };

if (require.main === module) {
  main(JSON.parse(Buffer.from(process.argv[2], "base64").toString("utf8")));
}
