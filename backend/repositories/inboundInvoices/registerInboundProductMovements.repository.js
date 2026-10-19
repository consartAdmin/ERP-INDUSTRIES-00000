// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ registerInboundProductMovements.repository.js — CONSART ERP            ║
// ║ ✅ Registra productMovements: ENTRADA + estoque anterior → novo          ║
// ╚══════════════════════════════════════════════════════════════════════════╝

'use strict';

import {
  registerProductMovement,
  MOVEMENT_TYPES,
} from '../productMovements/productMovements.index.js';

import {
  TB_INVOICES,
  TB_III,
  toNum,
} from './_shared.js';

export async function registerInboundProductMovements(client, invoiceId, { userCtx = {} } = {}) {
  const invoiceRes = await client.query(
    `
      SELECT inbound_id, access_key, invoice_number, series, issuer, recipient, total_amount
        FROM ${TB_INVOICES}
       WHERE inbound_id = $1
       LIMIT 1
    `,
    [invoiceId]
  );

  const invoice = invoiceRes.rows[0];
  if (!invoice) throw new Error('Inbound invoice not found to register movements');

  const itemsRes = await client.query(
    `
      SELECT
        iii.inbound_item_id,
        iii.inbound_id,
        iii.nf_product_code,
        iii.product_code,
        iii.product_id,
        iii.product_grade_id,
        iii.lot_id,
        iii.description,
        iii.ncm,
        iii.cfop,
        iii.unit,
        iii.quantity,
        iii.unit_price,
        iii.total_price,
        iii.ipi,
        iii.icms,
        psl.lot_code
      FROM ${TB_III} iii
      LEFT JOIN public."productsStockLots" psl
        ON psl.lot_id = iii.lot_id
      WHERE iii.inbound_id = $1
        AND iii.product_code IS NOT NULL
        AND TRIM(iii.product_code) <> ''
      ORDER BY iii.inbound_item_id ASC
    `,
    [invoiceId]
  );

  const items = itemsRes.rows;
  if (!items.length) return [];

  // ========================================================================
  // ESTOQUE FINAL POR SKU
  //
  // Neste ponto o estoque da NF-e já foi aplicado. Portanto:
  //
  //   estoque_inicial = estoque_final - soma_das_entradas_da_NFe
  //
  // Depois avançamos item a item. Isso também funciona quando a mesma NF-e
  // possui o mesmo SKU em mais de uma linha.
  // ========================================================================
  const productCodes = [
    ...new Set(
      items
        .map((item) => String(item.product_code || '').trim())
        .filter(Boolean)
    ),
  ];

  const finalStockBySku = new Map();

  if (productCodes.length) {
    const stockRes = await client.query(
      `
        SELECT
          p.product_code,
          COALESCE(ps.stock_qty, 0)::numeric AS stock_qty
        FROM public.products p
        LEFT JOIN public."productsStock" ps
          ON ps.product_stock_id = p.product_stock_id
        WHERE p.product_code = ANY($1::text[])
      `,
      [productCodes]
    );

    for (const row of stockRes.rows) {
      finalStockBySku.set(
        String(row.product_code || '').trim(),
        toNum(row.stock_qty, 0)
      );
    }
  }

  const inboundTotalBySku = new Map();

  for (const item of items) {
    const sku = String(item.product_code || '').trim();
    const quantity = toNum(item.quantity, 0);

    inboundTotalBySku.set(
      sku,
      toNum(inboundTotalBySku.get(sku), 0) + quantity
    );
  }

  // Cursor representa o estoque imediatamente ANTES do próximo item do SKU.
  const stockCursorBySku = new Map();

  for (const sku of productCodes) {
    if (!finalStockBySku.has(sku)) {
      stockCursorBySku.set(sku, null);
      continue;
    }

    const finalStock = toNum(finalStockBySku.get(sku), 0);
    const inboundTotal = toNum(inboundTotalBySku.get(sku), 0);

    stockCursorBySku.set(sku, finalStock - inboundTotal);
  }

  const movements = [];

  for (const item of items) {
    const sku = String(item.product_code || '').trim();
    const quantity = toNum(item.quantity, 0);

    const cursor = stockCursorBySku.get(sku);

    const previousStock =
      cursor === null || cursor === undefined
        ? null
        : toNum(cursor, 0);

    const newStock =
      previousStock === null
        ? null
        : previousStock + quantity;

    const movement = await registerProductMovement({
      client,
      product_code: sku,
      movement_type: MOVEMENT_TYPES.ENTRADA,
      origin_module: 'INBOUND_INVOICE',
      origin_table: 'inboundInvoiceItems',
      origin_id: item.inbound_item_id,
      quantity,

      // ✅ Histórico de estoque para a aba "Registros do Produto"
      previous_stock: previousStock,
      new_stock: newStock,

      unit: item.unit,
      lot_code: item.lot_code || (item.lot_id ? String(item.lot_id) : null),
      nfe_key: invoice.access_key,
      nfe_number: invoice.invoice_number,
      notes: `Entrada por NF-e de compra #${invoice.invoice_number || invoice.inbound_id}`,
      user_id: userCtx?.id || userCtx?.user_id || null,

      metadata: {
        inbound_invoice_id: invoice.inbound_id,
        invoice_number: invoice.invoice_number,
        series: invoice.series,
        issuer: invoice.issuer,
        recipient: invoice.recipient,
        total_amount: invoice.total_amount,

        inbound_item_id: item.inbound_item_id,
        nf_product_code: item.nf_product_code,
        product_id: item.product_id,
        product_grade_id: item.product_grade_id,
        lot_id: item.lot_id,
        lot_code: item.lot_code || null,
        description: item.description,
        ncm: item.ncm,
        cfop: item.cfop,
        unit_price: item.unit_price,
        total_price: item.total_price,
        ipi: item.ipi,
        icms: item.icms,

        previous_stock: previousStock,
        new_stock: newStock,
      },
    });

    if (newStock !== null) {
      stockCursorBySku.set(sku, newStock);
    }

    if (movement) movements.push(movement);
  }

  return movements;
}

export default registerInboundProductMovements;
