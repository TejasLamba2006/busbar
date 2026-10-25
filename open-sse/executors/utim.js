import { DefaultExecutor } from "./default.js";

// api.utim.dev/api/playground/chat is OpenAI-compatible (stream + JSON + native tools), keyless;
// an optional utim-... key is forwarded. Only job: never send "Bearer undefined".
export class UtimExecutor extends DefaultExecutor {
  constructor() {
    super("utim");
  }

  buildHeaders(credentials, stream = true, ...rest) {
    const headers = super.buildHeaders(credentials, stream, ...rest);
    const key = credentials?.apiKey || credentials?.accessToken;
    if (key) headers["X-API-Key"] = key;
    else delete headers.Authorization;
    return headers;
  }
}
