import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../open-sse/utils/proxyFetch.js", () => ({
  proxyAwareFetch: vi.fn(),
}));

import { proxyAwareFetch } from "../../open-sse/utils/proxyFetch.js";
import { getUsageForProvider } from "../../open-sse/services/usage.js";
import {
  USAGE_SUPPORTED_PROVIDERS,
  USAGE_APIKEY_PROVIDERS,
} from "../../src/shared/constants/providers.js";
import { parseQuotaData } from "../../src/app/(dashboard)/dashboard/usage/components/ProviderLimits/utils.js";

const BALANCE_URL = "https://agentrouter.org/api/user/self";

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const CONNECTION = {
  provider: "agentrouter",
  apiKey: "routing-key",
  providerSpecificData: {
    agentrouterSystemAccessToken: "system-token",
    agentrouterUserId: "42",
  },
};

describe("agentrouter registry usage flags", () => {
  it("is listed for API-key quota dashboard", () => {
    expect(USAGE_SUPPORTED_PROVIDERS).toContain("agentrouter");
    expect(USAGE_APIKEY_PROVIDERS).toContain("agentrouter");
  });
});

describe("getUsageForProvider(agentrouter)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires the System Access Token and New-API User ID", async () => {
    const missing = await getUsageForProvider({
      provider: "agentrouter",
      apiKey: "routing-key",
    });

    expect(missing.message).toMatch(/system access token/i);
    expect(missing.message).toMatch(/user id/i);
    expect(proxyAwareFetch).not.toHaveBeenCalled();
  });

  it("fetches wallet quota with console credentials and converts units to USD", async () => {
    proxyAwareFetch.mockResolvedValueOnce(jsonResponse({ data: { quota: 250_000 } }));

    const usage = await getUsageForProvider(CONNECTION);

    expect(proxyAwareFetch).toHaveBeenCalledTimes(1);
    const [url, options] = proxyAwareFetch.mock.calls[0];
    expect(url).toBe(BALANCE_URL);
    expect(options).toMatchObject({
      method: "GET",
      headers: {
        Authorization: "Bearer system-token",
        "New-Api-User": "42",
        Accept: "application/json",
      },
    });
    expect(usage).toMatchObject({
      plan: "AgentRouter",
      quotas: {
        "Wallet Balance (USD)": {
          used: 0,
          total: 0.5,
          remainingPercentage: 100,
          resetAt: null,
          isCreditBalance: true,
          currency: "USD",
        },
      },
    });
  });

  it("reports an exhausted wallet as zero balance", async () => {
    proxyAwareFetch.mockResolvedValueOnce(jsonResponse({ data: { quota: 0 } }));

    const usage = await getUsageForProvider(CONNECTION);

    expect(usage.quotas["Wallet Balance (USD)"]).toMatchObject({
      total: 0,
      remainingPercentage: 0,
    });
  });

  it("returns clear messages for authentication and malformed quota responses", async () => {
    proxyAwareFetch.mockResolvedValueOnce(jsonResponse({ error: "unauthorized" }, 401));
    const auth = await getUsageForProvider(CONNECTION);
    expect(auth.message).toMatch(/authentication|token/i);

    proxyAwareFetch.mockResolvedValueOnce(jsonResponse({ data: { quota: -1 } }));
    const malformed = await getUsageForProvider(CONNECTION);
    expect(malformed.message).toMatch(/quota response/i);

    proxyAwareFetch.mockResolvedValueOnce(jsonResponse({ data: { quota: null } }));
    const missing = await getUsageForProvider(CONNECTION);
    expect(missing.message).toMatch(/quota response/i);
  });
});

describe("parseQuotaData(agentrouter)", () => {
  it("preserves AgentRouter wallet balance as a USD credit row", () => {
    const rows = parseQuotaData("agentrouter", {
      plan: "AgentRouter",
      quotas: {
        "Wallet Balance (USD)": {
          used: 0,
          total: 0.5,
          remainingPercentage: 100,
          resetAt: null,
          isCreditBalance: true,
          currency: "USD",
        },
      },
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      name: "Wallet Balance (USD)",
      total: 0.5,
      remainingPercentage: 100,
      isCreditBalance: true,
      currency: "USD",
    });
  });
});
