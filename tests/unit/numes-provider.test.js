import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { PROVIDERS } from "open-sse/config/providers.js";
import { getDefaultModel } from "../../open-sse/config/providerModels.js";
import { AI_PROVIDERS } from "@/shared/constants/providers.js";

const iconPath = path.resolve(import.meta.dirname, "../../public/providers/numes.png");

describe("Numes provider", () => {
  it("registers the OpenAI-compatible chat, key validation, and model endpoints", () => {
    expect(PROVIDERS.numes).toMatchObject({
      baseUrl: "https://api.numes.ai/api/v1/chat/completions",
      validateUrl: "https://api.numes.ai/api/v1/key",
    });
    expect(AI_PROVIDERS.numes).toMatchObject({
      id: "numes",
      name: "Numes",
      modelsFetcher: {
        url: "https://api.numes.ai/api/v1/models",
        type: "openai",
      },
      passthroughModels: true,
    });
  });

  it("defaults to z-ai/glm-5.3-flash:free", () => {
    expect(getDefaultModel("numes")).toBe("z-ai/glm-5.3-flash:free");
  });

  it("bundles the official icon", () => {
    expect(fs.existsSync(iconPath)).toBe(true);
    expect(fs.readFileSync(iconPath).subarray(1, 4).toString()).toBe("PNG");
  });
});
