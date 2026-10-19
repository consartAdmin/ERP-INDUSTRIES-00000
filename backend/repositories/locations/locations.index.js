// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║ locations.index.js — ponto de entrada do módulo locations                ║
// ║ Mantém a mesma API pública do antigo services/apis/locationsApi.js       ║
// ║ This module DOES NOT create the pool; you must pass pgPool in each call. ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

import { TABLES } from './locations.constants.js';
import { withClient } from './locations.utils.js';
import { listLocationMap } from './locationsMap.repository.js';
import {
  listLocals,
  getLocalById,
  createLocal,
  updateLocal,
  deleteLocal,
} from './locationsLocals.repository.js';
import {
  listCorridors,
  createCorridor,
  updateCorridor,
  deleteCorridor,
} from './locationsCorridors.repository.js';
import {
  listShelves,
  createShelf,
  updateShelf,
  deleteShelf,
} from './locationsShelves.repository.js';
import {
  listBins,
  createBin,
  updateBin,
  deleteBin,
} from './locationsBins.repository.js';
import {
  listPositions,
  createPosition,
  updatePosition,
  deletePosition,
} from './locationsPositions.repository.js';
import {
  listProductLocations,
  getProductLocationById,
  createProductLocation,
  updateProductLocation,
  deleteProductLocation,
  getLocationByBarcode,
} from './locationsProductLocations.repository.js';

/* ------------------------------------------------------------------------- */
/* Export bundle                                                             */
/* ------------------------------------------------------------------------- */

const locationsApi = {
  TABLES,
  withClient,

  // Location map
  listLocationMap,

  // Locals
  listLocals,
  getLocalById,
  createLocal,
  updateLocal,
  deleteLocal,

  // Corridors
  listCorridors,
  createCorridor,
  updateCorridor,
  deleteCorridor,

  // Shelves
  listShelves,
  createShelf,
  updateShelf,
  deleteShelf,

  // Bins
  listBins,
  createBin,
  updateBin,
  deleteBin,

  // Positions
  listPositions,
  createPosition,
  updatePosition,
  deletePosition,

  // Product locations
  listProductLocations,
  getProductLocationById,
  createProductLocation,
  updateProductLocation,
  deleteProductLocation,
  getLocationByBarcode,
};

export default locationsApi;
