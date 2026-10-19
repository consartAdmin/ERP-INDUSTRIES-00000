// ╔════════════════════════════════════════════════════════════════════╗
// ║ usersProfileUpsert.repository.js — upsert / saveMany               ║
// ║ Tabela: public."usersProfile"                                      ║
// ║ Sincroniza public."userModules".pode_acessar com can_view para     ║
// ║ que o menu (securityModules.js) siga o perfil definido.            ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB } from './usersProfile.constants.js';
import { normalizeProfileItem, toNum } from './usersProfile.sanitizers.js';
import { mapRow } from './usersProfile.mappers.js';
import { getCatalogMap } from '../accessProfiles/accessProfiles.index.js';

const RETURNING = `
  id, usuario_id, modulo_id, profile,
  can_view, can_create, can_edit, can_delete, can_export,
  updated_by, created_at, updated_at
`;

async function upsertWithClient(client, usuarioId, item, updatedBy) {
  const { rows } = await client.query(
    `
    INSERT INTO ${TB} (
      usuario_id, modulo_id, profile,
      can_view, can_create, can_edit, can_delete, can_export,
      updated_by
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    ON CONFLICT (usuario_id, modulo_id)
    DO UPDATE SET
      profile    = EXCLUDED.profile,
      can_view   = EXCLUDED.can_view,
      can_create = EXCLUDED.can_create,
      can_edit   = EXCLUDED.can_edit,
      can_delete = EXCLUDED.can_delete,
      can_export = EXCLUDED.can_export,
      updated_by = EXCLUDED.updated_by,
      updated_at = NOW()
    RETURNING ${RETURNING}
    `,
    [
      usuarioId,
      item.modulo_id,
      item.profile,
      item.can_view,
      item.can_create,
      item.can_edit,
      item.can_delete,
      item.can_export,
      updatedBy,
    ]
  );

  // Mantém o acesso ao menu (userModules) alinhado com o perfil
  await client.query(
    `
    INSERT INTO public."userModules" (usuario_id, modulo_id, pode_acessar)
    VALUES ($1, $2, $3)
    ON CONFLICT (usuario_id, modulo_id)
    DO UPDATE SET
      pode_acessar = EXCLUDED.pode_acessar,
      updated_at   = NOW()
    `,
    [usuarioId, item.modulo_id, item.can_view]
  );

  return mapRow(rows[0]);
}

/**
 * Salva vários perfis de um usuário em uma única transação.
 * Itens: [{ modulo_id, profile, can_view, can_create, ... }]
 * Módulos não enviados permanecem como estão.
 */
export async function saveMany(usuarioId, items = [], { updatedBy = null } = {}) {
  const uid = toNum(usuarioId);
  if (!uid) return { ok: false, error: 'usuario_id inválido.' };
  if (!Array.isArray(items) || !items.length) {
    return { ok: false, error: 'Nenhum módulo informado.' };
  }

  let catalog;
  try {
    catalog = await getCatalogMap();
  } catch (err) {
    console.error('[usersProfile:saveMany] catalog error:', err);
    return { ok: false, error: 'Failed to load access profiles.' };
  }

  const normalized = [];
  for (const raw of items) {
    const r = normalizeProfileItem(raw, catalog);
    if (!r.ok) return r;
    normalized.push(r.data);
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const saved = [];
    for (const item of normalized) {
      saved.push(await upsertWithClient(client, uid, item, toNum(updatedBy)));
    }

    await client.query('COMMIT');
    return { ok: true, data: saved };
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[usersProfile:saveMany] error:', err);
    return { ok: false, error: 'Failed to save user profiles.' };
  } finally {
    client.release();
  }
}

/** Salva o perfil de um usuário em um único módulo */
export async function upsert(usuarioId, item = {}, { updatedBy = null } = {}) {
  const result = await saveMany(usuarioId, [item], { updatedBy });
  if (!result.ok) return result;
  return { ok: true, data: result.data[0] };
}
