// ╔════════════════════════════════════════════════════════════════════╗
// ║ sellerByUserCreate.repository.js — create                          ║
// ║ Tabela: public."sellerByUser"                                      ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB } from './sellerByUser.constants.js';
import { normalizeRow } from './sellerByUser.mappers.js';

export async function create({ user_id, seller_id, is_primary = false, active = true } = {}) {
  if (!user_id) throw new Error('user_id é obrigatório');
  if (!seller_id) throw new Error('seller_id é obrigatório');

  await pool.query('BEGIN');
  try {
    // se vier como principal, zera os outros do usuário
    if (is_primary) {
      await pool.query(`UPDATE ${TB} SET is_primary = false WHERE user_id = $1`, [Number(user_id)]);
    }

    const { rows } = await pool.query(
      `
      INSERT INTO ${TB} (user_id, seller_id, is_primary, active)
      VALUES ($1, $2, $3, $4)
      RETURNING id, user_id, seller_id, is_primary, active, created_at, updated_at
      `,
      [Number(user_id), Number(seller_id), Boolean(is_primary), Boolean(active)]
    );

    await pool.query('COMMIT');
    return normalizeRow(rows[0]);
  } catch (e) {
    await pool.query('ROLLBACK');
    throw e;
  }
}
