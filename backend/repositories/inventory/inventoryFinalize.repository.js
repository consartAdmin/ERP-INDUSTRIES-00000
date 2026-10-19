// ╔════════════════════════════════════════════════════════════════════╗
// ║ inventoryFinalize.repository.js — finalizeInventory                ║
// ║ Finalização robusta por unidade/fator/lote                         ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import {
  registerProductMovement,
  MOVEMENT_TYPES,
} from '../productMovements/productMovements.index.js';
import { TB_INV, TB_ITEMS, TB_LOTS } from './inventory.constants.js';
import { invDebug, invError, q } from './inventory.utils.js';
import { rowToInventory } from './inventory.mappers.js';
import {
  hasCol,
  inventoryItemsHasLot,
} from './inventorySchemaInfo.repository.js';
import { insertLog } from './inventoryAudit.repository.js';

// ──────────────────────────────────────────────────────────────
// FINALIZE (robusta por unidade/fator/lote)
// ──────────────────────────────────────────────────────────────
export async function finalizeInventory(inventory_id, { applyAdjust = true, userCtx = {} } = {}) {
  const client = await pool.connect();

  try {
    await q(client, 'tx.BEGIN.finalize', 'BEGIN', []);

    const { rows: invRows } = await q(
      client,
      'finalize.inv.lock',
      `SELECT * FROM ${TB_INV} WHERE inventory_id = $1 FOR UPDATE;`,
      [inventory_id],
    );

    const inv = invRows[0];
    if (!inv) throw new Error('Inventory not found');

    const invStatus = String(inv.status || '').toUpperCase();

    if (['FINALIZED', 'CANCELLED'].includes(invStatus)) {
      throw new Error('Inventory already finalized/cancelled');
    }

    const hasLot = await inventoryItemsHasLot(client);
    const puHasFator = await hasCol('public', 'productsBarCode', 'fator', client);
    const lotsHasUpdatedAt = await hasCol('public', 'productsStockLots', 'updated_at', client);
    const stockHasUpdatedAt = await hasCol('public', 'productsStock', 'updated_at', client);

    const { rows: itemRows } = await q(
      client,
      'finalize.items.load',
      `
      SELECT
        it.inventory_item_id,
        it.inventory_id,
        it.product_code,
        it.product_name,
        it.product_unit_id,
        it.product_location_id,
        it.system_stock_qty,
        it.counted_qty,
        it.status,
        ${hasLot ? 'it.lot_id,' : ''}
        p.product_id,
        p.product_stock_id,
        p.description AS product_name_resolved,
        pu.unit,
        ${puHasFator ? 'COALESCE(pu.fator, 1) AS unit_factor' : '1::numeric AS unit_factor'}
      FROM ${TB_ITEMS} it
      JOIN public."products" p
        ON p.product_code = it.product_code
      LEFT JOIN public."productsBarCode" pu
        ON pu.product_unit_id = it.product_unit_id
       AND pu.product_code = it.product_code
       AND COALESCE(pu.is_active, TRUE) IS TRUE
      WHERE it.inventory_id = $1
      ORDER BY it.inventory_item_id;
      `,
      [inventory_id],
    );

    if (applyAdjust && itemRows.length) {
      const lotTotals = new Map();
      const stockTotals = new Map();

      for (const it of itemRows) {
        const stockId = Number(it.product_stock_id ?? 0);
        if (!Number.isInteger(stockId) || stockId <= 0) continue;

        const factor = Number(it.unit_factor ?? 1) || 1;

        // ✅ REGRA CORRETA:
        // counted_qty = quantidade contada na unidade escolhida
        // countedFinal = quantidade final em unidade base
        const countedFinal =
          it.counted_qty != null ? Number(it.counted_qty) * factor : null;

        invDebug('finalize.calc', 'Cálculo de quantidade final do item', {
          inventory_item_id: it.inventory_item_id,
          product_code: it.product_code,
          unit: it.unit,
          counted_qty_saved: it.counted_qty,
          unit_factor: factor,
          counted_final_qty: countedFinal,
          note: 'Multiplica contado pelo fator da unidade. Ex: CX.12 x 6 = 72.',
        });

        if (countedFinal == null || !Number.isFinite(countedFinal)) continue;

        if (hasLot && it.lot_id != null) {
          const lotId = Number(it.lot_id);
          const prevLot = Number(lotTotals.get(lotId) ?? 0);
          lotTotals.set(lotId, prevLot + countedFinal);
        }

        const prevStock = Number(stockTotals.get(stockId) ?? 0);
        stockTotals.set(stockId, prevStock + countedFinal);
      }

      if (hasLot && lotTotals.size) {
        for (const [lotId, qty] of lotTotals.entries()) {
          await q(
            client,
            'finalize.lot.grouped.update',
            `
            UPDATE ${TB_LOTS}
               SET qty_on_hand = $2
                   ${lotsHasUpdatedAt ? ', updated_at = NOW()' : ''}
             WHERE lot_id = $1;
            `,
            [lotId, qty],
          );
        }
      }

      if (stockTotals.size) {
        for (const [stockId, qty] of stockTotals.entries()) {
          await q(
            client,
            'finalize.stock.grouped.update',
            `
            UPDATE public."productsStock"
               SET stock_qty = $2
                   ${stockHasUpdatedAt ? ', updated_at = NOW()' : ''}
             WHERE product_stock_id = $1;
            `,
            [stockId, qty],
          );
        }
      }
    }

    for (const it of itemRows) {
      const factor = Number(it.unit_factor ?? 1) || 1;
      const before = Number(it.system_stock_qty ?? 0);

      const countedFinal =
        it.counted_qty != null ? Number(it.counted_qty) * factor : null;

      const after = applyAdjust
        ? (countedFinal != null && Number.isFinite(countedFinal) ? countedFinal : before)
        : before;

      const difference = Number(after || 0) - Number(before || 0);

      invDebug('finalize.movement', 'Movimento de estoque por finalização', {
        inventory_item_id: it.inventory_item_id,
        product_code: it.product_code,
        unit: it.unit,
        system_qty_before: before,
        counted_qty_saved: it.counted_qty,
        unit_factor: factor,
        system_qty_after: after,
        difference,
      });

      await insertLog(client, {
        inventory_id,
        inventory_item_id: it.inventory_item_id,
        action: 'FINALIZE_ADJUST',
        product_code: it.product_code,
        product_name: it.product_name_resolved || it.product_name,
        unit: it.unit,
        system_qty_before: before,
        counted_qty: countedFinal,
        system_qty_after: after,
        userCtx,
      });

      await registerProductMovement({
        client,
        product_code: it.product_code,
        movement_type: MOVEMENT_TYPES.INVENTARIO,
        origin_module: 'inventory',
        origin_table: 'inventoryItems',
        origin_id: it.inventory_item_id,
        quantity: difference,
        previous_stock: before,
        new_stock: after,
        unit: it.unit,
        lot_code: null,
        notes: 'Ajuste por finalização de inventário',
        user_id: userCtx?.id || null,
        metadata: {
          inventory_id,
          inventory_code: inv.code,
          inventory_type: inv.type,
          applyAdjust,
          product_id: it.product_id,
          product_stock_id: it.product_stock_id,
          product_unit_id: it.product_unit_id,
          product_location_id: it.product_location_id,
          counted_qty: it.counted_qty,
          counted_final_qty: countedFinal,
          unit_factor: factor,
          lot_id: hasLot ? it.lot_id ?? null : null,
          rule: 'counted_qty x unit_factor is applied on finalize',
        },
      });
    }

    await q(
      client,
      'finalize.items.status',
      `
      UPDATE ${TB_ITEMS} it
         SET status =
           CASE
             WHEN it.counted_qty IS NULL THEN it.status
             WHEN (
               it.counted_qty * COALESCE(
                 (
                   SELECT pu.fator
                   FROM public."productsBarCode" pu
                   WHERE COALESCE(pu.is_active, TRUE) IS TRUE
                     AND pu.product_unit_id = it.product_unit_id
                     AND pu.product_code = it.product_code
                   LIMIT 1
                 ),
                 1
               )
             ) = COALESCE(it.system_stock_qty, 0)
             THEN 'COUNTED'
             ELSE 'ADJUSTED'
           END,
           updated_at = NOW()
       WHERE it.inventory_id = $1;
      `,
      [inventory_id],
    );

    const { rows: updatedInv } = await q(
      client,
      'finalize.inv.status',
      `
      UPDATE ${TB_INV}
         SET status = 'FINALIZED',
             finalized_by = $2,
             updated_at = NOW()
       WHERE inventory_id = $1
       RETURNING *;
      `,
      [inventory_id, userCtx?.id ?? null],
    );

    await q(client, 'tx.COMMIT.finalize', 'COMMIT', []);

    return rowToInventory(updatedInv[0]);
  } catch (err) {
    try {
      await q(client, 'tx.ROLLBACK.finalize', 'ROLLBACK', []);
    } catch (_) { }

    invError('finalizeInventory', 'Erro ao finalizar inventário', err, {
      inventory_id,
      applyAdjust,
    });

    throw err;
  } finally {
    client.release();
  }
}
