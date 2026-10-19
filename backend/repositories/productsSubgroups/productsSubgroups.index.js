// ╔════════════════════════════════════════════════════════════════════╗
// ║ productsSubgroups.index.js — ponto de entrada do módulo            ║
// ║ Mantém a mesma API pública do antigo productsSubgroupsApi.js       ║
/* ║ - Endpoints esperados:
   ║     GET    /api/products-subgroups?q=&group_id=&is_active=&limit=&offset=
   ║     GET    /api/products-subgroups/:id
   ║     POST   /api/products-subgroups         { name, group_id?, is_active? }
   ║     PUT    /api/products-subgroups/:id     { name?, group_id?, is_active? }
   ║     DELETE /api/products-subgroups/:id     (hard delete)
   ║     UPSERT /api/products-subgroups/upsert  { name, group_id?, is_active? } */
// ╚════════════════════════════════════════════════════════════════════╝

import { ensureProductsSubgroupsTable } from './productsSubgroupsSchema.repository.js';
import { listProductsSubgroups, getProductsSubgroupById } from './productsSubgroupsQuery.repository.js';
import { createProductsSubgroup, upsertProductsSubgroupByName } from './productsSubgroupsCreate.repository.js';
import { updateProductsSubgroup, deactivateProductsSubgroup } from './productsSubgroupsUpdate.repository.js';
import { deleteProductsSubgroup } from './productsSubgroupsRemove.repository.js';

export {
  ensureProductsSubgroupsTable,
  listProductsSubgroups,
  getProductsSubgroupById,
  createProductsSubgroup,
  upsertProductsSubgroupByName,
  updateProductsSubgroup,
  deactivateProductsSubgroup,
  deleteProductsSubgroup,
};

// ──────────────────────────────────────────────────────────────────────────────
// Export default
// ──────────────────────────────────────────────────────────────────────────────
const ProductsSubgroupsAPI = Object.freeze({
  ensureProductsSubgroupsTable,
  list: listProductsSubgroups,
  getById: getProductsSubgroupById,
  create: createProductsSubgroup,
  upsertByName: upsertProductsSubgroupByName,
  update: updateProductsSubgroup,
  deactivate: deactivateProductsSubgroup,
  remove: deleteProductsSubgroup,
});

export default ProductsSubgroupsAPI;
