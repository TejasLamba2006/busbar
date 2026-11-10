import crypto from "node:crypto";
import { BaseExecutor } from "./base.js";
import { randomUUID } from "node:crypto";
import { PROVIDERS, PROVIDER_OAUTH } from "../config/providers.js";
import { ANTHROPIC_API_VERSION, OPENAI_COMPAT_BASE, ANTHROPIC_COMPAT_BASE, selectAnthropicBeta, mergeAnthropicBeta } from "../providers/shared.js";
import { resolveOpenAICompatibleApiType } from "../services/provider.js";
import { OAUTH_ENDPOINTS, buildKimiHeaders, NOUS_ATTRIBUTION } from "../config/appConstants.js";
import { buildClineHeaders } from "../shared/clineAuth.js";
import { proxyAwareFetch } from "../utils/proxyFetch.js";
import { injectReasoningContent } from "../utils/reasoningContentInjector.js";
import { stripUnsupportedParams } from "../translator/concerns/paramSupport.js";
import { applyMaxCompletionTokens, applyMinMaxCompletionTokens } from "../translator/formats/maxTokens.js";
import { applyResponsesOutputCap } from "../translator/formats/responsesApi.js";
import { recordRenamedToolNames } from "../utils/opencodeFingerprint.js";
import { extractClaudeSessionIdFromUserId } from "../utils/claudeCloaking.js";

// Auth header descriptors — derived from registry transport.auth, fallback to hardcoded defaults.
const BEARER = { combined: true, header: "Authorization", scheme: "bearer" };
const XAPIKEY = { combined: true, header: "x-api-key", scheme: "raw" };
const AUTH_DESCRIPTORS = Object.fromEntries(
  Object.entries(PROVIDERS)
    .filter(([, t]) => t.auth)
    .map(([id, t]) => [id, t.auth])
);

// Apply a token to a header per scheme (matches legacy: combined always sets, even when undefined).
function setAuth(headers, spec, token) {
  headers[spec.header] = spec.scheme === "bearer" ? `Bearer ${token}` : token;
}

// Resolve auth onto headers from a descriptor.
function applyAuth(headers, desc, credentials) {
  if (desc.combined) {
    // combined providers always set the header (legacy behavior, incl. noAuth → "Bearer undefined")
    setAuth(headers, desc, credentials.apiKey || credentials.accessToken);
    if (desc.anthropicVersion && !headers["anthropic-version"]) headers["anthropic-version"] = ANTHROPIC_API_VERSION;
    return;
  }
  // split apiKey/oauth: set only the matching branch (legacy: anthropic-compatible skips when both absent)
  if (credentials.apiKey) setAuth(headers, desc.apiKey, credentials.apiKey);
  else if (credentials.accessToken) setAuth(headers, desc.oauth, credentials.accessToken);
  if (desc.anthropicVersion && !headers["anthropic-version"]) headers["anthropic-version"] = ANTHROPIC_API_VERSION;
}

// Provider-specific header quirks kept as small hooks (not pure auth).
const HEADER_HOOKS = {
  // Stable device_id from OAuth connection (CLIProxyAPI KimiTokenStorage.DeviceID)
  kimiHeaders: (h, c) => Object.assign(h, buildKimiHeaders(c?.providerSpecificData?.deviceId)),
  // MiniMax Code (mcode): the placeholder x-api-key rides every request next
  // to the Bearer token, plus per-request session/timezone headers. Static
  // teammates (User-Agent, X-Mavis-Agent-Id) live in the registry transport.
  minimaxHeaders: (h) => {
    h["x-api-key"] = "sk-xxx";
    h["X-Mavis-Timezone-Offset"] = String(new Date().getTimezoneOffset() * -60);
    if (!h["X-Mavis-Session-Id"]) h["X-Mavis-Session-Id"] = randomUUID();
  },
  // Muse: x-api-version only on subscription (minted key) requests — plain
  // Model API keys already work without it
  museHeaders: (h, c) => { if (c?.accessToken && !c?.apiKey) h["x-api-version"] = "1.0.0"; },
  clineHeaders: (h, c) => Object.assign(h, buildClineHeaders(c.apiKey || c.accessToken)),
  kilocodeOrg: (h, c) => { if (c.providerSpecificData?.orgId) h["X-Kilocode-OrganizationID"] = c.providerSpecificData.orgId; },
  codebuddyHeaders: (h) => {
    const requestId = randomUUID();
    h["X-Request-ID"] = requestId;
    h["X-Conversation-ID"] = randomUUID();
    h["X-Conversation-Request-ID"] = requestId;
    h["X-Conversation-Message-ID"] = requestId;
  },
};

