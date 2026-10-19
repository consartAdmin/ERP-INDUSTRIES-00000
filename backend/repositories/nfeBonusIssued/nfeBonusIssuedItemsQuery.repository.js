// ╔═══════════════════════════════════════════════════════════════════════╗
// ║ nfeBonusIssuedItemsQuery.repository.js — NF-e Bonificação             ║
// ║ Lista os itens da bonificação                                         ║
// ╚═══════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB_BONUS_ITEMS, TB_PRODUCTS, TB_PRODUCT_GRADES, TB_STOCK_LOTS } from './nfeBonusIssued.constants.js';
import { normalizePositiveInteger } from './nfeBonusIssued.sanitizers.js';
import { rowToBonusItem } from './nfeBonusIssued.mappers.js';
import { ensureTables } from './nfeBonusIssuedSchema.repository.js';

// ======================================================================
// LIST ITEMS
// ======================================================================

export async function listItems(
  bonusId
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


  const { rows } =
    await pool.query(
      `
      SELECT
        i.*,

        p.description,
        p.manufacturer_ref,

        pg.grade_id,

        l.lot_code,
        l.expires_at,

        l.qty_on_hand,
        l.qty_reserved,

        CASE
          WHEN l.lot_id IS NULL
            THEN NULL
          ELSE (
            l.qty_on_hand -
            l.qty_reserved
          )
        END AS qty_available

      FROM ${TB_BONUS_ITEMS} i

      INNER JOIN ${TB_PRODUCTS} p
        ON p.product_id =
           i.product_id

      LEFT JOIN ${TB_PRODUCT_GRADES} pg
        ON pg.product_grade_id =
           i.product_grade_id

      LEFT JOIN ${TB_STOCK_LOTS} l
        ON l.lot_id =
           i.lot_id

      WHERE i.bonus_id = $1

      ORDER BY
        i.item_sequence ASC,
        i.bonus_item_id ASC
      `,
      [id]
    );


  return {
    ok: true,

    rows:
      rows.map(
        rowToBonusItem
      ),

    total:
      rows.length,
  };
}
