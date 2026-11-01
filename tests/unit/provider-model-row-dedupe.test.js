import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getProviderCustomModelRows } from "@/shared/utils/providerCustomModels.js";

const providerPageSource = fs.readFileSync(
  path.resolve(import.meta.dirname, "../../src/app/(dashboard)/dashboard/providers/[id]/page.js"),
  "utf8",
);

describe("provider model row canonical dedupe", () => {
  it("does not create an alias row when the alias name contains a slash and targets another provider", () => {
    const rows = getProviderCustomModelRows({
      providerAlias: "nvidia",
      builtInModels: [{ id: "nemotron-3-nano-omni-30b-a3b-reasoning", name: "Nemotron" }],
      customModels: [],
      modelAliases: {
        "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning":
          "kc/nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
      },
    });

    expect(rows).toEqual([]);
  });

  it("dedupes custom rows whose nested provider id resolves to a built-in id", () => {
    const rows = getProviderCustomModelRows({
      providerAlias: "nvidia",
      builtInModels: [{ id: "nemotron-3-nano-omni-30b-a3b-reasoning", name: "Nemotron" }],
      customModels: [
        {
          providerAlias: "nvidia",
          id: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning",
          type: "llm",
          source: "manual",
        },
      ],
      modelAliases: {},
    });

    expect(rows).toEqual([]);
  });

  it("dedupes custom and alias rows against Kilo free models, not only static models", () => {
    expect(providerPageSource).toMatch(
      /getProviderCustomModelRows\(\{[\s\S]*?builtInModels:\s*allModels,/,
    );
  });
});
