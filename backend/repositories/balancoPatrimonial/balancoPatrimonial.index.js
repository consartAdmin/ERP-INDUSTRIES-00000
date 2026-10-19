// ╔════════════════════════════════════════════════════════════════════╗
// ║ balancoPatrimonial.index.js — ponto de entrada do módulo           ║
// ║ Mantém a mesma API pública do antigo balancoPatrimonialApi.js      ║
// ║ (somente named exports; o original não tinha default)              ║
// ╚════════════════════════════════════════════════════════════════════╝

export { ensureTable } from './balancoPatrimonialSchema.repository.js';
export { list, getById } from './balancoPatrimonialQuery.repository.js';
export { create, update, remove } from './balancoPatrimonialMutation.repository.js';
