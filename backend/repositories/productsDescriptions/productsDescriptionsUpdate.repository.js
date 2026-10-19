// ╔════════════════════════════════════════════════════════════════════╗
// ║ productsDescriptionsUpdate.repository.js — update / deactivate     ║
// ║ Tabela: public."productsDescriptions"                              ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TABLE } from './productsDescriptions.constants.js';

export async function update(id, data = {}) {
  const description = String(data.description || '').trim();
  const is_active   = (data.is_active === undefined) ? null : !!data.is_active;

  if (!id) throw Object.assign(new Error('id is required'), { status: 400 });
  if (!description) throw Object.assign(new Error('description is required'), { status: 400 });
  if (is_active === null) throw Object.assign(new Error('is_active is required'), { status: 400 });

  const { rows } = await pool.query(
    `
    UPDATE ${TABLE}
    SET description = $1,
        is_active   = $2,
        updated_at  = NOW()
    WHERE product_description_id = $3
    RETURNING
      product_description_id, product_code, description, is_active, created_at, updated_at;
    `,
    [description, is_active, id]
  );
  return rows[0] || null;
}

/**
 * ✅ Soft delete padrão (recomendado no ERP)
 */
export async function deactivate(id) {
  const { rows } = await pool.query(
    `
    UPDATE ${TABLE}
    SET is_active = FALSE,
        updated_at = NOW()
    WHERE product_description_id = $1
    RETURNING
      product_description_id, product_code, description, is_active, created_at, updated_at;
    `,
    [id]
  );
  return rows[0] || null;
}
