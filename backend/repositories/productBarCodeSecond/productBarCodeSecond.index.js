// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ productBarCodeSecond.index.js — ponto de entrada do módulo              ║
// ║ Mantém a mesma API pública do antigo productBarCodeSecondApi.js         ║
// ╚══════════════════════════════════════════════════════════════════════════╝

import { ensureProductBarCodeSecondTable } from './productBarCodeSecondSchema.repository.js';
import {
  listSecondBarCodes,
  getSecondBarCodeById,
  findBySecondBarCode,
} from './productBarCodeSecondQuery.repository.js';
import {
  createSecondBarCode,
  upsertSecondBarCode,
} from './productBarCodeSecondCreate.repository.js';
import {
  updateSecondBarCode,
  deleteSecondBarCode,
} from './productBarCodeSecondUpdate.repository.js';

export {
  ensureProductBarCodeSecondTable,
  listSecondBarCodes,
  getSecondBarCodeById,
  findBySecondBarCode,
  createSecondBarCode,
  upsertSecondBarCode,
  updateSecondBarCode,
  deleteSecondBarCode,
};

// ──────────────────────────────────────────────────────────────────────────────
// Export default agrupado
// ──────────────────────────────────────────────────────────────────────────────
const ProductBarCodeSecondAPI = Object.freeze({
  ensureTable: ensureProductBarCodeSecondTable,
  list:        listSecondBarCodes,
  getById:     getSecondBarCodeById,
  findBySecondBarCode,
  create:      createSecondBarCode,
  upsert:      upsertSecondBarCode,
  update:      updateSecondBarCode,
  remove:      deleteSecondBarCode,
});

export default ProductBarCodeSecondAPI;
