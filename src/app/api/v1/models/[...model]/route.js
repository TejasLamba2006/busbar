import { buildModelsList } from "../route.js";
import { getKeyAccessContext, filterModelsListForKey, enforceEndpointAccess } from "@/sse/services/keyAccess.js";

// URL slug → service kind(s). `web` covers both webSearch and webFetch.
const KIND_SLUG_MAP = {
  "image": ["image"],
  "video": ["video"],
  "tts": ["tts"],
  "stt": ["stt"],
  "embedding": ["embedding"],
  "image-to-text": ["imageToText"],
  "web": ["webSearch", "webFetch"],
  "systemone": ["systemone"],
  "music": ["music"],
};

const ALL_LOOKUP_KINDS = [
  "llm",
  "image",
  "video",
  "tts",
  "stt",
  "embedding",
  "imageToText",
  "webSearch",
  "webFetch",
  "systemone",
  "music",
];

export async function OPTIONS() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "*",
    },
  });
}

function json(data, options = {}) {
  return Response.json(data, {
    ...options,
    headers: {
      "Access-Control-Allow-Origin": "*",
      ...options.headers,
    },
  });
}

/**
 * GET /v1/models/{kind} - OpenAI-compatible models list filtered by capability.
 * GET /v1/models/{provider}/{model} - OpenAI-compatible single model lookup.
 * Supported kinds: image, video, tts, stt, embedding, image-to-text, web.
 */
export async function GET(request, { params }) {
  try {
    const { model } = await params;
    const path = Array.isArray(model) ? model : [model];
    const identifier = path.filter(Boolean).join("/");
    const kindFilter = path.length === 1 ? KIND_SLUG_MAP[identifier] : null;
    const keyAccess = await getKeyAccessContext(request);
    const endpointDenied = enforceEndpointAccess(keyAccess);
    if (endpointDenied) return endpointDenied;

    if (kindFilter) {
      const data = await filterModelsListForKey(keyAccess, await buildModelsList(kindFilter));
      return json({ object: "list", data });
    }

    // Match the catalog exposed by GET /v1/models (first check LLM, then fall back to media kinds).
    const models = await filterModelsListForKey(keyAccess, await buildModelsList(["llm"]));
    let matchedModel = models.find((candidate) => candidate.id === identifier);
    if (!matchedModel) {
      const mediaModels = await filterModelsListForKey(keyAccess, await buildModelsList(ALL_LOOKUP_KINDS));
      matchedModel = (mediaModels || []).find((candidate) => candidate.id === identifier);
    }

    if (!matchedModel) {
      return json(
        {
          error: {
            message: `The model '${identifier}' does not exist or you do not have access to it.`,
            type: "invalid_request_error",
            code: "model_not_found",
          },
        },
        { status: 404 },
      );
    }

    return json(matchedModel);
  } catch (error) {
    console.log("Error fetching model:", error);
    return json(
      { error: { message: error.message, type: "server_error" } },
      { status: 500 },
    );
  }
}
