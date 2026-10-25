const fs = require("fs");
const path = require("path");
const os = require("os");

const APP_NAME = "busbar";

function defaultDir() {
  const win = process.platform === "win32";
  const base = win ? (process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming")) : os.homedir();
  const primary = path.join(base, win ? "busbar" : ".busbar");
  const legacy = path.join(base, win ? "9router" : ".9router");
  // Auto-migrate legacy 9router data once; fall back to legacy if copy fails.
  if (!fs.existsSync(path.join(primary, "db", "data.sqlite")) && fs.existsSync(legacy)) {
    try { fs.cpSync(legacy, primary, { recursive: true, force: false }); } catch { return legacy; }
  }
  return primary;
}

function getDataDir() {
  const configured = process.env.DATA_DIR;
  if (!configured) return defaultDir();
  try {
    fs.mkdirSync(configured, { recursive: true });
    return configured;
  } catch (e) {
    if (e?.code === "EACCES" || e?.code === "EPERM") {
      console.warn(`[DATA_DIR] '${configured}' not writable → fallback ~/.${APP_NAME}`);
      return defaultDir();
    }
    throw e;
  }
}

const DATA_DIR = getDataDir();
const MITM_DIR = path.join(DATA_DIR, "mitm");
try { fs.mkdirSync(MITM_DIR, { recursive: true }); } catch {}

module.exports = { DATA_DIR, MITM_DIR };
