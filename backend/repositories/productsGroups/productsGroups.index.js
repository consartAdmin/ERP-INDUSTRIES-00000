// ╔════════════════════════════════════════════════════════════════════╗
// ║ productsGroups.index.js — ponto de entrada do módulo               ║
// ║ Mantém a mesma API pública do antigo productsGroupsApi.js          ║
// ╚════════════════════════════════════════════════════════════════════╝

import { ensureProductsGroupsTable } from './productsGroupsSchema.repository.js';
import { listProductsGroups, getProductsGroupById } from './productsGroupsQuery.repository.js';
import { createProductsGroup, upsertProductsGroupByName } from './productsGroupsCreate.repository.js';
import { updateProductsGroup, deactivateProductsGroup } from './productsGroupsUpdate.repository.js';
import { deleteProductsGroup } from './productsGroupsRemove.repository.js';

export {
  ensureProductsGroupsTable,
  listProductsGroups,
  getProductsGroupById,
  createProductsGroup,
  upsertProductsGroupByName,
  updateProductsGroup,
  deactivateProductsGroup,
  deleteProductsGroup,
};

// ──────────────────────────────────────────────────────────────────────────────
// Export default
// ──────────────────────────────────────────────────────────────────────────────
const ProductsGroupsAPI = Object.freeze({
  ensureProductsGroupsTable,
  list: listProductsGroups,
  getById: getProductsGroupById,
  create: createProductsGroup,
  upsertByName: upsertProductsGroupByName,
  update: updateProductsGroup,
  deactivate: deactivateProductsGroup,
  remove: deleteProductsGroup,
});

export default ProductsGroupsAPI;
