// ╔════════════════════════════════════════════════════════════════════╗
// ║ emailOutboundsRemove.repository.js — clearOutbounds                ║
// ╚════════════════════════════════════════════════════════════════════╝

import { EMAIL_OUTBOUNDS_TABLE } from './emailOutbounds.constants.js';
import { withClient } from './emailOutbounds.utils.js';

export async function clearOutbounds(pgPool) {
  return withClient(pgPool, async (client) => {
    const { rowCount } = await client.query(`DELETE FROM ${EMAIL_OUTBOUNDS_TABLE};`);
    return rowCount;
  });
}
