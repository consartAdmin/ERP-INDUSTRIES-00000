// ╔══════════════════════════════════════════════════════════════════════╗
// ║ _stockOutAudit.js — CONSART ERP | Notas Fiscais Emitidas             ║
// ║ Auditoria automática de saída de produtos (PRODUCT_STOCK_OUT)        ║
// ║ Usado por create, upsertFromOrder e syncFaturadasFromOrders          ║
// ╚══════════════════════════════════════════════════════════════════════╝

import {
  pool,
  createAuditLog,
  TB_ORDER_ITEMS,
  TB_AUDIT_LOGS,
  normalizeText,
} from './_shared.js';

async function auditAlreadyExists({ sku, invoiceId, orderItemId }) {
  const { rowCount } = await pool.query(
    `
    SELECT 1
    FROM ${TB_AUDIT_LOGS}
    WHERE tabela = 'invoicesIssued'
      AND register_id = $1
      AND operation = 'PRODUCT_STOCK_OUT'
      AND after->>'invoice_id' = $2
      AND after->>'order_item_id' = $3
    LIMIT 1
    `,
    [
      String(sku),
      String(invoiceId),
      String(orderItemId),
    ]
  );

  return rowCount > 0;
}

export async function createInvoiceIssuedAudit(orderId, invoiceId) {
  try {
    const safeOrderId = Number(orderId);
    const safeInvoiceId = Number(invoiceId);

    if (!Number.isFinite(safeOrderId) || safeOrderId <= 0) return;
    if (!Number.isFinite(safeInvoiceId) || safeInvoiceId <= 0) return;

    const { rows: items } = await pool.query(
      `
      SELECT
        order_item_id,
        order_id,
        product_code,
        description,
        grade_id,
        unit_code,
        quantity,
        unit_price,
        discount_value,
        price_id
      FROM ${TB_ORDER_ITEMS}
      WHERE order_id = $1
      ORDER BY order_item_id ASC
      `,
      [safeOrderId]
    );

    for (const item of items) {
      const sku = normalizeText(item.product_code);
      if (!sku) continue;

      const quantityOut = Number(item.quantity || 0);

      const duplicated = await auditAlreadyExists({
        sku,
        invoiceId: safeInvoiceId,
        orderItemId: item.order_item_id,
      });

      if (duplicated) continue;

      const { rows: stockRows } = await pool.query(
        `
        SELECT
          p.product_id,
          p.product_code,
          p.product_stock_id,
          COALESCE(ps.stock_qty, 0) AS stock_qty
        FROM public."products" p
        LEFT JOIN public."productsStock" ps
          ON ps.product_stock_id = p.product_stock_id
        WHERE
          p.product_code = $1
          OR regexp_replace(p.product_code, '^0+', '') =
             regexp_replace($1, '^0+', '')
        LIMIT 1
        `,
        [sku]
      );

      const stock = stockRows[0] || null;
      const stockAfter = Number(stock?.stock_qty || 0);
      const stockBefore = stockAfter + quantityOut;

      const { rows: lotRows } = await pool.query(
        `
        SELECT
          l.lot_id,
          l.product_stock_id,
          l.product_grade_id,
          pg.grade_id,
          pg.product_id AS grade_product_id,
          l.lot_code,
          l.expires_at,
          l.qty_on_hand,
          l.qty_reserved,
          (l.qty_on_hand - l.qty_reserved) AS qty_available
        FROM public."productsStockLots" l
        LEFT JOIN public."productsGrades" pg
          ON pg.product_grade_id = l.product_grade_id
        WHERE l.product_stock_id = $1
          AND (
            $2::integer IS NULL
            OR pg.grade_id = $2::integer
            OR l.product_grade_id = $2::integer
          )
        ORDER BY
          CASE WHEN (l.qty_on_hand - l.qty_reserved) > 0 THEN 0 ELSE 1 END,
          l.expires_at NULLS LAST,
          l.lot_id ASC
        LIMIT 1
        `,
        [
          stock?.product_stock_id || null,
          item.grade_id ? Number(item.grade_id) : null,
        ]
      );

      const lot = lotRows[0] || null;

      await createAuditLog({
        tabela: 'invoicesIssued',
        register_id: sku,
        operation: 'PRODUCT_STOCK_OUT',
        user_id: null,

        before: {
          sku,
          product_id: stock?.product_id || null,
          product_stock_id: stock?.product_stock_id || null,

          grade_id: item.grade_id,
          product_grade_id: lot?.product_grade_id || null,

          lot_id: lot?.lot_id || null,
          lot_code: lot?.lot_code || null,
          expires_at: lot?.expires_at || null,

          stock_before: stockBefore,
        },

        after: {
          source: 'invoiceIssued',
          order_id: item.order_id,
          invoice_id: safeInvoiceId,
          order_item_id: item.order_item_id,

          sku,
          description: item.description,

          grade_id: item.grade_id,
          product_grade_id: lot?.product_grade_id || null,

          lot_id: lot?.lot_id || null,
          lot_code: lot?.lot_code || null,
          expires_at: lot?.expires_at || null,

          quantity_out: quantityOut,
          stock_before: stockBefore,
          stock_after: stockAfter,

          qty_on_hand_after:
            lot?.qty_on_hand !== undefined && lot?.qty_on_hand !== null
              ? Number(lot.qty_on_hand || 0)
              : null,

          qty_reserved_after:
            lot?.qty_reserved !== undefined && lot?.qty_reserved !== null
              ? Number(lot.qty_reserved || 0)
              : null,

          qty_available_after:
            lot?.qty_available !== undefined && lot?.qty_available !== null
              ? Number(lot.qty_available || 0)
              : null,

          unit: item.unit_code,
          unit_price: Number(item.unit_price || 0),
          discount_value: Number(item.discount_value || 0),
          price_id: item.price_id,
          observation: `Saída por NF-e emitida #${safeInvoiceId}`,
        },
      });
    }
  } catch (error) {
    console.error('[createInvoiceIssuedAudit]', error);
  }
}
