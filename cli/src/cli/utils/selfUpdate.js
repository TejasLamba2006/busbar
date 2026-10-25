const fs = require("fs");
const os = require("os");
const path = require("path");
const net = require("net");
const https = require("https");
const { spawn } = require("child_process");

const INSTALL_ROOT = path.resolve(__dirname, "..", "..", "..");

function latestVersion(name) {
  return new Promise((resolve) => {
    const req = https.get(`https://registry.npmjs.org/${name}/latest`, { timeout: 5000 }, (res) => {
      let d = "";
      res.on("data", (c) => (d += c));
      res.on("end", () => { try { resolve(JSON.parse(d).version || null); } catch { resolve(null); } });
    });
    req.on("error", () => resolve(null));
    req.on("timeout", () => { req.destroy(); resolve(null); });
  });
}

function portOpen(port) {
  return new Promise((resolve) => {
    const s = net.connect({ port, host: "127.0.0.1", timeout: 800 });
    s.on("connect", () => { s.destroy(); resolve(true); });
    s.on("error", () => resolve(false));
    s.on("timeout", () => { s.destroy(); resolve(false); });
  });
}

// Copy hooks/updater-worker.cjs out of node_modules and run it detached (cwd=tmp).
// It kills this process + any running server (they lock node_modules/busbar-ai on Windows),
// runs npm install -g from this node's npm, then respawns busbar if `restart`.
function launchWorker({ version, dataDir, port, host, restart }) {
  const src = path.join(INSTALL_ROOT, "hooks", "updater-worker.cjs");
  fs.mkdirSync(dataDir, { recursive: true });
  const worker = path.join(dataDir, "updater-worker.cjs");
  fs.copyFileSync(src, worker);
  const cfg = { version, dataDir, installRoot: INSTALL_ROOT, nodeExe: process.execPath, pids: [process.pid, process.ppid], port, host, restart };
  spawn(process.execPath, [worker, Buffer.from(JSON.stringify(cfg)).toString("base64")], {
    cwd: os.tmpdir(), detached: true, stdio: "ignore", windowsHide: true,
  }).unref();
  return path.join(dataDir, "updater.log");
}

module.exports = { INSTALL_ROOT, latestVersion, portOpen, launchWorker };
