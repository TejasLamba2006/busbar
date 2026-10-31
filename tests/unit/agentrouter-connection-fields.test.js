import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";

const ROOT = path.resolve(import.meta.dirname, "../..");
const addSource = fs.readFileSync(
  path.join(ROOT, "src/app/(dashboard)/dashboard/providers/[id]/AddApiKeyModal.js"),
  "utf8",
);
const editSource = fs.readFileSync(
  path.join(ROOT, "src/shared/components/EditConnectionModal.js"),
  "utf8",
);

describe("AgentRouter quota credentials", () => {
  it("adds System Access Token and New-API User ID fields", () => {
    expect(addSource).toContain('label="System Access Token"');
    expect(addSource).toContain('label="New-API User ID"');
    expect(addSource).toContain("agentrouterSystemAccessToken");
    expect(addSource).toContain("agentrouterUserId");
  });

  it("edits both fields without replacing unrelated provider data", () => {
    expect(editSource).toContain('label="System Access Token"');
    expect(editSource).toContain('label="New-API User ID"');
    expect(editSource).toContain("agentrouterSystemAccessToken");
    expect(editSource).toContain("agentrouterUserId");
    expect(editSource).toMatch(/\.\.\.\(connection\.providerSpecificData \|\| \{\}\)[\s\S]*agentrouterSystemAccessToken/);
  });
});
