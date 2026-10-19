// ╔════════════════════════════════════════════════════════════════════╗
// ║ usersProfileRemove.repository.js — remove (hard delete)            ║
// ║ Tabela: public."usersProfile"                                      ║
// ║ Remover o perfil também retira o acesso ao menu (userModules).     ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB } from './usersProfile.constants.js';
import { toNum } from './usersProfile.sanitizers.js';

export async function remove(usuarioId, moduloId) {
  const uid = toNum(usuarioId);
  const mid = toNum(moduloId);
  if (!uid || !mid) return { ok: false, error: 'usuario_id e modulo_id são obrigatórios.' };

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `
      DELETE FROM ${TB}
      WHERE usuario_id = $1 AND modulo_id = $2
      RETURNING id, usuario_id, modulo_id
      `,
      [uid, mid]
    );

    if (!rows.length) {
      await client.query('ROLLBACK');
      return { ok: false, error: 'UserProfile not found.' };
    }

    await client.query(
      `
      UPDATE public."userModules"
      SET pode_acessar = FALSE, updated_at = NOW()
      WHERE usuario_id = $1 AND modulo_id = $2
      `,
      [uid, mid]
    );

    await client.query('COMMIT');
    return { ok: true, data: rows[0] };
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[usersProfile:remove] error:', err);
    return { ok: false, error: 'Failed to delete user profile.' };
  } finally {
    client.release();
  }
}
