import { describe, expect, it } from "vitest";
import { OpenCodeExecutor } from "../../open-sse/executors/opencode.js";

const MODEL = "muse-spark-1.3-contributor-free";

describe("OpenCode Responses tool-name limits", () => {
  it("keeps long names distinct and matches tool history within 64 characters", () => {
    const names = ["custom_" + "x".repeat(80) + "_first", "custom_" + "x".repeat(80) + "_second"];
    const body = {
      tools: names.map((name) => ({ type: "function", name, parameters: { type: "object", properties: {} } })),
      input: names.flatMap((name, i) => [
        { type: "function_call", name, call_id: `call_${i}`, arguments: "{}" },
        { type: "function_call_output", call_id: `call_${i}`, output: "ok" },
      ]),
    };
    const out = new OpenCodeExecutor().transformRequest(MODEL, body, true, {});
    const calls = out.input.filter((item) => item.type === "function_call");
    const toolNames = out.tools.slice(0, 2).map((tool) => tool.name);
    expect(toolNames.every((name) => name.length <= 64)).toBe(true);
    expect(new Set(toolNames).size).toBe(2);
    expect(calls.map((call) => call.name)).toEqual(toolNames);
  });
});
