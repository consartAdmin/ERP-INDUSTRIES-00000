// ╔════════════════════════════════════════════════════════════════════╗
// ║ userModulesCreate.repository.js — create (idempotente/upsert)      ║
// ║ Tabela: public."userModules"                                       ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { mapRow } from './userModules.mappers.js';

/**
 * Cria um novo vínculo usuário/módulo.
 * Espera:
 *  - usuario_id (number) obrigatório
 *  - modulo_id  (number) obrigatório
 *  - pode_acessar (boolean) opcional (default false)
 *
 * Comportamento idempotente:
 *  - Se já existir (usuario_id, modulo_id), atualiza pode_acessar e retorna.
 */
export async function create(data = {}) {
  const usuario_id   = Number(data.usuario_id);
  const modulo_id    = Number(data.modulo_id);
  const pode_acessar = data.pode_acessar === undefined ? false : !!data.pode_acessar;

  if (!usuario_id || !modulo_id) {
    return { ok: false, error: 'usuario_id e modulo_id são obrigatórios.' };
  }

  try {
    const { rows } = await pool.query(
      `
      INSERT INTO public."userModules" (usuario_id, modulo_id, pode_acessar)
      VALUES ($1, $2, $3)
      ON CONFLICT (usuario_id, modulo_id)
      DO UPDATE SET
        pode_acessar = EXCLUDED.pode_acessar,
        updated_at   = NOW()
      RETURNING
        id,
        usuario_id,
        modulo_id,
        pode_acessar,
        created_at,
        updated_at
      `,
      [usuario_id, modulo_id, pode_acessar]
    );

    return { ok: true, data: mapRow(rows[0]) };
  } catch (err) {
    console.error('[userModulesApi:create] error inesperado:', err);
    return { ok: false, error: 'Failed to create or update user module.' };
  }
}
