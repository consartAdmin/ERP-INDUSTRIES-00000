// ╔══════════════════════════════════════════════════════════════════════╗
// ║ productFiscalCostRulesCreate.repository.js — create                  ║
// ╚══════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { PRODUCT_FISCAL_COST_RULES_INSERT_COLUMNS, prepareProductFiscalCostRuleInsert } from './productFiscalCostRules.catalog.js';
import { TB, SELECT_COLUMNS } from './productFiscalCostRules.constants.js';
import { assertPrepared, assertReference, normalize } from './productFiscalCostRules.sanitizers.js';

/* ========================================================================== */
/* Create                                                                     */
/* ========================================================================== */

export async function create(
  input,
  client = pool,
) {
  const prepared = assertPrepared(
    prepareProductFiscalCostRuleInsert(input),
  );

  const value = normalize(prepared);
  assertReference(value);

  const columns = PRODUCT_FISCAL_COST_RULES_INSERT_COLUMNS
    .filter((column) =>
      Object.prototype.hasOwnProperty.call(value, column),
    );

  const parameters = columns
    .map((_, index) => `$${index + 1}`)
    .join(', ');

  const values = columns.map(
    (column) => value[column],
  );

  const { rows } = await client.query(
    `
      INSERT INTO ${TB}
      (
        ${columns.join(', ')}
      )
      VALUES
      (
        ${parameters}
      )
      RETURNING
        ${SELECT_COLUMNS}
    `,
    values,
  );

  return rows[0];
}
