// ╔════════════════════════════════════════════════════════════════════╗
// ║ transportersUpdate.repository.js — UPDATE                          ║
// ║ Tabela: public.transporters                                        ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB, WRITE_FIELDS } from './transporters.constants.js';
import { sanitizePayload, validatePayload } from './transporters.sanitizers.js';
import { parseTransporterId } from './transporters.utils.js';
import { getById } from './transportersGetById.repository.js';

/**
 * UPDATE — retorna null quando o ID não existe
 */
export async function update(id, data) {
  const transporterId = parseTransporterId(id);
  const payload = sanitizePayload(data);
  validatePayload(payload);

  const params = WRITE_FIELDS.map((field) => payload[field]);
  const sets = WRITE_FIELDS.map((field, i) => `${field} = $${i + 1}`);
  params.push(transporterId);

  const { rowCount } = await pool.query(
    `
      UPDATE ${TB}
      SET
        ${sets.join(',\n        ')},
        updated_at = CURRENT_TIMESTAMP
      WHERE transporter_id = $${params.length}
    `,
    params,
  );

  return rowCount ? getById(transporterId) : null;
}

export default update;
