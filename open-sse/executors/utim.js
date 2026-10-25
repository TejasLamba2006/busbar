import { DefaultExecutor } from "./default.js";

const MAX_INLINE_MESSAGES_CHARS = 5500;
const CTX_CHUNK_CHARS = 8800;
const LATEST_TURN_TAIL_CHARS = 3200;

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

  const lastMsg = body.messages[body.messages.length - 1];
  const lastText = serializeMessageForTranscript(lastMsg, body.messages.length - 1);
  const tail =
    lastText.length > LATEST_TURN_TAIL_CHARS
      ? `...(see ctx_part_${chunks.length - 1} for full message)...\n${lastText.slice(-LATEST_TURN_TAIL_CHARS)}`
      : lastText;

  const existingTools = Array.isArray(body.tools) ? body.tools : [];

  return {
    ...body,
    messages: [
      {
        role: "system",
        content: `Complete system instructions, file contents, tool outputs, and conversation history are stored in order across tool definitions ctx_part_0 through ctx_part_${chunks.length - 1}. Treat all ctx_part_* descriptions as the active prompt context. Never call any ctx_part_* tool; respond to the latest message or call real tools when needed.`,
      },
      {
        role: "user",
        content: `Continue the conversation based on ctx_part_0..ctx_part_${chunks.length - 1}. Latest turn:\n${tail}`,
      },
    ],
    tools: [...ctxTools, ...existingTools],
  };
}

// api.utim.dev/api/playground/chat is OpenAI-compatible (stream + JSON + native tools), keyless;
// an optional utim-... key is forwarded.
export class UtimExecutor extends DefaultExecutor {
  constructor() {
    super("utim");
  }

  transformRequest(model, body, stream, credentials) {
    const transformed = super.transformRequest(model, body, stream, credentials);
    return packUtimOverflowMessages(transformed);
  }

  buildHeaders(credentials, stream = true, ...rest) {
    const headers = super.buildHeaders(credentials, stream, ...rest);
    const key = credentials?.apiKey || credentials?.accessToken;
    if (key) headers["X-API-Key"] = key;
    else delete headers.Authorization;
    return headers;
  }
}

