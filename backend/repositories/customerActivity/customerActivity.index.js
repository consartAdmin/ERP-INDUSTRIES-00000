// ╔════════════════════════════════════════════════════════════════════╗
// ║ customerActivity.index.js — ponto de entrada do módulo atividade   ║
// ║ Mantém a mesma API pública do antigo customerActivityApi.js        ║
// ╚════════════════════════════════════════════════════════════════════╝

export {
  listCustomerActivities,
  getCustomerActivitySummary,
} from './customerActivityQuery.repository.js';
export {
  getCustomerActivityByCustomerId,
  getCustomerActivityById,
} from './customerActivityGetById.repository.js';
export { createCustomerActivityIfMissing } from './customerActivityCreate.repository.js';
export {
  updateCustomerActivity,
  registerCustomerFollowup,
  recalculateCustomerActivityStatuses,
} from './customerActivityUpdate.repository.js';
export { applyCrmOutcomeToCustomerActivity } from './customerActivityCrmOutcome.repository.js';
