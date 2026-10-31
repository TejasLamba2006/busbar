import { describe, expect, it } from "vitest";
import REGISTRY from "../../open-sse/providers/registry/index.js";
import { PROVIDER_MEDIA } from "../../open-sse/providers/index.js";
import { AI_PROVIDERS, getProvidersByKind } from "@/shared/constants/providers";

describe("v1m System One provider", () => {
  const entry = REGISTRY.find((e) => e.id === "v1m");

  it("is registered as a System One apikey provider", () => {
    expect(entry).toBeDefined();
    expect(entry.category).toBe("apikey");
    expect(entry.serviceKinds).toEqual(["systemone"]);
    expect(PROVIDER_MEDIA["v1m"]?.systemoneConfig?.baseUrl).toBe("https://v1m.ir/v1/systemone");
  });

  it("appears in getProvidersByKind('systemone')", () => {
    const list = getProvidersByKind("systemone");
    const found = list.find((p) => p.id === "v1m");
    expect(found).toBeDefined();
    expect(found.alias).toBe("v1m");
    expect(found.systemoneConfig?.baseUrl).toBe("https://v1m.ir/v1/systemone");
  });

  it("exposes calibrated models", () => {
    const ids = (entry.models || []).map((m) => m.id);
    expect(ids).toContain("rev-latest");
    expect(ids).toContain("v1m-decision-engine");
  });
});

describe("Inception Labs System One provider", () => {
  const entry = REGISTRY.find((e) => e.id === "inceptionlabs");

  it("registers Mercury Decide as a System One model", () => {
    expect(entry?.serviceKinds).toEqual(["llm", "systemone"]);
    expect(entry?.models.find((m) => m.id === "mercury-decide")?.kind).toBe("systemone");
    expect(PROVIDER_MEDIA["inceptionlabs"]?.systemoneConfig?.baseUrl).toBe("https://api.inceptionlabs.ai/v1/decisions");
  });

  it("appears in getProvidersByKind('systemone')", () => {
    expect(getProvidersByKind("systemone").some((p) => p.id === "inceptionlabs")).toBe(true);
  });
});

describe("TypeSafe (official Jev / System One) provider", () => {
  const entry = REGISTRY.find((e) => e.id === "typesafe");

  it("is registered as the official TypeSafe System One apikey provider", () => {
    expect(entry).toBeDefined();
    expect(entry.alias).toBe("ts");
    expect(entry.aliases).toContain("jev");
    expect(entry.category).toBe("apikey");
    expect(entry.serviceKinds).toEqual(["systemone"]);
    expect(PROVIDER_MEDIA["typesafe"]?.systemoneConfig?.baseUrl).toBe("https://api.typesafe.ai/v1/systemone");
  });

  it("appears in getProvidersByKind('systemone')", () => {
    const list = getProvidersByKind("systemone");
    const found = list.find((p) => p.id === "typesafe");
    expect(found).toBeDefined();
    expect(found.alias).toBe("ts");
    expect(found.systemoneConfig?.baseUrl).toBe("https://api.typesafe.ai/v1/systemone");
  });

  it("exposes official Jev models and aliases", () => {
    const ids = (entry.models || []).map((m) => m.id);
    expect(ids).toContain("jev-latest");
    expect(ids).toContain("jev-preview");
    expect(ids).toContain("jev-1.14.0");
    expect(ids).toContain("jev-1.13.0");
  });
});
