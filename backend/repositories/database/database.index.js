// ╔════════════════════════════════════════════════════════════════════╗
// ║ database.index.js — ponto de entrada Database Viewer / Editor      ║
// ║ Mantém a mesma API pública do antigo databaseApi.js                ║
// ╚════════════════════════════════════════════════════════════════════╝

export { listTables, getTableColumns } from './databaseSchema.repository.js';
export { countTableRows, getTableRows } from './databaseQuery.repository.js';
export { insertRow } from './databaseCreate.repository.js';
export { updateRow } from './databaseUpdate.repository.js';
export { deleteRow } from './databaseRemove.repository.js';
export { getTableStructure } from './databaseStructure.repository.js';
export { previewStructureChange, applyStructureChange } from './databaseStructureApply.repository.js';
