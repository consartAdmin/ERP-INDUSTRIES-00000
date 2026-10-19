// ╔════════════════════════════════════════════════════════════════════╗
// ║ salesAnalytics.constants.js — Tabelas e status de NF-e excluídos   ║
// ║ Fonte oficial de vendas: public."invoicesIssued"                   ║
// ╚════════════════════════════════════════════════════════════════════╝

// ======================================================================
// TABLES
// ======================================================================

export const TB_INVOICES =
    'public."invoicesIssued"';

export const TB_ORDERS =
    'public."orders"';

export const TB_ORDER_ITEMS =
    'public."ordersItems"';

export const TB_BUDGETS =
    'public."budgets"';

export const TB_BUDGET_ITEMS =
    'public."budgetsItems"';

export const TB_PRODUCTS =
    'public."products"';

export const TB_PRODUCT_GROUPS =
    'public."productsGroups"';

export const TB_CUSTOMERS =
    'public."customers"';


// ======================================================================
// NF-E STATUSES THAT MUST NOT COUNT AS SALES
// ======================================================================

export const NFE_EXCLUDED_STATUSES = [
    'CANCELADO',
    'CANCELADA',
    'CANCELLED',
    'DENIED',
    'REJEITADO',
    'REJEITADA',
    'REJECTED',
];

