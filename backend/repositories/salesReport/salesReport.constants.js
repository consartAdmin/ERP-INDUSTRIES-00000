// ╔════════════════════════════════════════════════════════════════════╗
// ║ salesReport.constants.js — Tabelas e status de NF-e                ║
// ║ Fonte oficial do faturamento: public."invoicesIssued"              ║
// ╚════════════════════════════════════════════════════════════════════╝

export const TB_INVOICES = 'public."invoicesIssued"';
export const TB_ORDERS = 'public."orders"';
export const TB_ORDER_ITEMS = 'public."ordersItems"';
export const TB_BUDGET_ITEMS = 'public."budgetsItems"';
export const TB_PRODUCTS = 'public."products"';
export const TB_BUDGETS = 'public."budgets"';
export const TB_SELLER_BY_BUDGETS = 'public."sellerByBudgets"';
export const TB_NFE_STATUS_MAP = 'public."nfeStatusMap"';

export const NFE_VALIDAS = Object.freeze([
  'CONCLUIDO', 'CONCLUÍDO', 'CONCLUIDA', 'CONCLUÍDA',
  'AUTORIZADA', 'AUTORIZADO', 'EMITIDA', 'EMITIDO',
  'APROVADA', 'APROVADO', 'FINALIZADA', 'FINALIZADO',
  'AUTHORIZED', 'APPROVED', 'ISSUED',
]);

export const NFE_EXCLUIR = Object.freeze([
  'CANCELADA', 'CANCELADO', 'CANCELLED', 'CANCELED',
  'DENIED', 'DENEGADA', 'DENEGADO',
  'REJEITADA', 'REJEITADO', 'REJECTED',
]);
