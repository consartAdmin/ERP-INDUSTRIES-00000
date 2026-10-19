// ╔════════════════════════════════════════════════════════════════════╗
// ║ transportersCreate.repository.js — INSERT                          ║
// ║ Tabela: public.transporters                                        ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB, WRITE_FIELDS } from './transporters.constants.js';
import { sanitizePayload, validatePayload } from './transporters.sanitizers.js';
import { getById } from './transportersGetById.repository.js';

/**
 * CREATE
 */
export async function create(data) {
  const payload = sanitizePayload(data, { keepDefaultIsActive: true });
  validatePayload(payload);

  const params = WRITE_FIELDS.map((field) => payload[field]);
  const placeholders = params.map((_, i) => `$${i + 1}`);

  const { rows } = await pool.query(
    `
      INSERT INTO ${TB}
        (${WRITE_FIELDS.join(', ')})
      VALUES
        (${placeholders.join(', ')})
      RETURNING transporter_id
    `,
    params,
  );

  return getById(rows[0].transporter_id);
}

export default create;
