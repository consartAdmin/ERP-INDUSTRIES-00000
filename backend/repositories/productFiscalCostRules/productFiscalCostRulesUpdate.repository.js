// ╔══════════════════════════════════════════════════════════════════════╗
// ║ productFiscalCostRulesUpdate.repository.js — update                  ║
// ╚══════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { PRODUCT_FISCAL_COST_RULES_UPDATE_COLUMNS, prepareProductFiscalCostRuleUpdate } from './productFiscalCostRules.catalog.js';
import { TB, SELECT_COLUMNS } from './productFiscalCostRules.constants.js';
import { assertPrepared, assertReference, normalize } from './productFiscalCostRules.sanitizers.js';
import { getById } from './productFiscalCostRulesGetById.repository.js';

/* ========================================================================== */
/* Update                                                                     */
/* ========================================================================== */

export async function update(
  ruleId,
  input,
  client = pool,
) {
  const id = Number(ruleId);

  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }

  const current = await getById(
    id,
    client,
  );

  if (!current) {
    return null;
  }

  const prepared = assertPrepared(
    prepareProductFiscalCostRuleUpdate({
      ...current,
      ...input,
    }),
  );

  const value = normalize(prepared);
  assertReference(value);

  const columns = PRODUCT_FISCAL_COST_RULES_UPDATE_COLUMNS
    .filter((column) =>
      Object.prototype.hasOwnProperty.call(value, column),
    );

  const setSql = columns
    .map(
      (column, index) =>
        `${column} = $${index + 1}`,
    )
    .join(', ');

  const values = columns.map(
    (column) => value[column],
  );

  values.push(id);

  const { rows } = await client.query(
    `
      UPDATE ${TB}
      SET
        ${setSql},
        updated_at = NOW()
      WHERE rule_id = $${values.length}
      RETURNING
        ${SELECT_COLUMNS}
    `,
    values,
  );

  return rows[0] || null;
}
