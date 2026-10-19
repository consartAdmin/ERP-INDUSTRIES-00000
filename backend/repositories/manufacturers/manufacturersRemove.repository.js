// ╔════════════════════════════════════════════════════════════════════╗
// ║ manufacturersRemove.repository.js — remove (soft delete)           ║
// ║ Tabela: public.manufacturers                                       ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TABLE, PK } from './manufacturers.constants.js';
import { ok, fail } from './manufacturers.utils.js';
import { normalize } from './manufacturers.mappers.js';

// ─────────────────────────────────────────────────────────────
// REMOVE — Soft delete
// ─────────────────────────────────────────────────────────────
export async function remove(id) {
  try {
    const { rows } = await pool.query(
      `
        UPDATE ${TABLE}
        SET active = FALSE, updated_at = now()
        WHERE ${PK} = $1
        RETURNING *
      `,
      [id]
    );

    if (!rows.length) return fail('Fabricante não encontrado', 404);

    return ok(normalize(rows[0]));
  } catch (err) {
    console.error('[manufacturersApi:remove] Erro:', err);
    return fail(err.message, 500);
  }
}