// Config-driven OAuth refresh grants — derived from registry oauth.refresh.
const REFRESH_GRANTS = Object.fromEntries(
  Object.entries(PROVIDER_OAUTH)
    .filter(([, o]) => o.refresh)
    .map(([id, o]) => {
      const tokenUrl = o.tokenUrl;
      const encoding = o.refresh.encoding;
      const extraParams = o.refresh.scope ? { scope: o.refresh.scope } : {};
      return [id, {
        encoding,
        url: () => tokenUrl,
        params: (ex) => id === "gemini"
          ? { client_id: ex.config.clientId, client_secret: ex.config.clientSecret, ...extraParams }
          : { client_id: o.clientId, ...extraParams },
      }];
    })
);

// api.openai.com rejects more than 128 tools (400 array_above_max_length). Claude Code with
// many MCP servers sends 200+. Keep tools the model is forced to call or already called in
// this conversation first, then fill the rest in the client's order.
const OPENAI_MAX_TOOLS = 128;

function toolName(t) {
  return t?.function?.name || t?.name;
}

function capOpenAITools(body) {
  if (!Array.isArray(body.tools) || body.tools.length <= OPENAI_MAX_TOOLS) return;
  const must = new Set();
  const forced = body.tool_choice?.function?.name || body.tool_choice?.name;
  if (forced) must.add(forced);
  for (const m of body.messages || []) {
    for (const c of m?.tool_calls || []) if (c?.function?.name) must.add(c.function.name);
  }
  // Responses history stores assistant calls as flat input[] items. Preserve a
  // tool already used in the previous turn even when the follow-up no longer
  // carries tool_choice, or the cap makes its function_call_output impossible
  // to continue coherently.
  for (const item of Array.isArray(body.input) ? body.input : []) {
    if (item?.type === "function_call" && item.name) must.add(item.name);
  }
  const pinned = body.tools.filter((t) => must.has(toolName(t)));
  const rest = body.tools.filter((t) => !must.has(toolName(t)));
  const keep = new Set([...pinned, ...rest.slice(0, Math.max(0, OPENAI_MAX_TOOLS - pinned.length))]);
  body.tools = body.tools.filter((t) => keep.has(t)).slice(0, OPENAI_MAX_TOOLS);
}

// api.openai.com only accepts ^[a-zA-Z0-9_-]{1,64}$ for tool names (400 invalid_value
// otherwise). MCP clients send names with dots, colons or slashes, so rewrite them and
// remember the mapping so responses can be restored to the client's own spelling.
const OPENAI_TOOL_NAME_OK = /^[a-zA-Z0-9_-]{1,64}$/;

function openAIToolName(name, taken) {
  let base = name.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64) || "tool";
  if (!taken.has(base)) return base;
  const hash = crypto.createHash("sha256").update(name).digest("hex").slice(0, 8);
  base = `${base.slice(0, 55)}_${hash}`;
  return base;
}

