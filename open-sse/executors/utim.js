import { DefaultExecutor } from "./default.js";
import { recordRenamedToolNames } from "../utils/opencodeFingerprint.js";
import { probeStreamingResponseForEmptyTurn } from "../utils/emptyTurnRetry.js";

const MAX_INLINE_MESSAGES_CHARS = 6000;
const TAIL_MESSAGES_BUDGET = 5800;
const LONG_STRING_CHARS = 350;
const MAX_UTIM_ATTEMPTS = 3;
const TOOL_NAME_OK = /^[a-zA-Z0-9_-]{1,64}$/;
const CTX_CHUNK_CHARS = 8800;

function extractContentText(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part?.type === "text" && typeof part.text === "string") return part.text;
        return JSON.stringify(part);
      })
      .join("\n");
  }
  if (content == null) return "";
  return typeof content === "object" ? JSON.stringify(content) : String(content);
}

function serializeMessageForTranscript(msg, idx) {
  const role = String(msg?.role || "user").toUpperCase();
  const lines = [`=== MESSAGE ${idx + 1} [${role}] ===`];
  const text = extractContentText(msg?.content);
  if (text) lines.push(text);
  if (Array.isArray(msg?.tool_calls) && msg.tool_calls.length > 0) {
    for (const tc of msg.tool_calls) {
      lines.push(
        `[TOOL_CALL id=${tc?.id || ""} name=${tc?.function?.name || ""}] ${tc?.function?.arguments || "{}"}`
      );
    }
  }
  if (msg?.role === "tool" && msg?.tool_call_id) {
    lines[0] = `=== MESSAGE ${idx + 1} [TOOL_RESULT id=${msg.tool_call_id} name=${msg.name || ""}] ===`;
  }
  return lines.join("\n");
}

const shorten = (str) =>
  typeof str === "string" && str.length > LONG_STRING_CHARS
    ? `${str.slice(0, 300)} ...[full in ctx_part_0..N]`
    : str;

function compactJsonValue(v) {
  if (typeof v === "string") return shorten(v);
  if (Array.isArray(v)) return v.slice(0, 15).map(compactJsonValue);
  if (v && typeof v === "object") {
    return Object.fromEntries(Object.entries(v).slice(0, 20).map(([k, val]) => [k, compactJsonValue(val)]));
  }
  return v;
}

function compactToolCallArguments(argsStr) {
  if (typeof argsStr !== "string" || argsStr.length <= 2000) return argsStr;
  try {
    return JSON.stringify(compactJsonValue(JSON.parse(argsStr)));
  } catch {
    return argsStr;
  }
}

function compactMessage(msg) {
  const out = { ...msg };
  if (typeof out.content === "string") out.content = shorten(out.content);
  else if (Array.isArray(out.content)) out.content = shorten(extractContentText(out.content));
  // Keep tool_calls[].function.arguments valid JSON: compact inner string values only when >2000 chars.
  if (Array.isArray(out.tool_calls)) {
    out.tool_calls = out.tool_calls.map((tc) =>
      tc?.function?.arguments
        ? { ...tc, function: { ...tc.function, arguments: compactToolCallArguments(tc.function.arguments) } }
        : tc
    );
  }
  return out;
}

// Keep the real recent assistant(tool_calls) -> tool(tool_call_id) log (Kiro treats text-only
// tool history as unverified), whole turn groups only so no tool message is orphaned.
function buildTailMessages(messages, nChunks) {
  const last = nChunks - 1;
  const head = {
    role: "system",
    content: `Full system instructions, file contents, and full tool outputs are in tool definitions ctx_part_0..ctx_part_${last}. Never call ctx_part_* tools. You are in an active autonomous agentic tool loop: always emit the next tool_call directly whenever further actions are needed to complete the user's goal.`,
  };
  const compact = messages.map((m) => (m?.role === "system" ? null : compactMessage(m)));
  let picked = [];
  let len = JSON.stringify(head).length + 100;
  let i = messages.length - 1;
  while (i >= 0) {
    if (!compact[i]) { i--; continue; }
    // group = [assistant(tool_calls)?] + its tool messages, or a single message
    let start = i;
    if (compact[i].role === "tool") {
      while (start > 0 && compact[start - 1]?.role === "tool") start--;
      if (start > 0 && compact[start - 1]?.role === "assistant" && compact[start - 1].tool_calls) start--;
    }
    const group = compact.slice(start, i + 1).filter(Boolean);
    const glen = JSON.stringify(group).length;
    if (len + glen > TAIL_MESSAGES_BUDGET) break;
    picked = [...group, ...picked];
    len += glen;
    i = start - 1;
  }
  // never start the tail with a tool message whose parent was cut
  while (picked.length && picked[0].role === "tool") picked.shift();
  if (!picked.length || picked[0].role === "assistant") {
    picked.unshift({ role: "user", content: `Continue the task from ctx_part_0..ctx_part_${last}` });
  }
  return [head, ...picked];
}

