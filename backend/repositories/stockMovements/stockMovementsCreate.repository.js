// ╔══════════════════════════════════════════════════════════════╗
// ║ stockMovementsCreate.repository.js — createStockMovement   ║
// ║ Tabela: public."stockMovements" (usa client da transação)  ║
// ╚══════════════════════════════════════════════════════════════╝

import { TB } from './stockMovements.constants.js';

export async function createStockMovement(client, payload) {
  const sql = `
    INSERT INTO ${TB} (
      product_id,
      product_code,
      source,
      source_table,
      source_id,
      source_item_id,
      qty,
      qty_before,
      qty_after,
      unit,
      unit_factor
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
    RETURNING *
  `;

  const params = [
    payload.product_id,
    payload.product_code,
    payload.source,
    payload.source_table,
    payload.source_id,
    payload.source_item_id,
    payload.qty,
    payload.qty_before,
    payload.qty_after,
    payload.unit,
    payload.unit_factor,
  ];

  const { rows } = await client.query(sql, params);
  return rows[0];
}
