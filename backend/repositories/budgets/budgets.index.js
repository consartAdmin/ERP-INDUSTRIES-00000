// ╔══════════════════════════════════════════════════════════════════════╗
// ║ budgets.index.js — Service/API de acesso a dados de Orçamentos (ESM) ║
// ║ Mantém a mesma API pública do antigo budgetsApi.js                   ║
// ║ CONSART ERP — PostgreSQL (pool)                                      ║
// ║ ✅ AUTO: seller_id via sellerByUser (ctx.userId)                     ║
// ║ ✅ HARDEN: resolve colunas case-sensitive / case-insensitive         ║
// ║ ✅ Itens: persiste product_code/barcode_id/grade/price/commission    ║
// ║ ✅ AUTO: resolve commission_id via public."commissions"              ║
// ║ ✅ LOTES: persiste lot_id em public."budgetsItems"                   ║
// ║ ✅ STOCK OVERRIDE: valida token HMAC assinado                        ║
// ║ ✅ NOVO: persiste desconto geral e totais do orçamento               ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { ensureTables } from './budgetsSchema.repository.js';
import { search, list } from './budgetsQuery.repository.js';
import { getById } from './budgetsGetById.repository.js';
import { create } from './budgetsCreate.repository.js';
import { update } from './budgetsUpdate.repository.js';
import { remove } from './budgetsRemove.repository.js';
import { getTotals } from './budgetsTotals.repository.js';
import { copyFromBudget } from './budgetsCopy.repository.js';

export {
  ensureTables,
  search,
  list,
  getById,
  create,
  update,
  remove,
  getTotals,
  copyFromBudget,
};

// ----------------------------------------------------------------------
// Export default
// ----------------------------------------------------------------------
const budgetsApi = {
  ensureTables,
  search,
  list,
  getById,
  create,
  update,
  remove,
  getTotals,
  copyFromBudget,
};

export default budgetsApi;
