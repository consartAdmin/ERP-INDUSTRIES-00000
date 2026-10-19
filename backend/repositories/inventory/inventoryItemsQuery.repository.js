// ╔════════════════════════════════════════════════════════════════════╗
// ║ inventoryItemsQuery.repository.js — listItems / getItemById        ║
// ║ Tabela: public."inventoryItems"                                    ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB_ITEMS, TB_LOTS } from './inventory.constants.js';
import { q } from './inventory.utils.js';
import { rowToItem } from './inventory.mappers.js';
import {
  joinProductsLocationsSql,
  inventoryItemsHasLot,
} from './inventorySchemaInfo.repository.js';

// ──────────────────────────────────────────────────────────────
// ITEMS
// ──────────────────────────────────────────────────────────────
export async function listItems(inventory_id) {
  const joinPL = await joinProductsLocationsSql(pool, 'it');
  const hasLot = await inventoryItemsHasLot(pool);
  const joinLot = hasLot ? `LEFT JOIN ${TB_LOTS} lot ON lot.lot_id = it.lot_id` : '';

  const sql = `
  SELECT
      it.*,
      pu.unit,
      pu.barcode,
      pu.fator,

     (
      COALESCE(it.counted_qty,0)
      *
      COALESCE(pu.fator,1)
     ) AS total_qty,
      pu.standard,
      ${hasLot ? `lot.lot_code, lot.expires_at AS lot_expires_at,` : ''}
      CONCAT_WS(' / ', pl.corredor, pl.prateleira, pl.bandeja, pl.box) AS location_name
      FROM ${TB_ITEMS} it

     LEFT JOIN public."productsBarCode" pu
      ON pu.product_unit_id = it.product_unit_id
      AND pu.product_code = it.product_code
      AND COALESCE(pu.is_active, TRUE) IS TRUE

      ${joinPL}
    ${joinLot}
   WHERE it.inventory_id = $1
   ORDER BY it.inventory_item_id;
  `;

  const { rows } = await q(pool, 'items.listItems', sql, [inventory_id]);
  return rows.map(rowToItem);
}

export async function getItemById(inventory_item_id) {
  const joinPL = await joinProductsLocationsSql(pool, 'it');
  const hasLot = await inventoryItemsHasLot(pool);
  const joinLot = hasLot ? `LEFT JOIN ${TB_LOTS} lot ON lot.lot_id = it.lot_id` : '';

  const sql = `
    SELECT
    it.*,
    pu.unit,
    
    (
    COALESCE(it.counted_qty,0)
    *
    COALESCE(pu.fator,1)
  ) AS total_qty,
      ${hasLot ? `lot.lot_code, lot.expires_at AS lot_expires_at,` : ''}
      CONCAT_WS(' / ', pl.corredor, pl.prateleira, pl.bandeja, pl.box) AS location_name
    FROM ${TB_ITEMS} it
    LEFT JOIN public."productsUnits" pu
           ON pu.product_unit_id = it.product_unit_id
    ${joinPL}
    ${joinLot}
   WHERE it.inventory_item_id = $1;
  `;

  const { rows } = await q(pool, 'items.getItemById', sql, [inventory_item_id]);
  return rows[0] ? rowToItem(rows[0]) : null;
}
