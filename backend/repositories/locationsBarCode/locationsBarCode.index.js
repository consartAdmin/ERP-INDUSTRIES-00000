// ╔══════════════════════════════════════════════════════════════════════╗
// ║ locationsBarCode.index.js — ponto de entrada do módulo             ║
// ║ Mantém a mesma API pública do antigo locationsBarCodeApi.js        ║
// ║ (somente default export; funções recebem pgPool)                   ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { TABLES } from './locationsBarCode.constants.js';
import { normalizeBarcode } from './locationsBarCode.sanitizers.js';
import { list, getById, getByBarcode } from './locationsBarCodeQuery.repository.js';
import { create, generateBins } from './locationsBarCodeCreate.repository.js';
import { update, deactivate, remove } from './locationsBarCodeUpdate.repository.js';

export default {
  TABLES,
  normalizeBarcode,
  list,
  getById,
  getByBarcode,
  create,
  update,
  deactivate,
  remove,
  generateBins,
};
