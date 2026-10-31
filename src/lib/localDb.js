// Shim → re-export from new SQLite-based DB layer (src/lib/db/)
// Kept for backward compatibility with existing imports.
export {
  getSettings, updateSettings, isCloudEnabled, getCloudUrl,
  getProviderConnections, getProviderConnectionById,
  createProviderConnection, updateProviderConnection,
  deleteProviderConnection, deleteProviderConnectionsByProvider,
  reorderProviderConnections, cleanupProviderConnections,
  getProviderNodes, getProviderNodeById,
  createProviderNode, updateProviderNode, deleteProviderNode,
  getProxyPools, getProxyPoolById,
  createProxyPool, updateProxyPool, deleteProxyPool,
  getApiKeys, getApiKeyById, getApiKeyByKey, createApiKey, updateApiKey, deleteApiKey, validateApiKey, authenticateClientKey,
  getCombos, getComboById, getComboByName,
  createCombo, updateCombo, deleteCombo,
  getModelAliases, setModelAlias, deleteModelAlias,
  getCustomModels, addCustomModel, upsertCustomModels, deleteCustomModel,
  getMitmAlias, setMitmAliasAll,
  getPricing, getManualPricing, getPricingForModel, getPricingForModelWithSource, getPricingForModelsWithSource, updatePricing, resetPricing, resetAllPricing,
  upsertModelCapabilityEvidence, getModelCapabilityEvidence, deleteModelCapabilityEvidence,
  exportDb, importDb,
} from "@/lib/db/index.js";
