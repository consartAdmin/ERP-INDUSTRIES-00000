// ╔════════════════════════════════════════════════════════════════════╗
// ║ usersUpdate.repository.js — update parcial                         ║
// ║ Tabela: public.users                                               ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB, PK, WRITABLE_COLS } from './users.constants.js';
import { RETURNING_COLS } from './users.sql.js';
import { toNum, validate, uniqueViolationMessage } from './users.sanitizers.js';
import { mapRow } from './users.mappers.js';

/**
 * Atualiza parcialmente um usuário.
 * Patch pode conter qualquer subset dos campos graváveis do catálogo:
 *   name, email, password_hash, access_level, is_active
 */
export async function update(id, patch = {}) {
  const uid = toNum(id);
  if (!uid) return { ok: false, error: 'user_id is required.' };

  const invalid = validate(patch, { partial: true });
  if (invalid) return { ok: false, error: invalid };

  const sets = [];
  const params = [];

  WRITABLE_COLS.forEach((k) => {
    if (patch[k] !== undefined) {
      params.push(patch[k]);
      sets.push(`${k} = $${params.length}`);
    }
  });

  if (!sets.length) return { ok: false, error: 'Nothing to update.' };

  params.push(uid);

  try {
    const { rows } = await pool.query(
      `
      UPDATE ${TB}
      SET ${sets.join(', ')}
      WHERE ${PK} = $${params.length}
      RETURNING ${RETURNING_COLS}
      `,
      params
    );

    if (!rows.length) return { ok: false, error: 'User not found.' };
    return { ok: true, data: mapRow(rows[0]) };
  } catch (err) {
    const dup = uniqueViolationMessage(err);
    if (dup) return { ok: false, error: dup };
    console.error('[usersApi:update] error:', err);
    return { ok: false, error: 'Failed to update user.' };
  }
}
