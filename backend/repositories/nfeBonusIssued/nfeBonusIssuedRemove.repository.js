// ╔═══════════════════════════════════════════════════════════════════════╗
// ║ nfeBonusIssuedRemove.repository.js — NF-e Bonificação                 ║
// ║ Remove a bonificação                                                  ║
// ╚═══════════════════════════════════════════════════════════════════════╝

import { createAuditLog } from '../../repositories/auditLogs/auditLogs.index.js';
import { TB_BONUS } from './nfeBonusIssued.constants.js';
import { normalizePositiveInteger, normalizeUserId } from './nfeBonusIssued.sanitizers.js';
import { withTransaction } from './nfeBonusIssued.utils.js';
import { rowToBonus } from './nfeBonusIssued.mappers.js';
import { ensureTables } from './nfeBonusIssuedSchema.repository.js';

// ======================================================================
// DELETE BONUS
// ======================================================================

export async function remove(
  bonusId,
  {
    userId = null,
  } = {}
) {
  await ensureTables();

  const id =
    normalizePositiveInteger(
      bonusId
    );


  if (!id) {
    return {
      ok: false,
      error:
        'bonus_id inválido',
    };
  }


  const result =
    await withTransaction(
      async (client) => {

        // ------------------------------------------------------------
        // LOCK
        // ------------------------------------------------------------

        const beforeRes =
          await client.query(
            `
            SELECT *
            FROM ${TB_BONUS}
            WHERE bonus_id = $1
            FOR UPDATE
            `,
            [id]
          );


        if (!beforeRes.rows.length) {
          return {
            ok: true,
            deleted: 0,
          };
        }


        const before =
          beforeRes.rows[0];


        const status =
          String(
            before.status || ''
          ).toUpperCase();


        if (
          status !== 'DRAFT' &&
          status !== 'REJECTED'
        ) {
          return {
            ok: false,

            error:
              `Bonificação não pode ser excluída no status ${status}`,
          };
        }


        // ------------------------------------------------------------
        // DELETE
        // ------------------------------------------------------------

        await client.query(
          `
          DELETE FROM ${TB_BONUS}
          WHERE bonus_id = $1
          `,
          [id]
        );


        // ------------------------------------------------------------
        // AUDIT
        // ------------------------------------------------------------

        await createAuditLog({
          tabela:
            'nfeBonus',

          register_id:
            id,

          operation:
            'DELETE',

          user_id:
            normalizeUserId(userId),

          before:
            rowToBonus(before),

          after:
            null,

          db: client,
        });


        return {
          ok: true,
          deleted: 1,
        };
      }
    );


  return result;
}
