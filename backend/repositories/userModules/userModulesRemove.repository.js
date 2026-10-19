// ╔════════════════════════════════════════════════════════════════════╗
// ║ userModulesRemove.repository.js — remove (hard delete)             ║
// ║ Tabela: public."userModules"                                       ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB } from './userModules.constants.js';
import { toNum } from './userModules.sanitizers.js';

/** Remove definitivamente o vínculo (hard delete) */
export async function remove(id) {
  const uid = toNum(id);
  if (!uid) return { ok: false, error: 'id is required.' };

  try {
    const { rows } = await pool.query(
      `
      DELETE FROM ${TB}
      WHERE id = $1
      RETURNING id, usuario_id, modulo_id
      `,
      [uid]
    );

    if (!rows.length) return { ok: false, error: 'UserModule not found.' };

    return {
      ok: true,
      data: {
        id: rows[0].id,
        usuario_id: rows[0].usuario_id,
        modulo_id: rows[0].modulo_id,
      },
    };
  } catch (err) {
    console.error('[userModulesApi:remove] error:', err);
    return { ok: false, error: 'Failed to delete user module.' };
  }
}
