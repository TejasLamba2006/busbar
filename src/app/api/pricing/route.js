import { NextResponse } from "next/server";
import { getManualPricing, getPricingForModelWithSource, getPricingForModelsWithSource, updatePricing, resetPricing, resetAllPricing } from "@/lib/localDb.js";
import { PROVIDER_PRICING, getDefaultPricing, getPricingForModel } from "open-sse/providers/pricing.js";
import { getCatalogRevision, getCatalogSnapshot } from "open-sse/providers/catalogOverride.js";
import { PROVIDER_MODELS, PROVIDER_ID_TO_ALIAS } from "open-sse/config/providerModels.js";
import { buildPricingView } from "@/lib/pricingView.js";

const MAX_MODEL_BATCH = 1000;
const UNSAFE_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const ALIAS_TO_PROVIDER_ID = Object.fromEntries(
  Object.entries(PROVIDER_ID_TO_ALIAS).map(([id, alias]) => [alias, id])
);

function buildRegistryPricingDefaults() {
  const defaults = {};
  for (const [p, models] of Object.entries(PROVIDER_PRICING)) {
    defaults[p] = { ...models };
  }
  for (const [key, models] of Object.entries(PROVIDER_MODELS)) {
    if (!Array.isArray(models) || key.endsWith("-tts-models") || key.endsWith("-tts-voices")) continue;
    const providerId = ALIAS_TO_PROVIDER_ID[key] || key;
    if (key !== (PROVIDER_ID_TO_ALIAS[providerId] || providerId) && key !== providerId) continue;
    for (const m of models) {
      if (!m?.id || defaults[providerId]?.[m.id]) continue;
      const rates = getPricingForModel(providerId, m.id);
      if (rates) {
        (defaults[providerId] ||= {})[m.id] = rates;
      }
    }
  }
  return defaults;
}

async function getPricingView() {
  const manual = await getManualPricing();
  const catalog = getCatalogSnapshot();
  const view = buildPricingView({ hardcoded: buildRegistryPricingDefaults(), manual, catalog });
  return { ...view, catalog: getCatalogRevision() };
}

/**
 * GET /api/pricing
 * Get current pricing configuration (merged user + defaults)
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const provider = searchParams.get("provider");
    const model = searchParams.get("model");
    const models = searchParams.getAll("models");
    if (provider && models.length) {
      if (models.length > MAX_MODEL_BATCH) {
        return NextResponse.json({ error: `At most ${MAX_MODEL_BATCH} models per request` }, { status: 400 });
      }
      return NextResponse.json(await getPricingForModelsWithSource(provider, models));
    }
    if (provider && model) {
      return NextResponse.json(await getPricingForModelWithSource(provider, model));
    }
    return NextResponse.json(await getPricingView());
  } catch (error) {
    console.error("Error fetching pricing:", error);
    return NextResponse.json(
      { error: "Failed to fetch pricing" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/pricing
 * Update pricing configuration
 * Body: { provider: { model: { input: number, output: number, cached: number, ... } } }
 */
export async function PATCH(request) {
  try {
    const body = await request.json();

    // Validate body structure
    if (typeof body !== "object" || body === null) {
      return NextResponse.json(
        { error: "Invalid pricing data format" },
        { status: 400 }
      );
    }

    // Validate pricing structure
    for (const [provider, models] of Object.entries(body)) {
      if (UNSAFE_KEYS.has(provider)) {
        return NextResponse.json({ error: `Invalid provider: ${provider}` }, { status: 400 });
      }
      if (typeof models !== "object" || models === null) {
        return NextResponse.json(
          { error: `Invalid pricing for provider: ${provider}` },
          { status: 400 }
        );
      }

      for (const [model, pricing] of Object.entries(models)) {
        if (UNSAFE_KEYS.has(model)) {
          return NextResponse.json({ error: `Invalid model: ${model}` }, { status: 400 });
        }
        if (typeof pricing !== "object" || pricing === null) {
          return NextResponse.json(
            { error: `Invalid pricing for model: ${provider}/${model}` },
            { status: 400 }
          );
        }

        // Validate pricing fields
        const validFields = ["input", "output", "cached", "reasoning", "cache_creation"];
        for (const [key, value] of Object.entries(pricing)) {
          if (!validFields.includes(key)) {
            return NextResponse.json(
              { error: `Invalid pricing field: ${key} for ${provider}/${model}` },
              { status: 400 }
            );
          }
          if (typeof value !== "number" || isNaN(value) || value < 0) {
            return NextResponse.json(
              { error: `Invalid pricing value for ${key} in ${provider}/${model}: must be non-negative number` },
              { status: 400 }
            );
          }
        }
      }
    }

    const updatedPricing = await updatePricing(body);
    return NextResponse.json(updatedPricing);
  } catch (error) {
    console.error("Error updating pricing:", error);
    return NextResponse.json(
      { error: "Failed to update pricing" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/pricing
 * Reset pricing to defaults
 * Query params: ?provider=xxx&model=yyy (optional)
 */
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const provider = searchParams.get("provider");
    const model = searchParams.get("model");

    if (provider && model) {
      // Reset specific model
      await resetPricing(provider, model);
    } else if (provider) {
      // Reset entire provider
      await resetPricing(provider);
    } else {
      // Reset all pricing
      await resetAllPricing();
    }

    return NextResponse.json(await getPricingView());
  } catch (error) {
    console.error("Error resetting pricing:", error);
    return NextResponse.json(
      { error: "Failed to reset pricing" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/pricing/defaults
 * Get default pricing configuration
 */
export async function GET_DEFAULTS() {
  try {
    const defaultPricing = getDefaultPricing();
    return NextResponse.json(defaultPricing);
  } catch (error) {
    console.error("Error fetching default pricing:", error);
    return NextResponse.json(
      { error: "Failed to fetch default pricing" },
      { status: 500 }
    );
  }
}