// ╔═══════════════════════════════════════════════════════════════════════╗
// ║ nfeBonusIssuedLookup.repository.js — NF-e Bonificação                 ║
// ║ Operação BONUS, cliente, produto, lote e sequência de item            ║
// ╚═══════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB_BONUS_ITEMS, TB_OPERATION_TYPES, TB_CUSTOMERS, TB_PRODUCTS, TB_STOCK, TB_STOCK_LOTS } from './nfeBonusIssued.constants.js';
import { normalizeText, normalizePositiveInteger } from './nfeBonusIssued.sanitizers.js';

// ======================================================================
// GET BONUS OPERATION
// ======================================================================

export async function getBonusOperation({
  db = pool,
} = {}) {
  const { rows } = await db.query(
    `
    SELECT
      operation_type_id,
      code,
      name,
      nature_operation,
      cfop_internal,
      cfop_interstate,
      generates_receivable,
      moves_stock,
      active
    FROM ${TB_OPERATION_TYPES}
    WHERE UPPER(code) = 'BONUS'
      AND active = TRUE
    LIMIT 1
    `
  );

  return rows[0] || null;
}


// ======================================================================
// CHECK CUSTOMER
// ======================================================================

export async function getCustomerForBonus(
  customerId,
  {
    db = pool,
  } = {}
) {
  const id = normalizePositiveInteger(customerId);

  if (!id) {
    return null;
  }

  const { rows } = await db.query(
    `
    SELECT
      customer_id,
      legal_name,
      trade_name,
      tax_id,
      state,
      city,
      email,
      invoice_email,
      is_active
    FROM ${TB_CUSTOMERS}
    WHERE customer_id = $1
    LIMIT 1
    `,
    [id]
  );

  return rows[0] || null;
}


// ======================================================================
// RESOLVE PRODUCT
// ======================================================================

export async function resolveProduct(
  productCode,
  {
    db = pool,
  } = {}
) {
  const code =
    normalizeText(productCode);

  if (!code) {
    return null;
  }

  const { rows } =
    await db.query(
      `
      SELECT
        p.product_id,
        p.product_code,
        p.description,
        p.manufacturer_ref,

        p.product_grade_id,
        p.product_stock_id,

        COALESCE(
          ps.stock_qty,
          0
        ) AS stock_qty

      FROM ${TB_PRODUCTS} p

      LEFT JOIN ${TB_STOCK} ps
        ON ps.product_stock_id =
           p.product_stock_id

      WHERE
        p.product_code = $1

        OR regexp_replace(
             p.product_code,
             '^0+',
             ''
           ) =
           regexp_replace(
             $1,
             '^0+',
             ''
           )

      LIMIT 1
      `,
      [code]
    );

  return rows[0] || null;
}


// ======================================================================
// RESOLVE LOT
// ======================================================================

export async function resolveLot(
  lotId,
  {
    productStockId = null,
    db = pool,
  } = {}
) {
  const id =
    normalizePositiveInteger(lotId);

  if (!id) {
    return null;
  }


  const args = [id];

  let stockFilter = '';


  if (
    normalizePositiveInteger(
      productStockId
    )
  ) {
    args.push(
      normalizePositiveInteger(
        productStockId
      )
    );

    stockFilter =
      `AND l.product_stock_id = $2`;
  }


  const { rows } =
    await db.query(
      `
      SELECT
        l.lot_id,
        l.product_stock_id,

        l.product_grade_id,

        l.lot_code,
        l.expires_at,

        l.qty_on_hand,
        l.qty_reserved,

        (
          l.qty_on_hand -
          l.qty_reserved
        ) AS qty_available,

        l.cost_unit,

        l.is_active

      FROM ${TB_STOCK_LOTS} l

      WHERE
        l.lot_id = $1

        ${stockFilter}

        AND COALESCE(
          l.is_active,
          TRUE
        ) = TRUE

      LIMIT 1
      `,
      args
    );


  return rows[0] || null;
}


// ======================================================================
// NEXT ITEM SEQUENCE
// ======================================================================

export async function getNextItemSequence(
  bonusId,
  {
    db = pool,
  } = {}
) {
  const { rows } =
    await db.query(
      `
      SELECT
        COALESCE(
          MAX(item_sequence),
          0
        ) + 1 AS next_sequence

      FROM ${TB_BONUS_ITEMS}

      WHERE bonus_id = $1
      `,
      [bonusId]
    );


  return Number(
    rows?.[0]?.next_sequence || 1
  );
}
