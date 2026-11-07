import { describe, expect, it } from "vitest";
import { DefaultExecutor } from "../../open-sse/executors/default.js";

describe("DefaultExecutor Responses output-token floor", () => {
  const credentials = { runtimeTransport: { format: "openai-responses" } };

  it("clamps a native /v1/responses max_output_tokens probe", () => {
    const executor = new DefaultExecutor("agentrouter");
    const out = executor.transformRequest("gpt-5.6-sol", {
      model: "gpt-5.6-sol",
      input: "Reply OK",
      max_output_tokens: 1,
      stream: false,
    }, false, credentials);
    expect(out.max_output_tokens).toBe(16);
  });

  it("leaves valid caps unchanged", () => {
    const executor = new DefaultExecutor("agentrouter");
    const out = executor.transformRequest("gpt-5.6-sol", {
      model: "gpt-5.6-sol",
      input: "Reply OK",
      max_output_tokens: 256,
    }, false, credentials);
    expect(out.max_output_tokens).toBe(256);
  });

  it("does not add a cap when none was sent", () => {
    const executor = new DefaultExecutor("agentrouter");
    const out = executor.transformRequest("gpt-5.6-sol", {
      model: "gpt-5.6-sol",
      input: "Reply OK",
    }, false, credentials);
    expect("max_output_tokens" in out).toBe(false);
  });
});
