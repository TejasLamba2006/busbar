"use client";

// Per-API-key access control on the Endpoint page.
// "Restrict access" toggle per key; when on, the key may call only the listed
// combos/models, shown as removable badges. Entries are picked with the same
// shared ModelSelectModal the combo editor uses (combos first, then models).
import { useState } from "react";
import PropTypes from "prop-types";
import { Toggle, ModelSelectModal } from "@/shared/components";
import { ENDPOINT_SCOPES } from "@/shared/constants/keyAccess.js";

export default function KeyAccessControls({ apiKey, onChange, onRequestRestrict, onEndpointsChange, onLimitsChange }) {
  const endpoints = apiKey.allowedEndpoints || [];
  const limits = apiKey.limits || { maxBudgetUsd: null, budgetResetPeriod: "daily", maxRequestsPerMinute: null };
  const limitsEnabled = limits.maxBudgetUsd != null || limits.maxRequestsPerMinute != null;
  const [limitDraft, setLimitDraft] = useState(limits);
  const setDraft = (patch) => setLimitDraft((prev) => ({ ...prev, ...patch }));
  const toNumberOrNull = (v) => (v === "" || v == null ? null : Number(v));
  const saveLimits = () => onLimitsChange({
    maxBudgetUsd: toNumberOrNull(limitDraft.maxBudgetUsd),
    budgetResetPeriod: limitDraft.budgetResetPeriod,
    maxRequestsPerMinute: toNumberOrNull(limitDraft.maxRequestsPerMinute),
  });
  const toggleEndpoint = (id) => onEndpointsChange(endpoints.includes(id) ? endpoints.filter((e) => e !== id) : [...endpoints, id]);
  const access = apiKey.access || { restricted: false, allow: [] };
  const [pickerOpen, setPickerOpen] = useState(false);
  const [activeProviders, setActiveProviders] = useState([]);
  const [modelAliases, setModelAliases] = useState({});

  const openPicker = async () => {
    setPickerOpen(true);
    // Same sources the combo editor feeds the picker with.
    try {
      const [providersRes, aliasRes] = await Promise.all([fetch("/api/providers"), fetch("/api/models/alias")]);
      if (providersRes.ok) setActiveProviders((await providersRes.json()).connections || []);
      if (aliasRes.ok) setModelAliases((await aliasRes.json()).aliases || {});
    } catch (error) {
      console.log("Error loading picker data:", error);
    }
  };

  const setAllow = (allow) => onChange({ restricted: true, allow });
  const add = (model) => {
    const value = model?.value;
    if (value && !access.allow.some((e) => e.toLowerCase() === value.toLowerCase())) setAllow([...access.allow, value]);
  };
  const remove = (value) => setAllow(access.allow.filter((e) => e !== value));

  return (
    <div className="mt-2" data-testid="key-access">
      <Toggle
        size="sm"
        checked={access.restricted}
        label="Restrict access"
        onChange={(checked) => (checked ? onRequestRestrict() : onChange({ restricted: false, allow: access.allow }))}
      />
      {access.restricted && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {access.allow.length === 0 && (
            <span className="text-xs text-orange-500">No combos or models allowed — this key can call nothing.</span>
          )}
          {access.allow.map((entry) => (
            <span key={entry} className="flex items-center gap-1 rounded-xl border border-primary/30 bg-primary/10 px-2 py-0.5 font-mono text-xs text-text-main">
              {entry}
              <button
                onClick={() => remove(entry)}
                className="rounded text-text-muted hover:text-red-500"
                title={`Remove ${entry}`}
                aria-label={`Remove ${entry}`}
              >
                <span className="material-symbols-outlined leading-none" style={{ fontSize: "12px" }}>close</span>
              </button>
            </span>
          ))}
          <button
            onClick={openPicker}
            className="flex items-center gap-0.5 rounded-xl border border-dashed border-black/10 px-2 py-0.5 text-xs font-medium text-primary hover:border-primary/50 dark:border-white/10"
          >
            <span className="material-symbols-outlined leading-none" style={{ fontSize: "14px" }}>add</span>
            Add combo or model
          </button>
        </div>
      )}
      <div className="mt-2" data-testid="key-endpoint-access">
        <Toggle
          size="sm"
          checked={endpoints.length > 0}
          label={endpoints.length > 0 ? `Restricted to ${endpoints.length} endpoint${endpoints.length === 1 ? "" : "s"}` : "All endpoints (unrestricted)"}
          onChange={(checked) => onEndpointsChange(checked ? ["chat"] : [])}
        />
        {endpoints.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {Object.entries(ENDPOINT_SCOPES).map(([id, scope]) => (
              <label key={id} className="flex cursor-pointer items-center gap-1 rounded-xl border border-primary/30 px-2 py-0.5 text-xs text-text-main">
                <input type="checkbox" checked={endpoints.includes(id)} onChange={() => toggleEndpoint(id)} />
                {scope.label}
              </label>
            ))}
            {endpoints.filter((e) => !(e in ENDPOINT_SCOPES)).map((raw) => (
              <span key={raw} className="rounded-xl border border-primary/30 bg-primary/10 px-2 py-0.5 font-mono text-xs">{raw}</span>
            ))}
          </div>
        )}
      </div>
      <div className="mt-2" data-testid="key-budget-limits">
        <Toggle
          size="sm"
          checked={limitsEnabled}
          label="Budget & rate limits"
          onChange={(checked) => {
            if (checked) setLimitDraft({ ...limits, maxBudgetUsd: limits.maxBudgetUsd ?? 5, maxRequestsPerMinute: limits.maxRequestsPerMinute ?? 60 });
            else onLimitsChange({ maxBudgetUsd: null, budgetResetPeriod: limits.budgetResetPeriod, maxRequestsPerMinute: null });
          }}
        />
        {limitsEnabled && (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-text-main">
            <label className="flex items-center gap-1">
              Max USD
              <input
                type="number"
                step="0.5"
                min="0"
                placeholder="e.g. 5.00"
                value={limitDraft.maxBudgetUsd ?? ""}
                onChange={(e) => setDraft({ maxBudgetUsd: e.target.value })}
                className="w-20 rounded border border-black/10 bg-transparent px-1 py-0.5 dark:border-white/10"
              />
            </label>
            <label className="flex items-center gap-1">
              Period
              <select
                value={limitDraft.budgetResetPeriod}
                onChange={(e) => setDraft({ budgetResetPeriod: e.target.value })}
                className="rounded border border-black/10 bg-transparent px-1 py-0.5 dark:border-white/10"
              >
                <option value="daily">daily</option>
                <option value="monthly">monthly</option>
                <option value="total">total</option>
              </select>
            </label>
            <label className="flex items-center gap-1">
              Max RPM
              <input
                type="number"
                step="10"
                min="1"
                placeholder="e.g. 60"
                value={limitDraft.maxRequestsPerMinute ?? ""}
                onChange={(e) => setDraft({ maxRequestsPerMinute: e.target.value })}
                className="w-20 rounded border border-black/10 bg-transparent px-1 py-0.5 dark:border-white/10"
              />
            </label>
            <button
              onClick={saveLimits}
              className="rounded-xl border border-primary/30 bg-primary/10 px-2 py-0.5 font-medium text-primary hover:border-primary/50"
            >
              Save limits
            </button>
          </div>
        )}
      </div>
      {pickerOpen && (
        <ModelSelectModal
          isOpen={pickerOpen}
          onClose={() => setPickerOpen(false)}
          onSelect={add}
          onDeselect={(model) => remove(access.allow.find((e) => e.toLowerCase() === String(model?.value).toLowerCase()))}
          onSelectBatch={(models) => {
            const next = [...access.allow];
            for (const m of models) {
              const v = m?.value;
              if (v && !next.some((e) => e.toLowerCase() === v.toLowerCase())) next.push(v);
            }
            setAllow(next);
          }}
          onDeselectBatch={(models) => {
            const drop = new Set(models.map((m) => String(m?.value || "").toLowerCase()));
            setAllow(access.allow.filter((e) => !drop.has(e.toLowerCase())));
          }}
          activeProviders={activeProviders}
          modelAliases={modelAliases}
          title={`Allowed for "${apiKey.name}"`}
          addedModelValues={access.allow}
          closeOnSelect={false}
          allowProviderWildcard={true}
          includeAllServiceKinds={true}
        />
      )}
    </div>
  );
}

KeyAccessControls.propTypes = {
  apiKey: PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string,
    allowedEndpoints: PropTypes.arrayOf(PropTypes.string),
    access: PropTypes.shape({ restricted: PropTypes.bool, allow: PropTypes.arrayOf(PropTypes.string) }),
  }).isRequired,
  onChange: PropTypes.func.isRequired,
  onRequestRestrict: PropTypes.func.isRequired,
  onEndpointsChange: PropTypes.func.isRequired,
  onLimitsChange: PropTypes.func.isRequired,
};
