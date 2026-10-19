// ╔════════════════════════════════════════════════════════════════════╗
// ║ paymentMethods.index.js — ponto de entrada das formas de pagamento ║
// ║ Mantém a mesma API pública do antigo paymentMethodsApi.js          ║
// ╚════════════════════════════════════════════════════════════════════╝

import { ensureTable } from './paymentMethodsSchema.repository.js';
import { getById, list } from './paymentMethodsQuery.repository.js';
import { create } from './paymentMethodsCreate.repository.js';
import { update, toggleActive } from './paymentMethodsUpdate.repository.js';
import { remove } from './paymentMethodsRemove.repository.js';

export { ensureTable, getById, list, create, update, remove, toggleActive };

export default { ensureTable, getById, list, create, update, remove, toggleActive };
