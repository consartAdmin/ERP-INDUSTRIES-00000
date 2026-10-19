// ╔════════════════════════════════════════════════════════════════════╗
// ║ emailSignaturesRemove.repository.js — remove                       ║
// ╚════════════════════════════════════════════════════════════════════╝

import { EMAIL_SIGNATURES_TABLE } from './emailSignatures.constants.js';
import { withClient } from './emailSignatures.utils.js';

/**
 * Remove uma assinatura.
 * @param {import('pg').Pool} pgPool
 * @param {number} id
 */
export async function remove(pgPool, id) {
  return withClient(pgPool, async (client) => {
    const { rowCount } = await client.query(
      `DELETE FROM ${EMAIL_SIGNATURES_TABLE}
        WHERE id = $1`,
      [id]
    );
    return rowCount > 0;
  });
}
