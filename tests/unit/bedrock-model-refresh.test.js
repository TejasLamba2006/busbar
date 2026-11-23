import { describe, expect, it, vi } from "vitest";
import { listBedrockInferenceProfiles } from "../../open-sse/executors/bedrock.js";
import { AI_PROVIDERS } from "../../src/shared/constants/providers.js";
import { showsModelRefresh } from "../../src/shared/utils/providerModelDiscovery.js";
import { supportsProviderModelListing } from "../../src/app/api/providers/[id]/models/route.js";

const jsonResponse = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const BEARER_CREDS = {
  apiKey: "ABSK-test-placeholder-token-0000",
  providerSpecificData: { region: "us-east-1" },
};

const STATIC_CREDS = {
  apiKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
  providerSpecificData: {
    accessKeyId: "AKIAEXAMPLE123456789",
    region: "us-west-2",
  },
};

describe("listBedrockInferenceProfiles", () => {
  it("lists active Anthropic profiles for bedrock with Bearer auth and follows nextToken pagination", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          inferenceProfileSummaries: [
            {
              inferenceProfileId: "global.anthropic.claude-sonnet-4-6",
              inferenceProfileName: "Global Claude Sonnet 4.6",
              status: "ACTIVE",
            },
            {
              inferenceProfileId: "us.anthropic.claude-3-haiku-20240307-v1:0",
              inferenceProfileName: "Inactive Claude",
              status: "INACTIVE",
            },
            {
              inferenceProfileId: "us.xai.grok-4.6",
              inferenceProfileName: "US Grok 4.6",
              status: "ACTIVE",
            },
            {
              inferenceProfileId: "us.openai.gpt-oss-120b-1:0",
              inferenceProfileName: "OpenAI OSS",
              status: "ACTIVE",
            },
            {
              inferenceProfileId: "cohere.command-r-plus-v1:0",
              inferenceProfileName: "Cohere Command R+",
              status: "ACTIVE",
            },
          ],
          nextToken: "page+2/token=",
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          inferenceProfileSummaries: [
            {
              inferenceProfileId: "global.anthropic.claude-sonnet-4-6",
              inferenceProfileName: "Duplicate Should Be Dropped",
              status: "ACTIVE",
            },
            {
              inferenceProfileId: "us.anthropic.claude-opus-4-6-v1",
              status: "ACTIVE",
            },
          ],
        }),
      );

    const result = await listBedrockInferenceProfiles(BEARER_CREDS, fetchFn, {
      providerId: "bedrock",
    });

    expect(result).toEqual({
      models: [
        {
          id: "global.anthropic.claude-sonnet-4-6",
          name: "Global Claude Sonnet 4.6",
        },
        {
          id: "us.anthropic.claude-opus-4-6-v1",
          name: "us.anthropic.claude-opus-4-6-v1",
        },
      ],
    });

    expect(fetchFn).toHaveBeenCalledTimes(2);
    const [url1, init1] = fetchFn.mock.calls[0];
    const [url2, init2] = fetchFn.mock.calls[1];
    expect(url1).toBe(
      "https://bedrock.us-east-1.amazonaws.com/inference-profiles?maxResults=100",
    );
    expect(url2).toBe(
      "https://bedrock.us-east-1.amazonaws.com/inference-profiles?maxResults=100&nextToken=page%2B2%2Ftoken%3D",
    );
    expect(init1.method).toBe("GET");
    expect(init1.redirect).toBe("error");
    expect(init1.headers.Authorization).toBe(`Bearer ${BEARER_CREDS.apiKey}`);
    expect(init2.headers.Authorization).toBe(`Bearer ${BEARER_CREDS.apiKey}`);
  });

  it("filters bedrock-xai to active xai, openai, moonshotai, and zai profiles only", async () => {
    const fetchFn = vi.fn().mockResolvedValueOnce(
      jsonResponse({
        inferenceProfileSummaries: [
          {
            inferenceProfileId: "us.xai.grok-4.6",
            inferenceProfileName: "Grok 4.6",
            status: "ACTIVE",
          },
          {
            inferenceProfileId: "us.openai.gpt-oss-120b-1:0",
            inferenceProfileName: "GPT OSS 120B",
            status: "ACTIVE",
          },
          {
            inferenceProfileId: "global.moonshotai.kimi-k3",
            inferenceProfileName: "Kimi K3",
            status: "ACTIVE",
          },
          {
            inferenceProfileId: "global.zai.glm-4.5",
            inferenceProfileName: "GLM 4.5",
            status: "ACTIVE",
          },
          {
            inferenceProfileId: "us.xai.grok-retired",
            inferenceProfileName: "Retired Grok",
            status: "INACTIVE",
          },
          {
            inferenceProfileId: "global.anthropic.claude-sonnet-4-6",
            inferenceProfileName: "Claude Sonnet 4.6",
            status: "ACTIVE",
          },
          {
            inferenceProfileId: "cohere.command-r-plus-v1:0",
            inferenceProfileName: "Cohere",
            status: "ACTIVE",
          },
        ],
      }),
    );

    const result = await listBedrockInferenceProfiles(BEARER_CREDS, fetchFn, {
      providerId: "bedrock-xai",
    });

    expect(result).toEqual({
      models: [
        { id: "us.xai.grok-4.6", name: "Grok 4.6" },
        { id: "us.openai.gpt-oss-120b-1:0", name: "GPT OSS 120B" },
        { id: "global.moonshotai.kimi-k3", name: "Kimi K3" },
        { id: "global.zai.glm-4.5", name: "GLM 4.5" },
      ],
    });
  });

  it("signs GET /inference-profiles with SigV4 when using static credentials", async () => {
    const fetchFn = vi.fn().mockResolvedValueOnce(
      jsonResponse({
        inferenceProfileSummaries: [
          {
            inferenceProfileId: "us.anthropic.claude-sonnet-4-6",
            inferenceProfileName: "Claude Sonnet 4.6",
            status: "ACTIVE",
          },
        ],
      }),
    );

    const result = await listBedrockInferenceProfiles(STATIC_CREDS, fetchFn, {
      providerId: "bedrock",
    });

    expect(result).toEqual({
      models: [
        { id: "us.anthropic.claude-sonnet-4-6", name: "Claude Sonnet 4.6" },
      ],
    });

    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe(
      "https://bedrock.us-west-2.amazonaws.com/inference-profiles?maxResults=100",
    );
    expect(init.redirect).toBe("error");
    expect(init.headers.Authorization).toMatch(
      /^AWS4-HMAC-SHA256 Credential=AKIAEXAMPLE123456789\/\d{8}\/us-west-2\/bedrock\/aws4_request, SignedHeaders=.*Signature=[0-9a-f]{64}$/,
    );
  });

  it("returns 400 on invalid credentials without calling fetch", async () => {
    const fetchFn = vi.fn();
    const result = await listBedrockInferenceProfiles(
      { apiKey: "secret-only", providerSpecificData: {} },
      fetchFn,
    );

    expect(result.status).toBe(400);
    expect(result.error).toMatch(/static credentials are incomplete/);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("propagates non-OK HTTP status errors", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ message: "Forbidden" }, 403));

    const result = await listBedrockInferenceProfiles(BEARER_CREDS, fetchFn, {
      providerId: "bedrock",
    });

    expect(result).toEqual({
      error: "Failed to fetch Bedrock inference profiles: 403",
      status: 403,
    });
  });
});

describe("bedrock model refresh UI and route wiring", () => {
  it("enables Refresh Models in UI metadata and route listing for bedrock and bedrock-xai", () => {
    expect(showsModelRefresh(AI_PROVIDERS.bedrock, true)).toBe(true);
    expect(showsModelRefresh(AI_PROVIDERS["bedrock-xai"], true)).toBe(true);
    expect(supportsProviderModelListing("bedrock")).toBe(true);
    expect(supportsProviderModelListing("bedrock-xai")).toBe(true);
  });
});
