// ╔════════════════════════════════════════════════════════════════════╗
// ║ paymentForms.index.js — ponto de entrada dos meios de pagamento    ║
// ║ Mantém a mesma API pública do antigo paymentFormsApi.js            ║
// ║ (TABLE só no default, como no original)                            ║
// ╚════════════════════════════════════════════════════════════════════╝

import { TABLE } from './paymentForms.constants.js';
import { getById, getByTpag, listAll } from './paymentFormsQuery.repository.js';
import { create } from './paymentFormsCreate.repository.js';
import { update, softDelete } from './paymentFormsUpdate.repository.js';

export { getById, getByTpag, listAll, create, update, softDelete };

const paymentFormsApi = {
  TABLE,
  getById,
  getByTpag,
  listAll,
  create,
  update,
  softDelete,
};

export default paymentFormsApi;
