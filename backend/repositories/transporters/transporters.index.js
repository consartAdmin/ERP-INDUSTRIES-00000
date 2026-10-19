// ╔════════════════════════════════════════════════════════════════════════╗
// ║ repositories/transporters — ponto de entrada único                     ║
// ║ Mantém a mesma API pública do antigo services/apis/transportersApi.js  ║
// ╚════════════════════════════════════════════════════════════════════════╝

import { ensureTable } from './transportersSchema.repository.js';
import { list } from './transportersQuery.repository.js';
import { getById } from './transportersGetById.repository.js';
import { create } from './transportersCreate.repository.js';
import { update } from './transportersUpdate.repository.js';
import { remove } from './transportersRemove.repository.js';

export {
  ensureTable,
  list,
  getById,
  create,
  update,
  remove,
};

// Anexos (antigo services/apis/transportersAttachmentsApi.js)
export { default as transportersAttachments } from './transportersAttachments.repository.js';

export default {
  ensureTable,
  list,
  getById,
  create,
  update,
  remove,
};
