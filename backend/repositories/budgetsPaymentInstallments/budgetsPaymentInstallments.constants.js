// ╔══════════════════════════════════════════════════════════════════════╗
// ║ budgetsPaymentInstallments.constants.js — catálogo → nomes SQL       ║
// ║ Tabelas, PK/FKs, defaults e UNIQUE vindos do catalog_schema          ║
// ╚══════════════════════════════════════════════════════════════════════╝

import installmentsSchema, {
  INSTALLMENT_STATUSES
} from './budgetsPaymentInstallments.catalog.js';

import budgetsPaymentsSchema from '../budgetsPayments/budgetsPayments.catalog.js';

/* ──────────────────────────────────────────────────────────────────────
 * Catálogo → SQL
 * ──────────────────────────────────────────────────────────────────── */

export const CATALOG = installmentsSchema;
export const COLUMNS = CATALOG.columns;
export const PK = CATALOG.primaryKey;

export function quoteIdent(name) {
  return `"${String(name).replace(/"/g, '""')}"`;
}

export function qualifyTable(schema, table) {
  return `${schema}.${quoteIdent(table)}`;
}

export function foreignKeyFor(catalog, column) {
  const fk = catalog.foreignKeys.find((row) => row.column === column);
  if (!fk) {
    throw new Error(`[catalog_schema.${catalog.table}] FK ausente para a coluna ${column}.`);
  }
  return fk;
}

export const FK_PAYMENT = foreignKeyFor(CATALOG, 'budget_payment_id');
export const FK_METHOD = foreignKeyFor(budgetsPaymentsSchema, 'payment_method_id');

export const TB_INSTALLMENTS = qualifyTable(CATALOG.schema, CATALOG.table);
export const TB_BUDGETS_PAYMENTS = qualifyTable(budgetsPaymentsSchema.schema, FK_PAYMENT.references.table);
export const TB_PAYMENT_METHODS = qualifyTable(budgetsPaymentsSchema.schema, FK_METHOD.references.table);
export const TB_BUDGETS = 'public.budgets';

export const Q_PK = quoteIdent(PK);
export const Q_PAYMENT_FK = quoteIdent(FK_PAYMENT.column);
export const Q_PAYMENT_PK = quoteIdent(FK_PAYMENT.references.column);
export const Q_METHOD_FK = quoteIdent(FK_METHOD.column);
export const Q_METHOD_PK = quoteIdent(FK_METHOD.references.column);

export const DEFAULT_STATUS = COLUMNS.status.default;
export const DEFAULT_PAID_AMOUNT = COLUMNS.paid_amount.default;

export const UNIQUE_INSTALLMENT_NUMBER = CATALOG.uniques.find(
  (row) => row.columns.includes('installment_number')
);

export { INSTALLMENT_STATUSES };
