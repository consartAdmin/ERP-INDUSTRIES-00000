// ╔══════════════════════════════════════════════════════════════════════╗
// ║ productsFiscalOriginsQuery.repository.js — getById / getByProduct    ║
// ╚══════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB, SELECT_COLUMNS } from './productsFiscalOrigins.constants.js';
import { clean, positiveInteger } from './productsFiscalOrigins.sanitizers.js';
import { ensureOnce } from './productsFiscalOriginsSchema.repository.js';

/* ========================================================================== */
/* Leitura                                                                    */
/* ========================================================================== */

export async function getById(fiscalOriginId, client = pool) {
  const id = positiveInteger(fiscalOriginId);
  if (!id) throw new Error('fiscal_origin_id inválido.');

  await ensureOnce(client);

  const { rows } = await client.query(
    `
      SELECT
        ${SELECT_COLUMNS}
      FROM ${TB}
      WHERE fiscal_origin_id = $1
      LIMIT 1
    `,
    [id],
  );

  return rows[0] || null;
}

export async function getByProduct(productCode, client = pool) {
  const code = clean(productCode);
  if (!code) throw new Error('product_code é obrigatório.');

  await ensureOnce(client);

  const { rows } = await client.query(
    `
      SELECT
        ${SELECT_COLUMNS}
      FROM ${TB}
      WHERE TRIM(product_code) = $1
        AND is_active = TRUE
      ORDER BY
        lot_id NULLS LAST,
        product_grade_id NULLS LAST,
        calculated_at DESC
    `,
    [code],
  );

  return rows;
}