// Handles chat ({function:{name}}) and Responses ({name}) declarations, forced
// tool_choice, assistant tool_calls and Responses function_call history items.
function sanitizeOpenAIToolNames(body) {
  const names = new Set();
  const note = (n) => { if (typeof n === "string" && n && !OPENAI_TOOL_NAME_OK.test(n)) names.add(n); };
  const declared = (t) => t?.function?.name ?? t?.name;
  for (const t of body.tools || []) note(declared(t));
  note(body.tool_choice?.function?.name ?? body.tool_choice?.name);
  for (const m of body.messages || []) for (const c of m?.tool_calls || []) note(c?.function?.name);
  for (const i of Array.isArray(body.input) ? body.input : []) if (i?.type === "function_call") note(i.name);
  if (!names.size) return null;

  const taken = new Set([...(body.tools || [])].map(declared).filter((n) => OPENAI_TOOL_NAME_OK.test(n || "")));
  const forward = new Map();
  for (const original of names) {
    const sent = openAIToolName(original, taken);
    taken.add(sent);
    forward.set(original, sent);
  }
  const fix = (n) => forward.get(n) ?? n;

  body.tools = (body.tools || []).map((t) => {
    if (t?.function?.name !== undefined) return { ...t, function: { ...t.function, name: fix(t.function.name) } };
    return t?.name !== undefined ? { ...t, name: fix(t.name) } : t;
  });
  if (body.tool_choice && typeof body.tool_choice === "object") {
    const c = body.tool_choice;
    if (c.function?.name !== undefined) body.tool_choice = { ...c, function: { ...c.function, name: fix(c.function.name) } };
    else if (c.name !== undefined) body.tool_choice = { ...c, name: fix(c.name) };
  }
  if (Array.isArray(body.messages)) {
    body.messages = body.messages.map((m) => Array.isArray(m?.tool_calls)
      ? { ...m, tool_calls: m.tool_calls.map((c) => c?.function?.name !== undefined ? { ...c, function: { ...c.function, name: fix(c.function.name) } } : c) }
      : m);
  }
  if (Array.isArray(body.input)) {
    body.input = body.input.map((i) => i?.type === "function_call" && i.name !== undefined ? { ...i, name: fix(i.name) } : i);
  }
  // sent name -> client's original, so response tool names can be restored
  return new Map([...forward].map(([original, sent]) => [sent, original]));
}

export class DefaultExecutor extends BaseExecutor {
  constructor(provider) {
    super(provider, PROVIDERS[provider] || PROVIDERS.openai);
  }

  transformRequest(model, body, stream, credentials) {
    let transformed = this.applyJsonSchemaFallback(this.applyNousAttribution(model, body, stream, credentials));

    if (transformed && typeof transformed === "object") {
      // OpenAI-compatible upstreams (NVIDIA NIM, DeepSeek) reject `stream_options` on
      // non-streaming requests with 400 "Stream options can only be defined when stream=True".
      if (stream !== true && transformed.stream_options !== undefined && transformed.stream !== true) {
        if (transformed === body) transformed = { ...transformed };
        delete transformed.stream_options;
      }
      // quirk: some openai-compatible providers reject Anthropic's client_metadata field
      if (this.config.quirks?.dropClientMetadata) {
        delete transformed.client_metadata;
      }
      stripUnsupportedParams(this.provider, model, transformed);
      // Native /v1/responses requests skip format translation when source and target match.
      // Enforce the shared Responses floor here at the final provider boundary too.
      if (credentials?.runtimeTransport?.format === "openai-responses") {
        applyResponsesOutputCap(transformed);
      }
      // Responses wire: reasoning_effort moved to reasoning.effort (400 otherwise).
      if (credentials?.runtimeTransport?.format === "openai-responses" && typeof transformed.reasoning_effort === "string") {
        transformed.reasoning = { ...(transformed.reasoning || {}), effort: transformed.reasoning_effort };
        delete transformed.reasoning_effort;
      }
      // Groq and custom OpenAI-compatible endpoints enforce OpenAI's 128-tool limit too.
      if (this.provider === "openai" || this.provider === "groq" || this.provider?.startsWith?.("openai-compatible-")) capOpenAITools(transformed);
      if (this.provider === "openai" || this.provider?.startsWith?.("openai-compatible-")) {
        const renamed = sanitizeOpenAIToolNames(transformed);
        // chatCore reads the map off the body it handed to execute(), which may differ from a
        // cloned `transformed` (json_schema fallback), so key both.
        recordRenamedToolNames(body, renamed);
        recordRenamedToolNames(transformed, renamed);
      }
      if (this.provider === "openai" || this.provider?.startsWith?.("openai-compatible-")) {
        const onChatWire = credentials?.runtimeTransport?.format !== "openai-responses"
          && resolveOpenAICompatibleApiType(this.provider, credentials) !== "responses";
        if (onChatWire) {
          // OpenAI-format clients send max_tokens straight through; newer models reject it.
          applyMaxCompletionTokens(transformed, model);
          applyMinMaxCompletionTokens(transformed, model);
          // A chat stream carries no token counts unless asked; without this a forced-stream
          // request folded back to JSON reports 0 tokens. Only valid with stream:true.
          if (transformed.stream === true && transformed.stream_options?.include_usage === undefined) {
            transformed.stream_options = { ...transformed.stream_options, include_usage: true };
          }
        }
      }
    }

    return injectReasoningContent({ provider: this.provider, model, body: transformed });
  }

