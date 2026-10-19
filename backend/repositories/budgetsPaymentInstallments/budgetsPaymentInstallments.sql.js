// ╔══════════════════════════════════════════════════════════════════════╗
// ║ budgetsPaymentInstallments.sql.js — SQL gerado pelo catálogo         ║
// ║ ORDER BY / SELECT / INSERT / UPDATE das parcelas                     ║
// ╚══════════════════════════════════════════════════════════════════════╝

import {
  CATALOG,
  COLUMNS,
  PK,
  quoteIdent,
  TB_INSTALLMENTS,
  TB_BUDGETS_PAYMENTS,
  TB_PAYMENT_METHODS,
  Q_PK,
  Q_PAYMENT_FK,
  Q_PAYMENT_PK,
  Q_METHOD_FK,
  Q_METHOD_PK,
} from './budgetsPaymentInstallments.constants.js';

export function orderBySql(orderBy) {
  return orderBy
    .map(({ column, direction }) => `i.${quoteIdent(column)} ${direction === 'DESC' ? 'DESC' : 'ASC'}`)
    .join(', ');
}

export const ORDER_BY_BUDGET = orderBySql([
  ...CATALOG.defaultOrderBy,
  { column: PK, direction: 'ASC' }
]);

export const ORDER_BY_PAYMENT = orderBySql([
  { column: 'installment_number', direction: 'ASC' },
  { column: PK, direction: 'ASC' }
]);

export const SELECT_INSTALLMENTS_SQL = `
    SELECT
      ${Object.keys(COLUMNS).map((column) => `i.${quoteIdent(column)}`).join(',\n      ')},
      bp.${Q_METHOD_FK} AS payment_method_id,
      pm.name AS payment_method_name,
      pm.type AS payment_method_type
    FROM ${TB_INSTALLMENTS} i
    LEFT JOIN ${TB_BUDGETS_PAYMENTS} bp
      ON bp.${Q_PAYMENT_PK} = i.${Q_PAYMENT_FK}
    LEFT JOIN ${TB_PAYMENT_METHODS} pm
      ON pm.${Q_METHOD_PK} = bp.${Q_METHOD_FK}
`;

export const INSERT_INSTALLMENT_SQL = `
    INSERT INTO ${TB_INSTALLMENTS} (
      ${CATALOG.insertable.map(quoteIdent).join(',\n      ')}
    )
    VALUES (${CATALOG.insertable.map((_, i) => `$${i + 1}`).join(', ')})
    RETURNING ${Q_PK}
`;

/*
 * updated_at não entra no SET: o trigger
 * trg_budgetspaymentinstallments_updated_at (BEFORE UPDATE) cuida dele.
 */
export const UPDATE_INSTALLMENT_SQL = `
    UPDATE ${TB_INSTALLMENTS}
       SET ${CATALOG.updatable.map((column, i) => `${quoteIdent(column)} = $${i + 2}`).join(',\n           ')}
     WHERE ${Q_PK} = $1
     RETURNING ${Q_PK}
`;
