import WebSocket from "ws";
import claude from "../providers/registry/claude.js";
import { convertAudioToPcm16, MAX_AUDIO_BYTES } from "./codexSttAudio.js";
import { createErrorResult } from "../utils/error.js";

let active = 0;
const MAX_CONCURRENT = 4;
const SAMPLE_RATE = 16000;
const CHUNK_BYTES = 32000;
const KEEPALIVE_INTERVAL_MS = 8000;
const FINALIZE_NODATA_MS = 2000;
const POST_ENDPOINT_SETTLE_MS = 250;
const FINALIZE_SAFETY_MS = 30000;
const KEYTERMS_MAX_CHARS = 1024;
const KEEPALIVE_FRAME = '{"type":"KeepAlive"}';
const CLOSESTREAM_FRAME = '{"type":"CloseStream"}';
const cors = { "Access-Control-Allow-Origin": "*", "Cache-Control": "no-store" };

const failure = (status, message) => Object.assign(new Error(message), { status });

// Mirrors claude.exe voice_stream keyterms sanitizer: split on commas/newlines,
// keep printable ASCII (0x20-0x7E), collapse spaces, dedupe, cap at 1024 chars.
export function sanitizeKeyterms(rawPrompt) {
  if (typeof rawPrompt !== "string" || !rawPrompt.trim()) return "";
  const parts = rawPrompt.split(/[,\r\n]+/);
  const seen = new Set();
  const out = [];
  let total = 0;
  for (const item of parts) {
    const cleaned = item
      .replace(/,/g, " ")
      .replace(/[^\x20-\x7E]/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!cleaned || seen.has(cleaned)) continue;
    const addLen = cleaned.length + (out.length > 0 ? 1 : 0);
    if (total + addLen > KEYTERMS_MAX_CHARS) break;
    seen.add(cleaned);
    out.push(cleaned);
    total += addLen;
  }
  return out.join(",");
}

const SUPPORTED_VOICE_LANGS = new Set([
  "en", "es", "fr", "ja", "de", "pt", "it", "ko", "hi", "id",
  "ru", "pl", "tr", "nl", "uk", "el", "cs", "da", "sv", "no",
]);

const VOICE_LANG_ALIASES = {
  english: "en", spanish: "es", español: "es", espanol: "es",
  french: "fr", français: "fr", francais: "fr", japanese: "ja", 日本語: "ja",
  german: "de", deutsch: "de", portuguese: "pt", português: "pt", portugues: "pt",
  italian: "it", italiano: "it", korean: "ko", 한국어: "ko",
  hindi: "hi", हिन्दी: "hi", हिंदी: "hi", indonesian: "id", "bahasa indonesia": "id", bahasa: "id",
  russian: "ru", русский: "ru", polish: "pl", polski: "pl",
  turkish: "tr", türkçe: "tr", turkce: "tr", dutch: "nl", nederlands: "nl",
  ukrainian: "uk", українська: "uk", greek: "el", ελληνικά: "el",
  czech: "cs", čeština: "cs", cestina: "cs", danish: "da", dansk: "da",
  swedish: "sv", svenska: "sv", norwegian: "no", norsk: "no",
};

export function resolveVoiceLanguage(raw) {
  if (typeof raw !== "string") return "en";
  const norm = raw.toLowerCase().trim();
  if (!norm || norm === "auto") return "en";
  if (SUPPORTED_VOICE_LANGS.has(norm)) return norm;
  if (VOICE_LANG_ALIASES[norm]) return VOICE_LANG_ALIASES[norm];
  const base = norm.split(/[-_]/)[0];
  if (base && SUPPORTED_VOICE_LANGS.has(base)) return base;
  return "en";
}

function resolveClientPlatform() {
  if (process.platform === "darwin") return "darwin";
  if (process.platform === "win32") return "win32";
  return "linux";
}

