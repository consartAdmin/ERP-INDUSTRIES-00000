// ╔════════════════════════════════════════════════════════════════════╗
// ║ cashDocumentTypes.index.js — ponto de entrada tipos de documento   ║
// ║ Mantém a mesma API pública do antigo cashDocumentTypesApi.js       ║
// ║ (sem export default, como no original)                             ║
// ╚════════════════════════════════════════════════════════════════════╝

export {
  ensureCashDocumentTypesTable,
  seedCashDocumentTypes,
} from './cashDocumentTypesSchema.repository.js';
export {
  listCashDocumentTypes,
  getCashDocumentTypeById,
} from './cashDocumentTypesQuery.repository.js';
export { createCashDocumentType } from './cashDocumentTypesCreate.repository.js';
export {
  updateCashDocumentType,
  setCashDocumentTypeActive,
  toggleCashDocumentTypeActive,
  removeCashDocumentType,
} from './cashDocumentTypesUpdate.repository.js';
