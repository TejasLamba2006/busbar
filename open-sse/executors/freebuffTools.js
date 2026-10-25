// The Codebuff server only accepts requests whose tools use a published Codebuff name AND only that tool's own
// property keys (descriptions, `required` and value types are free). So client tools are re-exposed as
// whitelisted slots carrying one string property holding the JSON arguments; overflow tools share a
// dispatcher slot taking {"tool","input"}.
const SLOTS = [
  ["run_terminal_command", "command"], ["read_files", "paths"], ["glob", "pattern"], ["find_files", "prompt"],
  ["list_directory", "path"], ["web_search", "query"], ["read_url", "url"], ["read_docs", "libraryTitle"],
  ["think_deeply", "thought"], ["write_todos", "todos"], ["skill", "name"], ["read_subtree", "paths"],
  ["create_plan", "path"], ["str_replace", "path"], ["write_file", "path"], ["add_subgoal", "id"],
  ["update_subgoal", "id"], ["ask_user", "questions"], ["propose_str_replace", "path"],
];
const DISPATCH = ["lookup_agent_info", "agentId"];
const PREFERRED = {
  Bash: "run_terminal_command", Read: "read_files", Glob: "glob", WebSearch: "web_search", WebFetch: "read_url",
  Skill: "skill", Write: "write_file", Edit: "str_replace", TodoWrite: "write_todos", AskUserQuestion: "ask_user",
};

const tryJson = (v) => { try { return JSON.parse(v); } catch { return undefined; } };
const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);
const slotArgs = (key, payload) => JSON.stringify({ [key]: JSON.stringify(payload) });
const brief = (t) => `${t.description || ""} Schema: ${JSON.stringify(t.parameters || {})}`;

// Returns { fields, bySlot }: fields to spread over the request body, bySlot for uncloaking responses.
export function cloakTools(body = {}) {
  const { messages, tools, tool_choice: tc } = body;
  if (!Array.isArray(tools) || !tools.length) return { fields: { messages } };
  const fns = tools.map((t) => t.function || t).filter((f) => f?.name);
  const pool = new Map(SLOTS);
  const direct = new Map(); // client name -> { slot, key, fn }
  const overflow = [];
  for (const f of fns) {
    const want = PREFERRED[f.name];
    if (want && pool.has(want)) { direct.set(f.name, { slot: want, key: pool.get(want), fn: f }); pool.delete(want); }
  }
  for (const f of fns) {
    if (direct.has(f.name)) continue;
    const [slot, key] = pool.entries().next().value || [];
    if (slot) { direct.set(f.name, { slot, key, fn: f }); pool.delete(slot); } else overflow.push(f);
  }
  const bySlot = {};
  const out = [];
  const def = (name, key, description) => ({
    type: "function",
    function: {
      name,
      description,
      parameters: { type: "object", properties: { [key]: { type: "string", description: "JSON string of the arguments object" } }, required: [key] },
    },
  });
  for (const [name, e] of direct) {
    bySlot[e.slot] = { key: e.key, fn: e.fn };
    out.push(def(e.slot, e.key, `Acts as the "${name}" tool. ${brief(e.fn)} Put the arguments object, JSON-encoded as a string, in "${e.key}".`));
  }
  if (overflow.length) {
    const [slot, key] = DISPATCH;
    bySlot[slot] = { key, dispatch: true };
    out.push(def(slot, key, `Dispatcher for these tools: ${overflow.map((f) => `"${f.name}": ${brief(f)}`).join(" | ")}. Put {"tool":"<name>","input":{...arguments}} JSON-encoded as a string in "${key}".`));
  }
  const to = (name, argStr) => {
    const e = direct.get(name);
    if (e) return { name: e.slot, arguments: slotArgs(e.key, tryJson(argStr) ?? {}) };
    if (overflow.some((f) => f.name === name)) return { name: DISPATCH[0], arguments: slotArgs(DISPATCH[1], { tool: name, input: tryJson(argStr) ?? {} }) };
    return { name, arguments: argStr };
  };
  const fields = {
    tools: out,
    messages: messages?.map((m) => {
      if (m.role === "assistant" && Array.isArray(m.tool_calls)) {
        return { ...m, tool_calls: m.tool_calls.map((c) => ({ ...c, function: { ...c.function, ...to(c.function?.name, c.function?.arguments) } })) };
      }
      if (m.role === "tool" && m.name) return { ...m, name: to(m.name, "{}").name };
      return m;
    }),
  };
  if (isObj(tc) && tc.function?.name) fields.tool_choice = { ...tc, function: { name: to(tc.function.name, "{}").name } };
  return { fields, bySlot };
}

