const fs = require("fs");
const path = require("path");
const os = require("os");

const DEFAULT_PORT = 20128;

const isValidPort = (n) => Number.isInteger(n) && n >= 1 && n <= 65535;

// Mirrors src/lib/dataDir.js default resolution (DATA_DIR env, else per-OS app dir).
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

function getDataDir(env = process.env) {
  if (env.DATA_DIR) return env.DATA_DIR;
  return defaultDir();
}

const portFile = (env) => path.join(getDataDir(env), "port.json");

function readSavedPort(env = process.env) {
  try {
    const n = Number(JSON.parse(fs.readFileSync(portFile(env), "utf8")).port);
    return isValidPort(n) ? n : null;
  } catch {
    return null;
  }
}

function savePort(port, env = process.env) {
  if (!isValidPort(port)) throw new Error("Invalid port");
  fs.mkdirSync(getDataDir(env), { recursive: true });
  fs.writeFileSync(portFile(env), JSON.stringify({ port }));
}

// Priority: --port flag > PORT env > port.json > 20128
function resolvePort({ flagPort, env = process.env } = {}) {
  if (isValidPort(flagPort)) return flagPort;
  const envPort = Number(env.PORT);
  if (isValidPort(envPort)) return envPort;
  return readSavedPort(env) || DEFAULT_PORT;
}

module.exports = { DEFAULT_PORT, isValidPort, getDataDir, readSavedPort, savePort, resolvePort };
