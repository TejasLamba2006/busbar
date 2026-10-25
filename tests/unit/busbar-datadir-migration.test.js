import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const portPath = require.resolve("../../cli/src/cli/utils/port.js");

describe("~/.9router -> ~/.busbar auto-migration", () => {
  let home, prev;
  beforeEach(() => {
    home = fs.mkdtempSync(path.join(os.tmpdir(), "busbar-home-"));
    prev = { HOME: process.env.HOME, USERPROFILE: process.env.USERPROFILE, APPDATA: process.env.APPDATA, DATA_DIR: process.env.DATA_DIR };
    process.env.HOME = home;
    process.env.USERPROFILE = home;
    process.env.APPDATA = path.join(home, "AppData", "Roaming");
    delete process.env.DATA_DIR;
  });
  afterEach(() => {
    for (const [k, v] of Object.entries(prev)) v === undefined ? delete process.env[k] : (process.env[k] = v);
    fs.rmSync(home, { recursive: true, force: true });
  });

  const dirs = () => process.platform === "win32"
    ? [path.join(process.env.APPDATA, "busbar"), path.join(process.env.APPDATA, "9router")]
    : [path.join(home, ".busbar"), path.join(home, ".9router")];

  it("copies legacy data into the new dir once", () => {
    const [primary, legacy] = dirs();
    fs.mkdirSync(path.join(legacy, "db"), { recursive: true });
    fs.writeFileSync(path.join(legacy, "db", "data.sqlite"), "legacy-db");
    fs.writeFileSync(path.join(legacy, "port.json"), JSON.stringify({ port: 4242 }));
    delete require.cache[portPath];
    const { resolvePort } = require(portPath);
    expect(resolvePort({ env: {} })).toBe(4242);
    expect(fs.readFileSync(path.join(primary, "db", "data.sqlite"), "utf8")).toBe("legacy-db");
    // legacy left intact, and a second call does not overwrite new data
    fs.writeFileSync(path.join(primary, "db", "data.sqlite"), "new-db");
    resolvePort({ env: {} });
    expect(fs.readFileSync(path.join(primary, "db", "data.sqlite"), "utf8")).toBe("new-db");
    expect(fs.existsSync(path.join(legacy, "db", "data.sqlite"))).toBe(true);
  });

  it("uses a fresh busbar dir when no legacy data exists", () => {
    const [primary] = dirs();
    delete require.cache[portPath];
    const { savePort } = require(portPath);
    savePort(5555, { ...process.env });
    expect(fs.existsSync(path.join(primary, "port.json"))).toBe(true);
  });
});