// Slot call -> original client tool call.
function uncloakCall(cloak, slotName, argStr) {
  const e = cloak.bySlot[slotName];
  if (!e) return { name: slotName, arguments: argStr };
  const raw = tryJson(argStr)?.[e.key];
  const inner = typeof raw === "string" ? tryJson(raw) : raw;
  if (e.dispatch) {
    const input = typeof inner?.input === "string" ? tryJson(inner.input) : inner?.input;
    return { name: inner?.tool ?? slotName, arguments: JSON.stringify(isObj(input) ? input : {}) };
  }
  let args = {};
  if (isObj(inner)) args = inner;
  else if (raw !== undefined) {
    // model sent a bare value: feed the tool's first property
    const first = Object.keys(e.fn.parameters?.properties || {})[0];
    if (first) args = { [first]: raw };
  }
  return { name: e.fn.name, arguments: JSON.stringify(args) };
}

export async function uncloakResponse(response, cloak) {
  const headers = new Headers(response.headers);
  headers.delete("content-length");
  if (!(headers.get("content-type") || "").includes("text/event-stream")) {
    const json = await response.clone().json().catch(() => null);
    if (!json?.choices) return response;
    for (const c of json.choices) for (const call of c.message?.tool_calls || []) Object.assign(call.function, uncloakCall(cloak, call.function.name, call.function.arguments));
    return new Response(JSON.stringify(json), { status: response.status, headers });
  }
  // streaming: tool calls are held back until finish_reason, then emitted whole under their original names
  const calls = new Map();
  const dec = new TextDecoder();
  const enc = new TextEncoder();
  const send = (ctl, obj) => ctl.enqueue(enc.encode(`data: ${typeof obj === "string" ? obj : JSON.stringify(obj)}\n\n`));
  let buf = "";
  let tpl = {};
  const flush = (ctl) => {
    if (!calls.size) return;
    const tool_calls = [...calls.entries()].map(([index, c]) => ({ index, id: c.id, type: "function", function: uncloakCall(cloak, c.name, c.args) }));
    calls.clear();
    send(ctl, { ...tpl, choices: [{ index: 0, delta: { tool_calls }, finish_reason: null }] });
  };
  const onEvent = (ctl, line) => {
    const m = /^data: ?(.*)$/.exec(line);
    if (!m) return;
    const evt = m[1] === "[DONE]" ? undefined : tryJson(m[1]);
    if (!evt) { flush(ctl); send(ctl, m[1]); return; }
    tpl = { id: evt.id, object: evt.object, created: evt.created, model: evt.model };
    const ch = evt.choices?.[0];
    const d = ch?.delta;
    if (d?.tool_calls) {
      for (const t of d.tool_calls) {
        const i = t.index ?? 0;
        const c = calls.get(i) || { id: t.id, name: "", args: "" };
        if (t.id) c.id = t.id;
        c.name += t.function?.name || "";
        c.args += t.function?.arguments || "";
        calls.set(i, c);
      }
      delete d.tool_calls;
    }
    if (ch?.finish_reason) flush(ctl);
    if (d && !Object.keys(d).length && !ch?.finish_reason && !evt.usage) return;
    send(ctl, evt);
  };
  const body = response.body.pipeThrough(new TransformStream({
    transform(chunk, ctl) {
      buf += dec.decode(chunk, { stream: true });
      const parts = buf.split(/\r?\n\r?\n/);
      buf = parts.pop();
      for (const p of parts) for (const line of p.split(/\r?\n/)) onEvent(ctl, line);
    },
    flush(ctl) { if (buf.trim()) buf.trim().split(/\r?\n/).forEach((l) => onEvent(ctl, l)); },
  }));
  return new Response(body, { status: response.status, headers });
}
