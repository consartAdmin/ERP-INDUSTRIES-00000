// ╔════════════════════════════════════════════════════════════════════╗
// ║ inventoryStock.repository.js — Helpers de estoque                  ║
// ║ usados na finalização/reabertura (productsStock / lotes)           ║
// ╚════════════════════════════════════════════════════════════════════╝

import { TB_LOTS } from './inventory.constants.js';
import { q } from './inventory.utils.js';
import { chunkArray } from './inventory.sanitizers.js';
import {
  hasCol,
} from './inventorySchemaInfo.repository.js';

// ──────────────────────────────────────────────────────────────
// Helpers de estoque finalização/reabertura
// ──────────────────────────────────────────────────────────────
export async function ensureProductsStockRows(client, productStockIds = []) {
  const ids = [...new Set(productStockIds.map((v) => Number(v)).filter((v) => Number.isInteger(v) && v > 0))];
  if (!ids.length) return;

  const psHasUpdatedAt = await hasCol('public', 'productsStock', 'updated_at', client);

  for (const stockId of ids) {
    const exists = await q(
      client,
      'productsStock.ensure.exists',
      `SELECT product_stock_id FROM public."productsStock" WHERE product_stock_id = $1 LIMIT 1;`,
      [stockId],
    );
    if (!exists.rows.length) {
      await q(
        client,
        'productsStock.ensure.insert',
        `
        INSERT INTO public."productsStock" (product_stock_id, stock_qty${psHasUpdatedAt ? ', updated_at' : ''})
        VALUES ($1, 0${psHasUpdatedAt ? ', NOW()' : ''});
        `,
        [stockId],
      );
    }
  }
}

export async function getLotSumsByStockIds(client, stockIds = []) {
  const ids = [...new Set(stockIds.map((v) => Number(v)).filter((v) => Number.isInteger(v) && v > 0))];
  const out = new Map();
  if (!ids.length) return out;

  for (const chunk of chunkArray(ids, 500)) {
    const { rows } = await q(
      client,
      'lots.sum.by.stockIds',
      `
      SELECT
        product_stock_id,
        SUM(COALESCE(qty_on_hand, 0)) AS sum_qty
      FROM ${TB_LOTS}
      WHERE product_stock_id = ANY($1::bigint[])
      GROUP BY product_stock_id;
      `,
      [chunk],
    );

    for (const row of rows) {
      out.set(Number(row.product_stock_id), Number(row.sum_qty ?? 0));
    }
  }

  return out;
}

export async function updateProductsStockQty(client, totalsMap = new Map()) {
  const entries = [...totalsMap.entries()]
    .map(([product_stock_id, stock_qty]) => ({
      product_stock_id: Number(product_stock_id),
      stock_qty: Number(stock_qty ?? 0),
    }))
    .filter((r) => Number.isInteger(r.product_stock_id) && r.product_stock_id > 0);

  if (!entries.length) return;

  await ensureProductsStockRows(client, entries.map((r) => r.product_stock_id));

  const psHasUpdatedAt = await hasCol('public', 'productsStock', 'updated_at', client);

  for (const row of entries) {
    await q(
      client,
      'productsStock.update.qty',
      `
      UPDATE public."productsStock"
         SET stock_qty = $2
             ${psHasUpdatedAt ? ', updated_at = NOW()' : ''}
       WHERE product_stock_id = $1;
      `,
      [row.product_stock_id, row.stock_qty],
    );
  }
}
