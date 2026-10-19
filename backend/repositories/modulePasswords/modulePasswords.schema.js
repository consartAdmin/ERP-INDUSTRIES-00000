// ╔════════════════════════════════════════════════════════════════════╗
// ║ modulePasswords.schema.js — DDL de public."modulePasswords"        ║
// ║ Idempotente.                                                       ║
// ╚════════════════════════════════════════════════════════════════════╝

import { TB } from './modulePasswords.constants.js';
import { MODULE_PASSWORDS_CATALOG } from './modulePasswords.catalog.js';

/**
 * Cria tabela, índices e as linhas do catálogo.
 * Recebe um `client` já dentro de uma transação.
 */
export async function ensureModulePasswordsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS ${TB} (
      module_password_id  SERIAL        PRIMARY KEY,
      module_code         VARCHAR(60)   NOT NULL,
      action_code         VARCHAR(60)   NOT NULL,
      description         VARCHAR(255),
      password_hash       TEXT,
      is_active           BOOLEAN       NOT NULL DEFAULT TRUE,
      updated_by          INTEGER,
      created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
    );
  `);

  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_modulePasswords_module_action
      ON ${TB} (module_code, action_code);
  `);

  // Linhas do catálogo (sem senha → usa o fallback do .env até ser definida)
  for (const item of MODULE_PASSWORDS_CATALOG) {
    await client.query(
      `INSERT INTO ${TB} (module_code, action_code, description)
       VALUES ($1, $2, $3)
       ON CONFLICT (module_code, action_code) DO NOTHING`,
      [item.module_code, item.action_code, item.description]
    );
  }
}
