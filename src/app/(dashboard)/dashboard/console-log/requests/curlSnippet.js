// Pure helper (no React): kept out of RequestLogClient.js so node tests can import it without JSX parsing.

// Build a copy-pasteable curl for a stored request. Single quotes escaped for '...' shell quoting.
export function buildCurlSnippet(detail, origin = "http://localhost:20128") {
  const endpoint = detail?.endpoint || (detail?.request?.questions ? "/v1/decisions" : "/v1/chat/completions");
  const model = detail?.provider ? `${detail.provider}/${detail.model}` : detail?.model;
  const pr = detail?.providerRequest;
  let payload;
  if (pr && (pr.messages || pr.input || pr.prompt || pr.questions)) {
    payload = pr;
  } else if (detail?.request?.messages) {
    payload = {
      model,
      messages: detail.request.messages,
      ...(detail.request.temperature != null ? { temperature: detail.request.temperature } : {}),
      ...(detail.request.max_tokens != null ? { max_tokens: detail.request.max_tokens } : {}),
      ...(detail.request.stream != null ? { stream: detail.request.stream } : {}),
    };
  } else if (detail?.request && typeof detail.request === "object") {
    payload = { model, ...detail.request };
  }
  const jsonStr = JSON.stringify(payload ?? {}).replace(/'/g, "'\\''");
  return `curl ${origin}${endpoint} \\\n  -H "Authorization: Bearer $BUSBAR_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '${jsonStr}'`;
}
