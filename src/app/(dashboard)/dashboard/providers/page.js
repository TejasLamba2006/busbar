"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import PropTypes from "prop-types";
import {
  Card,
  CardSkeleton,
  Badge,
  Button,
  Toggle,
} from "@/shared/components";
import ProviderIcon from "@/shared/components/ProviderIcon";
import { getProviderIconSrc } from "@/shared/utils/providerIcon";
import { OAUTH_PROVIDERS, APIKEY_PROVIDERS } from "@/shared/constants/config";
import { PROVIDER_MODELS } from "@/shared/constants/models";
import {
  FREE_PROVIDERS,
  FREE_TIER_PROVIDERS,
  WEB_COOKIE_PROVIDERS,
  OPENAI_COMPATIBLE_PREFIX,
  ANTHROPIC_COMPATIBLE_PREFIX,
} from "@/shared/constants/providers";
import Link from "next/link";
import { getErrorCode, getRelativeTime } from "@/shared/utils";
import { useNotificationStore } from "@/store/notificationStore";
import { useHeaderSearchStore } from "@/store/headerSearchStore";
import ModelAvailabilityBadge from "./components/ModelAvailabilityBadge";
import AddCompatibleModal from "./components/AddCompatibleModal";
import ProviderSummaryCard from "./components/ProviderSummaryCard";
import { matchesStatusFilter } from "./utils";
import {
  CATEGORY_FILTERS,
  DISPLAY_MODE_STORAGE_KEY,
  SECTION_ORDER,
  SECTION_TITLES,
  buildFilterSearch,
  buildModelIndex,
  findModelMatches,
  getProviderCategories,
  getSectionId,
  isConfigured,
  matchesCategory,
  matchesMedia,
  matchesSearch,
  normalizeDisplayMode,
  readFilterParams,
} from "./providerFiltering";

const providerIdFromAssignment = (assignment) => String(assignment || "").split("/", 1)[0];

export function filterClientProviderEntries(entries, connections, isClientSession, assignedModels) {
  if (!isClientSession || !assignedModels?.length) return entries;
  const allowed = new Set(assignedModels.map(providerIdFromAssignment));
  for (const connection of connections) allowed.add(connection.provider);
  return entries.filter((entry) => allowed.has(entry.key) || allowed.has(entry.info?.alias));
}

function getStatusDisplay(connected, error, errorCode) {
  const parts = [];
  if (connected > 0) {
    parts.push(
      <Badge key="connected" variant="success" size="sm" dot>
        {connected} Connected
      </Badge>,
    );
  }
  if (error > 0) {
    const errText = errorCode
      ? `${error} Error (${errorCode})`
      : `${error} Error`;
    parts.push(
      <Badge key="error" variant="error" size="sm" dot>
        {errText}
      </Badge>,
    );
  }
  if (parts.length === 0) {
    return <span className="text-text-muted">No connections</span>;
  }
  return parts;
}

function getConnectionErrorTag(connection) {
  if (!connection) return null;

  const explicitType = connection.lastErrorType;
  if (explicitType === "runtime_error") return "RUNTIME";
  if (
    explicitType === "upstream_auth_error" ||
    explicitType === "auth_missing" ||
    explicitType === "token_refresh_failed" ||
    explicitType === "token_expired"
  )
    return "AUTH";
  if (explicitType === "upstream_rate_limited") return "429";
  if (explicitType === "upstream_unavailable") return "5XX";
  if (explicitType === "network_error") return "NET";

  const numericCode = Number(connection.errorCode);
  if (Number.isFinite(numericCode) && numericCode >= 400)
    return String(numericCode);

  const fromMessage = getErrorCode(connection.lastError);
  if (fromMessage === "401" || fromMessage === "403") return "AUTH";
  if (fromMessage && fromMessage !== "ERR") return fromMessage;

  const msg = (connection.lastError || "").toLowerCase();
  if (
    msg.includes("runtime") ||
    msg.includes("not runnable") ||
    msg.includes("not installed")
  )
    return "RUNTIME";
  if (
    msg.includes("invalid api key") ||
    msg.includes("token invalid") ||
    msg.includes("revoked") ||
    msg.includes("unauthorized")
  )
    return "AUTH";

  return "ERR";
}

