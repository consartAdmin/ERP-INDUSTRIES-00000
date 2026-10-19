// ╔════════════════════════════════════════════════════════════════════╗
// ║ customersCredit.index.js — ponto de entrada do módulo crédito      ║
// ║ Mantém a mesma API pública do antigo customersCreditApi.js         ║
// ╚════════════════════════════════════════════════════════════════════╝

import { getByCustomerId, list } from './customersCreditQuery.repository.js';
import { upsertByCustomerId } from './customersCreditUpsert.repository.js';
import { removeByCustomerId } from './customersCreditRemove.repository.js';

export { getByCustomerId, list, upsertByCustomerId, removeByCustomerId };

export default { getByCustomerId, list, upsertByCustomerId, removeByCustomerId };
