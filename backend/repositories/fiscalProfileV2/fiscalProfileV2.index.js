// ╔════════════════════════════════════════════════════════════════════╗
// ║ fiscalProfileV2.index.js — ponto de entrada do módulo              ║
// ║ Mantém a mesma API pública do antigo fiscalProfileV2Api.js         ║
// ╚════════════════════════════════════════════════════════════════════╝

import { list, getById } from './fiscalProfileV2Query.repository.js';
import { create } from './fiscalProfileV2Create.repository.js';
import { update, setActive } from './fiscalProfileV2Update.repository.js';

export { list, getById, create, update, setActive };

export default {
  list,
  getById,
  create,
  update,
  setActive,
};
