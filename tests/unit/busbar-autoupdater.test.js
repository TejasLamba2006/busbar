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
