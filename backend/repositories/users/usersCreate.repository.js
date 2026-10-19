// ╔════════════════════════════════════════════════════════════════════╗
// ║ usersCreate.repository.js — create                                 ║
// ║ Tabela: public.users                                               ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB, WRITABLE_COLS, APP_DEFAULTS } from './users.constants.js';
import { RETURNING_COLS } from './users.sql.js';
import { validate, uniqueViolationMessage } from './users.sanitizers.js';
import { mapRow } from './users.mappers.js';

/**
 * Cria um novo usuário.
 * Espera que o controller já envie `password_hash` pronto (bcrypt).
 * Campos não enviados ficam com o default da aplicação ou do banco.
 */
export async function create(data = {}) {
  const payload = {};
  for (const k of WRITABLE_COLS) {
    if (data[k] !== undefined) payload[k] = data[k];
    else if (APP_DEFAULTS[k] !== undefined) payload[k] = APP_DEFAULTS[k];
  }

  const invalid = validate(payload);
  if (invalid) return { ok: false, error: invalid };

  const fields = Object.keys(payload);
  const vals = fields.map((k) => payload[k]);
  const placeholders = fields.map((_, i) => `$${i + 1}`).join(',');

  try {
    const { rows } = await pool.query(
      `
      INSERT INTO ${TB}
        (${fields.join(',')})
      VALUES (${placeholders})
      RETURNING ${RETURNING_COLS}
      `,
      vals
    );

    return { ok: true, data: mapRow(rows[0]) };
  } catch (err) {
    const dup = uniqueViolationMessage(err);
    if (dup) return { ok: false, error: dup };
    console.error('[usersApi:create] error:', err);
    return { ok: false, error: 'Failed to create user.' };
  }
}
