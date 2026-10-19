// ╔════════════════════════════════════════════════════════════════════╗
// ║ userModulesUpdate.repository.js — update (parcial)                 ║
// ║ Tabela: public."userModules"                                       ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB } from './userModules.constants.js';
import { toNum } from './userModules.sanitizers.js';
import { mapRow } from './userModules.mappers.js';

/**
 * Atualiza parcialmente um vínculo usuário/módulo.
 * Patch pode conter:
 *  - usuario_id
 *  - modulo_id
 *  - pode_acessar
 */
export async function update(id, patch = {}) {
  const uid = toNum(id);
  if (!uid) return { ok: false, error: 'id is required.' };

  const fields = ['usuario_id', 'modulo_id', 'pode_acessar'];

  const sets = [];
  const params = [];

  fields.forEach((k) => {
    if (patch[k] !== undefined) {
      params.push(patch[k]);
      sets.push(`${k} = $${params.length}`);
    }
  });

  if (!sets.length) return { ok: false, error: 'Nothing to update.' };

  // Atualiza também updated_at
  sets.push(`updated_at = NOW()`);

  params.push(uid);

  try {
    const { rows } = await pool.query(
      `
      UPDATE ${TB}
      SET ${sets.join(', ')}
      WHERE id = $${params.length}
      RETURNING id, ${fields.join(',')}, created_at, updated_at
      `,
      params
    );

    if (!rows.length) return { ok: false, error: 'UserModule not found.' };
    return { ok: true, data: mapRow(rows[0]) };
  } catch (err) {
    console.error('[userModulesApi:update] error:', err);
    return { ok: false, error: 'Failed to update user module.' };
  }
}
