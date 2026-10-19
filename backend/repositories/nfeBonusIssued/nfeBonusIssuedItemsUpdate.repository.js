// ╔═══════════════════════════════════════════════════════════════════════╗
// ║ nfeBonusIssuedItemsUpdate.repository.js — NF-e Bonificação            ║
// ║ Atualiza item da bonificação                                          ║
// ╚═══════════════════════════════════════════════════════════════════════╝

import { createAuditLog } from '../../repositories/auditLogs/auditLogs.index.js';
import { TB_BONUS, TB_BONUS_ITEMS, TB_PRODUCTS } from './nfeBonusIssued.constants.js';
import { normalizePositiveInteger, normalizeDecimal, normalizeMoney, normalizeUserId } from './nfeBonusIssued.sanitizers.js';
import { withTransaction } from './nfeBonusIssued.utils.js';
import { rowToBonusItem } from './nfeBonusIssued.mappers.js';
import { ensureTables } from './nfeBonusIssuedSchema.repository.js';
import { resolveLot } from './nfeBonusIssuedLookup.repository.js';
import { recalculateBonusTotal } from './nfeBonusIssuedTotal.repository.js';
import { getById } from './nfeBonusIssuedGetById.repository.js';

// ======================================================================
// UPDATE ITEM
// ======================================================================

export async function updateItem(
  bonusId,
  bonusItemId,
  patch = {},
  {
    userId = null,
  } = {}
) {
  await ensureTables();

  const safeBonusId =
    normalizePositiveInteger(
      bonusId
    );

  const safeItemId =
    normalizePositiveInteger(
      bonusItemId
    );


  if (!safeBonusId) {
    return {
      ok: false,
      error:
        'bonus_id inválido',
    };
  }


  if (!safeItemId) {
    return {
      ok: false,
      error:
        'bonus_item_id inválido',
    };
  }


  const result =
    await withTransaction(
      async (client) => {

        // ------------------------------------------------------------
        // BONUS
        // ------------------------------------------------------------

        const bonusRes =
          await client.query(
            `
            SELECT *
            FROM ${TB_BONUS}
            WHERE bonus_id = $1
            FOR UPDATE
            `,
            [safeBonusId]
          );


        if (!bonusRes.rows.length) {
          return {
            ok: false,
            error:
              'BONUS_NOT_FOUND',
          };
        }


        if (
          String(
            bonusRes.rows[0].status
          ).toUpperCase() !==
          'DRAFT'
        ) {
          return {
            ok: false,
            error:
              'Itens só podem ser alterados enquanto a bonificação estiver em DRAFT',
          };
        }


        // ------------------------------------------------------------
        // ITEM
        // ------------------------------------------------------------

        const itemRes =
          await client.query(
            `
            SELECT *
            FROM ${TB_BONUS_ITEMS}
            WHERE
              bonus_item_id = $1
              AND bonus_id = $2
            FOR UPDATE
            `,
            [
              safeItemId,
              safeBonusId,
            ]
          );


        if (!itemRes.rows.length) {
          return {
            ok: false,
            error:
              'ITEM_NOT_FOUND',
          };
        }


        const before =
          itemRes.rows[0];


        // ------------------------------------------------------------
        // QUANTITY
        // ------------------------------------------------------------

        const quantity =
          patch.quantity !== undefined
            ? normalizeDecimal(
                patch.quantity,
                0,
                3
              )
            : Number(
                before.quantity || 0
              );


        if (quantity <= 0) {
          return {
            ok: false,
            error:
              'quantity deve ser maior que zero',
          };
        }


        // ------------------------------------------------------------
        // UNIT VALUE
        // ------------------------------------------------------------

        const unitValue =
          patch.unit_value !== undefined
            ? normalizeDecimal(
                patch.unit_value,
                0,
                6
              )
            : Number(
                before.unit_value || 0
              );


        if (unitValue < 0) {
          return {
            ok: false,
            error:
              'unit_value inválido',
          };
        }


        // ------------------------------------------------------------
        // LOT
        // ------------------------------------------------------------

        let lotId =
          before.lot_id;

        let productGradeId =
          before.product_grade_id;


        if (
          patch.lot_id !== undefined
        ) {
          if (
            patch.lot_id === null ||
            patch.lot_id === ''
          ) {
            lotId = null;
          } else {

            const productRes =
              await client.query(
                `
                SELECT
                  product_id,
                  product_stock_id
                FROM ${TB_PRODUCTS}
                WHERE product_id = $1
                LIMIT 1
                `,
                [
                  before.product_id,
                ]
              );


            const product =
              productRes.rows[0];


            const lot =
              await resolveLot(
                patch.lot_id,
                {
                  productStockId:
                    product?.product_stock_id,

                  db: client,
                }
              );


            if (!lot) {
              return {
                ok: false,
                error:
                  'LOT_NOT_FOUND_OR_INVALID',
              };
            }


            const available =
              Number(
                lot.qty_available || 0
              );


            if (
              quantity > available
            ) {
              return {
                ok: false,

                error:
                  'INSUFFICIENT_LOT_STOCK',

                available,

                requested:
                  quantity,
              };
            }


            lotId =
              lot.lot_id;

            productGradeId =
              lot.product_grade_id
              ?? productGradeId;
          }
        }


        // ------------------------------------------------------------
        // VALIDATE EXISTING LOT
        // ------------------------------------------------------------

        if (
          patch.lot_id === undefined &&
          lotId
        ) {
          const lot =
            await resolveLot(
              lotId,
              {
                db: client,
              }
            );


          if (lot) {
            const available =
              Number(
                lot.qty_available || 0
              );

            if (
              quantity > available
            ) {
              return {
                ok: false,

                error:
                  'INSUFFICIENT_LOT_STOCK',

                available,

                requested:
                  quantity,
              };
            }
          }
        }


        // ------------------------------------------------------------
        // TOTAL
        // ------------------------------------------------------------

        const totalValue =
          normalizeMoney(
            quantity *
            unitValue,
            0
          );


        // ------------------------------------------------------------
        // UPDATE
        // ------------------------------------------------------------

        const { rows } =
          await client.query(
            `
            UPDATE ${TB_BONUS_ITEMS}
            SET
              quantity = $1,
              unit_value = $2,
              total_value = $3,
              lot_id = $4,
              product_grade_id = $5,
              updated_at = NOW()
            WHERE
              bonus_item_id = $6
              AND bonus_id = $7
            RETURNING *
            `,
            [
              quantity,
              unitValue,
              totalValue,

              lotId,
              productGradeId,

              safeItemId,
              safeBonusId,
            ]
          );


        const after =
          rows[0];


        // ------------------------------------------------------------
        // TOTAL
        // ------------------------------------------------------------

        await recalculateBonusTotal(
          safeBonusId,
          {
            db: client,
          }
        );


        // ------------------------------------------------------------
        // AUDIT
        // ------------------------------------------------------------

        await createAuditLog({
          tabela:
            'nfeBonusItems',

          register_id:
            safeItemId,

          operation:
            'UPDATE',

          user_id:
            normalizeUserId(userId),

          before:
            rowToBonusItem(before),

          after:
            rowToBonusItem(after),

          db: client,
        });


        return {
          ok: true,
        };
      }
    );


  if (!result.ok) {
    return result;
  }


  return getById(
    safeBonusId
  );
}
