import { describe, it, expect } from "vitest";
import { extractModelLimits } from "@/shared/utils/modelLimits.js";
import { normalizeModelList } from "@/lib/providerModelSync.js";

describe("extractModelLimits", () => {
  it("reads OpenAI/UTIM style fields", () => {
    expect(extractModelLimits({ context_length: 1048576, max_output_tokens: 131072 })).toEqual({ context: 1048576, output: 131072 });
  });
  it("reads models.dev limit shape", () => {
    expect(extractModelLimits({ limit: { context: 200000, output: 64000 } })).toEqual({ context: 200000, output: 64000 });
  });
  it("reads Gemini and OpenRouter shapes", () => {
    expect(extractModelLimits({ inputTokenLimit: 1000000, outputTokenLimit: 65536 })).toEqual({ context: 1000000, output: 65536 });
    expect(extractModelLimits({ top_provider: { context_length: 128000, max_completion_tokens: 16384 } })).toEqual({ context: 128000, output: 16384 });
  });
  it("accepts numeric strings and ignores junk", () => {
    expect(extractModelLimits({ context_window: "32768", max_output_tokens: "nope" })).toEqual({ context: 32768, output: null });
    expect(extractModelLimits({ context_length: -5, max_completion_tokens: 0 })).toEqual({ context: null, output: null });
    expect(extractModelLimits(null)).toEqual({ context: null, output: null });
  });
  it("drops an output cap larger than the window", () => {
    expect(extractModelLimits({ context_length: 8000, max_output_tokens: 90000 })).toEqual({ context: 8000, output: null });
  });
});

describe("normalizeModelList keeps provider limits under canonical names", () => {
  it("maps max_output_tokens to max_completion_tokens", () => {
    const [m] = normalizeModelList([{ id: "kimi-k3", context_length: 1048576, max_output_tokens: 131072 }]);
    expect(m.reported.context_length).toBe(1048576);
    expect(m.reported.max_completion_tokens).toBe(131072);
  });
});
