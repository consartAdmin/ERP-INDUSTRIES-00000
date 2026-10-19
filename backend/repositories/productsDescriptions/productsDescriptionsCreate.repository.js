// ╔════════════════════════════════════════════════════════════════════╗
// ║ productsDescriptionsCreate.repository.js — create                  ║
// ║ Tabela: public."productsDescriptions"                              ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TABLE } from './productsDescriptions.constants.js';

export async function create(data = {}) {
  const product_code = String(data.product_code || '').trim();
  const description  = String(data.description || '').trim();
  const is_active    = (data.is_active === undefined) ? true : !!data.is_active;

  if (!product_code) throw Object.assign(new Error('product_code is required'), { status: 400 });
  if (!description)  throw Object.assign(new Error('description is required'),  { status: 400 });

  const { rows } = await pool.query(
    `
    INSERT INTO ${TABLE} (product_code, description, is_active)
    VALUES ($1, $2, $3)
    RETURNING
      product_description_id, product_code, description, is_active, created_at, updated_at;
    `,
    [product_code, description, is_active]
  );
  return rows[0];
}
