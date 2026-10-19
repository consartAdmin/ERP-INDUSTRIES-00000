// ╔════════════════════════════════════════════════════════════════════╗
// ║ sellerByUserUpdate.repository.js — update / toggleActive /         ║
// ║ setPrimary                                                         ║
// ║ Tabela: public."sellerByUser"                                      ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB } from './sellerByUser.constants.js';
import { normalizeRow } from './sellerByUser.mappers.js';
import { getById } from './sellerByUserQuery.repository.js';

export async function update(id, patch = {}) {
  id = Number(id);
  if (!id) throw new Error('id inválido');

  const allowed = ['user_id', 'seller_id', 'is_primary', 'active'];
  const sets = [];
  const params = [];

  for (const k of allowed) {
    if (patch[k] === undefined) continue;
    params.push(k === 'user_id' || k === 'seller_id' ? Number(patch[k]) : Boolean(patch[k]));
    sets.push(`${k} = $${params.length}`);
  }

  if (!sets.length) {
    return getById(id);
  }

  await pool.query('BEGIN');
  try {
    // se estiver marcando como primary, precisamos saber user_id
    if (patch.is_primary === true) {
      // user_id pode ter vindo no patch; se não, busca o atual
      let userId = patch.user_id ? Number(patch.user_id) : null;
      if (!userId) {
        const cur = await getById(id);
        if (!cur) throw new Error('Registro não encontrado');
        userId = cur.user_id;
      }
      await pool.query(`UPDATE ${TB} SET is_primary = false WHERE user_id = $1`, [Number(userId)]);
    }

    params.push(id);
    const { rows } = await pool.query(
      `
      UPDATE ${TB}
      SET ${sets.join(', ')}
      WHERE id = $${params.length}
      RETURNING id, user_id, seller_id, is_primary, active, created_at, updated_at
      `,
      params
    );

    await pool.query('COMMIT');
    return normalizeRow(rows[0]);
  } catch (e) {
    await pool.query('ROLLBACK');
    throw e;
  }
}

export async function toggleActive(id, active) {
  const { rows } = await pool.query(
    `
    UPDATE ${TB}
    SET active = $2
    WHERE id = $1
    RETURNING id, user_id, seller_id, is_primary, active, created_at, updated_at
    `,
    [Number(id), Boolean(active)]
  );
  return normalizeRow(rows[0]);
}

export async function setPrimary(userId, id) {
  userId = Number(userId);
  id = Number(id);
  if (!userId) throw new Error('userId inválido');
  if (!id) throw new Error('id inválido');

  await pool.query('BEGIN');
  try {
    await pool.query(`UPDATE ${TB} SET is_primary = false WHERE user_id = $1`, [userId]);

    const { rows } = await pool.query(
      `
      UPDATE ${TB}
      SET is_primary = true, active = true
      WHERE id = $1 AND user_id = $2
      RETURNING id, user_id, seller_id, is_primary, active, created_at, updated_at
      `,
      [id, userId]
    );

    await pool.query('COMMIT');
    return normalizeRow(rows[0]);
  } catch (e) {
    await pool.query('ROLLBACK');
    throw e;
  }
}
