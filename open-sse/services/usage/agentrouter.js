import { proxyAwareFetch } from "../../utils/proxyFetch.js";

const BALANCE_URL = "https://agentrouter.org/api/user/self";
const QUOTA_PER_USD = 500_000;

export async function getAgentrouterUsage(providerSpecificData = {}, proxyOptions = null) {
  const systemToken = providerSpecificData?.agentrouterSystemAccessToken?.trim();
  const userId = providerSpecificData?.agentrouterUserId?.trim();

  if (!systemToken || !userId) {
    return {
      message: "AgentRouter System Access Token and New-API User ID are required to view usage.",
    };
  }

  try {
    const response = await proxyAwareFetch(
      BALANCE_URL,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${systemToken}`,
          "New-Api-User": userId,
          Accept: "application/json",
        },
      },
      proxyOptions,
    );

    if (response.status === 401 || response.status === 403) {
      return { plan: "AgentRouter", message: "AgentRouter authentication failed. Check the System Access Token and New-API User ID." };
    }

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      return {
        plan: "AgentRouter",
        message: `AgentRouter balance API error (${response.status})${detail ? `: ${detail.slice(0, 120)}` : ""}`,
      };
    }

    const data = await response.json().catch(() => null);
    const rawQuota = Number(data?.data?.quota ?? data?.quota);
    if (!Number.isFinite(rawQuota) || rawQuota < 0) {
      return { plan: "AgentRouter", message: "AgentRouter quota response was invalid." };
    }

    const balance = rawQuota / QUOTA_PER_USD;
    return {
      plan: "AgentRouter",
      quotas: {
        "Wallet Balance (USD)": {
          used: 0,
          total: balance,
          remainingPercentage: balance > 0 ? 100 : 0,
          resetAt: null,
          isCreditBalance: true,
          currency: "USD",
        },
      },
    };
  } catch (error) {
    return { message: `AgentRouter error: ${error.message}` };
  }
}