  applyNousAttribution(model, body, stream, credentials) {
    if (!this.provider?.startsWith?.("openai-compatible-") || !credentials?.apiKey
      || !body || typeof body !== "object" || Array.isArray(body)
      || (body.tags != null && !Array.isArray(body.tags))) return body;

    try {
      const url = new URL(this.buildUrl(model, stream, 0, credentials));
      if (url.protocol !== "https:" || url.hostname !== NOUS_ATTRIBUTION.hostname
        || url.pathname !== NOUS_ATTRIBUTION.chatCompletionsPath) return body;
    } catch {
      return body;
    }

    let tags = Array.isArray(body.tags) ? [...body.tags] : [];
    for (const fallback of NOUS_ATTRIBUTION.tags) {
      const prefix = fallback.slice(0, fallback.indexOf("=") + 1);
      // Empty attribution values do not satisfy the upstream requirement.
      tags = tags.filter((tag) => typeof tag !== "string" || !tag.startsWith(prefix) || tag.slice(prefix.length).trim());
      if (!tags.some((tag) => typeof tag === "string" && tag.startsWith(prefix))) tags.push(fallback);
    }
    return { ...body, tags: [...new Set(tags)] };
  }

  // Fallback json_schema → json_object for openai-compatible and native deepseek providers without native Structured Output.
  applyJsonSchemaFallback(body) {
    if (!this.provider?.startsWith?.("openai-compatible-") && this.provider !== "deepseek") return body;
    const rf = body?.response_format;
    if (rf?.type !== "json_schema" || !rf.json_schema?.schema) return body;

    const schemaJson = JSON.stringify(rf.json_schema.schema, null, 2);
    const prompt = `You must respond with valid JSON that strictly follows this JSON schema:\n\`\`\`json\n${schemaJson}\n\`\`\`\nRespond ONLY with the JSON object, no other text.`;

    const messages = Array.isArray(body.messages) ? body.messages.map(m => ({ ...m })) : [];
    const sys = messages.find(m => m.role === "system");
    if (sys) {
      if (typeof sys.content === "string") sys.content = `${sys.content}\n\n${prompt}`;
      else if (Array.isArray(sys.content)) sys.content.push({ type: "text", text: `\n\n${prompt}` });
    } else {
      messages.unshift({ role: "system", content: prompt });
    }
    return { ...body, messages, response_format: { type: "json_object" } };
  }

