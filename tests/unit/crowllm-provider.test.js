import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { PROVIDERS } from "open-sse/config/providers.js";
import { getDefaultModel } from "../../open-sse/config/providerModels.js";
import { AI_PROVIDERS } from "@/shared/constants/providers.js";

const iconPath = path.resolve(import.meta.dirname, "../../public/providers/crowllm.png");

describe("CrowLLM provider", () => {
  it("registers the OpenAI-compatible chat and model endpoints", () => {
    expect(PROVIDERS.crowllm).toMatchObject({
      baseUrl: "https://crowllm.com/v1/chat/completions",
      validateUrl: "https://crowllm.com/v1/models",
    });
    expect(AI_PROVIDERS.crowllm).toMatchObject({
      id: "crowllm",
      name: "CrowLLM",
      modelsFetcher: {
        url: "https://crowllm.com/v1/models",
        type: "openai",
      },
      passthroughModels: true,
    });
  });

  it("defaults to crow-uncensored:free", () => {
    expect(getDefaultModel("crowllm")).toBe("crow-uncensored:free");
  });

  it("bundles the official icon", () => {
    expect(fs.existsSync(iconPath)).toBe(true);
    expect(fs.readFileSync(iconPath).subarray(1, 4).toString()).toBe("PNG");
  });
});
