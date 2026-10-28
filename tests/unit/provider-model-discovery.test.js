import { describe, expect, it } from "vitest";
import REGISTRY from "open-sse/providers/registry/index.js";
import { PROVIDER_MODEL_DISCOVERY } from "open-sse/providers/index.js";
import { AI_PROVIDERS } from "../../src/shared/constants/providers.js";
import {
  showsModelCatalog,
  showsModelRefresh,
} from "../../src/shared/utils/providerModelDiscovery.js";
import { supportsProviderModelListing } from "../../src/app/api/providers/[id]/models/route.js";

const byId = Object.fromEntries(REGISTRY.map((provider) => [provider.id, provider]));

const REFRESHABLE = [
  "antigravity", "claude", "cline", "clinepass", "gemini", "tokenrouter",
  "openrouter", "nvidia", "kilocode", "groq", "openai", "qoder", "qoder-cn",
  "vertex",
];

const STATIC_OR_NON_LLM = ["cloudflare-ai", "exa", "firecrawl"];

describe("provider model discovery metadata", () => {
  it("marks verified refresh and live providers in the registry", () => {
    for (const id of REFRESHABLE) {
      expect(byId[id]?.modelDiscovery, id).toBe("refresh");
      expect(PROVIDER_MODEL_DISCOVERY[id], id).toBe("refresh");
      expect(AI_PROVIDERS[id]?.modelDiscovery, id).toBe("refresh");
    }
    expect(PROVIDER_MODEL_DISCOVERY.cursor).toBe("live");
    expect(PROVIDER_MODEL_DISCOVERY.zed).toBe("live");
    for (const id of STATIC_OR_NON_LLM) {
      expect(PROVIDER_MODEL_DISCOVERY[id], id).toBeUndefined();
    }
  });

  it("gates provider model UI from registry metadata", () => {
    expect(showsModelCatalog(AI_PROVIDERS.exa)).toBe(false);
    expect(showsModelCatalog(AI_PROVIDERS.firecrawl)).toBe(false);
    expect(showsModelCatalog(AI_PROVIDERS.claude)).toBe(true);
    expect(showsModelCatalog(AI_PROVIDERS.elevenlabs)).toBe(true);
    expect(showsModelCatalog(AI_PROVIDERS.typesafe)).toBe(true);
    expect(showsModelRefresh(AI_PROVIDERS.vertex, true)).toBe(true);
    expect(showsModelRefresh(AI_PROVIDERS.vertex, false)).toBe(false);
    expect(showsModelRefresh(AI_PROVIDERS["cloudflare-ai"], true)).toBe(false);
    expect(showsModelRefresh(AI_PROVIDERS.zed, true)).toBe(false);
  });

  it("keeps registry refresh declarations aligned with route support", () => {
    for (const id of REFRESHABLE) expect(supportsProviderModelListing(id), id).toBe(true);
  });
});
