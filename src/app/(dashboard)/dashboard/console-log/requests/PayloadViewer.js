"use client";

import { useState, useMemo } from "react";
import { Button } from "@/shared/components";
import { useCopyToClipboard } from "@/shared/hooks/useCopyToClipboard";

const RENDER_CAP = 200 * 1024;
const SEARCH_CAP = 500 * 1024;

export const isTruncated = (v) => !!v && typeof v === "object" && v._truncated === true;
export const isEmptyPayload = (v) =>
  v == null || (Array.isArray(v) ? v.length === 0 : typeof v === "object" && Object.keys(v).length === 0);

const fmtSize = (n) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const pretty = (v) => {
  if (typeof v === "string") {
    try { return JSON.stringify(JSON.parse(v), null, 2); } catch { return v; }
  }
  return JSON.stringify(v, null, 2);
};

function TruncatedNote({ value, maxJsonKB }) {
  const size = typeof value._originalSize === "number" ? fmtSize(value._originalSize) : "unknown size";
  return (
    <div className="rounded-[10px] border border-yellow-500/30 bg-yellow-500/10 p-3 text-xs text-yellow-300">
      Payload truncated at the {maxJsonKB ?? "?"} KB cap (original {size}). Raise the cap in the logging settings.
      {value._preview ? (
        <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] text-text-muted">{String(value._preview)}</pre>
      ) : null}
    </div>
  );
}

