// ╔════════════════════════════════════════════════════════════════════╗
// ║ groupsAndSubgroupsBatch.index.js — ponto de entrada do módulo      ║
// ║ Mantém a mesma API pública do antigo groupsAndSubgroupsBatchApi.js ║
// ╚════════════════════════════════════════════════════════════════════╝

import { batchAssignGroups } from './groupsAndSubgroupsBatchAssign.repository.js';
import { batchClearGroups } from './groupsAndSubgroupsBatchClear.repository.js';
import { batchListProducts } from './groupsAndSubgroupsBatchQuery.repository.js';

export { batchAssignGroups, batchClearGroups, batchListProducts };

export default {
  batchListProducts,
  batchAssignGroups,
  batchClearGroups,
};
