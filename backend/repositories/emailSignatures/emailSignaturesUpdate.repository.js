// ╔════════════════════════════════════════════════════════════════════╗
// ║ emailSignaturesUpdate.repository.js — update / setDefault          ║
// ╚════════════════════════════════════════════════════════════════════╝

import { EMAIL_SIGNATURES_TABLE } from './emailSignatures.constants.js';
import { withClient } from './emailSignatures.utils.js';
import { normalizePayload } from './emailSignatures.sanitizers.js';

/**
 * Atualiza uma assinatura existente.
 * Pode trocar texto, nome e se é default.
 *
 * @param {import('pg').Pool} pgPool
 * @param {number} id
 * @param {object} payload
 */
export async function update(pgPool, id, payload) {
  const normalized = normalizePayload(payload);

  return withClient(pgPool, async (client) => {
    await client.query('BEGIN');

    try {
      // Descobre owneruserid atual, se não veio no payload
      let ownerUserId = normalized.owneruserid;
      if (ownerUserId == null) {
        const { rows: currentRows } = await client.query(
          `SELECT owneruserid
             FROM ${EMAIL_SIGNATURES_TABLE}
            WHERE id = $1`,
          [id]
        );
        if (!currentRows[0]) {
          throw new Error(`emailSignatures.id=${id} not found`);
        }
        ownerUserId = currentRows[0].owneruserid;
      }

      if (normalized.isdefault) {
        // Limpa default anterior do mesmo owner
        if (ownerUserId == null) {
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
            [ownerUserId]
          );
        }
      }

      const { rows } = await client.query(
        `UPDATE ${EMAIL_SIGNATURES_TABLE}
            SET owneruserid = $1,
                name        = $2,
                html        = $3,
                isdefault   = $4,
                updated_at  = NOW()
          WHERE id = $5
        RETURNING *`,
        [
          normalized.owneruserid ?? ownerUserId,
          normalized.name,
          normalized.html,
          normalized.isdefault,
          id
        ]
      );

      await client.query('COMMIT');
      return rows[0] || null;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }
  });
}

/**
 * Define a assinatura como padrão (e limpa as outras do mesmo owner).
 *
 * @param {import('pg').Pool} pgPool
 * @param {number} id
 */
export async function setDefault(pgPool, id) {
  return withClient(pgPool, async (client) => {
    await client.query('BEGIN');

    try {
      const { rows } = await client.query(
        `SELECT owneruserid
           FROM ${EMAIL_SIGNATURES_TABLE}
          WHERE id = $1`,
        [id]
      );
      if (!rows[0]) {
        throw new Error(`emailSignatures.id=${id} not found`);
      }

      const ownerUserId = rows[0].owneruserid;

      if (ownerUserId == null) {
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
          [ownerUserId]
        );
      }

      const { rows: updated } = await client.query(
        `UPDATE ${EMAIL_SIGNATURES_TABLE}
            SET isdefault = TRUE,
                updated_at = NOW()
          WHERE id = $1
        RETURNING *`,
        [id]
      );

      await client.query('COMMIT');
      return updated[0] || null;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }
  });
}
