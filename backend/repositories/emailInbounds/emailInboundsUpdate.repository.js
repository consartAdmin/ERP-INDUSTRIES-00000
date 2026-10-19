// ╔════════════════════════════════════════════════════════════════════╗
// ║ emailInboundsUpdate.repository.js — markInboundAsRead              ║
// ╚════════════════════════════════════════════════════════════════════╝

import { EMAIL_INBOUNDS_TABLE } from './emailInbounds.constants.js';
import { log, withClient } from './emailInbounds.utils.js';
import { toPositiveIntOrNull } from './emailInbounds.sanitizers.js';

export async function markInboundAsRead(pgPool, id) {
  const numericId = toPositiveIntOrNull(id);

  log('MARK_READ_START', {
    id_raw: id,
    id: numericId,
  });

  if (!numericId) {
    throw new Error('ID inválido para marcar email como lido');
  }

  return withClient(pgPool, async (client) => {
    const { rows } = await client.query(
      `
      UPDATE ${EMAIL_INBOUNDS_TABLE}
      SET is_read = true
      WHERE id = $1
      RETURNING id, is_read;
      `,
      [numericId]
    );

    const row = rows[0] || null;

    log('MARK_READ_RESULT', {
      id: numericId,
      found: !!row,
      is_read: row?.is_read,
    });

    return row;
  }, 'markInboundAsRead');
}
