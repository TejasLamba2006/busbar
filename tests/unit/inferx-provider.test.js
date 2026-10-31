import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { PROVIDERS } from "open-sse/config/providers.js";
import { AI_PROVIDERS } from "@/shared/constants/providers.js";

const iconPath = path.resolve(import.meta.dirname, "../../public/providers/inferx.png");

describe("InferX provider", () => {
  it("registers the OpenAI-compatible chat and model endpoints", () => {
    expect(PROVIDERS.inferx).toMatchObject({
      baseUrl: "https://model.inferx.net/endpoints/v1/chat/completions",
      validateUrl: "https://model.inferx.net/endpoints/v1/models",
    });
    expect(AI_PROVIDERS.inferx).toMatchObject({
      id: "inferx",
      name: "InferX",
      website: "https://model.inferx.net/catalog/endpoints",
      modelsFetcher: {
        url: "https://model.inferx.net/endpoints/v1/models",
        type: "openai",
      },
      passthroughModels: true,
    });
  });

  it("bundles the favicon as the provider icon", () => {
    expect(fs.existsSync(iconPath)).toBe(true);
    expect(fs.readFileSync(iconPath).subarray(1, 4).toString()).toBe("PNG");
  });
});
