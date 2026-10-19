// ╔══════════════════════════════════════════════════════════════════════╗
// ║ budgetsGetById.repository.js — Leitura completa do orçamento         ║
// ╚══════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { BUDGETS_PRIMARY_KEY } from './budgets.catalog.js';
import {
  TB_BUDGETS,
  TB_BUDGET_ITEMS,
  TB_GRADES,
  TB_PSL,
  TB_PRODUCTS,
  ALIAS_PRD,
  TB_PRODUCTS_FISCAL,
  ALIAS_PF,
  TB_FISCAL_CLASSIFICATION,
  TB_BUDGETS_SHIPPING,
  TB_PRODUCTS_BARCODE,
} from './budgets.constants.js';
import {
  getTableColumns,
  tableExists,
} from './budgets.utils.js';
import {
  rowToBudget,
  rowToItem,
  rowToShipping,
} from './budgets.mappers.js';
import {
  AGG_FIELDS,
  BUDGET_SELECT,
} from './budgets.sql.js';

// ----------------------------------------------------------------------
// Read
// ----------------------------------------------------------------------
export async function getById(budgetId) {
  const client = await pool.connect();

  try {
    const bid = Number(budgetId);
    if (!Number.isFinite(bid) || bid <= 0) {
      return { ok: false, error: 'BAD_REQUEST' };
    }

    const headSql = `
        SELECT ${BUDGET_SELECT}, ${AGG_FIELDS}
        FROM ${TB_BUDGETS} b
        LEFT JOIN ${TB_BUDGET_ITEMS} i ON i.budget_id = b.budget_id
        WHERE b.${BUDGETS_PRIMARY_KEY} = $1
        GROUP BY b.budget_id
      `;
    const head = await client.query(headSql, [bid]);

    if (!head.rowCount) {
      return { ok: false, error: 'NOT_FOUND' };
    }

    console.log('[budgetsApi.getById] loaded budget header discount', {
      budgetId: bid,
      global_discount_type: head.rows?.[0]?.global_discount_type,
      global_discount_value: head.rows?.[0]?.global_discount_value,
      global_discount_amount: head.rows?.[0]?.global_discount_amount,
      subtotal: head.rows?.[0]?.subtotal,
      total_discount: head.rows?.[0]?.total_discount,
      total_amount: head.rows?.[0]?.total_amount,
    });

    const hasLotsTable = await tableExists(client, 'public', 'productsStockLots');

    let hasLotCode = false;
    let hasExpirationDate = false;
    let hasValidityDate = false;
    let hasExpireDate = false;

    if (hasLotsTable) {
      const set = await getTableColumns(client, 'public', 'productsStockLots');
      hasLotCode = set.has('lot_code');
      hasExpirationDate = set.has('expiration_date');
      hasValidityDate = set.has('validity_date');
      hasExpireDate = set.has('expire_date');
    }

    const lotsJoin = hasLotsTable
      ? `LEFT JOIN ${TB_PSL} l ON l.lot_id = bi.lot_id`
      : ``;

    const lotCodeSelect = (hasLotsTable && hasLotCode)
      ? `l.lot_code AS lot_code`
      : `NULL::text AS lot_code`;

    const lotExpSelect = (() => {
      if (!hasLotsTable) return `NULL::date AS lot_expiration`;

      const parts = [];
      if (hasExpirationDate) parts.push('l.expiration_date');
      if (hasValidityDate) parts.push('l.validity_date');
      if (hasExpireDate) parts.push('l.expire_date');

      return parts.length
        ? `COALESCE(${parts.join(', ')}) AS lot_expiration`
        : `NULL::date AS lot_expiration`;
    })();

    const productsJoin = `
        LEFT JOIN ${TB_PRODUCTS} ${ALIAS_PRD}
          ON ${ALIAS_PRD}.product_code = bi.product_code
      `;

    const pfJoin = `
        LEFT JOIN LATERAL (
          SELECT pf.*
          FROM ${TB_PRODUCTS_FISCAL} pf
          WHERE pf.product_code = bi.product_code
            AND pf.is_current = TRUE
            AND pf.is_active = TRUE
          ORDER BY pf.version DESC, pf.products_fiscal_id DESC
          LIMIT 1
        ) ${ALIAS_PF} ON TRUE
        LEFT JOIN ${TB_FISCAL_CLASSIFICATION} fc
          ON fc.fiscal_classification_id = ${ALIAS_PF}.fiscal_classification_id
      `;

    // Use the barcode selected on the item. For legacy items without a
    // barcode_id, use the product's standard barcode as a safe fallback.
    const barcodeWeightJoin = `
        LEFT JOIN LATERAL (
          SELECT pbc.weight_kg
          FROM ${TB_PRODUCTS_BARCODE} pbc
          WHERE
            (
              bi.barcode_id IS NOT NULL
              AND pbc.barcode_id = bi.barcode_id
            )
            OR
            (
              bi.barcode_id IS NULL
              AND pbc.product_code = bi.product_code
              AND pbc.standard = TRUE
            )
          ORDER BY
            CASE WHEN pbc.barcode_id = bi.barcode_id THEN 0 ELSE 1 END,
            pbc.barcode_id ASC
          LIMIT 1
        ) pbw ON TRUE
      `;

    const itemSql = `
        SELECT
          bi.budget_item_id,
          bi.budget_id,
          bi.product_code,
          bi.barcode_id,
          bi.manufacturer_ref,
          bi.description,
          bi.grade_id,
          g.grade AS grade,
          bi.unit_code,
          bi.conversion_factor,
          bi.quantity,
          COALESCE(pbw.weight_kg, 0) AS weight_kg,
          bi.unit_price,
          bi.discount_value,
          bi.price_id,
          bi.commission_id,
          bi.lot_id,
          ${ALIAS_PF}.products_fiscal_id AS products_fiscal_id,
          fc.ncm_code AS ncm,
          ${lotCodeSelect},
          ${lotExpSelect},
          bi.override_stock,
          bi.override_token,
          bi.override_approved_at,
          bi.override_approved_by,
          bi.override_reason,
          bi.override_qty,
          bi.override_lot_id
        FROM ${TB_BUDGET_ITEMS} bi
        LEFT JOIN ${TB_GRADES} g
          ON g.grade_id = bi.grade_id
        ${productsJoin}
        ${barcodeWeightJoin}
        ${pfJoin}
        ${lotsJoin}
        WHERE bi.budget_id = $1
        ORDER BY bi.budget_item_id ASC
      `;

    // Prefer the FK stored in budgets. If an older shipping save created the
    // budgetsShipping row but did not fill budgets.budget_shipping_id, recover
    // it through budget_id. This keeps NF-e preview/issuance compatible with
    // affected budgets and also lets us repair the missing pointer below.
    const shippingSql = `
        SELECT *
        FROM ${TB_BUDGETS_SHIPPING}
        WHERE budget_shipping_id = $1
           OR ($1::bigint IS NULL AND budget_id = $2)
        ORDER BY
          CASE WHEN budget_shipping_id = $1 THEN 0 ELSE 1 END,
          budget_shipping_id DESC
        LIMIT 1
      `;

    const [items, shipping] = await Promise.all([
      client.query(itemSql, [bid]),
      client.query(shippingSql, [
        head.rows[0]?.budget_shipping_id ?? null,
        bid,
      ]),
    ]);

    const mappedItems = items.rows.map(rowToItem);
    const calculatedGrossWeight = Number(
      mappedItems
        .reduce(
          (total, item) => total + Number(item.gross_weight_kg || 0),
          0,
        )
        .toFixed(3),
    );

    const shippingRow = shipping.rows?.[0] || null;
    const recoveredShippingId = shippingRow?.budget_shipping_id ?? null;

    // Self-heal records produced by the old freight-save flow. The guard
    // prevents overwriting a link that another request may have set meanwhile.
    if (
      head.rows[0]?.budget_shipping_id == null &&
      recoveredShippingId != null
    ) {
      await client.query(
        `
          UPDATE ${TB_BUDGETS}
          SET
            budget_shipping_id = $1,
            updated_at = CURRENT_TIMESTAMP
          WHERE ${BUDGETS_PRIMARY_KEY} = $2
            AND budget_shipping_id IS NULL
        `,
        [recoveredShippingId, bid],
      );

      head.rows[0].budget_shipping_id = recoveredShippingId;
    }

    // Product/package weights are the authoritative source for NF-e gross
    // weight. Persist the total so every downstream NF-e query receives it,
    // even when it reads budgetsShipping directly.
    if (shippingRow && calculatedGrossWeight > 0) {
      const storedGrossWeight = Number(shippingRow.gross_weight || 0);

      shippingRow.gross_weight = calculatedGrossWeight;

      if (Math.abs(storedGrossWeight - calculatedGrossWeight) > 0.0005) {
        await client.query(
          `
            UPDATE ${TB_BUDGETS_SHIPPING}
            SET
              gross_weight = $1,
              updated_at = CURRENT_TIMESTAMP
            WHERE budget_shipping_id = $2
          `,
          [calculatedGrossWeight, shippingRow.budget_shipping_id],
        );
      }
    }

    return {
      ok: true,
      header: rowToBudget(head.rows[0]),
      items: mappedItems,
      shipping: rowToShipping(shippingRow),
    };
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  } finally {
    client.release();
  }
}