// single regex pass: strings (keys when followed by ':'), numbers, booleans/null
const TOKEN_RE = /("(?:\\.|[^"\\])*")(\s*:)?|-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b|\b(?:true|false|null)\b/g;
function colorize(text) {
  const out = [];
  let last = 0;
  let m;
  TOKEN_RE.lastIndex = 0;
  while ((m = TOKEN_RE.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const cls = m[1] ? (m[2] ? "text-sky-400" : "text-green-400") : /^[tfn]/.test(m[0]) ? "text-purple-400" : "text-amber-400";
    if (m[2]) {
      out.push(<span key={m.index} className={cls}>{m[1]}</span>, m[2]);
    } else {
      out.push(<span key={m.index} className={cls}>{m[0]}</span>);
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function JsonView({ value, maxJsonKB }) {
  const { copied, copy } = useCopyToClipboard(1500);
  const [wrap, setWrap] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [q, setQ] = useState("");
  const text = useMemo(() => (isTruncated(value) ? "" : pretty(value) ?? ""), [value]);
  const canSearch = text.length < SEARCH_CAP;
  const shown = useMemo(() => {
    let t = text;
    const needle = canSearch ? q.trim().toLowerCase() : "";
    if (needle) t = t.split("\n").filter((l) => l.toLowerCase().includes(needle)).join("\n");
    return !showAll && t.length > RENDER_CAP ? t.slice(0, RENDER_CAP) : t;
  }, [text, q, showAll, canSearch]);
  const colored = useMemo(() => colorize(shown), [shown]);

  if (isTruncated(value)) return <TruncatedNote value={value} maxJsonKB={maxJsonKB} />;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {canSearch && (
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter lines..."
            className="h-7 w-44 rounded-[8px] border border-border-subtle bg-surface-2 px-2 text-xs text-text-main outline-none focus:border-brand-500/50"
          />
        )}
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="outline" icon="wrap_text" onClick={() => setWrap((w) => !w)}>{wrap ? "Wrap on" : "Wrap off"}</Button>
          <Button size="sm" variant="outline" icon={copied ? "check" : "content_copy"} onClick={() => copy(text)}>Copy</Button>
        </div>
      </div>
      <pre className={`max-h-[60vh] overflow-auto rounded-[10px] bg-surface-2 p-3 font-mono text-[11px] leading-relaxed text-text-main ${wrap ? "whitespace-pre-wrap break-words" : "whitespace-pre"}`}>
        {colored}
      </pre>
      {!showAll && !q && text.length > RENDER_CAP && (
        <Button size="sm" variant="outline" onClick={() => setShowAll(true)}>Show all ({fmtSize(text.length)})</Button>
      )}
    </div>
  );
}

const ROLE_STYLE = {
  system: "border-purple-500/30 bg-purple-500/5 text-purple-400",
  user: "border-blue-500/30 bg-blue-500/5 text-blue-400",
  assistant: "border-green-500/30 bg-green-500/5 text-green-400",
  tool: "border-amber-500/30 bg-amber-500/5 text-amber-400",
};

const Chip = ({ children }) => (
  <span className="inline-flex items-center rounded-full border border-border-subtle bg-surface-2 px-2 py-0.5 font-mono text-[10px] text-text-muted">{children}</span>
);

function ToolCall({ name, args }) {
  return (
    <div className="mt-2 rounded-[8px] border border-border-subtle bg-surface-2 p-2">
      <div className="flex items-center gap-1 font-mono text-[11px] text-text-main">
        <span className="material-symbols-outlined text-[14px]">build</span>{name || "tool"}
      </div>
      {args != null && args !== "" && (
        <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] text-text-muted">{pretty(args)}</pre>
      )}
    </div>
  );
}

function Content({ content }) {
  if (content == null) return null;
  if (typeof content === "string") return <div className="whitespace-pre-wrap break-words text-xs text-text-main">{content}</div>;
  if (!Array.isArray(content)) return <pre className="whitespace-pre-wrap break-words font-mono text-[11px] text-text-main">{pretty(content)}</pre>;
  return (
    <div className="flex flex-col gap-1.5">
      {content.map((p, i) => {
        if (typeof p === "string") return <div key={i} className="whitespace-pre-wrap break-words text-xs text-text-main">{p}</div>;
        if (p?.type === "text" || (p?.text != null && !p.type)) return <div key={i} className="whitespace-pre-wrap break-words text-xs text-text-main">{p.text}</div>;
        if (p?.type === "tool_use") return <ToolCall key={i} name={p.name} args={p.input} />;
        if (p?.type === "tool_result") return (
          <div key={i}><Chip>tool_result</Chip><div className="mt-1"><Content content={p.content} /></div></div>
        );
        return <div key={i}><Chip>{p?.type || "part"}</Chip></div>;
      })}
    </div>
  );
}

function Block({ role, content, toolCalls, thinking }) {
  return (
    <div className={`rounded-[10px] border p-3 ${ROLE_STYLE[role] || "border-border-subtle bg-surface-2 text-text-muted"}`}>
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide">{role}</div>
      {thinking ? (
        <details className="mb-2">
          <summary className="cursor-pointer text-[11px] text-text-muted">Thinking</summary>
          <div className="mt-1 whitespace-pre-wrap break-words text-xs italic text-text-muted">{thinking}</div>
        </details>
      ) : null}
      <Content content={content} />
      {(toolCalls || []).map((c, i) => (
        <ToolCall key={i} name={c?.function?.name || c?.name} args={c?.function?.arguments ?? c?.arguments ?? c?.input} />
      ))}
    </div>
  );
}

function Messages({ detail, maxJsonKB }) {
  const req = detail?.request;
  const res = detail?.response;
  if (isTruncated(req)) return <TruncatedNote value={req} maxJsonKB={maxJsonKB} />;
  const msgs = Array.isArray(req?.messages) ? req.messages : [];
  const hasOut = res && !isTruncated(res) && (res.content || res.thinking || res.tool_calls?.length);
  return (
    <div className="flex flex-col gap-2">
      {msgs.map((m, i) => (
        <Block key={i} role={m?.role || "unknown"} content={m?.content} toolCalls={m?.tool_calls} />
      ))}
      {hasOut && <Block role="assistant" content={res.content} thinking={res.thinking} toolCalls={res.tool_calls} />}
      {isTruncated(res) && <TruncatedNote value={res} maxJsonKB={maxJsonKB} />}
      {!msgs.length && !hasOut && <div className="text-xs text-text-muted">No messages captured.</div>}
    </div>
  );
}

// mode "messages": value = whole detail. otherwise value = one raw payload.
export default function PayloadViewer({ value, mode, maxJsonKB }) {
  if (mode === "messages") return <Messages detail={value} maxJsonKB={maxJsonKB} />;
  return <JsonView value={value} maxJsonKB={maxJsonKB} />;
}
