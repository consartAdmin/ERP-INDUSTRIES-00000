// ╔════════════════════════════════════════════════════════════════════╗
// ║ emailInboundsRemove.repository.js — clearInbounds                  ║
// ╚════════════════════════════════════════════════════════════════════╝

import { EMAIL_INBOUNDS_TABLE } from './emailInbounds.constants.js';
import { warn, withClient } from './emailInbounds.utils.js';

export async function clearInbounds(pgPool) {
  warn('CLEAR_START', {
    table: EMAIL_INBOUNDS_TABLE,
  });

  return withClient(pgPool, async (client) => {
    const { rowCount } = await client.query(
      `DELETE FROM ${EMAIL_INBOUNDS_TABLE};`
    );

    warn('CLEAR_DONE', {
      deleted: rowCount,
    });

    return rowCount;
  }, 'clearInbounds');
}
