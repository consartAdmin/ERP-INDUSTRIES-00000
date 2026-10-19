// ╔════════════════════════════════════════════════════════════════════╗
// ║ customerSubSegments.index.js — ponto de entrada subsegmentos       ║
// ║ Mantém a mesma API pública do antigo customerSubSegmentsApi.js     ║
// ║ subsegment_code gerado automaticamente: SUB-{subsegment_id}        ║
// ╚════════════════════════════════════════════════════════════════════╝

import { TB, ALIAS } from './customerSubSegments.constants.js';
import { ensureTable } from './customerSubSegmentsSchema.repository.js';
import { list, getById } from './customerSubSegmentsQuery.repository.js';
import { create } from './customerSubSegmentsCreate.repository.js';
import { update, remove } from './customerSubSegmentsUpdate.repository.js';

export { TB, ALIAS, ensureTable, list, getById, create, update, remove };

export default {
  ensureTable,
  list,
  getById,
  create,
  update,
  remove
};
