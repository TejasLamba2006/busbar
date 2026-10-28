import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getModelPricingPresentation, getModelSourceBadge, getModelTestPresentation, parsePricingInput } from "../../src/shared/utils/modelRowPresentation.js";

const root = path.resolve(import.meta.dirname, "../..");
const rowSource = fs.readFileSync(path.join(root, "src/app/(dashboard)/dashboard/providers/[id]/ModelRow.js"), "utf8");
const providerDir = path.join(root, "src/app/(dashboard)/dashboard/providers/[id]");
const pageSource = fs.readFileSync(path.join(providerDir, "page.js"), "utf8");
const compatibleSource = fs.readFileSync(path.join(providerDir, "CompatibleModelsSection.js"), "utf8");
const modelsCardSource = fs.readFileSync(path.join(root, "src/app/(dashboard)/dashboard/providers/components/ModelsCard.js"), "utf8");
const hookSource = fs.readFileSync(path.join(providerDir, "useModelPricing.js"), "utf8");

describe("OmniRoute-style model rows", () => {
  it("maps test states to always-visible OmniRoute icons", () => {
    expect(getModelTestPresentation({})).toMatchObject({ icon: "play_circle" });
    expect(getModelTestPresentation({ testing: true })).toMatchObject({ icon: "progress_activity" });
    expect(getModelTestPresentation({ result: { classification: "healthy", ok: true } })).toMatchObject({ icon: "check_circle", tone: "success" });
    expect(getModelTestPresentation({ result: { classification: "quota", ok: false } })).toMatchObject({ icon: "warning", tone: "warning" });
    expect(getModelTestPresentation({ result: { classification: "hard_model_failure", ok: false } })).toMatchObject({ icon: "error", tone: "error" });
  });

  it("maps model origins to source badges", () => {
    expect(getModelSourceBadge("custom").label).toBe("custom");
    expect(getModelSourceBadge("upstream").label).toBe("imported");
    expect(getModelSourceBadge("legacyAlias").label).toBe("alias");
    expect(getModelSourceBadge()).toMatchObject({ label: "system" });
  });

  it("presents pricing in explicit dollars per million tokens", () => {
    expect(getModelPricingPresentation({ rates: { input: 2.5, output: 10 }, source: "hardcoded" })).toEqual({
      label: "$2.5 in / $10 out per 1M tokens",
      input: "2.5",
      output: "10",
      canReset: false,
    });
    expect(getModelPricingPresentation({ rates: { input: 1, output: 2 }, source: "manual" }).canReset).toBe(true);
    expect(getModelPricingPresentation(null)).toEqual({ label: "No price", input: "", output: "", canReset: false });
  });

  it("validates pricing edits before saving", () => {
    expect(parsePricingInput({ input: "1.25", output: "0" })).toEqual({ input: 1.25, output: 0 });
    expect(parsePricingInput({ input: "", output: "2" })).toBeNull();
    expect(parsePricingInput({ input: "-1", output: "2" })).toBeNull();
    expect(parsePricingInput({ input: "abc", output: "2" })).toBeNull();
  });

  it("wires price edit, save and manual-only reset into the row", () => {
    expect(rowSource).toContain("getModelPricingPresentation");
    expect(rowSource).toContain("parsePricingInput");
    expect(rowSource).toContain("onSavePricing");
    expect(rowSource).toMatch(/canReset && onResetPricing/);
    expect(rowSource).toContain("$ / 1M tokens");
    expect(hookSource).toContain("/api/pricing?provider=${encodeURIComponent(resolvedProviderId)}&${qs}");
    expect(hookSource).toContain(`method: "PATCH"`);
    expect(hookSource).toContain(`method: "DELETE"`);
    for (const source of [pageSource, compatibleSource, modelsCardSource]) {
      expect(source).toContain("useModelPricing(");
      expect(source).toContain("onSavePricing=");
      expect(source).toContain("onResetPricing=");
    }
    expect(pageSource).toContain("useModelPricing(isCompatible ? null : providerId,");
    expect(compatibleSource).toContain("useModelPricing(providerStorageAlias,");
    expect(modelsCardSource).toContain("useModelPricing(providerId,");
  });

  it("keeps the test button visible and exposes disabled reasons", () => {
    expect(rowSource).toContain("getModelTestPresentation");
    expect(rowSource).toContain("testDisabledReason");
    expect(rowSource).not.toContain('isTesting ? "opacity-100" : "opacity-100 sm:opacity-0');
  });
});
