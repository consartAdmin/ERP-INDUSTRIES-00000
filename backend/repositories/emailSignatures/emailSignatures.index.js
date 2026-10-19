// ╔════════════════════════════════════════════════════════════════════╗
// ║ emailSignatures.index.js — ponto de entrada do módulo              ║
// ║ Mantém a mesma API pública do antigo emailSignaturesApi.js         ║
// ╚════════════════════════════════════════════════════════════════════╝

import { EMAIL_SIGNATURES_TABLE } from './emailSignatures.constants.js';
import { list, getById, getDefault } from './emailSignaturesQuery.repository.js';
import { create } from './emailSignaturesCreate.repository.js';
import { update, setDefault } from './emailSignaturesUpdate.repository.js';
import { remove } from './emailSignaturesRemove.repository.js';

export { EMAIL_SIGNATURES_TABLE };

const emailSignaturesApi = {
  list,
  getById,
  getDefault,
  create,
  update,
  setDefault,
  remove,
};

export default emailSignaturesApi;
