// ╔════════════════════════════════════════════════════════════════════╗
// ║ mobilized.index.js — ponto de entrada do módulo Imobilizado        ║
// ║ Mantém a mesma API pública do antigo mobilizedApi.js               ║
// ╚════════════════════════════════════════════════════════════════════╝

export { createMobilized } from './mobilizedCreate.repository.js';
export { getMobilizedById, listMobilized } from './mobilizedQuery.repository.js';
export { updateMobilized } from './mobilizedUpdate.repository.js';
export { deleteMobilized } from './mobilizedRemove.repository.js';
export {
  listMobilizedItems,
  getMobilizedItemById,
  addMobilizedItem,
  updateMobilizedItem,
  deleteMobilizedItem,
} from './mobilizedItems.repository.js';
export {
  listMobilizedAttachments,
  getMobilizedAttachmentById,
  createMobilizedAttachment,
  updateMobilizedAttachment,
  setPrimaryMobilizedAttachment,
  deleteMobilizedAttachment,
} from './mobilizedAttachments.repository.js';
