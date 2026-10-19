// ╔════════════════════════════════════════════════════════════════════╗
// ║ OrdersLogisticsPackingOrders.repository.js — handlers por pedido   ║
// ║  GET  /orders/:orderId/summary                                     ║
// ║  GET  /orders/:orderId/not-packed                                  ║
// ║  GET  /orders/:orderId/volumes                                     ║
// ║  POST /orders/:orderId/volumes                                     ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import {
  TB_ORDERS,
  TB_ITEMS,
  TB_VOL,
  TB_VI,
  VIEW_NOT_PACKED,
} from './OrdersLogisticsPacking.constants.js';
import { toNum, toInt, ok, bad } from './OrdersLogisticsPacking.utils.js';
import { ensureNotPackedView } from './OrdersLogisticsPacking.schema.js';
import {
  withClient,
  ensureOrderExists,
  getNextVolumeNumber,
} from './OrdersLogisticsPackingLookup.repository.js';

/* ──────────────────────────────────────────────────────────────
   GET /orders/:orderId/summary
   - Pedido + volumes + itens nos volumes + itens não alocados
────────────────────────────────────────────────────────────── */
export async function getOrderSummary(req, res) {
  const orderId = toInt(req.params.orderId);
  if (!orderId) return bad(res, 'orderId inválido.');

  try {
    const data = await withClient(async (client) => {

      // ==========================================================
      // Garante que a VIEW esteja utilizando productsBarCode
      // ==========================================================
      await ensureNotPackedView(client);

      // ==========================================================
      // Pedido
      // ==========================================================
      const order = await client.query(
        `SELECT *
           FROM ${TB_ORDERS}
          WHERE order_id = $1`,
        [orderId]
      );

      // ==========================================================
      // Volumes
      // ==========================================================
      const volumes = await client.query(
        `SELECT *
           FROM ${TB_VOL}
          WHERE order_id = $1
          ORDER BY volume_number ASC`,
        [orderId]
      );

      // ==========================================================
      // Itens dos volumes
      // ==========================================================
      const volumeItems = await client.query(
        `
        SELECT
            ovi.*,
            ov.order_id,
            ov.volume_number,
            oi.sku,
            oi.description,
            oi.unit
        FROM ${TB_VI} ovi
        JOIN ${TB_VOL} ov
             ON ov.id = ovi.volume_id
        JOIN ${TB_ITEMS} oi
             ON oi.order_item_id = ovi.order_item_id
        WHERE ov.order_id = $1
        ORDER BY
            ov.volume_number ASC,
            ovi.id ASC
        `,
        [orderId]
      );

      // ==========================================================
      // Itens ainda não embalados
      // (agora a VIEW já está apontando para productsBarCode)
      // ==========================================================
      const notPacked = await client.query(
        `
        SELECT *
        FROM ${VIEW_NOT_PACKED}
        WHERE order_id = $1
        ORDER BY description ASC
        `,
        [orderId]
      );

      return {
        order: order.rows[0] || null,
        volumes: volumes.rows,
        volumeItems: volumeItems.rows,
        notPacked: notPacked.rows,
      };
    });

    return ok(res, data);

  } catch (err) {
    console.error('packing summary error:', err);
    return bad(res, 'Falha ao carregar summary do packing.', 500);
  }
}

/* ──────────────────────────────────────────────────────────────
   GET /orders/:orderId/not-packed
────────────────────────────────────────────────────────────── */
export async function listNotPacked(req, res) {
  const orderId = toInt(req.params.orderId);
  if (!orderId) return bad(res, 'orderId inválido.');

  try {
    const r = await pool.query(
      `SELECT * FROM ${VIEW_NOT_PACKED}
        WHERE order_id = $1
        ORDER BY description ASC`,
      [orderId]
    );
    return ok(res, { rows: r.rows });
  } catch (err) {
    console.error('not-packed error:', err);
    return bad(res, 'Falha ao listar itens não alocados.', 500);
  }
}

/* ──────────────────────────────────────────────────────────────
   GET /orders/:orderId/volumes
────────────────────────────────────────────────────────────── */
export async function listOrderVolumes(req, res) {
  const orderId = toInt(req.params.orderId);
  if (!orderId) return bad(res, 'orderId inválido.');

  try {
    const r = await pool.query(
      `SELECT *
         FROM ${TB_VOL}
        WHERE order_id = $1
        ORDER BY volume_number ASC`,
      [orderId]
    );
    return ok(res, { rows: r.rows });
  } catch (err) {
    console.error('list volumes error:', err);
    return bad(res, 'Falha ao listar volumes.', 500);
  }
}

/* ──────────────────────────────────────────────────────────────
   POST /orders/:orderId/volumes
   Body (opcional):
     { volume_type, description, height_cm, width_cm, length_cm, tare_kg, notes }
   - volume_number é calculado automaticamente
────────────────────────────────────────────────────────────── */
export async function createOrderVolume(req, res) {
  const orderId = toInt(req.params.orderId);
  if (!orderId) return bad(res, 'orderId inválido.');

  const body = req.body || {};
  const volume_type = String(body.volume_type || 'BOX').trim() || 'BOX';
  const description = body.description ?? null;
  const notes = body.notes ?? null;

  const height_cm = toNum(body.height_cm, 0);
  const width_cm = toNum(body.width_cm, 0);
  const length_cm = toNum(body.length_cm, 0);
  const tare_kg = toNum(body.tare_kg, 0);

  if (height_cm < 0 || width_cm < 0 || length_cm < 0 || tare_kg < 0) {
    return bad(res, 'Dimensões/tara não podem ser negativas.');
  }

  try {
    const out = await withClient(async (client) => {
      const exists = await ensureOrderExists(client, orderId);
      if (!exists) return { __err: { code: 404, msg: `Pedido ${orderId} não encontrado.` } };

      const volume_number = await getNextVolumeNumber(client, orderId);

      const ins = await client.query(
        `INSERT INTO ${TB_VOL}
          (order_id, volume_number, volume_type, description, height_cm, width_cm, length_cm, tare_kg, notes)
         VALUES
          ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [orderId, volume_number, volume_type, description, height_cm, width_cm, length_cm, tare_kg, notes]
      );

      return { row: ins.rows[0] };
    });

    if (out.__err) return bad(res, out.__err.msg, out.__err.code);
    return ok(res, out);
  } catch (err) {
    console.error('create volume error:', err);
    return bad(res, 'Falha ao criar volume.', 500);
  }
}
