// ╔════════════════════════════════════════════════════════════════════╗
// ║ emailSignaturesCreate.repository.js — create                       ║
// ╚════════════════════════════════════════════════════════════════════╝

import { EMAIL_SIGNATURES_TABLE } from './emailSignatures.constants.js';
import { withClient } from './emailSignatures.utils.js';
import { normalizePayload } from './emailSignatures.sanitizers.js';

/**
 * Cria nova assinatura.
 * Se isdefault = true, limpa default anterior do mesmo owneruserid.
 *
 * @param {import('pg').Pool} pgPool
 * @param {object} payload
 */
export async function create(pgPool, payload) {
  const normalized = normalizePayload(payload);

  return withClient(pgPool, async (client) => {
    await client.query('BEGIN');

    try {
      if (normalized.isdefault) {
        // Limpa outros defaults do mesmo owner
        if (normalized.owneruserid == null) {
          await client.query(
            `UPDATE ${EMAIL_SIGNATURES_TABLE}
                SET isdefault = FALSE
              WHERE owneruserid IS NULL`
          );
        } else {
          await client.query(
            `UPDATE ${EMAIL_SIGNATURES_TABLE}
                SET isdefault = FALSE
              WHERE owneruserid = $1`,
            [normalized.owneruserid]
          );
        }
      }

      const { rows } = await client.query(
        `INSERT INTO ${EMAIL_SIGNATURES_TABLE}
           (owneruserid, name, html, isdefault, created_at, updated_at)
         VALUES ($1, $2, $3, $4, NOW(), NOW())
         RETURNING *`,
        [
          normalized.owneruserid,
          normalized.name,
          normalized.html,
          normalized.isdefault
        ]
      );

      await client.query('COMMIT');
      return rows[0];
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }
  });
}
