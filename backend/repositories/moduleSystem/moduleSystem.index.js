// ╔════════════════════════════════════════════════════════════════════╗
// ║ moduleSystem.index.js — ponto de entrada cadastro de módulos       ║
// ║ Mantém a mesma API pública do antigo moduleSystemApi.js            ║
// ╚════════════════════════════════════════════════════════════════════╝

export { ensureTable } from './moduleSystemSchema.repository.js';
export { list, findById, listChildren } from './moduleSystemQuery.repository.js';
export { getMenuTree } from './moduleSystemMenu.repository.js';
export { create } from './moduleSystemCreate.repository.js';
export { update } from './moduleSystemUpdate.repository.js';
export { remove, removeTestRecords } from './moduleSystemRemove.repository.js';
