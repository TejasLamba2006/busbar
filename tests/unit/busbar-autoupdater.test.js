import { describe, it, expect } from "vitest";
import { compareVersions, isInstallableEntry } from "../../src/lib/system/autoUpdater.js";

describe("auto-updater version checks", () => {
  it("compares semver", () => {
    expect(compareVersions("1.0.14", "1.0.13")).toBe(1);
    expect(compareVersions("1.0.9", "1.0.10")).toBe(-1);
    expect(compareVersions("1.0.14", "1.0.14")).toBe(0);
  });
  it("only treats published entries with a tarball as installable", () => {
    const ok = { version: "1.0.14", dist: { tarball: "https://registry.npmjs.org/busbar-ai/-/busbar-ai-1.0.14.tgz" } };
    expect(isInstallableEntry(ok, "1.0.14")).toBe(true);
    expect(isInstallableEntry(null, "1.0.14")).toBe(false);
    expect(isInstallableEntry({ version: "0.0.0-stage", dist: { tarball: "x" } }, "0.0.0-stage")).toBe(false);
    expect(isInstallableEntry({ version: "1.0.14" }, "1.0.14")).toBe(false);
    expect(isInstallableEntry({ ...ok, version: "1.0.13" }, "1.0.14")).toBe(false);
  });
});

// ---- detached updater worker -------------------------------------------------
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { readUpdateStatus, dismissChangelog } from "../../src/lib/system/autoUpdater.js";

const worker = createRequire(import.meta.url)("../../cli/hooks/updater-worker.cjs");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const alive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };
const mk = () => fs.mkdtempSync(path.join(os.tmpdir(), "busbar-upd-"));

describe("updater worker helpers", () => {
  it("matches only node/powershell processes inside the install dir (win + posix slashes)", () => {
    const B = String.fromCharCode(92);
    const w = (...p) => p.join(B);
    const root = w("C:", "Users", "x", "fnm", "installation", "node_modules", "busbar-ai");
    expect(worker.matchesInstall(`"${w("C:", "nodejs", "node.exe")}" "${w(root, "app", "server.js")}"`, root)).toBe(true);
    expect(worker.matchesInstall(`node ${root.split(B).join("/")}/app/server.js`, root)).toBe(true);
    expect(worker.matchesInstall(`powershell.exe -File "${w(root, "src", "tray.ps1")}"`, root)).toBe(true);
    expect(worker.matchesInstall(`${w("C:", "Program Files", "nodejs", "node.exe")} ${w(root, "app", "server.js")}`, root)).toBe(true);
    expect(worker.matchesInstall(`grep ${root}`, root)).toBe(false);
    expect(worker.matchesInstall(`node ${root}-other${B}x.js`, root)).toBe(false);
  });

  it("removes stale .busbar-ai-* dirs and nothing else", () => {
    const g = mk();
    fs.mkdirSync(path.join(g, ".busbar-ai-qLZCN0VW", "app"), { recursive: true });
    fs.mkdirSync(path.join(g, "busbar-ai"));
    fs.mkdirSync(path.join(g, "other"));
    expect(worker.cleanupStaleTemps(g)).toHaveLength(1);
    expect(fs.readdirSync(g).sort()).toEqual(["busbar-ai", "other"]);
    fs.rmSync(g, { recursive: true, force: true });
  });

  it("uses npm-cli.js next to the running node (fnm layout) when present", () => {
    const d = mk();
    const cli = process.platform === "win32" ? path.join(d, "node_modules", "npm", "bin", "npm-cli.js") : path.join(d, "..", "lib", "node_modules", "npm", "bin", "npm-cli.js");
    fs.mkdirSync(path.dirname(cli), { recursive: true });
    fs.writeFileSync(cli, "");
    const r = worker.resolveNpm(path.join(d, "node"));
    expect(r.pre[0]).toBe(path.resolve(cli));
    fs.rmSync(path.resolve(cli, "..", "..", ".."), { recursive: true, force: true });
    fs.rmSync(d, { recursive: true, force: true });
  });
});

describe("updater worker end to end (mock install dir)", () => {
  it("kills a process holding the install dir, clears stale temps, replaces dir, respawns, writes status", async () => {
    const base = mk();
    const globalRoot = path.join(base, "node_modules");
    const root = path.join(globalRoot, "busbar-ai");
    const dataDir = path.join(base, "data");
    fs.mkdirSync(path.join(root, "app"), { recursive: true });
    fs.mkdirSync(dataDir);
    fs.mkdirSync(path.join(globalRoot, ".busbar-ai-STALE01", "app"), { recursive: true });
    fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({ name: "busbar-ai", version: "1.0.15" }));
    // "server": runs from inside the install dir with cwd inside it, like app/server.js
    fs.writeFileSync(path.join(root, "app", "server.js"), "setInterval(()=>{},1000)");
    const holder = spawn(process.execPath, [path.join(root, "app", "server.js")], { cwd: path.join(root, "app"), stdio: "ignore", windowsHide: true });
    // fake npm: replaces the dir like npm does (rename old away, write new). Fails with EBUSY if still locked.
    const fakeNpm = path.join(base, "fake-npm.js");
    fs.writeFileSync(fakeNpm, `
      const fs=require("fs"),path=require("path");const root=${JSON.stringify(root)};
      fs.renameSync(root, root+"-old");
      fs.mkdirSync(root);
      fs.writeFileSync(path.join(root,"package.json"),JSON.stringify({name:"busbar-ai",version:"1.0.16"}));
      fs.writeFileSync(path.join(root,"cli.js"),"require('fs').writeFileSync("+JSON.stringify(${JSON.stringify(path.join(base, "respawned.txt"))})+",process.argv.slice(2).join(' '))");
    `);
    await sleep(300);
    expect(alive(holder.pid)).toBe(true);

    const cfg = { version: "1.0.16", dataDir, installRoot: root, nodeExe: process.execPath, pids: [], port: 59999, host: "127.0.0.1", restart: true, pingTries: 1, npm: { cmd: process.execPath, pre: [fakeNpm], shell: false } };
    await worker.main(cfg);

    expect(alive(holder.pid)).toBe(false);
    expect(fs.existsSync(path.join(globalRoot, ".busbar-ai-STALE01"))).toBe(false);
    expect(JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")).version).toBe("1.0.16");
    await sleep(1000);
    expect(fs.readFileSync(path.join(base, "respawned.txt"), "utf8")).toContain("--skip-update");
    const st = readUpdateStatus(dataDir);
    expect(st.status).toBe("idle");
    expect(st.updatedTo).toBe("1.0.16");
    expect(st.justUpdated).toBe(true);
    dismissChangelog(dataDir);
    expect(readUpdateStatus(dataDir).justUpdated).toBe(false);
    expect(fs.readFileSync(path.join(dataDir, "updater.log"), "utf8")).toContain("done");
    try { holder.kill(); } catch {}
    fs.rmSync(base, { recursive: true, force: true });
  }, 60000);
});
