// ╔════════════════════════════════════════════════════════════════════╗
// ║ productsKits.index.js — ponto de entrada do módulo                 ║
// ║ Mantém a mesma API pública do antigo productsKitsApi.js            ║
// ╚════════════════════════════════════════════════════════════════════╝

export { ensureProductsKitsTables } from './productsKitsSchema.repository.js';
export { listProductsKits, getProductsKitById } from './productsKitsQuery.repository.js';
export { createProductsKit } from './productsKitsCreate.repository.js';
export { updateProductsKit } from './productsKitsUpdate.repository.js';
export { deleteProductsKit, hardDeleteProductsKit } from './productsKitsRemove.repository.js';
