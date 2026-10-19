// ╔════════════════════════════════════════════════════════════════════╗
// ║ conciliationSalesxStock.sql.js — CTE da conciliação (reportCte)    ║
// ║ Fonte operacional: productMovements                                ║
// ╚════════════════════════════════════════════════════════════════════╝

export function reportCte(stockMode = {}) {
  const simpleStock = stockMode?.isSimple === true;
  const qtyOnHand = simpleStock
    ? 'COALESCE(MAX(ps.stock_qty), 0)'
    : `COALESCE(SUM(CASE WHEN COALESCE(psl.is_active, true) AND psl.deleted_at IS NULL THEN COALESCE(psl.qty_on_hand, 0) ELSE 0 END), 0)`;
  const qtyReserved = simpleStock
    ? '0::numeric'
    : `COALESCE(SUM(CASE WHEN COALESCE(psl.is_active, true) AND psl.deleted_at IS NULL THEN COALESCE(psl.qty_reserved, 0) ELSE 0 END), 0)`;
  const availableStock = simpleStock
    ? 'COALESCE(MAX(ps.stock_qty), 0)'
    : `COALESCE(SUM(CASE WHEN COALESCE(psl.is_active, true) AND psl.deleted_at IS NULL THEN COALESCE(psl.qty_on_hand, 0) ELSE 0 END), 0)
       - COALESCE(SUM(CASE WHEN COALESCE(psl.is_active, true) AND psl.deleted_at IS NULL THEN COALESCE(psl.qty_reserved, 0) ELSE 0 END), 0)`;

  return `
    WITH movement_source AS (
      SELECT
        pm.movement_id,
        BTRIM(pm.product_code) AS sku,
        CASE
          WHEN UPPER(BTRIM(pm.movement_type)) IN ('INBOUND', 'ENTRADA') THEN 'ENTRADA'
          WHEN UPPER(BTRIM(pm.movement_type)) IN ('OUTBOUND', 'SAIDA', 'SAÍDA') THEN 'SAIDA'
        END AS movement_type,
        ABS(COALESCE(pm.quantity, 0))::numeric AS quantity,
        COALESCE(
          NULLIF(BTRIM(pm.nfe_number), ''),
          inbound.invoice_number,
          issued.nfe_number::text
        ) AS invoice_number,
        COALESCE(
          CASE
            WHEN UPPER(BTRIM(pm.origin_module)) = 'INBOUND_INVOICE'
              THEN inbound.inbound_id::bigint
            WHEN UPPER(BTRIM(pm.origin_module)) IN (
              'ORDER_NFE_ATTEMPT',
              'BUDGET_NFE_ATTEMPT'
            )
             AND pm.origin_id::text ~ '^[0-9]+$'
              THEN pm.origin_id::text::bigint
          END,
          CASE
            WHEN COALESCE(pm.metadata->>'invoice_id', '') ~ '^[0-9]+$'
              THEN (pm.metadata->>'invoice_id')::bigint
          END,
          issued.invoice_id
        ) AS invoice_id,
        COALESCE(
          CASE
            WHEN UPPER(BTRIM(pm.origin_module)) = 'INBOUND_INVOICE'
              THEN COALESCE(
                inbound.entry_date,
                inbound.issue_date,
                inbound.created_at::date
              )
          END,
          CASE
            WHEN UPPER(BTRIM(pm.origin_module)) = 'ORDER_NFE_ATTEMPT'
              THEN COALESCE(
                order_attempt.authorized_at::date,
                order_attempt.requested_at::date
              )
          END,
          CASE
            WHEN UPPER(BTRIM(pm.origin_module)) = 'BUDGET_NFE_ATTEMPT'
              THEN COALESCE(
                budget_attempt.authorized_at::date,
                budget_attempt.requested_at::date
              )
          END,
          issued.issued_date,
          pm.created_at::date
        ) AS movement_date,
        pm.previous_stock::numeric AS stock_before,
        pm.new_stock::numeric AS stock_after,
        pm.created_at AS movement_created_at
      FROM public."productMovements" pm
      LEFT JOIN public."inboundInvoices" inbound
        ON UPPER(BTRIM(pm.origin_module)) = 'INBOUND_INVOICE'
       AND pm.origin_id::text = inbound.inbound_id::text
      LEFT JOIN LATERAL (
        SELECT a.authorized_at, a.requested_at
        FROM public."ordersNfeAttempts" a
        WHERE UPPER(BTRIM(pm.origin_module)) = 'ORDER_NFE_ATTEMPT'
          AND a.invoice_id::text = pm.origin_id::text
        ORDER BY
          a.authorized_at DESC NULLS LAST,
          a.attempt_id DESC
        LIMIT 1
      ) order_attempt ON true
      LEFT JOIN LATERAL (
        SELECT a.authorized_at, a.requested_at
        FROM public."budgetsNfeAttempts" a
        WHERE UPPER(BTRIM(pm.origin_module)) = 'BUDGET_NFE_ATTEMPT'
          AND a.invoice_id::text = pm.origin_id::text
        ORDER BY
          a.authorized_at DESC NULLS LAST,
          a.attempt_id DESC
        LIMIT 1
      ) budget_attempt ON true
      LEFT JOIN LATERAL (
        SELECT ii.invoice_id, ii.nfe_number, ii.issued_date
        FROM public."invoicesIssued" ii
        WHERE ii.nfe_number::text = NULLIF(BTRIM(pm.nfe_number), '')
           OR (
             UPPER(BTRIM(pm.origin_module)) IN (
               'INVOICEISSUED',
               'INVOICESISSUED'
             )
             AND pm.origin_id::text = ii.invoice_id::text
           )
        ORDER BY ii.invoice_id DESC
        LIMIT 1
      ) issued ON true
      WHERE UPPER(BTRIM(pm.movement_type)) IN (
        'INBOUND',
        'ENTRADA',
        'OUTBOUND',
        'SAIDA',
        'SAÍDA'
      )
        AND NULLIF(BTRIM(pm.product_code), '') IS NOT NULL
    ),
    filtered_movements AS (
      SELECT *
      FROM movement_source
      WHERE movement_date >= $1::date
        AND movement_date < ($2::date + INTERVAL '1 day')
    ),
    movement_rows AS (
      SELECT
        fm.movement_type,
        fm.invoice_id,
        fm.invoice_number,
        fm.movement_date,
        fm.sku,
        MAX(NULLIF(BTRIM(p.description), '')) AS movement_description,
        SUM(fm.quantity) AS movement_quantity,
        (
          ARRAY_AGG(
            fm.stock_before
            ORDER BY fm.movement_created_at, fm.movement_id
          )
        )[1] AS stock_before,
        (
          ARRAY_AGG(
            fm.stock_after
            ORDER BY fm.movement_created_at DESC, fm.movement_id DESC
          )
        )[1] AS stock_after,
        MIN(fm.movement_created_at) AS movement_created_at,
        MIN(fm.movement_id) AS movement_sort_id
      FROM filtered_movements fm
      LEFT JOIN public.products p
        ON p.product_code = fm.sku
      GROUP BY
        fm.movement_type,
        fm.invoice_id,
        fm.invoice_number,
        fm.movement_date,
        fm.sku
    ),
    sales_by_product AS (
      SELECT
        sku,
        COUNT(DISTINCT invoice_id) AS invoices_count,
        SUM(movement_quantity) AS quantity_sold
      FROM movement_rows
      WHERE movement_type = 'SAIDA'
      GROUP BY sku
    ),
inbound_by_product AS (
  SELECT
    sku,
    COUNT(
      DISTINCT COALESCE(
        NULLIF(BTRIM(invoice_number), ''),
        invoice_id::text
      )
    ) AS inbound_invoices_count,
    STRING_AGG(
      DISTINCT NULLIF(BTRIM(invoice_number), ''),
      ', '
      ORDER BY NULLIF(BTRIM(invoice_number), '')
    ) AS inbound_invoice_numbers,
    SUM(movement_quantity) AS quantity_inbound
  FROM movement_rows
  WHERE movement_type = 'ENTRADA'
  GROUP BY sku
),
    stock_by_product AS (
      SELECT
        BTRIM(p.product_code) AS sku,
        MAX(COALESCE(p.description, '')) AS product_description,
        ${qtyOnHand} AS qty_on_hand,
        ${qtyReserved} AS qty_reserved,
        ${availableStock} AS available_stock
      FROM public.products p
      LEFT JOIN public."productsStock" ps
        ON ps.product_stock_id = p.product_stock_id
      LEFT JOIN public."productsStockLots" psl
        ON psl.product_stock_id = ps.product_stock_id
      GROUP BY BTRIM(p.product_code)
    ),
    last_product_movement_balance AS (
      SELECT DISTINCT ON (sku)
        sku,
        new_stock::numeric AS historical_final_stock
      FROM (
        SELECT
          BTRIM(pm.product_code) AS sku,
          pm.new_stock,
          pm.created_at,
          pm.movement_id
        FROM public."productMovements" pm
        WHERE pm.new_stock IS NOT NULL
          AND NULLIF(BTRIM(pm.product_code), '') IS NOT NULL
      ) last_pm
      ORDER BY sku, created_at DESC, movement_id DESC
    ),
    reconciliation AS (
      SELECT
        COALESCE(sp.sku, ibp.sku) AS sku,
        COALESCE(st.product_description, '') AS description,
        COALESCE(sp.invoices_count, 0) AS invoices_count,
        COALESCE(ibp.inbound_invoices_count, 0) AS inbound_invoices_count,
        COALESCE(ibp.inbound_invoice_numbers, '') AS inbound_invoice_numbers,
        COALESCE(sp.quantity_sold, 0) AS quantity_sold,
        COALESCE(ibp.quantity_inbound, 0) AS quantity_inbound,
        COALESCE(st.qty_on_hand, 0) AS qty_on_hand,
        COALESCE(st.qty_reserved, 0) AS qty_reserved,
        COALESCE(st.available_stock, 0) AS available_stock,
        COALESCE(ibp.quantity_inbound, 0)
          - COALESCE(sp.quantity_sold, 0) AS net_movement,
        lpmb.historical_final_stock,
        GREATEST(-COALESCE(st.available_stock, 0), 0) AS stock_need,
        CASE
          WHEN lpmb.historical_final_stock IS NULL THEN 0
          ELSE ABS(
            COALESCE(st.qty_on_hand, 0) - lpmb.historical_final_stock
          )
        END AS reference_difference,
        GREATEST(-COALESCE(st.available_stock, 0), 0) AS quantity_to_buy
      FROM sales_by_product sp
      FULL JOIN inbound_by_product ibp
        ON ibp.sku = sp.sku
      LEFT JOIN stock_by_product st
        ON st.sku = COALESCE(sp.sku, ibp.sku)
      LEFT JOIN last_product_movement_balance lpmb
        ON lpmb.sku = COALESCE(sp.sku, ibp.sku)
    )
  `;
}
