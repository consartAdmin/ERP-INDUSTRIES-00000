// ╔══════════════════════════════════════════════════════════════════════╗
// ║ productsBarCode.index.js — ponto de entrada do módulo                ║
// ║ Mantém a mesma API pública do antigo productsBarCodeApi.js           ║
// ║ ✅ Dimensões gravadas em public."productsBarCode"                    ║
// ║ ✅ Payload de insert/update validado pelo catálogo                   ║
// ║ ✅ Resolve apenas barcode ativo + produto ativo                      ║
// ╚══════════════════════════════════════════════════════════════════════╝

import productsBarCodeSchema from './productsBarCode.catalog.js';
import { normalizeBarcode, detectBarcodeType } from './productsBarCode.sanitizers.js';
import {
  getByUnitId,
  getActiveByUnitId,
  getByProductCode,
  getActiveUnitsByProductCode,
  getFactorsByProductCodes,
} from './productsBarCodeQuery.repository.js';
import { resolve } from './productsBarCodeResolve.repository.js';
import { upsertForUnit } from './productsBarCodeUpsert.repository.js';
import { updateById, setActive } from './productsBarCodeUpdate.repository.js';
import { deleteById } from './productsBarCodeRemove.repository.js';

export const productsBarCodeApi = {
  schema: productsBarCodeSchema,
  normalizeBarcode,
  detectBarcodeType,
  getByUnitId,
  getActiveByUnitId,
  getByProductCode,
  resolve,
  upsertForUnit,
  updateById,
  setActive,
  getActiveUnitsByProductCode,
  deleteById,
  getFactorsByProductCodes,
};

export default productsBarCodeApi;
