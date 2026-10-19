// ╔════════════════════════════════════════════════════════════════════╗
// ║ grades.index.js — ponto de entrada do módulo                       ║
// ║ Mantém a mesma API pública do antigo gradesApi.js                  ║
// ║ Funções: ensureTable, list, getById, create, update, remove        ║
// ║ CONSART ERP — Controle de grades (cores, tamanhos, variações)      ║
// ╚════════════════════════════════════════════════════════════════════╝

import { ensureTable } from './gradesSchema.repository.js';
import { list, getById } from './gradesQuery.repository.js';
import { create } from './gradesCreate.repository.js';
import { update } from './gradesUpdate.repository.js';
import { remove } from './gradesRemove.repository.js';

export { TFULL, TNAME, ALIAS } from './grades.constants.js';
export { ensureTable, list, getById, create, update, remove };

/* ──────────────────────────────────────────────────────────────
   Export default (consistência com demais APIs)
────────────────────────────────────────────────────────────── */
export default { ensureTable, list, getById, create, update, remove };
