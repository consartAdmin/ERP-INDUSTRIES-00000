// ╔════════════════════════════════════════════════════════════════════╗
// ║ usersProfileSchema.repository.js — ensureTable                     ║
// ║ Tabela: public."usersProfile"                                      ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB } from './usersProfile.constants.js';

/**
 * Garante a existência da tabela public."usersProfile".
 * Um registro por (usuario_id, modulo_id) com o perfil e as permissões.
 */
export async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${TB} (
      id          BIGSERIAL    PRIMARY KEY,
      usuario_id  BIGINT       NOT NULL,
      modulo_id   BIGINT       NOT NULL,
      profile     VARCHAR(30)  NOT NULL DEFAULT 'SEM_ACESSO',
      can_view    BOOLEAN      NOT NULL DEFAULT FALSE,
      can_create  BOOLEAN      NOT NULL DEFAULT FALSE,
      can_edit    BOOLEAN      NOT NULL DEFAULT FALSE,
      can_delete  BOOLEAN      NOT NULL DEFAULT FALSE,
      can_export  BOOLEAN      NOT NULL DEFAULT FALSE,
      updated_by  BIGINT       NULL,
      created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    );
  `);

  // Índice único para suportar ON CONFLICT (usuario_id, modulo_id)
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS usersprofile_usuario_modulo_uidx
    ON ${TB}(usuario_id, modulo_id);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS usersprofile_modulo_idx
    ON ${TB}(modulo_id);
  `);
}
