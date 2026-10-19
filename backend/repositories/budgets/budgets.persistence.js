// ╔══════════════════════════════════════════════════════════════════════╗
// ║ budgets.persistence.js — Helpers de persistência via catálogo        ║
// ║ BUDGET_HEADER_PERSIST_COLUMNS / buildBudgetInsert|UpdateData         ║
// ╚══════════════════════════════════════════════════════════════════════╝

import {
  BUDGETS_INSERT_COLUMNS,
  isBudgetColumn,
  prepareBudgetInsert,
  prepareBudgetUpdate,
} from './budgets.catalog.js';

// ----------------------------------------------------------------------
// Budget catalog persistence helpers
// ----------------------------------------------------------------------
export const BUDGET_HEADER_PERSIST_COLUMNS = Object.freeze(
  BUDGETS_INSERT_COLUMNS.filter((column) =>
    [
      'issue_date',
      'status',
      'operation_type_id',
      'customer_id',
      'customer_name',
      'customer_tax_id',
      'customer_email',
      'customer_phone',
      'budget_shipping_id',
      'notes',
      'payment_form_id',
      'payment_term_id',
      'seller_id',
      'price_id',
      'subtotal',
      'items_discount_total',
      'total_discount',
      'global_discount_type',
      'global_discount_value',
      'global_discount_amount',
      'total_amount',
    ].includes(column)
  )
);

export function assertBudgetCatalogColumns(columns = []) {
  const invalid = columns.filter((column) => !isBudgetColumn(column));

  if (invalid.length) {
    throw new Error(
      `Coluna(s) de budgets fora do catálogo: ${invalid.join(', ')}`
    );
  }
}

assertBudgetCatalogColumns(BUDGET_HEADER_PERSIST_COLUMNS);

export function buildBudgetInsertData(header = {}) {
  const prepared = prepareBudgetInsert(header);

  if (!prepared.valid) {
    const message = prepared.errors
      .map((error) => error?.message || String(error))
      .join(' | ');

    throw new Error(message || 'Payload de orçamento inválido.');
  }

  return prepared.data;
}

export function buildBudgetUpdateData(header = {}) {
  const prepared = prepareBudgetUpdate(header);

  if (!prepared.valid) {
    const message = prepared.errors
      .map((error) => error?.message || String(error))
      .join(' | ');

    throw new Error(message || 'Payload de orçamento inválido.');
  }

  return prepared.data;
}
