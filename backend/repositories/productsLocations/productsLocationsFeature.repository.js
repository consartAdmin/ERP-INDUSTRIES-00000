// ╔══════════════════════════════════════════════════════════════════════╗
// ║ productsLocationsFeature.repository.js — appFeature PRODUCT_LOCATIONS║
// ║ Opções: LOCATIONS_ENABLED | LOCATIONS_DISABLED                      ║
// ║         (option_config.useLocations)                                ║
// ║ Sem a feature cadastrada, desativada ou em falha → usa.             ║
// ║ SQL: docs/shortCutsSQL/features/feature_products_locations.md       ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { resolveFeature } from '../appFeatures/appFeatures.index.js';

export const PRODUCT_LOCATIONS_FEATURE_CODE = 'PRODUCT_LOCATIONS';

const CACHE_TTL_MS = 30_000;
const cache = new Map();

/** Resolve a feature e retorna true (usar localizações) ou false (não usar). */
export async function resolveUseProductLocations({
  scopeType = 'GLOBAL',
  scopeId = 1,
} = {}) {
  const key = `${scopeType}:${scopeId}`;
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.value;

  let value = true;
  try {
    const feature = await resolveFeature({
      featureCode: PRODUCT_LOCATIONS_FEATURE_CODE,
      scopeType,
      scopeId,
    });

    if (feature && feature.enabled !== false) {
      const disabled =
        feature.config?.useLocations === false ||
        String(feature.optionCode || '').toUpperCase() === 'LOCATIONS_DISABLED';
      value = !disabled;
    }
  } catch (error) {
    console.warn('[PRODUCT_LOCATIONS] Falha ao resolver feature, usando localizações:', error?.message || error);
  }

  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  return value;
}
