// ╔════════════════════════════════════════════════════════════════════╗
// ║ licitations.index.js — ponto de entrada do módulo Licitações       ║
// ║ Mantém a mesma API pública do antigo licitationsApi.js             ║
// ╚════════════════════════════════════════════════════════════════════╝

export { ensureLicitationItemsTable } from './licitationsSchema.repository.js';
export {
  listLicitations,
  getLicitationById,
  getLicitationsSummary,
} from './licitationsQuery.repository.js';
export { createLicitation } from './licitationsCreate.repository.js';
export { updateLicitation, updateLicitationStatus } from './licitationsUpdate.repository.js';
export { deleteLicitation } from './licitationsRemove.repository.js';
export { diagnoseLicitationsDatabase } from './licitationsDiagnose.repository.js';
