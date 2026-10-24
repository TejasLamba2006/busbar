// Per-API-key access control: shared constants. Used by the engine
// (src/sse/services/keyAccess.js), the DB repo, the /api/keys routes and the
// Endpoint page.

// Upper bounds for one key's allow list. The API rejects input beyond these
// (400) rather than truncating it, so a declared list is never silently cut.
export const KEY_ACCESS_MAX_ENTRIES = 200;
export const KEY_ACCESS_MAX_ENTRY_LENGTH = 256;

// Every key — new, migrated, or restored from a backup without the field — is
// unrestricted unless explicitly switched to restricted.
export const KEY_ACCESS_UNRESTRICTED = Object.freeze({ restricted: false, allow: Object.freeze([]) });

// /v1/models entry kinds whose "model" is the provider itself (search/fetch).
export const KEY_ACCESS_PROVIDER_AS_MODEL_KINDS = Object.freeze(["webSearch", "webFetch"]);

// /v1/models owner tag for combo entries.
export const KEY_ACCESS_COMBO_OWNER = "combo";

// Client-facing 403 message. Names only what the client itself sent: never the
// key name or the key's allow list.
export function keyAccessDeniedMessage(requested) {
  return `This API key is not allowed to use model "${requested}"`;
}

// Per-key endpoint gating. Scope id -> label + path prefixes (pathname equals
// the prefix or continues under it). A key's allowedEndpoints may hold scope
// ids or raw "/v1/..." path prefixes. Empty list = every endpoint allowed.
export const ENDPOINT_SCOPES = Object.freeze({
  chat: { label: "Chat Completions (/v1/chat/completions)", paths: ["/v1/chat/completions", "/v1/api/chat"] },
  messages: { label: "Claude Messages (/v1/messages)", paths: ["/v1/messages"] },
  responses: { label: "OpenAI Responses (/v1/responses)", paths: ["/v1/responses"] },
  models: { label: "Models List (/v1/models)", paths: ["/v1/models"] },
  embeddings: { label: "Embeddings (/v1/embeddings)", paths: ["/v1/embeddings"] },
  images: { label: "Image Generation (/v1/images/*)", paths: ["/v1/images"] },
  audio_speech: { label: "Text-to-Speech (/v1/audio/speech)", paths: ["/v1/audio/speech", "/v1/audio/voices"] },
  audio_transcriptions: { label: "Speech-to-Text (/v1/audio/transcriptions)", paths: ["/v1/audio/transcriptions"] },
  search: { label: "Web Search (/v1/search)", paths: ["/v1/search", "/v1/web/search"] },
  fetch: { label: "Web Fetch (/v1/web/fetch)", paths: ["/v1/web/fetch"] },
  rerank: { label: "Rerank (/v1/rerank)", paths: ["/v1/rerank"] },
  systemone: { label: "SystemOne (/v1/systemone)", paths: ["/v1/systemone"] },
  videos: { label: "Video Generation (/v1/videos/*)", paths: ["/v1/videos"] },
  gemini: { label: "Gemini Native (/v1beta/*)", paths: ["/v1beta"] },
});

export const ENDPOINT_MAX_ENTRIES = 50;

export function endpointDeniedMessage(pathname) {
  return `API key is not authorized for endpoint ${pathname}`;
}
