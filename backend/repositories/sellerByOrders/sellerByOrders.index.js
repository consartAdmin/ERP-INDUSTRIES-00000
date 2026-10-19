// ╔════════════════════════════════════════════════════════════════════╗
// ║ sellerByOrders.index.js — ponto de entrada Vendedor x Pedido       ║
// ║ Mantém a mesma API pública do antigo sellerByOrdersApi.js          ║
// ╚════════════════════════════════════════════════════════════════════╝

export { ensureTable } from './sellerByOrdersSchema.repository.js';
export { listByOrder } from './sellerByOrdersQuery.repository.js';
export { upsertForOrder, patchSeller } from './sellerByOrdersUpsert.repository.js';
export { remove } from './sellerByOrdersRemove.repository.js';
