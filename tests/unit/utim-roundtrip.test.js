import { describe, it, expect, vi, afterEach } from "vitest";

const net = vi.hoisted(() => ({ fn: null }));
vi.mock("open-sse/utils/proxyFetch.js", async (orig) => ({
  ...(await orig()),
  proxyAwareFetch: (...a) => net.fn(...a),
  default: (...a) => net.fn(...a),
}));

const { handleChatCore } = await import("open-sse/handlers/chatCore.js");
const { UtimExecutor } = await import("open-sse/executors/utim.js");

const MCP = "mcp__srv__do_thing";
const TOOLS = [
  { name: MCP, description: "d", input_schema: { type: "object", properties: {} } },
  { name: "Bash", description: "d", input_schema: { type: "object", properties: {} } },
];
const LONG = { command: "x".repeat(500), nested: { list: ["a".repeat(400), 1, true] } };

const sse = (frames) =>
  new Response(frames.map((f) => `data: ${typeof f === "string" ? f : JSON.stringify(f)}\n\n`).join(""), {
    status: 200,
    headers: { "content-type": "text/event-stream" },
  });
const enc = new TextEncoder();
const NOOP_FRAME = `data: ${JSON.stringify({ choices: [{ index: 0, delta: {} }] })}

`;
const EMPTY = () => sse(["[DONE]"]);
const text = (t) => sse([{ choices: [{ index: 0, delta: { role: "assistant", content: t } }] }, { choices: [{ index: 0, delta: {}, finish_reason: "stop" }] }, "[DONE]"]);
const toolCalls = (calls) => {
  const frames = calls.flatMap((c, index) => {
    const args = JSON.stringify(c.args);
    const mid = Math.floor(args.length / 2);
    return [
      { choices: [{ index: 0, delta: { role: "assistant", tool_calls: [{ index, id: c.id, type: "function", function: { name: c.name, arguments: "" } }] } }] },
      { choices: [{ index: 0, delta: { tool_calls: [{ index, function: { arguments: args.slice(0, mid) } }] } }] },
      { choices: [{ index: 0, delta: { tool_calls: [{ index, function: { arguments: args.slice(mid) } }] } }] },
    ];
  });
  return sse([...frames, { choices: [{ index: 0, delta: {}, finish_reason: "tool_calls" }] }, "[DONE]"]);
};

let sent;
function mockUpstream(...responses) {
  sent = [];
  const queue = [...responses];
  net.fn = async (url, init) => {
    sent.push(JSON.parse(init.body));
    return queue.shift() ?? EMPTY();
  };
}

async function turn(messages, extra = {}) {
  const result = await handleChatCore({
    body: { model: "utim/m", stream: true, max_tokens: 64, messages, tools: TOOLS, ...extra.body },
    modelInfo: { provider: "utim", model: "antropic/claude-opus-5" },
    credentials: {},
    sourceFormatOverride: "claude",
    signal: extra.signal,
  });
  if (!result.success) return { result, raw: "" };
  return { result, raw: await result.response.text() };
}

const toolUses = (raw) =>
  raw.split("\n\n").map((c) => c.split("\n").find((l) => l.startsWith("data: "))).filter(Boolean)
    .map((l) => JSON.parse(l.slice(6)))
    .filter((d) => d.type === "content_block_start" && d.content_block?.type === "tool_use")
    .map((d) => d.content_block);
const argsJson = (raw) =>
  raw.split("\n\n").map((c) => c.split("\n").find((l) => l.startsWith("data: "))).filter(Boolean)
    .map((l) => JSON.parse(l.slice(6)))
    .filter((d) => d.delta?.type === "input_json_delta").map((d) => d.delta.partial_json);

afterEach(() => { net.fn = async () => { throw new Error("unmocked network call"); }; });

vi.setConfig({ testTimeout: 30000 });

