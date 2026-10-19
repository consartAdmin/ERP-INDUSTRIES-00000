// ╔══════════════════════════════════════════════════════════════════════╗
// ║ productFiscalCostRulesGetById.repository.js — consultas              ║
// ║ getById / getByClassification / getByProfile / getByProduct          ║
// ╚══════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB, SELECT_COLUMNS } from './productFiscalCostRules.constants.js';
import { clean } from './productFiscalCostRules.sanitizers.js';

/* ========================================================================== */
/* Get by ID                                                                  */
/* ========================================================================== */

export async function getById(
  ruleId,
  client = pool,
) {
  const id = Number(ruleId);

  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }

  const { rows } = await client.query(
    `
      SELECT
        ${SELECT_COLUMNS}
      FROM ${TB}
      WHERE rule_id = $1
      LIMIT 1
    `,
    [id],
  );

  return rows[0] || null;
}

/* ========================================================================== */
/* Get by Fiscal Classification                                               */
/* ========================================================================== */

export async function getByClassification(
  classificationId,
  client = pool,
) {
  const id = Number(classificationId);

  if (!Number.isInteger(id) || id <= 0) {
    return [];
  }

  const { rows } = await client.query(
    `
      SELECT
        ${SELECT_COLUMNS}
      FROM ${TB}
      WHERE fiscal_classification_id = $1
        AND is_active = TRUE
      ORDER BY rule_id DESC
    `,
    [id],
  );

  return rows;
}

/* ========================================================================== */
/* Get by Fiscal Profile                                                      */
/* ========================================================================== */

export async function getByProfile(
  fiscalProfileId,
  client = pool,
) {
  const id = Number(fiscalProfileId);

  if (!Number.isInteger(id) || id <= 0) {
    return [];
  }

  const { rows } = await client.query(
    `
      SELECT
        ${SELECT_COLUMNS}
      FROM ${TB}
      WHERE fiscal_profile_id = $1
        AND is_active = TRUE
      ORDER BY rule_id DESC
    `,
    [id],
  );

  return rows;
}

/* ========================================================================== */
/* Get by Product                                                             */
/* ========================================================================== */

export async function getByProduct(
  productCode,
  client = pool,
) {
  const code = clean(productCode);

  if (!code) {
    return [];
  }

  const { rows } = await client.query(
    `
      SELECT
        ${SELECT_COLUMNS}
      FROM ${TB}
      WHERE product_code = $1
        AND is_active = TRUE
      ORDER BY rule_id DESC
    `,
    [code],
  );

  return rows;
}
