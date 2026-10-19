// ╔════════════════════════════════════════════════════════════════════╗
// ║ usersRemove.repository.js — remove (hard delete)                   ║
// ║ Tabela: public.users                                               ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB, PK } from './users.constants.js';
import { toNum } from './users.sanitizers.js';

/**
 * Hard delete — remove o usuário definitivamente.
 * Atenção: pelo catálogo, apaga em cascata processesUsers e userEmailAccounts,
 * e falha se o usuário for referenciado em inventories (created_by/finalized_by).
 */
export async function remove(id) {
  const uid = toNum(id);
  if (!uid) return { ok: false, error: 'user_id is required.' };

  try {
    const { rows } = await pool.query(
      `
      DELETE FROM ${TB}
      WHERE ${PK} = $1
      RETURNING ${PK}, name
      `,
      [uid]
    );

    if (!rows.length) return { ok: false, error: 'User not found.' };
    return { ok: true, data: { user_id: rows[0][PK], name: rows[0].name } };
  } catch (err) {
    if (err?.code === '23503') {
      return { ok: false, error: 'User is referenced by other records and cannot be deleted.' };
    }
    console.error('[usersApi:remove] error:', err);
    return { ok: false, error: 'Failed to delete user.' };
  }
}
