// ╔════════════════════════════════════════════════════════════════════╗
// ║ crmDealsOutcomes.index.js — ponto de entrada do catálogo de        ║
// ║ resultados (outcomes) do CRM                                       ║
// ║ Mantém a mesma API pública do antigo crmDealsOutcomesApi.js        ║
// ║ (apenas named exports; o original não tinha default)              ║
// ╚════════════════════════════════════════════════════════════════════╝

export {
  listCrmDealsOutcomes,
  getCrmDealsOutcomeById,
  getCrmDealsOutcomeByCode,
} from './crmDealsOutcomesQuery.repository.js';
export { createCrmDealsOutcome } from './crmDealsOutcomesCreate.repository.js';
export { updateCrmDealsOutcome } from './crmDealsOutcomesUpdate.repository.js';
export { deleteCrmDealsOutcome } from './crmDealsOutcomesRemove.repository.js';
export {
  listCrmDealsOutcomesSummary,
  listOperationsByOutcomeCode,
  listOperationsByOutcomeId,
} from './crmDealsOutcomesOperations.repository.js';
