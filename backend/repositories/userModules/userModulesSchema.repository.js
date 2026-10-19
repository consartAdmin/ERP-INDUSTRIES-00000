// ╔════════════════════════════════════════════════════════════════════╗
// ║ userModulesSchema.repository.js — ensureTable                      ║
// ║ Tabela: public."userModules"                                       ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';

/**
 * Garante a existência da tabela public."userModules".
 * Não altera estrutura caso a tabela já exista.
 * Também garante o índice único (usuario_id, modulo_id) p/ ON CONFLICT.
 */
export async function ensureTable() {
  const sql = `
    CREATE TABLE IF NOT EXISTS public."userModules" (
      id           BIGSERIAL PRIMARY KEY,
      usuario_id   BIGINT NOT NULL,
      modulo_id    BIGINT NOT NULL,
      pode_acessar BOOLEAN NOT NULL DEFAULT FALSE,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;
  await pool.query(sql);

  // Índice único para suportar ON CONFLICT (usuario_id, modulo_id)
  const uniqueIdx = `
    CREATE UNIQUE INDEX IF NOT EXISTS usermodules_usuario_modulo_uidx
    ON public."userModules"(usuario_id, modulo_id);
  `;
  await pool.query(uniqueIdx);
}