  buildUrl(model, stream, urlIndex = 0, credentials = null) {
    // Runtime transport (multi-endpoint providers): use the sourceFormat-matched endpoint
    const rt = credentials?.runtimeTransport;
    if (rt?.baseUrl) {
      return rt.urlSuffix ? `${rt.baseUrl}${rt.urlSuffix}` : rt.baseUrl;
    }
    if (this.provider?.startsWith?.("openai-compatible-")) {
      const baseUrl = credentials?.providerSpecificData?.baseUrl || OPENAI_COMPAT_BASE;
      const normalized = baseUrl.replace(/\/$/, "");
      const path = resolveOpenAICompatibleApiType(this.provider, credentials) === "responses" ? "/responses" : "/chat/completions";
      return `${normalized}${path}`;
    }
    if (this.provider?.startsWith?.("anthropic-compatible-")) {
      const baseUrl = credentials?.providerSpecificData?.baseUrl || ANTHROPIC_COMPAT_BASE;
      const normalized = baseUrl.replace(/\/$/, "");
      return `${normalized}/messages`;
    }
    // gemini-format: build :streamGenerateContent / :generateContent path
    if (this.config.format === "gemini") {
      return `${this.config.baseUrl}/${model}:${stream ? "streamGenerateContent?alt=sse" : "generateContent"}`;
    }
    // urlSuffix (e.g. ?beta=true) declared per-provider in registry
    if (this.config.urlSuffix) {
      return `${this.config.baseUrl}${this.config.urlSuffix}`;
    }
    const url = this.config.baseUrl;
    if (url?.includes("{accountId}")) {
      const accountId = credentials?.providerSpecificData?.accountId;
      if (!accountId) throw new Error(`${this.provider} requires accountId in providerSpecificData`);
      return url.replace("{accountId}", accountId);
    }
    return url;
  }

  // Fallback descriptor for providers without an explicit entry in AUTH_DESCRIPTORS.
  resolveAuthDescriptor() {
    if (this.provider?.startsWith?.("anthropic-compatible-")) {
      return { apiKey: { header: "x-api-key", scheme: "raw" }, oauth: { header: "Authorization", scheme: "bearer" }, anthropicVersion: true };
    }
    if (this.config?.format === "claude") {
      return { ...XAPIKEY, anthropicVersion: true };
    }
    return BEARER;
  }

