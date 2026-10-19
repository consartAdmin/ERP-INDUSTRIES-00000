// ╔══════════════════════════════════════════════════════════════════════╗
// ║ budgetsPayments.constants.js — catálogo → nomes SQL                  ║
// ║ Tabelas, PK/FKs e defaults vindos do catalog_schema                  ║
// ╚══════════════════════════════════════════════════════════════════════╝

import budgetsPaymentsSchema, {
  BOLETO_MODES,
  COLLECTION_PROVIDERS
} from './budgetsPayments.catalog.js';

/* ──────────────────────────────────────────────────────────────────────
 * Catálogo → SQL
 * ──────────────────────────────────────────────────────────────────── */

export const CATALOG = budgetsPaymentsSchema;
export const COLUMNS = CATALOG.columns;
export const PK = CATALOG.primaryKey;

export function quoteIdent(name) {
  return `"${String(name).replace(/"/g, '""')}"`;
}

export function qualifyTable(table, schema = CATALOG.schema) {
  return `${schema}.${quoteIdent(table)}`;
}

export function foreignKeyFor(column) {
  const fk = CATALOG.foreignKeys.find((row) => row.column === column);
  if (!fk) {
    throw new Error(`[catalog_schema.budgetsPayments] FK ausente para a coluna ${column}.`);
  }
  return fk;
}

export function referencingTable(table) {
  const ref = CATALOG.referencedBy.find((row) => row.table === table);
  if (!ref) {
    throw new Error(`[catalog_schema.budgetsPayments] referencedBy ausente para ${table}.`);
  }
  return ref;
}

export const FK_METHOD = foreignKeyFor('payment_method_id');
export const FK_BANK_ACCOUNT = foreignKeyFor('bank_account_id');
export const REF_INSTALLMENTS = referencingTable('budgetsPaymentInstallments');

export const TB_PAYMENTS = qualifyTable(CATALOG.table);
export const TB_METHODS = qualifyTable(FK_METHOD.references.table);
export const TB_BANK_ACCOUNTS = qualifyTable(FK_BANK_ACCOUNT.references.table);
export const TB_INSTALLMENTS = qualifyTable(REF_INSTALLMENTS.table);
export const TB_BUDGETS = 'public.budgets';
export const TB_SHIPPING = 'public."budgetsShipping"';
/*
 * Itens do orçamento: tabela ATUAL (budgetsItems).
 * Antes apontava para a legada "budgetItens", que está congelada desde o
 * orçamento 160 — para qualquer orçamento novo a soma vinha zerada.
 * Verificado no schema em 16/09/2026.
 */
export const TB_ITEMS = 'public."budgetsItems"';

export const METHOD_PK = quoteIdent(FK_METHOD.references.column);
export const BANK_ACCOUNT_PK = quoteIdent(FK_BANK_ACCOUNT.references.column);

export const DEFAULT_COLLECTION_PROVIDER = COLUMNS.collection_provider.default;
export const DEFAULT_BOLETO_MODE = COLUMNS.boleto_mode.default;

export { BOLETO_MODES, COLLECTION_PROVIDERS };