describe("utim multi-turn tool round trip (mocked upstream)", () => {
  it("3 turns: parallel calls, __ names restored, long args exact, empty attempt retried", async () => {
    const calls = [
      { id: "call_a", name: "mcp_srv_do_thing", args: LONG },
      { id: "call_b", name: "Bash", args: { command: "ls" } },
    ];
    mockUpstream(toolCalls(calls));
    const t1 = await turn([{ role: "user", content: "go" }]);
    expect(t1.result.success).toBe(true);
    const uses = toolUses(t1.raw);
    expect(uses.map((u) => [u.id, u.name])).toEqual([["call_a", MCP], ["call_b", "Bash"]]);
    expect(argsJson(t1.raw).join("")).toContain(JSON.stringify(LONG));

    const hist2 = [
      { role: "user", content: "go" },
      { role: "assistant", content: uses.map((u, i) => ({ type: "tool_use", id: u.id, name: u.name, input: i === 0 ? LONG : { command: "ls" } })) },
      { role: "user", content: [
        { type: "tool_result", tool_use_id: "call_a", content: "r".repeat(600) },
        { type: "tool_result", tool_use_id: "call_b", content: "ok" },
      ] },
    ];
    mockUpstream(EMPTY(), toolCalls([{ id: "call_c", name: "mcp_srv_do_thing", args: LONG }]));
    const t2 = await turn(hist2, { body: { tool_choice: { type: "tool", name: MCP } } });
    expect(sent).toHaveLength(2);
    expect(toolUses(t2.raw).map((u) => [u.id, u.name])).toEqual([["call_c", MCP]]);
    const body2 = sent[1];
    const asst = body2.messages.find((m) => m.tool_calls);
    expect(asst.tool_calls.map((c) => [c.id, c.function.name])).toEqual([["call_a", "mcp_srv_do_thing"], ["call_b", "Bash"]]);
    expect(JSON.parse(asst.tool_calls[0].function.arguments)).toEqual(LONG);
    expect(body2.messages.filter((m) => m.role === "tool").map((m) => m.tool_call_id)).toEqual(["call_a", "call_b"]);
    expect(body2.tool_choice.function.name).toBe("mcp_srv_do_thing");

    const hist3 = [
      ...hist2,
      { role: "assistant", content: [{ type: "tool_use", id: "call_c", name: MCP, input: LONG }] },
      { role: "user", content: [{ type: "tool_result", tool_use_id: "call_c", content: "z".repeat(9000) }] },
    ];
    mockUpstream(text("done"));
    const t3 = await turn(hist3);
    expect(t3.raw).toContain("done");
    expect(sent).toHaveLength(1);
    const msgs = sent[0].messages;
    expect(msgs.length).toBeGreaterThan(2);
    expect(sent[0].tools.map((t) => t.function.name).filter((n) => n.startsWith("ctx_part_")).length).toBeGreaterThan(0);
    const nativeCalls = msgs.flatMap((m) => m.tool_calls || []);
    expect(nativeCalls.map((c) => [c.id, c.function.name])).toEqual([
      ["call_a", "mcp_srv_do_thing"], ["call_b", "Bash"], ["call_c", "mcp_srv_do_thing"],
    ]);
    expect(nativeCalls.map((c) => JSON.parse(c.function.arguments))).toEqual([LONG, { command: "ls" }, LONG]);
    expect(msgs.filter((m) => m.role === "tool").map((m) => m.tool_call_id)).toEqual(["call_a", "call_b", "call_c"]);
  });

  it("exhausted retries make exactly 3 upstream attempts and report no success", async () => {
    mockUpstream(EMPTY(), EMPTY(), EMPTY());
    const t = await turn([{ role: "user", content: "go" }]);
    expect(sent).toHaveLength(3);
    expect(t.result.success === false || !/content_block_start/.test(t.raw)).toBe(true);
  });

  it("client cancel stops retries before another upstream attempt", async () => {
    const ctrl = new AbortController();
    mockUpstream(EMPTY(), EMPTY(), EMPTY());
    net.fn = async () => {
      sent.push(1);
      ctrl.abort();
      return EMPTY();
    };
    await turn([{ role: "user", content: "go" }], { signal: ctrl.signal }).catch(() => {});
    expect(sent).toHaveLength(1);
  });

  it("packed streaming path (large system) keeps native tail exact on early tool-call turns", async () => {
    const body = { system: "S".repeat(9000) };
    mockUpstream(toolCalls([{ id: "call_a", name: "mcp_srv_do_thing", args: LONG }, { id: "call_b", name: "Bash", args: { command: "ls" } }]));
    const t1 = await turn([{ role: "user", content: "go" }], { body });
    expect(toolUses(t1.raw).map((u) => [u.id, u.name])).toEqual([["call_a", MCP], ["call_b", "Bash"]]);
    expect(sent[0].tools.some((t) => t.function.name === "ctx_part_0")).toBe(true);
    expect(argsJson(t1.raw).join("")).toContain(JSON.stringify(LONG));

    const hist2 = [
      { role: "user", content: "go" },
      { role: "assistant", content: [
        { type: "tool_use", id: "call_a", name: MCP, input: LONG },
        { type: "tool_use", id: "call_b", name: "Bash", input: { command: "ls" } },
      ] },
      { role: "user", content: [
        { type: "tool_result", tool_use_id: "call_a", content: "r".repeat(600) },
        { type: "tool_result", tool_use_id: "call_b", content: "ok" },
      ] },
    ];
    mockUpstream(EMPTY(), toolCalls([{ id: "call_c", name: "mcp_srv_do_thing", args: LONG }]));
    const t2 = await turn(hist2, { body });
    expect(toolUses(t2.raw).map((u) => [u.id, u.name])).toEqual([["call_c", MCP]]);
    expect(sent).toHaveLength(2);
    for (const req of sent) {
      expect(req.tools.some((t) => t.function.name === "ctx_part_0")).toBe(true);
      const calls = req.messages.flatMap((m) => m.tool_calls || []);
      expect(calls.map((c) => [c.id, c.function.name])).toEqual([["call_a", "mcp_srv_do_thing"], ["call_b", "Bash"]]);
      expect(calls.map((c) => JSON.parse(c.function.arguments))).toEqual([LONG, { command: "ls" }]);
      expect(req.messages.filter((m) => m.role === "tool").map((m) => m.tool_call_id)).toEqual(["call_a", "call_b"]);
    }
  });

  it("compacts a tool call whose arguments exceed 2k chars into valid JSON so the native tool pair survives", async () => {
    const big = { command: "y".repeat(7000) };
    const hist = [
      { role: "user", content: "go" },
      { role: "assistant", content: [{ type: "tool_use", id: "call_big", name: "Bash", input: big }] },
      { role: "user", content: [{ type: "tool_result", tool_use_id: "call_big", content: "ok" }] },
    ];
    const original = structuredClone(hist);
    const callerBody = { model: "utim/m", stream: true, max_tokens: 64, messages: hist, tools: TOOLS };
    const snapshot = structuredClone(callerBody);
    mockUpstream(text("done"));
    const result = await handleChatCore({
      body: callerBody,
      modelInfo: { provider: "utim", model: "antropic/claude-opus-5" },
      credentials: {},
      sourceFormatOverride: "claude",
    });
    await result.response.text();
    expect(sent).toHaveLength(1);
    const msgs = sent[0].messages;
    expect(msgs.some((m) => m.role === "tool" && m.tool_call_id === "call_big")).toBe(true);
    for (const c of msgs.flatMap((m) => m.tool_calls || [])) expect(() => JSON.parse(c.function.arguments)).not.toThrow();
    // Real tools with empty properties get _placeholder so Kiro does not crash on parameterless calls
    const mcpTool = sent[0].tools.find((t) => t.function.name === "mcp_srv_do_thing");
    expect(mcpTool.function.parameters.properties).toEqual({ _placeholder: { type: "boolean" } });
    expect(callerBody).toEqual(snapshot);
    expect(hist).toEqual(original);
  });

  it("client cancel during the async empty-turn probe makes no further upstream attempt", async () => {
    const ctrl = new AbortController();
    let upstream;
    sent = [];
    net.fn = async () => {
      sent.push(1);
      const body = new ReadableStream({
        start(c) {
          c.enqueue(enc.encode(NOOP_FRAME));
          setTimeout(() => { ctrl.abort(); c.enqueue(enc.encode("data: [DONE]\n\n")); c.close(); }, 50);
        },
      });
      upstream = new Response(body, { status: 200, headers: { "content-type": "text/event-stream" } });
      return upstream;
    };
    const t0 = Date.now();
    const out = await new UtimExecutor().execute({
      model: "antropic/claude-opus-5",
      body: { messages: [{ role: "user", content: "go" }] },
      stream: true,
      credentials: {},
      signal: ctrl.signal,
    });
    expect(out.response).toBe(upstream);
    expect(Date.now() - t0).toBeLessThan(380);
    await new Promise((r) => setTimeout(r, 500));
    expect(sent).toHaveLength(1);
    // Response.clone() tees: the probe read the clone branch, the discarded original branch still buffers
    // both frames unless cancelled, so done:true on first read proves it was cancelled.
    expect((await upstream.body.getReader().read()).done).toBe(true);
  });
});
