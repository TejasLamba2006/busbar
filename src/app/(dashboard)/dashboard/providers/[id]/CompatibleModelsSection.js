"use client";

import { useState } from "react";
import PropTypes from "prop-types";
import { Button } from "@/shared/components";
import { getProviderCustomModelRows } from "@/shared/utils/providerCustomModels";
import { filterModelRows } from "@/shared/utils/modelVisibility";
import { filterAndSortModelRows } from "@/shared/utils/modelToolbar";
import ModelVisibilityToolbar from "./ModelVisibilityToolbar";
import ModelBatchToolbar from "./ModelBatchToolbar";
import ModelRow from "./ModelRow";
import useModelPricing from "./useModelPricing";
import useModelBatchTest from "./useModelBatchTest";

export default function CompatibleModelsSection({
  providerStorageAlias,
  providerDisplayAlias,
  modelAliases,
  customModels,
  copied,
  onCopy,
  onSetAlias,
  onDeleteAlias,
  onAddCustomModel,
  onDeleteCustomModel,
  connections,
  isAnthropic,
  onImportModels,
  importing,
  importMessage,
  disabledModelIds,
  onHideModel,
  onHideModels,
  onUnhideModels,
  onVisibilityChanged,
}) {
  const [newModel, setNewModel] = useState("");
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");
  const [visibility, setVisibility] = useState("all");
  const [freeFilter, setFreeFilter] = useState("all");
  const [sortFreeFirst, setSortFreeFirst] = useState(false);
  const batch = useModelBatchTest({ providerId: providerStorageAlias, connections, onVisibilityChanged });

  const allModels = getProviderCustomModelRows({
    customModels,
    modelAliases,
    providerAlias: providerStorageAlias,
    type: null,
  });
  const modelPricing = useModelPricing(providerStorageAlias, allModels.map((model) => model.id));
  const disabledSet = new Set(disabledModelIds);
  const shownModels = filterAndSortModelRows(
    filterModelRows(allModels, { query, visibility, disabledIds: disabledModelIds }),
    { freeFilter, sortFreeFirst }
  );
  const counts = {
    all: allModels.length,
    visible: allModels.filter((model) => !disabledSet.has(model.id)).length,
    hidden: allModels.filter((model) => disabledSet.has(model.id)).length,
    disabledSet,
  };
  const visibleShownIds = shownModels.filter((model) => !disabledSet.has(model.id)).map((model) => model.id);
  const canImport = connections.some((connection) => connection.isActive !== false);

  const handleAdd = async () => {
    if (!newModel.trim() || adding) return;
    const modelId = newModel.trim();
    if (allModels.some((model) => model.id === modelId)) {
      alert("Model already exists for this provider.");
      return;
    }
    setAdding(true);
    try {
      await onAddCustomModel(modelId);
      setNewModel("");
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-text-muted">
        Add {isAnthropic ? "Anthropic" : "OpenAI"}-compatible models manually or import them from the /models endpoint.
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[240px] flex-1">
          <label htmlFor="new-compatible-model-input" className="mb-1 block text-xs text-text-muted">Model ID</label>
          <input
            id="new-compatible-model-input"
            value={newModel}
            onChange={(event) => setNewModel(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && handleAdd()}
            placeholder={isAnthropic ? "claude-3-opus-20240229" : "gpt-4o"}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
          />
        </div>
        <Button size="sm" icon="add" onClick={handleAdd} disabled={!newModel.trim() || adding}>{adding ? "Adding..." : "Add"}</Button>
        <Button size="sm" variant="secondary" icon="download" onClick={onImportModels} disabled={!canImport || importing}>
          {importing ? "Importing..." : (importMessage || "Import from /models")}
        </Button>
      </div>
      {!canImport && <p className="text-xs text-text-muted">Add an active connection to test or import models.</p>}

      {allModels.length > 0 && (
        <>
          <ModelVisibilityToolbar
            query={query}
            onQueryChange={setQuery}
            visibility={visibility}
            onVisibilityChange={setVisibility}
            freeFilter={freeFilter}
            onFreeFilterChange={setFreeFilter}
            sortFreeFirst={sortFreeFirst}
            onSortFreeFirstChange={setSortFreeFirst}
            counts={counts}
            shownIds={shownModels.map((model) => model.id)}
            onHideShown={onHideModels}
            onUnhideShown={onUnhideModels}
            batchControls={<ModelBatchToolbar batch={batch} shownIds={visibleShownIds} embedded />}
          />
          <div className="flex flex-wrap gap-3">
            {shownModels.map((model) => {
              const hidden = disabledSet.has(model.id);
              const hasConnection = batch.activeConnections.length > 0;
              return (
                <ModelRow
                  key={`${model.source}-${model.fullModel}`}
                  model={{ ...model, source: model.catalogSource || model.source }}
                  fullModel={`${providerDisplayAlias}/${model.id}`}
                  alias={model.alias}
                  copied={copied}
                  onCopy={onCopy}
                  onSetAlias={(alias) => onSetAlias(model.id, alias, providerStorageAlias)}
                  onDeleteAlias={() => model.source === "custom" ? onDeleteCustomModel(model.id) : onDeleteAlias(model.alias)}
                  onTest={!hidden && hasConnection ? () => batch.run([model.id]) : undefined}
                  testDisabledReason={hidden ? "Unhide model before testing" : !hasConnection ? "Active connection required" : undefined}
                  isTesting={batch.state?.running && batch.state.current === model.id && !batch.results[model.id]}
                  isCustom={model.source === "custom"}
                  onDisable={async () => { if (await onHideModel(model.id)) batch.removeSelected(model.id); }}
                  onEnable={() => onUnhideModels([model.id])}
                  hidden={hidden}
                  selected={batch.selectedIds.includes(model.id)}
                  onToggleSelected={!hidden ? () => batch.toggleSelected(model.id) : undefined}
                  batchResult={batch.results[model.id]}
                  capabilityEvidence={batch.capabilityEvidence[model.id]}
                  pricing={modelPricing.pricing[model.id]}
                  onSavePricing={(rates) => modelPricing.save(model.id, rates)}
                  onResetPricing={() => modelPricing.reset(model.id).catch((error) => alert(error.message))}
                />
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

CompatibleModelsSection.propTypes = {
  providerStorageAlias: PropTypes.string.isRequired,
  providerDisplayAlias: PropTypes.string.isRequired,
  modelAliases: PropTypes.object.isRequired,
  customModels: PropTypes.arrayOf(PropTypes.object),
  copied: PropTypes.string,
  onCopy: PropTypes.func.isRequired,
  onSetAlias: PropTypes.func.isRequired,
  onDeleteAlias: PropTypes.func.isRequired,
  onAddCustomModel: PropTypes.func.isRequired,
  onDeleteCustomModel: PropTypes.func.isRequired,
  connections: PropTypes.arrayOf(PropTypes.object).isRequired,
  isAnthropic: PropTypes.bool,
  onImportModels: PropTypes.func.isRequired,
  importing: PropTypes.bool,
  importMessage: PropTypes.string,
  disabledModelIds: PropTypes.arrayOf(PropTypes.string).isRequired,
  onHideModel: PropTypes.func.isRequired,
  onHideModels: PropTypes.func.isRequired,
  onUnhideModels: PropTypes.func.isRequired,
  onVisibilityChanged: PropTypes.func.isRequired,
};
