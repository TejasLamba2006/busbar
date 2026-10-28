import { getModelsByProviderId } from "@/shared/constants/models";

const NO_MODEL_CATALOG_KINDS = new Set(["webSearch", "webFetch"]);

export function showsModelCatalog(providerInfo, isCompatible = false) {
  if (isCompatible) return true;
  const kinds = providerInfo?.serviceKinds ?? ["llm"];
  if (kinds.includes("llm")) return true;
  if (kinds.some((k) => !NO_MODEL_CATALOG_KINDS.has(k))) return true;
  return !!(providerInfo?.id && getModelsByProviderId(providerInfo.id).length > 0);
}

export function showsModelRefresh(providerInfo, hasActiveConnection) {
  return providerInfo?.modelDiscovery === "refresh" && hasActiveConnection;
}
