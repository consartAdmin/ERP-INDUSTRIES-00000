// ╔════════════════════════════════════════════════════════════════════╗
// ║ productsDescriptions.index.js — ponto de entrada do módulo         ║
// ║ Mantém a mesma API pública do antigo productsDescriptionsApi.js    ║
// ╚════════════════════════════════════════════════════════════════════╝

export { list, getById } from './productsDescriptionsQuery.repository.js';
export { create } from './productsDescriptionsCreate.repository.js';
export { update, deactivate } from './productsDescriptionsUpdate.repository.js';
export { remove } from './productsDescriptionsRemove.repository.js';
