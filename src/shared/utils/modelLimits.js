// Pulls a model's context window and max output tokens out of the many shapes providers use
// (OpenAI-style, OpenRouter, models.dev `limit`, Gemini, vLLM...). Only positive numbers count;
// anything else is ignored so a bad upstream value never overrides the built-in tables.

const CONTEXT_KEYS = [
  "context_length", "context_window", "contextWindow", "contextLength", "max_context_length",
  "max_model_len", "max_input_tokens", "maxInputTokens", "inputTokenLimit", "input_token_limit", "context_size",
];
const OUTPUT_KEYS = [
  "max_completion_tokens", "max_output_tokens", "maxOutputTokens", "maxOutput", "outputTokenLimit", "output_token_limit",
];

function positive(value) {
  const n = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

function firstPositive(sources, keys) {
  for (const source of sources) {
    if (!source || typeof source !== "object") continue;
    for (const key of keys) {
      const n = positive(source[key]);
      if (n) return n;
    }
  }
  return null;
}

/** @returns {{context: number|null, output: number|null}} */
export function extractModelLimits(model) {
  if (!model || typeof model !== "object") return { context: null, output: null };
  // models.dev / opencode shape: { limit: { context, output } }; OpenRouter: top_provider.*
  const limit = model.limit && typeof model.limit === "object" ? model.limit : null;
  const sources = [model, model.top_provider, model.capabilities, model.metadata, model.metadata?.limit, model.reported];
  const context = positive(limit?.context) ?? firstPositive(sources, CONTEXT_KEYS);
  let output = positive(limit?.output) ?? firstPositive(sources, OUTPUT_KEYS);
  // An output cap larger than the window is a provider data error; do not publish it.
  if (context && output && output > context) output = null;
  return { context, output };
}
