// ╔════════════════════════════════════════════════════════════════════╗
// ║ productsKeyRemove.repository.js — remove                           ║
// ║ Tabela: public."productsKey"                                       ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB } from './productsKey.constants.js';

export async function remove(id) {
  const keyId = Number(id);
  if (!Number.isFinite(keyId)) throw new Error('ID inválido.');

  const { rows } = await pool.query(
    `
      DELETE FROM ${TB}
      WHERE products_key_id = $1
      RETURNING products_key_id
    `,
    [keyId]
  );

  return { ok: rows.length > 0, deletedId: rows[0]?.products_key_id ?? null };
}
