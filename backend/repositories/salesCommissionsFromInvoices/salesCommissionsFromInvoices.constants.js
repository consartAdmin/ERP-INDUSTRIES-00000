// ╔════════════════════════════════════════════════════════════════════╗
// ║ salesCommissionsFromInvoices.constants.js — Tabelas e defaults     ║
// ╚════════════════════════════════════════════════════════════════════╝

export const TB_SCI = 'public."salesCommissionsFromInvoices"';
export const TB_INVOICES = 'public."invoicesIssued"';
export const TB_ORDERS = 'public."orders"';
// Itens do pedido: a tabela é "ordersItems" (SKU na coluna product_code).
export const TB_ORDER_ITEMS = 'public."ordersItems"';
export const TB_PRICES = 'public."prices"';
export const TB_PC = 'public."priceCommissions"';
export const TB_SELLERS = 'public."sellers"';
export const TB_BUDGETS = 'public."budgets"';
export const TB_SELLER_BY_BUDGETS = 'public."sellerByBudgets"';
/*
 * Itens do orçamento: tabela ATUAL (budgetsItems).
 * Antes apontava para a legada "budgetItens", congelada no orçamento 160 —
 * o price_id do orçamento não era encontrado para nada recente.
 * A coluna de SKU lá é product_code (a legada usava sku).
 */
export const TB_BUDGET_ITEMS = 'public."budgetsItems"';

// Tentativas de NF-e (fonte da geração das comissões)
export const TB_BUDGETS_NFE_ATTEMPTS = 'public."budgetsNfeAttempts"';
export const TB_BUDGETS_NFE_ATTEMPT_ITEMS = 'public."budgetsNfeAttemptItems"';
export const TB_ORDERS_NFE_ATTEMPTS = 'public."ordersNfeAttempts"';
export const TB_ORDERS_NFE_ATTEMPT_ITEMS = 'public."ordersNfeAttemptItems"';

// nfeStatusMap: 3 = AUTORIZADA
export const NFE_STATUS_AUTHORIZED_ID = 3;

export const DEFAULT_PRICE_ID = 1;