  buildHeaders(credentials, stream = true, url, model, body = null) {
    const rt = credentials?.runtimeTransport;
    const headers = { "Content-Type": "application/json", ...(rt ? rt.headers : this.config.headers) };
    const desc = rt?.auth || AUTH_DESCRIPTORS[this.provider] || this.resolveAuthDescriptor();
    // Hooks run BEFORE auth so dynamic overlays can't clobber the token.
    for (const hook of desc.hooks || []) HEADER_HOOKS[hook]?.(headers, credentials);
    applyAuth(headers, desc, credentials);

    // anthropic-compatible-* nodes serving a real Claude model sit in front of
    // Anthropic itself (a rotating multi-account proxy, a corporate gateway),
    // so the request needs the same beta flags the `claude` provider sends:
    // without `context-management-2025-06-27` upstream rejects the
    // `context_management` block Claude Code puts in every request with
    // "context_management: Extra inputs are not permitted" (HTTP 400), and the
    // combo silently falls through to the next model. The model id gates this:
    // a node fronting Kimi or GLM answers on its own ids and never matches, so
    // gateways that would choke on unknown beta flags are left untouched.
    const isClaudeModel = typeof model === "string" && /^claude-/.test(model);
    const clientBeta = credentials?.rawHeaders?.["anthropic-beta"];
    if (model && (this.provider === "claude"
      || (this.provider?.startsWith?.("anthropic-compatible-") && isClaudeModel))) {
      headers["Anthropic-Beta"] = mergeAnthropicBeta(selectAnthropicBeta(model, body), clientBeta);
    } else if (this.provider === "anthropic" && clientBeta) {
      headers["Anthropic-Beta"] = mergeAnthropicBeta(headers["Anthropic-Beta"], clientBeta);
    }

    // Claude OAuth: align x-claude-code-session-id with metadata.user_id.session_id if missing
    if (this.provider === "claude" && !headers["x-claude-code-session-id"]) {
      const token = credentials?.accessToken || credentials?.apiKey || "";
      if (token.includes("sk-ant-oat")) {
        const sid = extractClaudeSessionIdFromUserId(body?.metadata?.user_id);
        if (sid) headers["x-claude-code-session-id"] = sid;
      }
    }

    // Strip first-party Claude Code identity headers for non-Anthropic anthropic-compatible upstreams
    if (this.provider?.startsWith?.("anthropic-compatible-")) {
      const baseUrl = credentials?.providerSpecificData?.baseUrl || "";
      const isOfficialAnthropic = baseUrl === "" || baseUrl.includes("api.anthropic.com");
      if (!isOfficialAnthropic) {
        // Some third-party Anthropic-compatible gateways require Bearer auth in
        // addition to x-api-key. Send both (x-api-key already set above) so
        // gateways that read either header succeed.
        if (credentials.apiKey && !headers["Authorization"]) {
          headers["Authorization"] = `Bearer ${credentials.apiKey}`;
        }
        delete headers["anthropic-dangerous-direct-browser-access"];
        delete headers["Anthropic-Dangerous-Direct-Browser-Access"];
        delete headers["x-app"];
        delete headers["X-App"];
        // Strip claude-code-20250219 from Anthropic-Beta / anthropic-beta
        for (const betaKey of ["anthropic-beta", "Anthropic-Beta"]) {
          if (headers[betaKey]) {
            const filtered = headers[betaKey]
              .split(",")
              .map(s => s.trim())
              .filter(f => f && f !== "claude-code-20250219")
              .join(",");
            if (filtered) {
              headers[betaKey] = filtered;
            } else {
              delete headers[betaKey];
            }
          }
        }
      }
    }

    if (stream) headers["Accept"] = "text/event-stream";
    return headers;
  }

  // Generic OAuth refresh for the common {grant_type, refresh_token, client_id[, ...]} shape.
  // grant = REFRESH_GRANTS[provider]; client creds resolved from PROVIDERS or this.config.
  refreshFromGrant(credentials, proxyOptions) {
    const grant = REFRESH_GRANTS[this.provider];
    const params = { grant_type: "refresh_token", refresh_token: credentials.refreshToken, ...grant.params(this) };
    return grant.encoding === "json"
      ? this.refreshWithJSON(grant.url(), params, proxyOptions)
      : this.refreshWithForm(grant.url(), params, proxyOptions);
  }

  async refreshCredentials(credentials, log, proxyOptions = null) {
    if (!credentials.refreshToken) return null;

    const refreshers = {
      claude: () => this.refreshFromGrant(credentials, proxyOptions),
      codex: () => this.refreshFromGrant(credentials, proxyOptions),
      iflow: () => this.refreshIflow(credentials.refreshToken, proxyOptions),
      gemini: () => this.refreshFromGrant(credentials, proxyOptions),
      kiro: () => this.refreshKiro(credentials.refreshToken, proxyOptions),
      cline: () => this.refreshCline(credentials.refreshToken, proxyOptions),
      clinepass: () => this.refreshCline(credentials.refreshToken, proxyOptions),
      kimi: () => this.refreshKimi(credentials, proxyOptions),
      "kimi-coding": () => this.refreshKimi(credentials, proxyOptions),
      kilocode: () => this.refreshKilocode(credentials.refreshToken, proxyOptions)
    };

    const refresher = refreshers[this.provider];
    if (!refresher) return null;

    try {
      const result = await refresher();
      if (result) log?.info?.("TOKEN", `${this.provider} refreshed`);
      return result;
    } catch (error) {
      log?.error?.("TOKEN", `${this.provider} refresh error: ${error.message}`);
      return null;
    }
  }

