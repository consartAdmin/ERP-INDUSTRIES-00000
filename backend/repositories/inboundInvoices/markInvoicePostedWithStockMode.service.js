// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ markInvoicePostedWithStockMode.service.js — CONSART ERP                  ║
// ║ Orquestra postagem da entrada respeitando PRODUCT_STOCK_MODE             ║
// ╚══════════════════════════════════════════════════════════════════════════╝

'use strict';

import { TB_III } from './_shared.js';
import { clearInvoiceItemLots } from './clearInvoiceItemLots.repository.js';
import { ensureInboundItemLots } from './ensureInboundItemLots.repository.js';
import {
  markInvoicePostedWithMovements as markInvoicePostedWithMovementsRepository,
} from './markInvoicePostedWithMovements.repository.js';
import {
  resolveInboundStockMode,
  assertInboundItemsForPosting,
} from './inboundStockMode.service.js';

async function listItemsForPosting(client, invoiceId) {
  const result = await client.query(
    `
      SELECT
        inbound_item_id,
        inbound_id,
        nfe_item_seq,
        product_code,
        product_id,
        product_grade_id,
        lot_id,
        quantity,
        unit,
        unit_price,
        description,
        nfe_key,
        raw_product_payload
      FROM ${TB_III}
      WHERE inbound_id = $1
      ORDER BY nfe_item_seq NULLS LAST, inbound_item_id ASC
    `,
    [invoiceId],
  );

  return result.rows || [];
}

export async function markInvoicePostedWithStockMode(
  client,
  invoiceId,
  options = {},
) {
  const stockMode =
    options.stockMode ||
    await resolveInboundStockMode(options);

  let items = await listItemsForPosting(client, invoiceId);

  if (stockMode.isSimple) {
    // Proteção de backend: um lot_id antigo/oculto nunca pode sobreviver
    // quando a feature está em STOCK_SIMPLE.
    await clearInvoiceItemLots(client, invoiceId);
    items = items.map((item) => ({ ...item, lot_id: null }));
  } else if (stockMode.isWithLot) {
    // Em STOCK_WITH_LOT, o backend é a autoridade final da rastreabilidade:
    // 1) respeita lot_id já selecionado, validando produto/grade;
    // 2) tenta reaproveitar lote da mesma NF-e/item;
    // 3) tenta localizar o lote do XML ou o LOTE PADRÃO do produto/grade;
    // 4) cria o lote quando ainda não existir;
    // 5) grava o lot_id no inboundInvoiceItems ANTES da movimentação.
    items = await ensureInboundItemLots(client, items);

    assertInboundItemsForPosting(items, stockMode);
  } else {
    const error = new Error(
      `[INBOUND] PRODUCT_STOCK_MODE não suportado na postagem: ${stockMode.mode || 'NÃO INFORMADO'}.`,
    );
    error.code = 'INBOUND_STOCK_MODE_UNSUPPORTED';
    error.status = 500;
    error.statusCode = 500;
    throw error;
  }

  const result = await markInvoicePostedWithMovementsRepository(
    client,
    invoiceId,
    options,
  );

  return {
    ...result,
    stockMode: {
      featureCode: 'PRODUCT_STOCK_MODE',
      mode: stockMode.mode,
      isSimple: stockMode.isSimple === true,
      isWithLot: stockMode.isWithLot === true,
      requireLot: stockMode.requireLot === true,
      scopeType: stockMode.scopeType,
      scopeId: stockMode.scopeId,
      source: stockMode.source,
    },
    lotResolution: stockMode.isWithLot
      ? items.map((item) => ({
        inbound_item_id: item.inbound_item_id,
        product_code: item.product_code,
        lot_id: item.lot_id ?? null,
        lot_code: item.lot_code ?? null,
      }))
      : [],
  };
}

export default markInvoicePostedWithStockMode;
