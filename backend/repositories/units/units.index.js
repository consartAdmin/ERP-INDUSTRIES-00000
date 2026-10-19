// ╔════════════════════════════════════════════════════════════════════╗
// ║ units.index.js — ponto de entrada do módulo Unidades               ║
// ║ Mantém a mesma API pública do antigo unitsApi.js                   ║
// ║ USO: import * as Units from '.../units/units.index.js'             ║
// ╚════════════════════════════════════════════════════════════════════╝

export { ensureTable } from './unitsSchema.repository.js';
export { list, getById } from './unitsQuery.repository.js';
export { create, upsertByUnit } from './unitsCreate.repository.js';
export { update, deactivate } from './unitsUpdate.repository.js';
export { remove } from './unitsRemove.repository.js';
