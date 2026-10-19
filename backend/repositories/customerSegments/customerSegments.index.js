// ╔════════════════════════════════════════════════════════════════════╗
// ║ customerSegments.index.js — ponto de entrada do módulo segmentos   ║
// ║ Mantém a mesma API pública do antigo customerSegmentsApi.js        ║
// ║ segment_code gerado automaticamente: SEG-000001                    ║
// ╚════════════════════════════════════════════════════════════════════╝

import { TB, ALIAS } from './customerSegments.constants.js';
import { ensureTable } from './customerSegmentsSchema.repository.js';
import { list, getById } from './customerSegmentsQuery.repository.js';
import { create } from './customerSegmentsCreate.repository.js';
import { update, remove } from './customerSegmentsUpdate.repository.js';

export { TB, ALIAS, ensureTable, list, getById, create, update, remove };

export default {
  ensureTable,
  list,
  getById,
  create,
  update,
  remove
};
