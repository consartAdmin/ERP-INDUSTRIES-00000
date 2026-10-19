// ╔══════════════════════════════════════════════════════════════════════╗
// ║ productsLocations.index.js — ponto de entrada do módulo              ║
// ║ Mantém a mesma API pública do antigo productsLocationsApi.js         ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { ensureTable } from './productsLocationsSchema.repository.js';
import { list, listByProductCode, getById } from './productsLocationsQuery.repository.js';
import { create } from './productsLocationsCreate.repository.js';
import { update, deactivate, setPrimary } from './productsLocationsUpdate.repository.js';
import { remove } from './productsLocationsRemove.repository.js';
import {
  PRODUCT_LOCATIONS_FEATURE_CODE,
  resolveUseProductLocations,
} from './productsLocationsFeature.repository.js';

export {
  ensureTable,
  list,
  listByProductCode,
  getById,
  create,
  update,
  deactivate,
  setPrimary,
  remove,
  PRODUCT_LOCATIONS_FEATURE_CODE,
  resolveUseProductLocations,
};

export default {
  ensureTable,
  list,
  listByProductCode,
  getById,
  create,
  update,
  deactivate,
  setPrimary,
  remove,
  resolveUseProductLocations,
};
