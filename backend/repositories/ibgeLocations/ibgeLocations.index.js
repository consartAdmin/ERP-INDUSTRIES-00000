// ╔════════════════════════════════════════════════════════════════════╗
// ║ ibgeLocations.index.js — ponto de entrada do módulo IBGE Locations ║
// ║ Mantém a mesma API pública do antigo ibgeLocationsApi.js           ║
// ╚════════════════════════════════════════════════════════════════════╝

import { ensureTable } from './ibgeLocationsSchema.repository.js';
import {
  listUfs,
  resolveCity,
  list,
  search,
  countByState,
  getById,
  getByIbgeCode,
  getCitiesByState,
} from './ibgeLocationsQuery.repository.js';
import { create, update, remove } from './ibgeLocationsMutation.repository.js';
import { importByState } from './ibgeLocationsImport.repository.js';

export {
  ensureTable,
  listUfs,
  resolveCity,
  list,
  search,
  countByState,
  getById,
  getByIbgeCode,
  getCitiesByState,
  create,
  update,
  remove,
  importByState,
};

/* =======================================================================
 * Export default
 * ======================================================================= */
export default {
  ensureTable,
  listUfs,
  resolveCity,
  list,
  search,
  countByState,
  getById,
  getByIbgeCode,
  getCitiesByState,
  create,
  update,
  remove,
  importByState,
};
