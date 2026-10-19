// ╔════════════════════════════════════════════════════════════════════╗
// ║ accessProfilesSchema.repository.js — ensureTable + perfis iniciais ║
// ║ Tabela: public."accessProfiles"                                    ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { SEED_PROFILES, TB } from './accessProfiles.constants.js';

/**
 * Garante a existência da tabela public."accessProfiles" e cria os
 * perfis iniciais (sem sobrescrever perfis já existentes).
 */
export async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${TB} (
      id          BIGSERIAL    PRIMARY KEY,
      code        VARCHAR(30)  NOT NULL,
      name        VARCHAR(80)  NOT NULL,
      description VARCHAR(255) NULL,
      can_view    BOOLEAN      NOT NULL DEFAULT FALSE,
      can_create  BOOLEAN      NOT NULL DEFAULT FALSE,
      can_edit    BOOLEAN      NOT NULL DEFAULT FALSE,
      can_delete  BOOLEAN      NOT NULL DEFAULT FALSE,
      can_export  BOOLEAN      NOT NULL DEFAULT FALSE,
      is_custom   BOOLEAN      NOT NULL DEFAULT FALSE,
      is_system   BOOLEAN      NOT NULL DEFAULT FALSE,
      is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
      sort_order  INTEGER      NOT NULL DEFAULT 100,
      created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS accessprofiles_code_uidx
    ON ${TB}(code);
  `);

  for (const p of SEED_PROFILES) {
    await pool.query(
      `
      INSERT INTO ${TB} (
        code, name, description,
        can_view, can_create, can_edit, can_delete, can_export,
        is_custom, is_system, sort_order
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (code) DO NOTHING
      `,
      [
        p.code, p.name, p.description,
        p.can_view, p.can_create, p.can_edit, p.can_delete, p.can_export,
        p.is_custom, p.is_system, p.sort_order,
      ]
    );
  }
}
