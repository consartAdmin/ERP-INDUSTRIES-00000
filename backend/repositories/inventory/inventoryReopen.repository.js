// ╔════════════════════════════════════════════════════════════════════╗
// ║ inventoryReopen.repository.js — reopenInventory (estorno)          ║
// ║ Restaura lotes/estoque via inventoryItems.system_stock_qty         ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB_INV, TB_ITEMS, TB_LOTS } from './inventory.constants.js';
import { q } from './inventory.utils.js';
import { addToMapNumber } from './inventory.sanitizers.js';
import { rowToInventory } from './inventory.mappers.js';
import {
  hasCol,
  inventoryItemsHasLot,
} from './inventorySchemaInfo.repository.js';
import { insertLog } from './inventoryAudit.repository.js';
import {
  getLotSumsByStockIds,
  updateProductsStockQty,
} from './inventoryStock.repository.js';

// ──────────────────────────────────────────────────────────────
// REOPEN / ESTORNO (sem tabela nova)
// - restaura lotes/estoque usando inventoryItems.system_stock_qty
// - reabre inventário e marca itens como PENDING
// ──────────────────────────────────────────────────────────────
export async function reopenInventory(inventory_id, { userCtx = {} } = {}) {
  const client = await pool.connect();
  try {
    await q(client, 'tx.BEGIN.reopen', 'BEGIN', []);

    const { rows: invRows } = await q(
      client,
      'reopen.inv.lock',
      `SELECT * FROM ${TB_INV} WHERE inventory_id = $1 FOR UPDATE;`,
      [inventory_id],
    );
    const inv = invRows[0];
    if (!inv) return null;

    const status = String(inv.status || '').toUpperCase();
    if (status !== 'FINALIZED') {
      throw new Error(`Inventory must be FINALIZED to reopen (current=${status}).`);
    }

    const hasLot = await inventoryItemsHasLot(client);
    const puHasFator = await hasCol('public', 'productsUnits', 'fator', client);

    const { rows: itemRows } = await q(
      client,
      'reopen.items.load',
      `
      SELECT
        it.inventory_item_id,
        it.inventory_id,
        it.product_code,
        it.product_name,
        it.product_unit_id,
        it.system_stock_qty,
        it.counted_qty,
        ${hasLot ? 'it.lot_id,' : ''}
        p.product_stock_id,
        ${puHasFator ? 'COALESCE(pu.fator, 1) AS unit_factor' : '1::numeric AS unit_factor'}
      FROM ${TB_ITEMS} it
      JOIN public."products" p
        ON p.product_code = it.product_code
      LEFT JOIN public."productsBarCode" pu
        ON pu.product_unit_id = it.product_unit_id
      WHERE it.inventory_id = $1
      ORDER BY it.inventory_item_id;
      `,
      [inventory_id],
    );

    const nonLotTotals = new Map();
    const lotAffectedStockIds = new Set();
    const allTouchedStockIds = new Set();

    for (const it of itemRows) {
      const stockId = Number(it.product_stock_id ?? 0);
      if (!Number.isInteger(stockId) || stockId <= 0) continue;

      allTouchedStockIds.add(stockId);

      const beforeBase = Number(it.system_stock_qty ?? 0);

      if (hasLot && it.lot_id != null) {
        const lotsHasUpdatedAt = await hasCol('public', 'productsStockLots', 'updated_at', client);

        await q(
          client,
          'reopen.restore.lot.single',
          `
          UPDATE ${TB_LOTS}
             SET qty_on_hand = $2
                 ${lotsHasUpdatedAt ? ', updated_at = NOW()' : ''}
           WHERE lot_id = $1;
          `,
          [it.lot_id, beforeBase],
        );

        lotAffectedStockIds.add(stockId);
      } else {
        addToMapNumber(nonLotTotals, stockId, beforeBase);
      }
    }

    const lotSums = await getLotSumsByStockIds(client, [...lotAffectedStockIds]);
    const finalTotals = new Map();

    for (const stockId of allTouchedStockIds) {
      const lotQty = Number(lotSums.get(stockId) ?? 0);
      const nonLotQty = Number(nonLotTotals.get(stockId) ?? 0);
      finalTotals.set(stockId, lotQty + nonLotQty);
    }

    await updateProductsStockQty(client, finalTotals);

    await q(
      client,
      'reopen.items.status',
      `
      UPDATE ${TB_ITEMS}
         SET status = 'PENDING',
             updated_at = NOW()
       WHERE inventory_id = $1;
      `,
      [inventory_id],
    );

    const { rows: updatedInv } = await q(
      client,
      'reopen.inv.status',
      `
      UPDATE ${TB_INV}
         SET status = 'OPEN',
             finalized_by = NULL,
             updated_at = NOW()
       WHERE inventory_id = $1
       RETURNING *;
      `,
      [inventory_id],
    );

    await insertLog(client, {
      inventory_id,
      inventory_item_id: null,
      action: 'REOPEN_RESTORE_FROM_ITEMS',
      userCtx,
    });

    await q(client, 'tx.COMMIT.reopen', 'COMMIT', []);
    return updatedInv[0] ? rowToInventory(updatedInv[0]) : null;
  } catch (err) {
    try { await q(client, 'tx.ROLLBACK.reopen', 'ROLLBACK', []); } catch (_) { }
    throw err;
  } finally {
    client.release();
  }
}
