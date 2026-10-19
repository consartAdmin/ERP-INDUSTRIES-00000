// ╔═══════════════════════════════════════════════════════════════════════╗
// ║ nfeBonusIssuedItemsCreate.repository.js — NF-e Bonificação            ║
// ║ Adiciona item à bonificação                                           ║
// ╚═══════════════════════════════════════════════════════════════════════╝

import { createAuditLog } from '../../repositories/auditLogs/auditLogs.index.js';
import { TB_BONUS, TB_BONUS_ITEMS } from './nfeBonusIssued.constants.js';
import { normalizeText, normalizePositiveInteger, normalizeDecimal, normalizeMoney, normalizeUserId } from './nfeBonusIssued.sanitizers.js';
import { withTransaction } from './nfeBonusIssued.utils.js';
import { ensureTables } from './nfeBonusIssuedSchema.repository.js';
import { resolveProduct, resolveLot, getNextItemSequence } from './nfeBonusIssuedLookup.repository.js';
import { recalculateBonusTotal } from './nfeBonusIssuedTotal.repository.js';
import { getById } from './nfeBonusIssuedGetById.repository.js';
import { rowToBonusItem } from './nfeBonusIssued.mappers.js';

// ======================================================================
// ADD ITEM
// ======================================================================

export async function addItem(
  bonusId,
  data = {},
  {
    userId = null,
  } = {}
) {
  await ensureTables();

  const safeBonusId =
    normalizePositiveInteger(bonusId);

  if (!safeBonusId) {
    return {
      ok: false,
      error: 'bonus_id inválido',
    };
  }


  const productCode =
    normalizeText(
      data.product_code
    );

  if (!productCode) {
    return {
      ok: false,
      error:
        'product_code é obrigatório',
    };
  }


  const quantity =
    normalizeDecimal(
      data.quantity,
      0,
      3
    );

  if (
    !Number.isFinite(quantity) ||
    quantity <= 0
  ) {
    return {
      ok: false,
      error:
        'quantity deve ser maior que zero',
    };
  }


  const unitValue =
    normalizeDecimal(
      data.unit_value,
      0,
      6
    );

  if (unitValue < 0) {
    return {
      ok: false,
      error:
        'unit_value inválido',
    };
  }


  // Fiscal total remains with 2 decimal places.
  const totalValue =
    normalizeMoney(
      quantity * unitValue,
      0
    );


  const result =
    await withTransaction(
      async (client) => {

        // ------------------------------------------------------------
        // LOCK BONUS
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


        const bonus =
          bonusRes.rows[0];


        if (
          String(bonus.status)
            .toUpperCase() !== 'DRAFT'
        ) {
          return {
            ok: false,
            error:
              `Itens só podem ser alterados em DRAFT. Status atual: ${bonus.status}`,
          };
        }


        // ------------------------------------------------------------
        // PRODUCT
        // ------------------------------------------------------------

        const product =
          await resolveProduct(
            productCode,
            {
              db: client,
            }
          );


        if (!product) {
          return {
            ok: false,
            error:
              'PRODUCT_NOT_FOUND',
          };
        }


        // ------------------------------------------------------------
        // LOT
        // ------------------------------------------------------------

        let lot = null;

        if (data.lot_id) {
          lot =
            await resolveLot(
              data.lot_id,
              {
                productStockId:
                  product.product_stock_id,

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


          if (quantity > available) {
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


        // ------------------------------------------------------------
        // GRADE
        // ------------------------------------------------------------

        const productGradeId =
          lot?.product_grade_id
          ??
          normalizePositiveInteger(
            data.product_grade_id
          )
          ??
          normalizePositiveInteger(
            product.product_grade_id
          )
          ??
          null;


        // ------------------------------------------------------------
        // SEQUENCE
        // ------------------------------------------------------------

        const itemSequence =
          data.item_sequence
            ? normalizePositiveInteger(
                data.item_sequence
              )
            : await getNextItemSequence(
                safeBonusId,
                {
                  db: client,
                }
              );


        if (!itemSequence) {
          return {
            ok: false,
            error:
              'item_sequence inválido',
          };
        }


        // ------------------------------------------------------------
        // INSERT
        // ------------------------------------------------------------

        const { rows } =
          await client.query(
            `
            INSERT INTO ${TB_BONUS_ITEMS} (
              bonus_id,

              product_id,
              product_code,

              product_grade_id,
              lot_id,

              quantity,

              unit_value,
              total_value,

              item_sequence
            )
            VALUES (
              $1,$2,$3,$4,$5,$6,$7,$8,$9
            )
            RETURNING *
            `,
            [
              safeBonusId,

              product.product_id,
              product.product_code,

              productGradeId,
              lot?.lot_id ?? null,

              quantity,

              unitValue,
              totalValue,

              itemSequence,
            ]
          );


        const created =
          rows[0];


        // ------------------------------------------------------------
        // RECALCULATE HEADER TOTAL
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
            created.bonus_item_id,

          operation:
            'CREATE',

          user_id:
            normalizeUserId(userId),

          before:
            null,

          after: {
            ...rowToBonusItem(
              created
            ),

            description:
              product.description,

            lot_code:
              lot?.lot_code || null,

            qty_available:
              lot
                ? Number(
                    lot.qty_available || 0
                  )
                : null,
          },

          db: client,
        });


        return {
          ok: true,

          bonus_item_id:
            Number(
              created.bonus_item_id
            ),
        };
      }
    );


  if (!result?.ok) {
    return result;
  }


  return getById(
    safeBonusId
  );
}
