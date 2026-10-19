// ╔════════════════════════════════════════════════════════════════════╗
// ║ productsSuppliers.index.js — ponto de entrada do módulo            ║
// ║ Mantém a mesma API pública do antigo productsSuppliersApi.js       ║
// ║ Vínculo Produto x Fornecedor — public."productsSuppliers"          ║
// ║ Funções exportadas:                                                ║
// ║   ensureProductsSuppliersTable()                                   ║
// ║   list({ page, limit, product_id, supplier_id })                   ║
// ║   listByProduct(productId)                                         ║
// ║   listBySupplier(supplierId)                                       ║
// ║   addLink({ product_id, supplier_id, is_primary })                 ║
// ║   setPrimary(product_supplier_id)                                  ║
// ║   remove(product_supplier_id)                                      ║
// ╚════════════════════════════════════════════════════════════════════╝

import { ensureProductsSuppliersTable } from './productsSuppliersSchema.repository.js';
import { list, listByProduct, listBySupplier } from './productsSuppliersQuery.repository.js';
import { addLink, setPrimary } from './productsSuppliersLink.repository.js';
import { remove } from './productsSuppliersRemove.repository.js';

export {
  ensureProductsSuppliersTable,
  list,
  listByProduct,
  listBySupplier,
  addLink,
  setPrimary,
  remove,
};

/* ──────────────────────────────────────────────────────────────
   Export default (bundle)
────────────────────────────────────────────────────────────── */
export default {
  ensureProductsSuppliersTable,
  list,
  listByProduct,
  listBySupplier,
  addLink,
  setPrimary,
  remove,
};
