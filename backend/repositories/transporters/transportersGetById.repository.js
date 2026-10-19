// ╔════════════════════════════════════════════════════════════════════╗
// ║ transportersGetById.repository.js — Busca por ID                   ║
// ║ Tabela: public.transporters                                        ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB, SELECT_FIELDS } from './transporters.constants.js';
import { parseTransporterId } from './transporters.utils.js';

/**
 * GET BY ID
 */
export async function getById(id) {
  const transporterId = parseTransporterId(id);

  const { rows } = await pool.query(
    `
      SELECT ${SELECT_FIELDS}
      FROM ${TB}
      WHERE transporter_id = $1
      LIMIT 1
    `,
    [transporterId],
  );

  return rows[0] || null;
}

export default getById;
