// ╔════════════════════════════════════════════════════════════════════╗
// ║ OrdersLogisticsPackingLookup.repository.js — helpers de banco      ║
// ║ withClient / ensure*Exists / getNextVolumeNumber                   ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB_ORDERS, TB_VOL, TB_VI } from './OrdersLogisticsPacking.constants.js';

export async function withClient(fn) {
  const client = await pool.connect();
  try {
    return await fn(client);
  } catch (err) {
    // Se fn abriu BEGIN e lançou erro, não devolve ao pool uma conexão no meio da transação.
    // Sem transação aberta o ROLLBACK só gera um WARNING no Postgres.
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export async function ensureOrderExists(client, orderId) {
  const r = await client.query(
    `SELECT order_id FROM ${TB_ORDERS} WHERE order_id = $1`,
    [orderId]
  );
  return r.rowCount ? r.rows[0] : null;
}

export async function ensureVolumeExists(client, volumeId) {
  const r = await client.query(
    `SELECT id, order_id, volume_number FROM ${TB_VOL} WHERE id = $1`,
    [volumeId]
  );
  return r.rowCount ? r.rows[0] : null;
}

export async function ensureVolumeItemExists(client, volumeItemId) {
  const r = await client.query(
    `SELECT
    id,
    volume_id,
    order_item_id,
    product_unit_id,
    unit,
    fator,
    quantity
   FROM ${TB_VI} WHERE id = $1`,
    [volumeItemId]
  );
  return r.rowCount ? r.rows[0] : null;
}

export async function getNextVolumeNumber(client, orderId) {
  const r = await client.query(
    `SELECT COALESCE(MAX(volume_number), 0) + 1 AS next
       FROM ${TB_VOL}
      WHERE order_id = $1`,
    [orderId]
  );
  return Number(r.rows[0]?.next || 1);
}
