import fs from "node:fs";
import path from "path";
import os from "os";

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

export function getDataDir() {
  const configured = process.env.DATA_DIR;
  if (!configured) return defaultDir();

  // On Windows, ignore Unix-style absolute paths (e.g. /var/lib/...) that come
  // from a Linux-targeted .env or Docker config — they are not valid here.
  if (process.platform === "win32" && /^\//.test(configured)) {
    console.warn(`[DATA_DIR] '${configured}' is a Unix path on Windows → fallback to default`);
    return defaultDir();
  }

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

export const DATA_DIR = getDataDir();