  async refreshWithJSON(url, body, proxyOptions = null) {
    const response = await proxyAwareFetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify(body)
    }, proxyOptions);
    if (!response.ok) return null;
    const tokens = await response.json();
    return { accessToken: tokens.access_token, refreshToken: tokens.refresh_token || body.refresh_token, expiresIn: tokens.expires_in };
  }

  async refreshWithForm(url, params, proxyOptions = null) {
    const response = await proxyAwareFetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "Accept": "application/json" },
      body: new URLSearchParams(params)
    }, proxyOptions);
    if (!response.ok) return null;
    const tokens = await response.json();
    return { accessToken: tokens.access_token, refreshToken: tokens.refresh_token || params.refresh_token, expiresIn: tokens.expires_in };
  }

  async refreshIflow(refreshToken, proxyOptions = null) {
    const basicAuth = btoa(`${PROVIDERS.iflow.clientId}:${PROVIDERS.iflow.clientSecret}`);
    const response = await proxyAwareFetch(OAUTH_ENDPOINTS.iflow.token, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "Accept": "application/json", "Authorization": `Basic ${basicAuth}` },
      body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken, client_id: PROVIDERS.iflow.clientId, client_secret: PROVIDERS.iflow.clientSecret })
    }, proxyOptions);
    if (!response.ok) return null;
    const tokens = await response.json();
    return { accessToken: tokens.access_token, refreshToken: tokens.refresh_token || refreshToken, expiresIn: tokens.expires_in };
  }

  async refreshKiro(refreshToken, proxyOptions = null) {
    const response = await proxyAwareFetch(PROVIDERS.kiro.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json", "User-Agent": "kiro-cli/1.0.0" },
      body: JSON.stringify({ refreshToken })
    }, proxyOptions);
    if (!response.ok) return null;
    const tokens = await response.json();
    return { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken || refreshToken, expiresIn: tokens.expiresIn };
  }

  async refreshCline(refreshToken, proxyOptions = null) {
    const response = await proxyAwareFetch(PROVIDERS.cline.refreshUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({ refreshToken, grantType: "refresh_token", clientType: "extension" })
    }, proxyOptions);
    if (!response.ok) return null;
    const payload = await response.json();
    const data = payload?.data || payload;
    const expiresAtIso = data?.expiresAt;
    const expiresIn = expiresAtIso ? Math.max(1, Math.floor((new Date(expiresAtIso).getTime() - Date.now()) / 1000)) : undefined;
    let accessToken = data?.accessToken;
    if (accessToken && !accessToken.startsWith("workos:")) {
      accessToken = `workos:${accessToken}`;
    }
    return { accessToken, refreshToken: data?.refreshToken || refreshToken, expiresIn };
  }

  // CLIProxyAPI DeviceFlowClient.RefreshToken — form body + X-Msh-* headers + stable device_id
  async refreshKimi(credentials, proxyOptions = null) {
    const refreshToken = credentials.refreshToken;
    const cfg = PROVIDERS.kimi || PROVIDERS["kimi-coding"];
    if (!cfg?.refreshUrl || !cfg?.clientId) return null;
    const kimiHeaders = buildKimiHeaders(credentials?.providerSpecificData?.deviceId);
    const response = await proxyAwareFetch(cfg.refreshUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json",
        ...kimiHeaders
      },
      body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken, client_id: cfg.clientId })
    }, proxyOptions);
    if (!response.ok) return null;
    const tokens = await response.json();
    return { accessToken: tokens.access_token, refreshToken: tokens.refresh_token || refreshToken, expiresIn: tokens.expires_in };
  }

  async refreshKilocode(refreshToken, proxyOptions = null) {
    // Kilocode uses device code flow, no refresh token support
    return null;
  }
}

export default DefaultExecutor;
