// ╔════════════════════════════════════════════════════════════════════╗
// ║ accessProfilesCreate.repository.js — create                        ║
// ║ Tabela: public."accessProfiles"                                    ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB } from './accessProfiles.constants.js';
import { mapRow } from './accessProfiles.mappers.js';

/** Cria um perfil (sempre com permissões fixas; nunca de sistema) */
export async function create(data) {
  try {
    const { rows } = await pool.query(
      `
      INSERT INTO ${TB} (
        code, name, description,
        can_view, can_create, can_edit, can_delete, can_export,
        is_active, sort_order
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
      `,
      [
        data.code, data.name, data.description ?? null,
        data.can_view, data.can_create, data.can_edit, data.can_delete, data.can_export,
        data.is_active, data.sort_order,
      ]
    );

    return { ok: true, data: mapRow(rows[0]) };
  } catch (err) {
    if (err.code === '23505') {
      return { ok: false, error: `Já existe um perfil com o código ${data.code}.` };
    }
    console.error('[accessProfiles:create] error:', err);
    return { ok: false, error: 'Failed to create access profile.' };
  }
}