function streamPcmToClaudeVoice({ pcm, accessToken, language, keyterms, wsBaseUrl, signal }) {
  const params = new URLSearchParams({
    encoding: "linear16",
    sample_rate: String(SAMPLE_RATE),
    channels: "1",
    endpointing_ms: "300",
    utterance_end_ms: "1000",
    language: language || "en",
    use_conversation_engine: "true",
  });
  const base = (wsBaseUrl || claude.sttConfig.baseUrl).replace(/\?.*$/, "");
  const url = `${base}?${params.toString()}`;
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "User-Agent": claude.transport.headers["User-Agent"],
    "x-app": "cli",
    "anthropic-client-platform": resolveClientPlatform(),
  };
  if (keyterms) headers["x-config-keyterms"] = keyterms;

  return new Promise((resolve, reject) => {
    let settled = false;
    let keepaliveTimer = null;
    let safetyTimer = null;
    let noDataTimer = null;
    let closeStreamSent = false;
    let pendingUtterance = "";
    const utterances = [];

    const ws = new WebSocket(url, { headers, handshakeTimeout: 10000 });

    const flushPending = () => {
      const trimmed = pendingUtterance.trim();
      pendingUtterance = "";
      if (trimmed) utterances.push(trimmed);
    };

    const cleanup = () => {
      if (keepaliveTimer) { clearInterval(keepaliveTimer); keepaliveTimer = null; }
      if (safetyTimer) { clearTimeout(safetyTimer); safetyTimer = null; }
      if (noDataTimer) { clearTimeout(noDataTimer); noDataTimer = null; }
      signal?.removeEventListener("abort", onAbort);
      try {
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
          ws.close(1000);
        }
      } catch {}
    };

    const succeed = () => {
      if (settled) return;
      settled = true;
      flushPending();
      cleanup();
      resolve({
        text: utterances.join(" ").trim(),
        segments: utterances.map((segText, id) => ({ id, text: segText })),
      });
    };

    const fail = (err) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(err);
    };

    const onAbort = () => fail(failure(504, "Transcription cancelled"));
    if (signal?.aborted) {
      onAbort();
      return;
    }
    signal?.addEventListener("abort", onAbort, { once: true });

    const resetTimers = (ms = FINALIZE_NODATA_MS) => {
      if (!closeStreamSent) return;
      if (noDataTimer) clearTimeout(noDataTimer);
      noDataTimer = setTimeout(() => succeed(), ms);
      if (safetyTimer) clearTimeout(safetyTimer);
      safetyTimer = setTimeout(() => succeed(), FINALIZE_SAFETY_MS);
    };

    ws.on("open", () => {
      if (settled) return;
      ws.send(KEEPALIVE_FRAME);
      keepaliveTimer = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send(KEEPALIVE_FRAME);
      }, KEEPALIVE_INTERVAL_MS);

      for (let off = 0; off < pcm.length; off += CHUNK_BYTES) {
        if (ws.readyState !== WebSocket.OPEN) break;
        ws.send(pcm.subarray(off, Math.min(off + CHUNK_BYTES, pcm.length)));
      }

      closeStreamSent = true;
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(CLOSESTREAM_FRAME);
      }
      resetTimers(FINALIZE_SAFETY_MS);
    });

    ws.on("message", (raw) => {
      if (settled) return;
      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }
      switch (msg.type) {
        case "TranscriptInterim":
        case "TranscriptText": {
          resetTimers(FINALIZE_NODATA_MS);
          if (typeof msg.data === "string" && msg.data) {
            pendingUtterance = msg.data;
          }
          break;
        }
        case "TranscriptEndpoint": {
          flushPending();
          if (closeStreamSent) {
            resetTimers(POST_ENDPOINT_SETTLE_MS);
          }
          break;
        }
        case "TranscriptError": {
          const desc = msg.description || msg.error_code || "Claude transcription error";
          flushPending();
          if (utterances.length > 0) succeed();
          else fail(failure(502, String(desc)));
          break;
        }
        case "error": {
          const desc = msg.message || "Claude voice stream error";
          flushPending();
          if (utterances.length > 0) succeed();
          else fail(failure(502, String(desc)));
          break;
        }
        default:
          break;
      }
    });

    ws.on("unexpected-response", (req, res) => {
      const code = res?.statusCode || 502;
      res?.resume?.();
      req?.destroy?.();
      fail(failure(code >= 400 && code <= 599 ? code : 502, `Claude voice stream rejected with HTTP ${code}`));
    });

    ws.on("error", (err) => {
      flushPending();
      if (utterances.length > 0) succeed();
      else fail(failure(502, `Claude voice stream connection error: ${err?.message || "unknown"}`));
    });

    ws.on("close", (code, reasonBuf) => {
      if (settled) return;
      flushPending();
      if (code === 1000 || code === 1005 || utterances.length > 0) {
        succeed();
        return;
      }
      const reason = reasonBuf ? reasonBuf.toString() : "";
      fail(failure(502, `Claude voice stream closed (code ${code}${reason ? `: ${reason}` : ""})`));
    });
  });
}

export async function transcribeClaude({ formData, credentials, signal: clientSignal, wsBaseUrlOverrideForTest }) {
  let slot = false;
  const signal = AbortSignal.any([...(clientSignal ? [clientSignal] : []), AbortSignal.timeout(60000)]);
  try {
    const isOAuth = credentials?.authType === "oauth" || (!credentials?.authType && !credentials?.apiKey);
    if (!isOAuth || typeof credentials?.accessToken !== "string" || !/^[\x21-\x7e]+$/.test(credentials.accessToken)) {
      throw failure(401, "A valid Claude OAuth account is required");
    }

    for (const [key] of formData) {
      if (!["model", "file", "response_format", "language", "prompt", "temperature"].includes(key) || formData.getAll(key).length !== 1) {
        throw failure(400, "Unsupported or duplicate form field");
      }
    }

    const format = String(formData.get("response_format") || "json").trim().toLowerCase() || "json";
    if (!["json", "text", "verbose_json"].includes(format)) {
      throw failure(400, "Only json, text, and verbose_json response formats are supported");
    }

    const file = formData.get("file");
    if (!(file instanceof Blob) || !file.size) throw failure(400, "A non-empty audio file is required");
    if (file.size > MAX_AUDIO_BYTES) throw failure(413, "Audio exceeds 25 MiB");

    if (active >= MAX_CONCURRENT) throw failure(503, "Transcription capacity reached");
    active++;
    slot = true;

    signal.throwIfAborted();
    const pcm = await convertAudioToPcm16(file, signal, SAMPLE_RATE);

    const language = resolveVoiceLanguage(formData.get("language"));
    const keyterms = sanitizeKeyterms(formData.get("prompt"));

    const { text, segments } = await streamPcmToClaudeVoice({
      pcm,
      accessToken: credentials.accessToken,
      language,
      keyterms,
      wsBaseUrl: wsBaseUrlOverrideForTest,
      signal,
    });

    if (format === "text") {
      return {
        success: true,
        response: new Response(text, { headers: { ...cors, "Content-Type": "text/plain; charset=utf-8" } }),
      };
    }
    if (format === "verbose_json") {
      return {
        success: true,
        response: Response.json({ text, segments }, { headers: cors }),
      };
    }
    return {
      success: true,
      response: Response.json({ text }, { headers: cors }),
    };
  } catch (error) {
    return createErrorResult(
      error.status || (signal.aborted ? 504 : 502),
      error.status ? error.message : "Claude transcription failed"
    );
  } finally {
    if (slot) active--;
  }
}