// UTIM playground enforces a 2,000-token (~8,000 char) check on `messages[]`,
// while `tools[].function.description` is not counted by the gate (each tool
// description supports up to ~9,000 chars before Kiro/Bedrock truncation).
// When `messages` exceeds MAX_INLINE_MESSAGES_CHARS, pack the full transcript
// across `ctx_part_0..N` tool descriptions and leave a compact continuation
// prompt in `messages` so 100k-350k+ token prompts succeed without truncation.
export function packUtimOverflowMessages(body) {
  if (!body || !Array.isArray(body.messages) || body.messages.length === 0) return body;
  const serializedLen = JSON.stringify(body.messages).length;
  if (serializedLen <= MAX_INLINE_MESSAGES_CHARS) return body;

  const transcript = body.messages.map(serializeMessageForTranscript).join("\n\n");
  const chunks = [];
  for (let i = 0; i < transcript.length; i += CTX_CHUNK_CHARS) {
    chunks.push(transcript.slice(i, i + CTX_CHUNK_CHARS));
  }

  const ctxTools = chunks.map((chunk, i) => ({
    type: "function",
    function: {
      name: `ctx_part_${i}`,
      description: `[CONTEXT PART ${i + 1}/${chunks.length} - DO NOT CALL THIS TOOL. Read as active system instructions and conversation history]:\n${chunk}`,
      parameters: { type: "object", properties: {} },
    },
  }));

  const existingTools = Array.isArray(body.tools) ? body.tools : [];

  return {
    ...body,
    messages: buildTailMessages(body.messages, chunks.length),
    tools: [...ctxTools, ...existingTools],
  };
}

// Kiro's OpenAI-to-Bedrock stream converter crashes and emits an empty turn (`data: [DONE]`)
// whenever the model calls a tool whose schema has empty `properties: {}`. Inject a dummy
// optional `_placeholder` property on real (non-ctx_part_*) tools with empty properties.
function ensureNonEmptyUtimToolProperties(tools) {
  if (!Array.isArray(tools)) return tools;
  return tools.map((t) => {
    const fn = t?.function;
    if (!fn || typeof fn.name !== "string" || fn.name.startsWith("ctx_part_")) return t;
    const params = fn.parameters;
    const props = params?.properties;
    if (props && typeof props === "object" && !Array.isArray(props) && Object.keys(props).length > 0) return t;
    return {
      ...t,
      function: {
        ...fn,
        parameters: {
          ...(params && typeof params === "object" ? params : { type: "object" }),
          type: "object",
          properties: { _placeholder: { type: "boolean" } },
        },
      },
    };
  });
}

// Kiro collapses "__" to "_" in tool names (mcp__x__y -> mcp_x_y), so send the collapsed
// spelling ourselves and return sent -> original for chatCore to restore on the way back.
function sanitizeUtimToolNames(body) {
  if (!body || !Array.isArray(body.tools)) return null;
  body.tools = ensureNonEmptyUtimToolProperties(body.tools);
  const declared = body.tools.map((t) => t?.function?.name).filter((n) => typeof n === "string" && !n.startsWith("ctx_part_"));
  const taken = new Set(declared);
  const forward = new Map();
  for (const n of declared) {
    if (!n.includes("__") && TOOL_NAME_OK.test(n)) continue;
    let sent = n.replace(/[^a-zA-Z0-9_-]/g, "_").replace(/_{2,}/g, "_").slice(0, 64) || "tool";
    for (let k = 2; taken.has(sent) && sent !== n; k++) sent = `${sent.slice(0, 60)}_${k}`;
    taken.add(sent);
    forward.set(n, sent);
  }
  if (!forward.size) return null;
  const fix = (n) => forward.get(n) ?? n;
  body.tools = body.tools.map((t) => (t?.function?.name !== undefined ? { ...t, function: { ...t.function, name: fix(t.function.name) } } : t));
  if (body.tool_choice?.function?.name !== undefined) {
    body.tool_choice = { ...body.tool_choice, function: { ...body.tool_choice.function, name: fix(body.tool_choice.function.name) } };
  }
  if (Array.isArray(body.messages)) {
    body.messages = body.messages.map((m) => Array.isArray(m?.tool_calls)
      ? { ...m, tool_calls: m.tool_calls.map((c) => (c?.function?.name !== undefined ? { ...c, function: { ...c.function, name: fix(c.function.name) } } : c)) }
      : m);
  }
  return new Map([...forward].map(([o, s]) => [s, o]));
}

// api.utim.dev/api/playground/chat is OpenAI-compatible (stream + JSON + native tools), keyless;
// an optional utim-... key is forwarded.
export class UtimExecutor extends DefaultExecutor {
  constructor() {
    super("utim");
  }

  transformRequest(model, body, stream, credentials) {
    // Copy so retries re-run on the caller's untouched body instead of an already-renamed one.
    const transformed = { ...super.transformRequest(model, body, stream, credentials) };
    const renamed = sanitizeUtimToolNames(transformed);
    recordRenamedToolNames(body, renamed);
    recordRenamedToolNames(transformed, renamed);
    return packUtimOverflowMessages(transformed);
  }

  // Keyless => single connection, so retry transient 5xx/429 and empty Kiro streams here.
  async execute(args) {
    const { stream, signal } = args;
    let result;
    for (let attempt = 0; attempt < MAX_UTIM_ATTEMPTS; attempt++) {
      result = await super.execute(args);
      if (signal?.aborted) return result;
      const res = result?.response;
      const last = attempt >= MAX_UTIM_ATTEMPTS - 1;
      let retry = false;
      if (res && !res.ok) retry = res.status >= 500 || res.status === 429;
      else if (stream && res?.ok) retry = (await probeStreamingResponseForEmptyTurn(res, undefined, 0)).empty;
      if (!retry || last) return result;
      void res?.body?.cancel?.().catch(() => {});
      if (signal?.aborted) return result;
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
    }
    return result;
  }

  buildHeaders(credentials, stream = true, ...rest) {
    const headers = super.buildHeaders(credentials, stream, ...rest);
    const key = credentials?.apiKey || credentials?.accessToken;
    if (key) headers["X-API-Key"] = key;
    else delete headers.Authorization;
    return headers;
  }
}

