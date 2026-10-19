// ╔════════════════════════════════════════════════════════════════════╗
// ║ productsFiscalSnapshot.repository.js — createFromImport / closeCurrent ║
// ║ Snapshots por product_code (is_current / valid_from / valid_to)    ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB, FISCAL_FIELDS } from './productsFiscal.constants.js';
import {
  isFiniteNum,
  q,
  normalizePayload,
  shallowEqualFiscal,
} from './productsFiscal.sanitizers.js';
import { rowToModel } from './productsFiscal.mappers.js';
import { resolveProductCode } from './productsFiscalLookup.repository.js';

/* ──────────────────────────────────────────────────────────
   CREATE snapshots (por product_code)
   ✅ IMPORTANT: products_fiscal_id NÃO entra no INSERT nunca.
   ✅ Aceita client externo para evitar nested transactions.
   ✅ INSERT com colunas QUOTED
────────────────────────────────────────────────────────── */
export async function createFromImport(payload = {}, externalClient = null) {
  const client = externalClient || (await pool.connect());
  const mustManageTx = !externalClient;

  try {
    const product_code = await resolveProductCode(client, payload);
    if (!product_code) {
      throw new Error('product_code é obrigatório (ou informe product_id para resolver SKU).');
    }

    const normalized = normalizePayload(payload);

    if (mustManageTx) await client.query('BEGIN');

    const { rows: curRows } = await client.query(
      `SELECT * FROM ${TB}
       WHERE product_code = $1 AND is_current = TRUE AND is_active = TRUE
       LIMIT 1`,
      [product_code]
    );
    const current = rowToModel(curRows[0]);

    if (current) {
      if (shallowEqualFiscal(normalizePayload(current), normalized)) {
        if (mustManageTx) await client.query('ROLLBACK');
        return null;
      }
      await client.query(
        `UPDATE ${TB}
         SET is_current = FALSE, valid_to = NOW()
         WHERE products_fiscal_id = $1`,
        [current.products_fiscal_id]
      );
    }

    // ✅ INSERT (sem products_fiscal_id)
    const cols = ['product_code', ...FISCAL_FIELDS, 'is_current', 'is_active', 'valid_from'];
    const vals = [product_code, ...FISCAL_FIELDS.map((k) => normalized[k]), true, true];

    // placeholders: vals + NOW() (valid_from)
    const placeholders = vals.map((_, idx) => `$${idx + 1}`).concat(['NOW()']);

    const insertSQL = `
      INSERT INTO ${TB} (${cols.map(q).join(', ')})
      VALUES (${placeholders.join(', ')})
      RETURNING *;
    `;

    const { rows: ins } = await client.query(insertSQL, vals);

    if (mustManageTx) await client.query('COMMIT');
    return rowToModel(ins[0]);
  } catch (err) {
    if (mustManageTx) {
      try { await client.query('ROLLBACK'); } catch { }
    }
    throw err;
  } finally {
    if (!externalClient) client.release();
  }
}

export async function closeCurrent(productCodeOrId) {
  const client = await pool.connect();
  try {
    const code = await resolveProductCode(client, {
      product_code: !isFiniteNum(productCodeOrId) ? String(productCodeOrId) : null,
      product_id: isFiniteNum(productCodeOrId) ? Number(productCodeOrId) : null,
    });
    if (!code) return { closed: 0 };

    const { rowCount } = await client.query(
      `UPDATE ${TB}
       SET is_current = FALSE, valid_to = NOW()
       WHERE product_code = $1 AND is_current = TRUE`,
      [code]
    );
    return { closed: rowCount };
  } finally {
    client.release();
  }
}
