// ╔════════════════════════════════════════════════════════════════════╗
// ║ prices.index.js — ponto de entrada do módulo tabelas de preço      ║
// ║ Mantém a mesma API pública do antigo pricesApi.js                  ║
// ╚════════════════════════════════════════════════════════════════════╝

export { ensurePricesTable } from './prices.schema.js';
export { listSimple, list, getById } from './pricesQuery.repository.js';
export { create } from './pricesCreate.repository.js';
export { update, softDelete, restore } from './pricesUpdate.repository.js';
export { permanentDelete } from './pricesRemove.repository.js';
