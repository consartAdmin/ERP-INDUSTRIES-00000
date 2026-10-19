// ╔════════════════════════════════════════════════════════════════════╗
// ║ productsLmRef.index.js — ponto de entrada do módulo                ║
// ║ Mantém a mesma API pública do antigo productsLmRefApi.js           ║
// ╚════════════════════════════════════════════════════════════════════╝

export { findAllProductsLmRef, findProductLmRefById } from './productsLmRefQuery.repository.js';
export { createProductLmRef } from './productsLmRefCreate.repository.js';
export { updateProductLmRef } from './productsLmRefUpdate.repository.js';
export { deleteProductLmRef } from './productsLmRefRemove.repository.js';
