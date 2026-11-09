import { describe, it, expect, vi, afterEach } from "vitest";
import { WebSocketServer } from "ws";
import { readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import claude from "../../open-sse/providers/registry/claude.js";
import { handleSttCore } from "../../open-sse/handlers/sttCore.js";
import { convertAudioToPcm16 } from "../../open-sse/handlers/codexSttAudio.js";
import { transcribeClaude, sanitizeKeyterms } from "../../open-sse/handlers/claudeStt.js";

function wav(seconds = 0.04) {
  const pcm = Buffer.alloc(Math.floor(48000 * seconds) * 4);
  const b = Buffer.alloc(44 + pcm.length);
  b.write("RIFF");
  b.writeUInt32LE(b.length - 8, 4);
  b.write("WAVEfmt ", 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(2, 22);
  b.writeUInt32LE(48000, 24);
  b.writeUInt32LE(192000, 28);
  b.writeUInt16LE(4, 32);
  b.writeUInt16LE(16, 34);
  b.write("data", 36);
  b.writeUInt32LE(pcm.length, 40);
  return b;
}

function makeForm(extra = {}) {
  const f = new FormData();
  f.set("model", "cc/transcribe");
  f.set("file", new File([wav()], "input.wav", { type: "audio/wav" }));
  for (const [k, v] of Object.entries(extra)) f.set(k, v);
  return f;
}

const validCredentials = {
  authType: "oauth",
  accessToken: "sk-ant-oat01-test-token",
  providerSpecificData: { baseUrl: "wss://attacker.invalid/steal" },
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Claude OAuth STT (cc/transcribe)", () => {
  it("registers transcribe model and stt serviceKind on claude provider", () => {
    expect(claude.serviceKinds).toEqual(expect.arrayContaining(["llm", "stt"]));
    expect(claude.sttConfig).toMatchObject({
      baseUrl: "wss://api.anthropic.com/api/ws/speech_to_text/voice_stream",
      authType: "oauth",
      format: "claude-transcribe",
    });
    expect(claude.display.kindNotice?.stt).toContain("ffmpeg");
    expect(claude.models.find((m) => m.id === "transcribe")).toMatchObject({
      kind: "stt",
      params: ["language", "prompt", "response_format"],
      responseFormats: ["json", "text", "verbose_json"],
    });
  });

  it("converts stereo 48k WAV to 16kHz mono signed 16-bit PCM and cleans up temp dir", async () => {
    const before = (await readdir(tmpdir())).filter((s) => s.startsWith("9router-codex-stt-"));
    const pcm = await convertAudioToPcm16(new File([wav(0.05)], "in.wav"), new AbortController().signal, 16000);
    expect(Buffer.isBuffer(pcm)).toBe(true);
    // 0.05s * 16000 Hz * 2 bytes = 1600 bytes
    expect(pcm.length).toBe(1600);
    const after = (await readdir(tmpdir())).filter((s) => s.startsWith("9router-codex-stt-") && !before.includes(s));
    expect(after).toEqual([]);
  });

  it("rejects API keys and missing OAuth tokens with 401", async () => {
    const formData = makeForm();
    const res = await handleSttCore({
      provider: "claude",
      model: "transcribe",
      formData,
      credentials: { authType: "apikey", apiKey: "sk-ant-api03-test" },
      sttConfig: claude.sttConfig,
    });
    expect(res.status).toBe(401);
    expect(res.error).toContain("OAuth");
  });

  it("rejects unsupported response_format and oversized uploads before transport", async () => {
    expect((await transcribeClaude({ formData: makeForm({ response_format: "srt" }), credentials: validCredentials })).status).toBe(400);
    const bigForm = makeForm();
    bigForm.set("file", new File([Buffer.alloc(25 * 1024 * 1024 + 1)], "huge.wav"));
    expect((await transcribeClaude({ formData: bigForm, credentials: validCredentials })).status).toBe(413);
  });

  it("sanitizes prompt into ASCII comma-separated keyterms capped at 1024 chars", () => {
    expect(sanitizeKeyterms("Busbar, OpenWhispr\nClaude Code,  Tejas  , Busbar, हिंदी")).toBe("Busbar,OpenWhispr,Claude Code,Tejas");
  });

  it("streams 16kHz PCM over WebSocket, accumulates utterances, and supports json/text/verbose_json", async () => {
    let receivedHeaders = null;
    let receivedUrl = null;
    let receivedBinaryBytes = 0;
    const textFrames = [];

    const wss = new WebSocketServer({ host: "127.0.0.1", port: 0 });
    await new Promise((r) => wss.once("listening", r));
    const port = wss.address().port;

    wss.on("connection", (ws, req) => {
      receivedHeaders = req.headers;
      receivedUrl = req.url;
      ws.on("message", (data, isBinary) => {
        if (isBinary) {
          receivedBinaryBytes += data.length;
        } else {
          const msg = JSON.parse(data.toString());
          textFrames.push(msg.type);
          if (msg.type === "CloseStream") {
            ws.send(JSON.stringify({ type: "TranscriptText", data: "Hello" }));
            ws.send(JSON.stringify({ type: "TranscriptText", data: "Hello world." }));
            ws.send(JSON.stringify({ type: "TranscriptEndpoint" }));
            ws.send(JSON.stringify({ type: "TranscriptInterim", data: "Testing Busbar STT" }));
            ws.close(1000);
          }
        }
      });
    });

    try {
      const wsBaseUrl = `ws://127.0.0.1:${port}/api/ws/speech_to_text/voice_stream`;
      const resJson = await transcribeClaude({
        formData: makeForm({ language: "en", prompt: "Busbar, Tejas" }),
        credentials: validCredentials,
        wsBaseUrlOverrideForTest: wsBaseUrl,
      });
      expect(resJson.success).toBe(true);
      expect(await resJson.response.json()).toEqual({ text: "Hello world. Testing Busbar STT" });
      expect(receivedHeaders.authorization).toBe("Bearer sk-ant-oat01-test-token");
      expect(receivedHeaders["x-app"]).toBe("cli");
      expect(receivedHeaders["x-config-keyterms"]).toBe("Busbar,Tejas");
      expect(receivedUrl).toContain("encoding=linear16");
      expect(receivedUrl).toContain("sample_rate=16000");
      expect(receivedUrl).toContain("language=en");
      expect(receivedBinaryBytes).toBe(1280);
      expect(textFrames).toContain("KeepAlive");
      expect(textFrames).toContain("CloseStream");

      const resText = await transcribeClaude({
        formData: makeForm({ response_format: "text" }),
        credentials: validCredentials,
        wsBaseUrlOverrideForTest: wsBaseUrl,
      });
      expect(await resText.response.text()).toBe("Hello world. Testing Busbar STT");

      const resVerbose = await transcribeClaude({
        formData: makeForm({ response_format: "verbose_json" }),
        credentials: validCredentials,
        wsBaseUrlOverrideForTest: wsBaseUrl,
      });
      expect(await resVerbose.response.json()).toEqual({
        text: "Hello world. Testing Busbar STT",
        segments: [
          { id: 0, text: "Hello world." },
          { id: 1, text: "Testing Busbar STT" },
        ],
      });
    } finally {
      await new Promise((r) => wss.close(r));
    }
  });
});
