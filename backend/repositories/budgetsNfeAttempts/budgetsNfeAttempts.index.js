/* ╔══════════════════════════════════════════════════════════════════════╗
 * ║ budgetsNfeAttempts.index.js — DAL de tentativas de emissão NF-e    ║
 * ║ CONSART ERP · PostgreSQL · ESM                                     ║
 * ║ Mantém a mesma API pública do antigo budgetsNfeAttemptsApi.js      ║
 * ╚══════════════════════════════════════════════════════════════════════╝ */

import { list, getById, listByBudget } from './budgetsNfeAttemptsQuery.repository.js';
import { create } from './budgetsNfeAttemptsCreate.repository.js';
import { update, setStatus } from './budgetsNfeAttemptsUpdate.repository.js';
import { linkInvoice } from './budgetsNfeAttemptsLinkInvoice.repository.js';
import { remove } from './budgetsNfeAttemptsRemove.repository.js';

export {
    list,
    getById,
    listByBudget,
    create,
    update,
    setStatus,
    linkInvoice,
    remove,
};

export default {
    list,
    getById,
    listByBudget,
    create,
    update,
    setStatus,
    linkInvoice,
    remove,
};
