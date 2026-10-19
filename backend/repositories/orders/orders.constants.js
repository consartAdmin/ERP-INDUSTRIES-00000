// ╔══════════════════════════════════════════════════════════════════════╗
// ║ orders.constants.js — Tabelas de pedidos                             ║
// ║ Nomes de tabelas + validação dos catálogos no import                 ║
// ╚══════════════════════════════════════════════════════════════════════╝

import {
  ordersSchema,
  ORDERS_TABLE,
  ORDERS_PRIMARY_KEY,
  ORDER_COLUMNS,
  ORDER_INSERT_COLUMNS,
  ORDER_UPDATE_COLUMNS,
  ORDER_MONEY_COLUMNS,
  ORDER_REQUIRED_COLUMNS,
  ORDER_DEFAULTS,
} from './orders.catalog.js';
import {
  ordersItemsSchema,
  ORDERS_ITEMS_TABLE,
  ORDERS_ITEMS_PRIMARY_KEY,
  ORDER_ITEM_COLUMNS,
  ORDER_ITEM_INSERT_COLUMNS,
  ORDER_ITEM_NUMERIC_COLUMNS,
  ORDER_ITEM_REQUIRED_COLUMNS,
  ORDER_ITEM_DEFAULTS,
} from './ordersItems.catalog.js';

// Tabelas vindas dos catálogos
export const TB_ORDERS = ORDERS_TABLE;
export const TB_ORDER_ITEMS = ORDERS_ITEMS_TABLE;
export const TB_BUDGETS = ordersSchema.relations.budget.table;
export const TB_ORDER_SHIPPING = ordersSchema.relations.shipping.table;
export const TB_ORDERS_PAYMENTS = ordersSchema.children.payments.table;
export const TB_GRADES = ordersItemsSchema.relations.grade.table;
export const TB_PRODUCTS = ordersItemsSchema.relations.product.table;

// Tabelas ainda sem catálogo
export const TB_BUDGET_ITEMS = 'public."budgetsItems"';
export const TB_INVOICES_ISSUED = 'public."invoicesIssued"';
export const TB_PRODUCTS_GRADES = 'public."productsGrades"';

// 🔹 Tabelas fiscal V2
export const TB_PRODUCTS_FISCAL = 'public."productsFiscalV2"';
export const TB_FISCAL_CLASSIFICATION = 'public."fiscalClassificationV2"';
export const TB_FISCAL_PROFILE = 'public."fiscalProfileV2"';

// 🔹 Tabelas de cliente (IBGE)
export const TB_CUSTOMERS = 'public."customers"';
export const TB_CUSTOMERS_IBGE = 'public."customersIbge"';

export const TB_SELLER_BY_USER = 'public."sellerByUser"';

// 🔹 Tabelas de pagamento do orçamento
export const TB_BUDGET_PAYMENTS = 'public."budgetsPayments"';
export const TB_PAYMENT_METHODS = 'public."paymentMethods"';
export const TB_BUDGET_PAYMENT_INSTALLMENTS = 'public."budgetsPaymentInstallments"';

export const TB_ORDERS_PAYMENT_INSTALLMENTS = 'public."ordersPaymentInstallments"';

export const TB_BUDGET_SHIPPING = 'public."budgetsShipping"';

// ----------------------------------------------------------------------
// Validação dos catálogos (falha no import se algo estiver inconsistente)
// ----------------------------------------------------------------------
export const ORDER_COLUMN_SET = new Set(ORDER_COLUMNS);
export const ORDER_MONEY_COLUMN_SET = new Set(ORDER_MONEY_COLUMNS);
export const ORDER_ITEM_COLUMN_SET = new Set(ORDER_ITEM_COLUMNS);

export function assertCatalogColumns(columns, catalog, context) {
  const invalid = columns.filter((column) => !catalog.has(column));
  if (invalid.length) {
    throw new Error(
      `[ordersApi] ${context}: coluna(s) ausente(s) no catálogo: ${invalid.join(', ')}`,
    );
  }
}

// Consistência interna: toda lista derivada precisa existir em *_COLUMNS
assertCatalogColumns([ORDERS_PRIMARY_KEY], ORDER_COLUMN_SET, 'ORDERS_PRIMARY_KEY');
assertCatalogColumns(ORDER_INSERT_COLUMNS, ORDER_COLUMN_SET, 'ORDER_INSERT_COLUMNS');
assertCatalogColumns(ORDER_UPDATE_COLUMNS, ORDER_COLUMN_SET, 'ORDER_UPDATE_COLUMNS');
assertCatalogColumns(ORDER_MONEY_COLUMNS, ORDER_COLUMN_SET, 'ORDER_MONEY_COLUMNS');
assertCatalogColumns(ORDER_REQUIRED_COLUMNS, ORDER_COLUMN_SET, 'ORDER_REQUIRED_COLUMNS');
assertCatalogColumns(Object.keys(ORDER_DEFAULTS), ORDER_COLUMN_SET, 'ORDER_DEFAULTS');

assertCatalogColumns([ORDERS_ITEMS_PRIMARY_KEY], ORDER_ITEM_COLUMN_SET, 'ORDERS_ITEMS_PRIMARY_KEY');
assertCatalogColumns(ORDER_ITEM_INSERT_COLUMNS, ORDER_ITEM_COLUMN_SET, 'ORDER_ITEM_INSERT_COLUMNS');
assertCatalogColumns(ORDER_ITEM_NUMERIC_COLUMNS, ORDER_ITEM_COLUMN_SET, 'ORDER_ITEM_NUMERIC_COLUMNS');
assertCatalogColumns(ORDER_ITEM_REQUIRED_COLUMNS, ORDER_ITEM_COLUMN_SET, 'ORDER_ITEM_REQUIRED_COLUMNS');
assertCatalogColumns(Object.keys(ORDER_ITEM_DEFAULTS), ORDER_ITEM_COLUMN_SET, 'ORDER_ITEM_DEFAULTS');

// Colunas referenciadas em SQL escrito à mão neste arquivo
assertCatalogColumns([
  'order_id', 'budget_id', 'issue_date', 'status', 'customer_id',
  'customer_name', 'customer_tax_id', 'customer_email', 'order_shipping_id',
  'subtotal', 'items_discount_total', 'global_discount_amount',
  'total_discount', 'total_amount', 'updated_at',
], ORDER_COLUMN_SET, 'SQL manual public.orders');

assertCatalogColumns([
  'order_id', 'product_code', 'grade_id', 'quantity',
], ORDER_ITEM_COLUMN_SET, 'SQL manual public.ordersItems');

if (ordersSchema.children.items.table !== ORDERS_ITEMS_TABLE) {
  throw new Error(
    `[ordersApi] ordersSchema.children.items (${ordersSchema.children.items.table}) ` +
    `diverge de ORDERS_ITEMS_TABLE (${ORDERS_ITEMS_TABLE}).`,
  );
}