const APIKEY_INITIAL_VISIBLE = 20;
const GRID = "grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4";
const COMPACT_GRID = "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4";

// Dual-auth providers (oauth + apikey) store API keys as authType "apikey"
// (and sometimes "api_key"). Card stats must count both so totals match detail.
// kiro has no authModes in registry but accepts both (headless uses "api_key").
const dualAuthTypes = (info, key) => {
  if (key === "kiro") return ["oauth", "apikey", "api_key"];
  const modes = info?.authModes;
  if (!Array.isArray(modes)) {
    return key in FREE_TIER_PROVIDERS || key in APIKEY_PROVIDERS
      ? ["oauth", "apikey", "api_key"]
      : "oauth";
  }
  if (!modes.includes("apikey")) return "oauth";
  return ["oauth", "apikey", "api_key"];
};

export default function ProvidersPage() {
  const [connections, setConnections] = useState([]);
  const [isClientSession, setIsClientSession] = useState(false);
  const [assignedModels, setAssignedModels] = useState([]);
  const [providerNodes, setProviderNodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAllApikey, setShowAllApikey] = useState(false);
  const [showAddCompatibleModal, setShowAddCompatibleModal] = useState(false);
  const [showAddAnthropicCompatibleModal, setShowAddAnthropicCompatibleModal] =
    useState(false);
  const [testingMode, setTestingMode] = useState(null);
  const [testResults, setTestResults] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [modelQuery, setModelQuery] = useState("");
  const [displayMode, setDisplayMode] = useState("all");
  const [category, setCategory] = useState("all");
  const [media, setMedia] = useState("");
  const [urlReady, setUrlReady] = useState(false);
  const notify = useNotificationStore();
  const searchQuery = useHeaderSearchStore((s) => s.query);
  const setSearchQuery = useHeaderSearchStore((s) => s.setQuery);
  const registerSearch = useHeaderSearchStore((s) => s.register);
  const unregisterSearch = useHeaderSearchStore((s) => s.unregister);

  // Register header search, then hydrate filters from URL (?search ?model ?mode ?cat ?media)
  // and localStorage (display mode, used when URL has no ?mode=).
  useEffect(() => {
    registerSearch("Search providers...");
    /* eslint-disable react-hooks/set-state-in-effect -- one-time hydration from URL/localStorage (not available during SSR) */
    const p = readFilterParams(window.location.search);
    if (p.search) setSearchQuery(p.search);
    setModelQuery(p.model);
    setCategory(p.cat);
    setMedia(p.media);
    let mode = p.mode;
    if (!mode) {
      try {
        mode = normalizeDisplayMode(localStorage.getItem(DISPLAY_MODE_STORAGE_KEY));
      } catch {
        mode = "all";
      }
    }
    setDisplayMode(mode);
    setUrlReady(true);
    /* eslint-enable react-hooks/set-state-in-effect */
    return () => unregisterSearch();
  }, [registerSearch, unregisterSearch, setSearchQuery]);

  // Mirror filters to the URL without a navigation.
  useEffect(() => {
    if (!urlReady) return;
    const next = buildFilterSearch({
      search: searchQuery,
      model: modelQuery,
      mode: displayMode,
      cat: category,
      media,
    });
    if (next !== window.location.search) {
      window.history.replaceState(null, "", `${window.location.pathname}${next}`);
    }
  }, [urlReady, searchQuery, modelQuery, displayMode, category, media]);

  const changeDisplayMode = (mode) => {
    setDisplayMode(mode);
    try {
      localStorage.setItem(DISPLAY_MODE_STORAGE_KEY, mode);
    } catch {}
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [connectionsRes, nodesRes] = await Promise.all([
          fetch("/api/providers"),
          fetch("/api/provider-nodes"),
        ]);
        const connectionsData = await connectionsRes.json();
        const nodesData = await nodesRes.json();
        if (connectionsRes.ok) {
          setConnections(connectionsData.connections || []);
          setIsClientSession(connectionsData.isClientSession === true);
          setAssignedModels(connectionsData.assignedModels || []);
        }
        if (nodesRes.ok) setProviderNodes(nodesData.nodes || []);
      } catch (error) {
        console.log("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Model index for "Search by Model": static registry + live /v1/models + custom models.
  // Live/custom are fetched lazily, once, the first time a model query is typed.
  const liveRequested = useRef(false);
  const [live, setLive] = useState({ liveIds: [], custom: [] });
  useEffect(() => {
    if (!modelQuery.trim() || liveRequested.current) return;
    liveRequested.current = true;
    Promise.allSettled([
      fetch("/api/v1/models").then((r) => r.json()),
      fetch("/api/models/custom").then((r) => r.json()),
    ]).then(([m, c]) =>
      setLive({
        liveIds: m.status === "fulfilled" ? (m.value?.data || []).map((x) => x.id) : [],
        custom: c.status === "fulfilled" ? c.value?.models || [] : [],
      }),
    );
  }, [modelQuery]);
  const modelIndex = useMemo(
    () => buildModelIndex({ staticModels: PROVIDER_MODELS, ...live }),
    [live],
  );

  const getProviderStats = (providerId, authType) => {
    const authTypes = Array.isArray(authType) ? authType : [authType];
    const providerConnections = connections.filter(
      (c) => c.provider === providerId && authTypes.includes(c.authType),
    );

    const getEffectiveStatus = (conn) => {
      const isCooldown = Object.entries(conn).some(
        ([k, v]) =>
          k.startsWith("modelLock_") && v && new Date(v).getTime() > Date.now(),
      );
      return conn.testStatus === "unavailable" && !isCooldown
        ? "active"
        : conn.testStatus;
    };

    const connected = providerConnections.filter((c) => {
      const status = getEffectiveStatus(c);
      return status === "active" || status === "success";
    }).length;

    const errorConns = providerConnections.filter((c) => {
      const status = getEffectiveStatus(c);
      return (
        status === "error" || status === "expired" || status === "unavailable"
      );
    });

    const error = errorConns.length;
    const total = providerConnections.length;
    const allDisabled =
      total > 0 && providerConnections.every((c) => c.isActive === false);

    const latestError = errorConns.sort(
      (a, b) => new Date(b.lastErrorAt || 0) - new Date(a.lastErrorAt || 0),
    )[0];
    const errorCode = latestError ? getConnectionErrorTag(latestError) : null;
    const errorTime = latestError?.lastErrorAt
      ? getRelativeTime(latestError.lastErrorAt)
      : null;

    return { connected, error, total, errorCode, errorTime, allDisabled };
  };

  // Toggle all connections for a provider on/off. authType may be a single
  // string or an array (kiro counts oauth + api_key/apikey together).
  const handleToggleProvider = async (providerId, authType, newActive) => {
    const authTypes = Array.isArray(authType) ? authType : [authType];
    const matches = (c) =>
      c.provider === providerId && authTypes.includes(c.authType);
    const providerConns = connections.filter(matches);
    setConnections((prev) =>
      prev.map((c) => (matches(c) ? { ...c, isActive: newActive } : c)),
    );
    await Promise.allSettled(
      providerConns.map((c) =>
        fetch(`/api/providers/${c.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isActive: newActive }),
        }),
      ),
    );
  };

  const handleBatchTest = async (mode, providerId = null) => {
    if (testingMode) return;
    setTestingMode(mode === "provider" ? providerId : mode);
    setTestResults(null);
    try {
      const res = await fetch("/api/providers/test-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, providerId }),
      });
      const data = await res.json();
      setTestResults(data);
      if (data.summary) {
        const { passed, failed, total } = data.summary;
        if (failed === 0) notify.success(`All ${total} tests passed`);
        else notify.warning(`${passed}/${total} passed, ${failed} failed`);
      }
    } catch (error) {
      setTestResults({ error: "Test request failed" });
      notify.error("Provider test failed");
    } finally {
      setTestingMode(null);
    }
  };

  // ---- Build one unified entry list, then filter it ----
  const allEntries = useMemo(() => {
    const out = [];
    const push = (key, info, group, authTypes, cardKind, cardAuthType) =>
      out.push({
        key,
        info,
        group,
        authTypes,
        cardKind,
        cardAuthType,
        cats: getProviderCategories(key, info, group),
        section: getSectionId(info, group, key),
      });
    for (const node of providerNodes) {
      if (node.type === "openai-compatible") {
        push(node.id, { id: node.id, name: node.name || "OpenAI Compatible", color: "#10A37F", textIcon: "OC", apiType: node.apiType }, "custom", "apikey", "apikey", "compatible");
      } else if (node.type === "anthropic-compatible") {
        push(node.id, { id: node.id, name: node.name || "Anthropic Compatible", color: "#D97757", textIcon: "AC" }, "custom", "apikey", "apikey", "compatible");
      }
    }
    for (const [key, info] of Object.entries(OAUTH_PROVIDERS)) {
      if (!info.hidden) push(key, info, "oauth", dualAuthTypes(info, key), "oauth", "oauth");
    }
    for (const [key, info] of Object.entries(FREE_PROVIDERS)) {
      if (!info.hidden) push(key, info, "free", dualAuthTypes(info, key), "oauth", "free");
    }
    for (const [key, info] of Object.entries(FREE_TIER_PROVIDERS)) {
      if (info.hidden) continue;
      const at = dualAuthTypes(info, key);
      push(key, info, "freeTier", at, "apikey", Array.isArray(at) ? (at[0] ?? "apikey") : at);
    }
    for (const [key, info] of Object.entries(APIKEY_PROVIDERS)) {
      if (!info.hidden) push(key, info, "apikey", "apikey", "apikey", "apikey");
    }
    for (const [key, info] of Object.entries(WEB_COOKIE_PROVIDERS)) {
      if (!info.hidden) push(key, info, "webCookie", "cookie", "apikey", "cookie");
    }
    return out;
  }, [providerNodes]);

  const entries = filterClientProviderEntries(
    allEntries.map((e) => ({ ...e, stats: getProviderStats(e.key, e.authTypes) })),
    connections,
    isClientSession,
    assignedModels,
  );

  const categoryCounts = {};
  for (const c of CATEGORY_FILTERS) {
    const inCat = entries.filter((e) => matchesCategory(e.cats, c.id));
    categoryCounts[c.id] = {
      total: inCat.length,
      configured: inCat.filter((e) => isConfigured(e.stats, e.info)).length,
    };
  }

  const modelFilterActive = !!modelQuery.trim();
  const isFiltering =
    !!searchQuery.trim() || modelFilterActive || statusFilter !== "all" ||
    category !== "all" || !!media || displayMode !== "all";

  const byPriority = (a, b) => {
    const pa = a.info.priority ?? 999;
    const pb = b.info.priority ?? 999;
    if (pa !== pb) return pa - pb;
    const ca = a.stats.total > 0 || a.info.noAuth ? 0 : 1;
    const cb = b.stats.total > 0 || b.info.noAuth ? 0 : 1;
    if (ca !== cb) return ca - cb;
    return (a.info.name || "").localeCompare(b.info.name || "");
  };

  const visible = entries
    .filter((e) => {
      if (!matchesSearch(e.key, e.info, searchQuery)) return false;
      if (!matchesCategory(e.cats, category)) return false;
      if (!matchesMedia(e.info, media)) return false;
      if (!matchesStatusFilter(statusFilter, e.stats, e.info.noAuth)) return false;
      if (displayMode === "configured" && !isConfigured(e.stats, e.info)) return false;
      if (modelFilterActive) {
        e.modelMatch = findModelMatches(modelIndex, [e.info.alias, e.key].filter(Boolean), modelQuery);
        if (e.modelMatch.count === 0) return false;
      } else {
        e.modelMatch = null;
      }
      return true;
    })
    .sort(byPriority);

  const renderCard = (e) => {
    const onToggle = (active) => handleToggleProvider(e.key, e.authTypes, active);
    return e.cardKind === "oauth" ? (
      <ProviderCard key={e.key} providerId={e.key} provider={e.info} stats={e.stats} authType={e.cardAuthType} modelMatch={e.modelMatch} onToggle={onToggle} />
    ) : (
      <ApiKeyProviderCard key={e.key} providerId={e.key} provider={e.info} stats={e.stats} authType={e.cardAuthType} modelMatch={e.modelMatch} onToggle={onToggle} />
    );
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-8">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  const sections = SECTION_ORDER.map((id) => ({
    id,
    items: visible.filter((e) => e.section === id),
  })).filter((s) => s.items.length > 0);

  return (
    <div className="flex min-w-0 flex-col gap-6 px-1 sm:px-0">
      <ProviderSummaryCard
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        modelQuery={modelQuery}
        onModelChange={setModelQuery}
        mode={displayMode}
        onModeChange={changeDisplayMode}
        statusFilter={statusFilter}
        onStatusChange={setStatusFilter}
        category={category}
        onCategoryChange={setCategory}
        media={media}
        onMediaChange={setMedia}
        categoryCounts={categoryCounts}
        onAddOpenAI={() => setShowAddCompatibleModal(true)}
        onAddAnthropic={() => setShowAddAnthropicCompatibleModal(true)}
        onTestAll={() => handleBatchTest("all")}
        testing={!!testingMode}
      />

      {visible.length === 0 && (
        <div className="text-center py-8 border border-dashed border-border rounded-xl">
          <span className="material-symbols-outlined text-[32px] text-text-muted mb-2">
            search_off
          </span>
          <p className="text-text-muted text-sm">
            No providers match your search or filters
          </p>
        </div>
      )}

      {displayMode === "compact" ? (
        visible.length > 0 && <div className={COMPACT_GRID}>{visible.map(renderCard)}</div>
      ) : (
        sections.map(({ id, items }) => {
          // Truncate the long API key list only when nothing is being filtered.
          const truncate = id === "apikey" && !isFiltering && !showAllApikey && items.length > APIKEY_INITIAL_VISIBLE;
          const shown = truncate ? items.slice(0, APIKEY_INITIAL_VISIBLE) : items;
          const testMode = { oauth: "oauth", free: "free", apikey: "apikey" }[id];
          return (
            <div key={id} className="flex flex-col gap-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-lg sm:text-xl font-semibold flex items-center gap-2 leading-tight">
                  {SECTION_TITLES[id]}
                  <span className="text-xs font-normal text-text-muted">{items.length}</span>
                </h2>
                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                  {id === "oauth" && <ModelAvailabilityBadge />}
                  {testMode && (
                    <button
                      onClick={() => handleBatchTest(testMode)}
                      disabled={!!testingMode}
                      className={`flex w-full items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors sm:w-auto sm:py-1.5 ${
                        testingMode === testMode
                          ? "bg-primary/20 border-primary/40 text-primary animate-pulse"
                          : "bg-bg border-border text-text-muted hover:text-text-main hover:border-primary/40"
                      }`}
                      title={`Test all ${testMode} connections`}
                      aria-label={`Test all ${testMode} connections`}
                    >
                      <span className={`material-symbols-outlined text-[14px]${testingMode === testMode ? " animate-spin" : ""}`}>
                        play_arrow
                      </span>
                      {testingMode === testMode ? "Testing..." : "Test All"}
                    </button>
                  )}
                </div>
              </div>
              <div className={GRID}>{shown.map(renderCard)}</div>
              {truncate && (
                <button
                  onClick={() => setShowAllApikey(true)}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-primary/40 px-3 py-2.5 text-sm font-medium text-primary transition-colors hover:border-primary hover:bg-primary/5"
                >
                  <span className="material-symbols-outlined text-[16px]">expand_more</span>
                  Show all {items.length} providers
                </button>
              )}
            </div>
          );
        })
      )}

      <AddCompatibleModal
        variant="openai"
        isOpen={showAddCompatibleModal}
        onClose={() => setShowAddCompatibleModal(false)}
        onCreated={(node) => {
          setProviderNodes((prev) => [...prev, node]);
          setShowAddCompatibleModal(false);
        }}
      />
      <AddCompatibleModal
        variant="anthropic"
        isOpen={showAddAnthropicCompatibleModal}
        onClose={() => setShowAddAnthropicCompatibleModal(false)}
        onCreated={(node) => {
          setProviderNodes((prev) => [...prev, node]);
          setShowAddAnthropicCompatibleModal(false);
        }}
      />

      {/* Test Results Modal */}
      {testResults && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center px-3 pt-[6vh] sm:pt-[10vh]"
          onClick={() => setTestResults(null)}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="relative bg-surface border border-border rounded-xl w-full max-w-[600px] max-h-[86vh] sm:max-h-[80vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-3 border-b border-border bg-surface/95 backdrop-blur-sm rounded-t-xl">
              <h3 className="font-semibold">Test Results</h3>
              <button
                onClick={() => setTestResults(null)}
                className="p-1 rounded-lg hover:bg-bg text-text-muted hover:text-text-main transition-colors"
                aria-label="Close test results"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>
            <div className="p-5">
              <ProviderTestResultsView results={testResults} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ModelMatchLine({ modelMatch }) {
  if (!modelMatch?.count) return null;
  return (
    <div className="truncate text-[11px] text-primary" title={modelMatch.samples.join(", ")}>
      {modelMatch.count} model{modelMatch.count > 1 ? "s" : ""}: {modelMatch.samples.join(", ")}
    </div>
  );
}

function ProviderCard({ providerId, provider, stats, authType, onToggle, modelMatch }) {
  const { connected, error, errorCode, errorTime, allDisabled } = stats;
  const isNoAuth = !!provider.noAuth;

  const dotColors = {
    free: "bg-green-500",
    oauth: "bg-blue-500",
    apikey: "bg-amber-500",
    compatible: "bg-orange-500",
  };
  const dotLabels = {
    free: "Free",
    oauth: "OAuth",
    apikey: "API Key",
    compatible: "Compatible",
  };

  return (
    <Link href={`/dashboard/providers/${providerId}`} className="group min-w-0">
      <Card
        padding="xs"
        className={`h-full hover:bg-black/[0.01] dark:hover:bg-white/[0.01] transition-colors cursor-pointer ${allDisabled ? "opacity-50" : ""}`}
      >
        <div className="flex min-w-0 items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div
              className="size-8 shrink-0 rounded-lg flex items-center justify-center"
              style={{
                backgroundColor: `${provider.color?.length > 7 ? provider.color : provider.color + "15"}`,
              }}
            >
              <ProviderIcon
                src={`/providers/${provider.id}.png`}
                alt={provider.name}
                size={30}
                className="object-contain rounded-lg max-w-[32px] max-h-[32px]"
                fallbackText={
                  provider.textIcon || provider.id.slice(0, 2).toUpperCase()
                }
                fallbackColor={provider.color}
              />
            </div>
            <div className="min-w-0">
              <h3 className="truncate font-semibold">{provider.name}</h3>
              <div className="flex min-w-0 items-center gap-1.5 text-xs flex-wrap">
                {allDisabled ? (
                  <Badge variant="default" size="sm">
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[12px]">
                        pause_circle
                      </span>
                      Disabled
                    </span>
                  </Badge>
                ) : isNoAuth ? (
                  <Badge variant="success" size="sm" dot>Ready</Badge>
                ) : (
                  <>
                    {getStatusDisplay(connected, error, errorCode)}
                    {errorTime && (
                      <span className="text-text-muted">{errorTime}</span>
                    )}
                  </>
                )}
              </div>
              <ModelMatchLine modelMatch={modelMatch} />
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {stats.total > 0 && (
              <div
                className="opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onToggle(!allDisabled ? false : true);
                }}
              >
                <Toggle
                  size="sm"
                  checked={!allDisabled}
                  onChange={() => {}}
                  title={allDisabled ? "Enable provider" : "Disable provider"}
                />
              </div>
            )}
          </div>
        </div>
      </Card>
    </Link>
  );
}

ProviderCard.propTypes = {
  providerId: PropTypes.string.isRequired,
  provider: PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    color: PropTypes.string,
    textIcon: PropTypes.string,
  }).isRequired,
  stats: PropTypes.shape({
    connected: PropTypes.number,
    error: PropTypes.number,
    errorCode: PropTypes.string,
    errorTime: PropTypes.string,
  }).isRequired,
  authType: PropTypes.string,
  onToggle: PropTypes.func,
  modelMatch: PropTypes.object,
};

function ApiKeyProviderCard({
  providerId,
  provider,
  stats,
  authType,
  onToggle,
  modelMatch,
}) {
  const { connected, error, errorCode, errorTime, allDisabled } = stats;
  const isCompatible = providerId.startsWith(OPENAI_COMPATIBLE_PREFIX);
  const isAnthropicCompatible = providerId.startsWith(
    ANTHROPIC_COMPATIBLE_PREFIX,
  );

  const dotColors = {
    free: "bg-green-500",
    oauth: "bg-blue-500",
    apikey: "bg-amber-500",
    compatible: "bg-orange-500",
  };
  const dotLabels = {
    free: "Free",
    oauth: "OAuth",
    apikey: "API Key",
    compatible: "Compatible",
  };

  const getIconPath = () => {
    if (isCompatible && provider.apiType)
      return provider.apiType === "responses"
        ? "/providers/oai-r.png"
        : "/providers/oai-cc.png";
    if (isAnthropicCompatible) return "/providers/anthropic-m.png";
    return getProviderIconSrc(provider.id);
  };

  return (
    <Link href={`/dashboard/providers/${providerId}`} className="group min-w-0">
      <Card
        padding="xs"
        className={`h-full hover:bg-black/[0.01] dark:hover:bg-white/[0.01] transition-colors cursor-pointer ${allDisabled ? "opacity-50" : ""}`}
      >
        <div className="flex min-w-0 items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div
              className="size-8 shrink-0 rounded-lg flex items-center justify-center"
              style={{
                backgroundColor: `${provider.color?.length > 7 ? provider.color : provider.color + "15"}`,
              }}
            >
              <ProviderIcon
                src={getIconPath()}
                alt={provider.name}
                size={30}
                className="object-contain rounded-lg max-w-[30px] max-h-[30px]"
                fallbackText={
                  provider.textIcon || provider.id.slice(0, 2).toUpperCase()
                }
                fallbackColor={provider.color}
              />
            </div>
            <div className="min-w-0">
              <h3 className="truncate font-semibold">{provider.name}</h3>
              <div className="flex min-w-0 items-center gap-1.5 text-xs flex-wrap">
                {allDisabled ? (
                  <Badge variant="default" size="sm">
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[12px]">
                        pause_circle
                      </span>
                      Disabled
                    </span>
                  </Badge>
                ) : (
                  <>
                    {getStatusDisplay(connected, error, errorCode)}
                    {isCompatible && (
                      <Badge variant="default" size="sm">
                        {provider.apiType === "responses"
                          ? "Responses"
                          : "Chat"}
                      </Badge>
                    )}
                    {isAnthropicCompatible && (
                      <Badge variant="default" size="sm">
                        Messages
                      </Badge>
                    )}
                    {errorTime && (
                      <span className="text-text-muted">{errorTime}</span>
                    )}
                  </>
                )}
              </div>
              <ModelMatchLine modelMatch={modelMatch} />
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {stats.total > 0 && (
              <div
                className="opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onToggle(!allDisabled ? false : true);
                }}
              >
                <Toggle
                  size="sm"
                  checked={!allDisabled}
                  onChange={() => {}}
                  title={allDisabled ? "Enable provider" : "Disable provider"}
                />
              </div>
            )}
          </div>
        </div>
      </Card>
    </Link>
  );
}

ApiKeyProviderCard.propTypes = {
  providerId: PropTypes.string.isRequired,
  provider: PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    color: PropTypes.string,
    textIcon: PropTypes.string,
    apiType: PropTypes.string,
  }).isRequired,
  stats: PropTypes.shape({
    connected: PropTypes.number,
    error: PropTypes.number,
    errorCode: PropTypes.string,
    errorTime: PropTypes.string,
  }).isRequired,
  authType: PropTypes.string,
  onToggle: PropTypes.func,
  modelMatch: PropTypes.object,
};

function ProviderTestResultsView({ results }) {
  if (results.error && !results.results) {
    return (
      <div className="text-center py-6">
        <span className="material-symbols-outlined text-red-500 text-[32px] mb-2 block">
          error
        </span>
        <p className="text-sm text-red-400">{results.error}</p>
      </div>
    );
  }

  const { summary, mode } = results;
  const items = results.results || [];
  const modeLabel =
    {
      oauth: "OAuth",
      free: "Free",
      apikey: "API Key",
      provider: "Provider",
      all: "All",
    }[mode] || mode;

  return (
    <div className="flex min-w-0 flex-col gap-3">
      {summary && (
        <div className="flex flex-wrap items-center gap-2 text-xs mb-1 sm:gap-3">
          <span className="text-text-muted">{modeLabel} Test</span>
          <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 font-medium">
            {summary.passed} passed
          </span>
          {summary.failed > 0 && (
            <span className="px-2 py-0.5 rounded bg-red-500/15 text-red-400 font-medium">
              {summary.failed} failed
            </span>
          )}
          <span className="text-text-muted sm:ml-auto">
            {summary.total} tested
          </span>
        </div>
      )}
      {items.map((r, i) => (
        <div
          key={r.connectionId || i}
          className="flex min-w-0 flex-wrap items-center gap-2 rounded-lg bg-black/[0.03] px-3 py-2 text-xs dark:bg-white/[0.03] sm:flex-nowrap"
        >
          <span
            className={`material-symbols-outlined text-[16px] ${r.valid ? "text-emerald-500" : "text-red-500"}`}
          >
            {r.valid ? "check_circle" : "error"}
          </span>
          <div className="min-w-0 flex-[1_1_160px]">
            <span className="block truncate font-medium sm:inline">
              {r.connectionName}
            </span>
            <span className="block truncate text-text-muted sm:ml-1.5 sm:inline">
              ({r.provider})
            </span>
          </div>
          {r.latencyMs !== undefined && (
            <span className="shrink-0 text-text-muted font-mono tabular-nums">
              {r.latencyMs}ms
            </span>
          )}
          <span
            className={`shrink-0 text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
              r.valid
                ? "bg-emerald-500/15 text-emerald-400"
                : "bg-red-500/15 text-red-400"
            }`}
          >
            {r.valid ? "OK" : r.diagnosis?.type || "ERROR"}
          </span>
        </div>
      ))}
      {items.length === 0 && (
        <div className="text-center py-4 text-text-muted text-sm">
          No active connections found for this group.
        </div>
      )}
    </div>
  );
}

ProviderTestResultsView.propTypes = {
  results: PropTypes.shape({
    mode: PropTypes.string,
    results: PropTypes.array,
    summary: PropTypes.shape({
      total: PropTypes.number,
      passed: PropTypes.number,
      failed: PropTypes.number,
    }),
    error: PropTypes.string,
  }).isRequired,
};
