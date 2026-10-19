// ╔════════════════════════════════════════════════════════════════════╗
// ║ productsUnits.index.js — ponto de entrada do módulo                ║
// ║ Mantém a mesma API pública do antigo productsUnitsApi.js           ║
// ╚════════════════════════════════════════════════════════════════════╝

import { ensureProductsUnitsTable } from './productsUnitsSchema.repository.js';
import { listProductsUnits, getProductsUnitById } from './productsUnitsQuery.repository.js';
import { createProductsUnit, upsertProductsUnit } from './productsUnitsCreate.repository.js';
import { updateProductsUnit } from './productsUnitsUpdate.repository.js';
import { deactivateProductsUnit, deleteProductsUnit } from './productsUnitsRemove.repository.js';
import {
  factorsBySkus,
  getFactorsMapBySkus,
  getByBarcode,
  listByProduct,
} from './productsUnitsLookup.repository.js';

export {
  ensureProductsUnitsTable,
  listProductsUnits,
  getProductsUnitById,
  createProductsUnit,
  upsertProductsUnit,
  updateProductsUnit,
  deactivateProductsUnit,
  deleteProductsUnit,
  factorsBySkus,
  getFactorsMapBySkus,
  getByBarcode,
  listByProduct,
};

/* ──────────────────────────────────────────────────────────────────────────────
   Export default
───────────────────────────────────────────────────────────────────────────── */
const ProductsUnitsAPI = Object.freeze({
  ensureProductsUnitsTable,

  list:       listProductsUnits,
  getById:    getProductsUnitById,
  create:     createProductsUnit,
  upsert:     upsertProductsUnit,
  update:     updateProductsUnit,
  deactivate: deactivateProductsUnit,
  remove:     deleteProductsUnit,

  // extras
  factorsBySkus,
  getByBarcode,
  getFactorsMapBySkus,
  listByProduct,
});

export default ProductsUnitsAPI;
