// ╔══════════════════════════════════════════════════════════════════════╗
// ║ budgetsPayments.sql.js — SQL gerado pelo catálogo                    ║
// ║ SELECT / ORDER BY / INSERT / UPDATE de pagamentos                    ║
// ╚══════════════════════════════════════════════════════════════════════╝

import {
  CATALOG,
  COLUMNS,
  PK,
  quoteIdent,
  FK_METHOD,
  TB_PAYMENTS,
  TB_METHODS,
  METHOD_PK,
} from './budgetsPayments.constants.js';

export const PAYMENT_SELECT_COLUMNS = Object.keys(COLUMNS)
  .map((column) => `bp.${quoteIdent(column)}`)
  .join(',\n      ');

export const PAYMENT_ORDER_BY = CATALOG.defaultOrderBy
  .map(({ column, direction }) => `bp.${quoteIdent(column)} ${direction === 'DESC' ? 'DESC' : 'ASC'}`)
  .join(', ');

export const SELECT_PAYMENTS_SQL = `
    SELECT
      ${PAYMENT_SELECT_COLUMNS},
      pm.name AS payment_method_name,
      pm.type AS payment_method_type,
      pm.installments,
      pm.gap_one,
      pm.gap_two,
      pm.gap_three,
      pm.gap_four
    FROM ${TB_PAYMENTS} bp
    LEFT JOIN ${TB_METHODS} pm
      ON pm.${METHOD_PK} = bp.${quoteIdent(FK_METHOD.column)}
`;

export const INSERT_PAYMENT_SQL = `
    INSERT INTO ${TB_PAYMENTS} (
      ${CATALOG.insertable.map(quoteIdent).join(',\n      ')}
    )
    VALUES (${CATALOG.insertable.map((_, i) => `$${i + 1}`).join(', ')})
    RETURNING ${quoteIdent(PK)}
`;

/*
 * updated_at não entra no SET: o trigger trg_budgetspayments_updated_at
 * (BEFORE UPDATE) já cuida dele.
 */
export const UPDATE_PAYMENT_SQL = `
    UPDATE ${TB_PAYMENTS}
       SET ${CATALOG.updatable.map((column, i) => `${quoteIdent(column)} = $${i + 2}`).join(',\n           ')}
     WHERE ${quoteIdent(PK)} = $1
     RETURNING ${quoteIdent(PK)}
`;
