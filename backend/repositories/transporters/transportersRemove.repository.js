// ╔════════════════════════════════════════════════════════════════════╗
// ║ transportersRemove.repository.js — DELETE                          ║
// ║ Tabela: public.transporters                                        ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB } from './transporters.constants.js';
import { parseTransporterId } from './transporters.utils.js';

/**
 * REMOVE — true quando uma linha foi apagada
 */
export async function remove(id) {
  const transporterId = parseTransporterId(id);

  const { rowCount } = await pool.query(
    `DELETE FROM ${TB} WHERE transporter_id = $1`,
    [transporterId],
  );

  return rowCount > 0;
}

export default remove;
