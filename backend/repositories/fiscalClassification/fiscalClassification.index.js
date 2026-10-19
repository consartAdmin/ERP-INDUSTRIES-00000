// ╔════════════════════════════════════════════════════════════════════╗
// ║ fiscalClassification.index.js — ponto de entrada do módulo         ║
// ║ Mantém a API pública do antigo fiscalClassificationApi.js          ║
// ╚════════════════════════════════════════════════════════════════════╝

export { TB_PROFILE, ALIAS_PROFILE, TB, ALIAS } from './fiscalClassification.constants.js';
export { ensureTable } from './fiscalClassificationSchema.repository.js';
export { create } from './fiscalClassificationCreate.repository.js';
export { update } from './fiscalClassificationUpdate.repository.js';
export { getById, list } from './fiscalClassificationQuery.repository.js';
export { remove } from './fiscalClassificationRemove.repository.js';
