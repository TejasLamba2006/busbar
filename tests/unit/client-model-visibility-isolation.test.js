import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const originalDataDir = process.env.DATA_DIR;
let tempDir;
let repo;
let visibility;

beforeAll(async () => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "busbar-model-visibility-"));
  process.env.DATA_DIR = tempDir;
  delete global._dbAdapter;
  vi.resetModules();
  const db = await import("@/lib/db/index.js");
  await db.initDb();
  repo = await import("@/lib/db/repos/disabledModelsRepo.js");
  visibility = await import("@/sse/services/modelVisibility.js");
});

afterAll(() => {
  delete global._dbAdapter;
  fs.rmSync(tempDir, { recursive: true, force: true });
  if (originalDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = originalDataDir;
});

describe("per-client disabled model isolation", () => {
  it("keeps client model visibility separate from Master and other clients", async () => {
    await repo.disableModels("openai", ["master-hidden"]);
    await repo.disableModels("openai", ["client-a-hidden"], "client-a");
    await repo.disableModels("openai", ["client-b-hidden"], "client-b");

    expect(await repo.getDisabledByProvider("openai")).toEqual(["master-hidden"]);
    expect(await repo.getDisabledByProvider("openai", "client-a")).toEqual(["client-a-hidden"]);
    expect(await repo.getDisabledByProvider("openai", "client-b")).toEqual(["client-b-hidden"]);

    expect(await visibility.getDisabledModelIds("openai", null, "client-a")).toEqual(
      expect.arrayContaining(["master-hidden", "client-a-hidden"]),
    );
    expect(await visibility.getDisabledModelIds("openai", null, "client-a")).not.toContain("client-b-hidden");
    expect(await visibility.getDisabledModelIds("openai")).toEqual(["master-hidden"]);
  });

  it("enabling a client model never changes Master visibility", async () => {
    await repo.enableModels("openai", ["client-a-hidden"], "client-a");
    expect(await repo.getDisabledByProvider("openai", "client-a")).toEqual([]);
    expect(await repo.getDisabledByProvider("openai")).toEqual(["master-hidden"]);
  });
});
