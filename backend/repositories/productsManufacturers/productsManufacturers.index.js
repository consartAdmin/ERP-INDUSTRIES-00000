// ╔════════════════════════════════════════════════════════════════════╗
// ║ productsManufacturers.index.js — ponto de entrada do módulo        ║
// ║ Mantém a mesma API pública do antigo productsManufacturersApi.js   ║
// ║ Endpoints esperados:                                               ║
// ║   GET    /api/products-manufacturers                               ║
// ║   GET    /api/products-manufacturers/:id                           ║
/* ║   POST   /api/products-manufacturers           { name, is_active? }
   ║   PUT    /api/products-manufacturers/:id       { name?, is_active? }
   ║   DELETE /api/products-manufacturers/:id       (hard delete)
   ║   UPSERT /api/products-manufacturers/upsert    { name, is_active? }      */
// ╚════════════════════════════════════════════════════════════════════╝

import { ensureProductsManufacturersTable } from './productsManufacturersSchema.repository.js';
import { listProductsManufacturers, getProductsManufacturerById } from './productsManufacturersQuery.repository.js';
import { createProductsManufacturer, upsertProductsManufacturerByName } from './productsManufacturersCreate.repository.js';
import { updateProductsManufacturer, deactivateProductsManufacturer } from './productsManufacturersUpdate.repository.js';
import { deleteProductsManufacturer } from './productsManufacturersRemove.repository.js';

export {
  ensureProductsManufacturersTable,
  listProductsManufacturers,
  getProductsManufacturerById,
  createProductsManufacturer,
  upsertProductsManufacturerByName,
  updateProductsManufacturer,
  deactivateProductsManufacturer,
  deleteProductsManufacturer,
};

const ProductsManufacturersAPI = Object.freeze({
  ensureProductsManufacturersTable,
  list: listProductsManufacturers,
  getById: getProductsManufacturerById,
  create: createProductsManufacturer,
  upsertByName: upsertProductsManufacturerByName,
  update: updateProductsManufacturer,
  deactivate: deactivateProductsManufacturer,
  remove: deleteProductsManufacturer,
});

export default ProductsManufacturersAPI;
