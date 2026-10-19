// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ OrdersLogisticsPackingController.js — Controller Packing/Volumes        ║
// ║ Path: backend/controllers/OrdersLogisticsPackingController.js           ║
// ║ CONSART ERP | ESM | Express | PostgreSQL                                ║
// ║                                                                          ║
// ║ Tabelas/View:                                                            ║
// ║  - public.orders (PK: order_id)                                          ║
// ║  - public.orderItems (PK: order_item_id)                                ║
// ║  - public.products (UK: product_code)                                    ║
// ║  - public."productsBarCode" (PK: product_dimension_id)                ║
// ║  - public."orderVolumes"                                                 ║
// ║  - public."orderVolumeItems"                                             ║
// ║  - public.orderItems                                 ║
// ║                                                                          ║
// ║ Rotas esperadas (exemplo):                                               ║
// ║  GET    /api/packing/orders/:orderId/summary                             ║
// ║  GET    /api/packing/orders/:orderId/not-packed                          ║
// ║  GET    /api/packing/orders/:orderId/volumes                             ║
// ║  POST   /api/packing/orders/:orderId/volumes                             ║
// ║  PATCH  /api/packing/volumes/:volumeId                                   ║
// ║  DELETE /api/packing/volumes/:volumeId                                   ║
// ║  GET    /api/packing/volumes/:volumeId/items                             ║
// ║  POST   /api/packing/volumes/:volumeId/items                             ║
// ║  PATCH  /api/packing/volume-items/:volumeItemId                          ║
// ║  DELETE /api/packing/volume-items/:volumeItemId                          ║
// ║  PATCH  /api/packing/volume-items/:volumeItemId/move                     ║
// ║  GET    /api/packing/orders/search?q=...&limit=...                        ║
// ║  GET    /api/packing/orders/:orderId/pdf                                 ║
// ╚══════════════════════════════════════════════════════════════════════════╝

'use strict';

import pool from '../config/db.js';
import { generateOrdersLogisticsPackingPdf } from '../generationPdf/generateOrdersLogisticsPackingPdf.js';

/* ──────────────────────────────────────────────────────────────
   Constantes
────────────────────────────────────────────────────────────── */
const TB_ORDERS = 'public.orders';
const TB_ITEMS = 'public."orderItems"';
const TB_PROD = 'public.products';
const TB_PBC = 'public."productsBarCode"'; // ✅ conforme sua tabela
const TB_VOL = 'public."orderVolumes"';
const TB_VI = 'public."orderVolumeItems"';
const VIEW_NOT_PACKED = 'public.v_order_items_not_fully_packed';

/* ──────────────────────────────────────────────────────────────
   Helpers
────────────────────────────────────────────────────────────── */
const isFiniteNum = (v) => Number.isFinite(Number(v));
const toNum = (v, def = 0) => (isFiniteNum(v) ? Number(v) : def);
const toInt = (v) => {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
};

function ok(res, data = {}) {
  return res.json({ ok: true, ...data });
}
function bad(res, msg, code = 400, extra = {}) {
  return res.status(code).json({ ok: false, error: msg, ...extra });
}

async function withClient(fn) {
  const client = await pool.connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

async function ensureOrderExists(client, orderId) {
  const r = await client.query(`SELECT order_id FROM ${TB_ORDERS} WHERE order_id = $1`, [orderId]);
  return r.rowCount ? r.rows[0] : null;
}

async function ensureVolumeExists(client, volumeId) {
  const r = await client.query(`SELECT id, order_id, volume_number FROM ${TB_VOL} WHERE id = $1`, [volumeId]);
  return r.rowCount ? r.rows[0] : null;
}

async function ensureVolumeItemExists(client, volumeItemId) {
  const r = await client.query(
    `SELECT id, volume_id, order_item_id, quantity FROM ${TB_VI} WHERE id = $1`,
    [volumeItemId]
  );
  return r.rowCount ? r.rows[0] : null;
}

async function getNextVolumeNumber(client, orderId) {
  const r = await client.query(
    `SELECT COALESCE(MAX(volume_number), 0) + 1 AS next
       FROM ${TB_VOL}
      WHERE order_id = $1`,
    [orderId]
  );
  return Number(r.rows[0]?.next || 1);
}

/* ──────────────────────────────────────────────────────────────
   Schema helpers (robusto: colunas opcionais)
────────────────────────────────────────────────────────────── */
async function tableHasColumn(client, tableSchema, tableName, columnName) {
  const r = await client.query(
    `
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema = $1
       AND table_name   = $2
       AND column_name  = $3
     LIMIT 1
    `,
    [tableSchema, tableName, columnName]
  );
  return !!r.rowCount;
}

/* ──────────────────────────────────────────────────────────────
   Recalc helpers (Cubagem e Peso calculado)
   - volume_m3: sempre atualiza (se as dimensões existirem)
   - weight_kg: só atualiza se a coluna existir em orderVolumes
────────────────────────────────────────────────────────────── */
async function recalcVolume(client, volumeId) {
  const hasWeightKg = await tableHasColumn(client, 'public', 'orderVolumes', 'weight_kg');

  // cubagem = (h*w*l)/1e6 (cm³ -> m³)
  // peso = tara + SUM(qty * unit_weight_kg)  (se coluna existir)
  const q = `
    UPDATE ${TB_VOL} ov
       SET
         volume_m3 =
           (COALESCE(ov.height_cm,0) * COALESCE(ov.width_cm,0) * COALESCE(ov.length_cm,0)) / 1000000.0
         ${hasWeightKg ? `,
         weight_kg =
           COALESCE(ov.tare_kg, 0)
           + COALESCE((
              SELECT SUM(COALESCE(ovi.quantity,0) * COALESCE(ovi.unit_weight_kg,0))
                FROM ${TB_VI} ovi
               WHERE ovi.volume_id = ov.id
           ), 0)` : ``},
         updated_at = now()
     WHERE ov.id = $1
     RETURNING *;
  `;
  const r = await client.query(q, [volumeId]);
  return r.rows[0] || null;
}

async function recalcAllVolumesOfOrder(client, orderId) {
  const r = await client.query(`SELECT id FROM ${TB_VOL} WHERE order_id = $1`, [orderId]);
  for (const row of r.rows) {
    await recalcVolume(client, row.id);
  }
}

async function computeVolumeWeight(client, volumeId) {
  const r = await client.query(
    `
    SELECT
      COALESCE(ov.tare_kg,0)
      + COALESCE((
          SELECT SUM(COALESCE(ovi.quantity,0) * COALESCE(ovi.unit_weight_kg,0))
            FROM ${TB_VI} ovi
           WHERE ovi.volume_id = ov.id
        ), 0) AS weight_kg_calc
    FROM ${TB_VOL} ov
    WHERE ov.id = $1
    `,
    [volumeId]
  );
  return toNum(r.rows[0]?.weight_kg_calc, 0);
}

/* ──────────────────────────────────────────────────────────────
   Fetch product dims by SKU (orderItems.sku -> products.product_code)
────────────────────────────────────────────────────────────── */
async function getProductDimsBySku(client, sku) {
  const r = await client.query(
    `
    SELECT
      COALESCE(d.weight, 0) AS unit_weight_kg,
      COALESCE(d.height, 0) AS unit_height_cm,
      COALESCE(d.width, 0)  AS unit_width_cm,
      COALESCE(d.length, 0) AS unit_length_cm
    FROM ${TB_PROD} p
    LEFT JOIN ${TB_DIM} d
      ON pb.barcode_id = p.product_dimension_id
    WHERE p.product_code = $1
    LIMIT 1
    `,
    [sku]
  );
  return {
    unit_weight_kg: toNum(r.rows[0]?.unit_weight_kg, 0),
    unit_height_cm: toNum(r.rows[0]?.unit_height_cm, 0),
    unit_width_cm: toNum(r.rows[0]?.unit_width_cm, 0),
    unit_length_cm: toNum(r.rows[0]?.unit_length_cm, 0),
  };
}

/* ──────────────────────────────────────────────────────────────
   Controllers
────────────────────────────────────────────────────────────── */
export async function getOrderSummary(req, res) {
  const orderId = toInt(req.params.orderId);
  if (!orderId) return bad(res, 'orderId inválido.');

  try {
    const data = await withClient(async (client) => {
      await recalcAllVolumesOfOrder(client, orderId);

      const orderR = await client.query(`SELECT * FROM ${TB_ORDERS} WHERE order_id = $1`, [orderId]);
      const order = orderR.rows[0] || null;

      const volumesR = await client.query(
        `SELECT *
           FROM ${TB_VOL}
          WHERE order_id = $1
          ORDER BY volume_number ASC`,
        [orderId]
      );

      // inclui peso calculado caso não exista weight_kg no banco
      const hasWeightKg = await tableHasColumn(client, 'public', 'orderVolumes', 'weight_kg');

      const volumes = [];
      for (const v of volumesR.rows) {
        if (hasWeightKg) {
          volumes.push(v);
        } else {
          const w = await computeVolumeWeight(client, v.id);
          volumes.push({ ...v, weight_kg_calc: w });
        }
      }

      const volumeItemsR = await client.query(
        `SELECT
           ovi.*,
           ov.order_id,
           ov.volume_number,
           oi.sku,
           oi.description,
           oi.unit
         FROM ${TB_VI} ovi
         JOIN ${TB_VOL} ov ON ov.id = ovi.volume_id
         JOIN ${TB_ITEMS} oi ON oi.order_item_id = ovi.order_item_id
        WHERE ov.order_id = $1
        ORDER BY ov.volume_number ASC, ovi.id ASC`,
        [orderId]
      );

      const notPackedR = await client.query(
        `
  SELECT
    oi.order_id,
    oi.order_item_id,
    oi.sku,
    oi.description,
    oi.unit,

    COALESCE(oi.quantity, 0) AS ordered_qty,
    COALESCE(SUM(ovi.quantity), 0) AS packed_qty,
    GREATEST(COALESCE(oi.quantity,0) - COALESCE(SUM(ovi.quantity),0), 0) AS remaining_qty,

    COALESCE(d.weight, 0)  AS unit_weight_kg,
    COALESCE(d.height, 0)  AS unit_height_cm,
    COALESCE(d.width, 0)   AS unit_width_cm,
    COALESCE(d.length, 0)  AS unit_length_cm

  FROM ${TB_ITEMS} oi
  LEFT JOIN ${TB_VI} ovi
    ON ovi.order_item_id = oi.order_item_id
  LEFT JOIN ${TB_VOL} ov
    ON ov.id = ovi.volume_id
   AND ov.order_id = oi.order_id

  LEFT JOIN ${TB_PROD} p
    ON p.product_code = oi.sku
  LEFT JOIN ${TB_DIM} d
    ON d.product_dimension_id = p.product_dimension_id

  WHERE oi.order_id = $1
  GROUP BY
    oi.order_id, oi.order_item_id, oi.sku, oi.description, oi.unit, oi.quantity,
    d.weight, d.height, d.width, d.length

  HAVING GREATEST(COALESCE(oi.quantity,0) - COALESCE(SUM(ovi.quantity),0), 0) > 0
  ORDER BY oi.description ASC
  `,
        [orderId]
      );

      return {
        order,
        volumes,
        volumeItems: volumeItemsR.rows,
        notPacked: notPackedR.rows,
      };
    });

    return ok(res, data);
  } catch (err) {
    console.error('getOrderSummary error:', err);
    return bad(res, 'Falha ao carregar summary do packing.', 500);
  }
}

export async function getNotPacked(req, res) {
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
    console.error('getNotPacked error:', err);
    return bad(res, 'Falha ao listar itens não alocados.', 500);
  }
}

export async function listVolumes(req, res) {
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
    console.error('listVolumes error:', err);
    return bad(res, 'Falha ao listar volumes.', 500);
  }
}

export async function createVolume(req, res) {
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
      await client.query('BEGIN');

      const exists = await ensureOrderExists(client, orderId);
      if (!exists) {
        await client.query('ROLLBACK');
        return { __err: { code: 404, msg: `Pedido ${orderId} não encontrado.` } };
      }

      const volume_number = await getNextVolumeNumber(client, orderId);

      const ins = await client.query(
        `INSERT INTO ${TB_VOL}
          (order_id, volume_number, volume_type, description, height_cm, width_cm, length_cm, tare_kg, notes)
         VALUES
          ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [orderId, volume_number, volume_type, description, height_cm, width_cm, length_cm, tare_kg, notes]
      );

      await recalcVolume(client, ins.rows[0].id);

      await client.query('COMMIT');
      return { row: ins.rows[0] };
    });

    if (out.__err) return bad(res, out.__err.msg, out.__err.code);
    return ok(res, out);
  } catch (err) {
    console.error('createVolume error:', err);
    return bad(res, 'Falha ao criar volume.', 500);
  }
}

export async function updateVolume(req, res) {
  const volumeId = toInt(req.params.volumeId);
  if (!volumeId) return bad(res, 'volumeId inválido.');

  const b = req.body || {};
  const fields = [];
  const vals = [];
  let i = 1;

  const setIf = (col, val) => {
    fields.push(`${col} = $${i++}`);
    vals.push(val);
  };

  if (b.volume_type !== undefined) setIf('volume_type', String(b.volume_type || 'BOX'));
  if (b.description !== undefined) setIf('description', b.description ?? null);
  if (b.notes !== undefined) setIf('notes', b.notes ?? null);
  if (b.status !== undefined) setIf('status', String(b.status || 'OPEN'));

  if (b.height_cm !== undefined) { const v = toNum(b.height_cm, 0); if (v < 0) return bad(res, 'height_cm inválido.'); setIf('height_cm', v); }
  if (b.width_cm !== undefined) { const v = toNum(b.width_cm, 0); if (v < 0) return bad(res, 'width_cm inválido.'); setIf('width_cm', v); }
  if (b.length_cm !== undefined) { const v = toNum(b.length_cm, 0); if (v < 0) return bad(res, 'length_cm inválido.'); setIf('length_cm', v); }
  if (b.tare_kg !== undefined) { const v = toNum(b.tare_kg, 0); if (v < 0) return bad(res, 'tare_kg inválido.'); setIf('tare_kg', v); }

  if (!fields.length) return bad(res, 'Nada para atualizar.');

  try {
    const out = await withClient(async (client) => {
      await client.query('BEGIN');

      const vol = await ensureVolumeExists(client, volumeId);
      if (!vol) {
        await client.query('ROLLBACK');
        return { __err: { code: 404, msg: 'Volume não encontrado.' } };
      }

      vals.push(volumeId);

      const q = `
        UPDATE ${TB_VOL}
           SET ${fields.join(', ')},
               updated_at = now()
         WHERE id = $${i}
         RETURNING *`;
      const r = await client.query(q, vals);

      await recalcVolume(client, volumeId);

      await client.query('COMMIT');
      return { row: r.rows[0] };
    });

    if (out.__err) return bad(res, out.__err.msg, out.__err.code);
    return ok(res, out);
  } catch (err) {
    console.error('updateVolume error:', err);
    return bad(res, 'Falha ao atualizar volume.', 500);
  }
}

export async function deleteVolume(req, res) {
  const volumeId = toInt(req.params.volumeId);
  if (!volumeId) return bad(res, 'volumeId inválido.');

  try {
    const out = await withClient(async (client) => {
      await client.query('BEGIN');

      const vol = await ensureVolumeExists(client, volumeId);
      if (!vol) {
        await client.query('ROLLBACK');
        return { __err: { code: 404, msg: 'Volume não encontrado.' } };
      }

      await client.query(`DELETE FROM ${TB_VOL} WHERE id = $1`, [volumeId]);

      await client.query('COMMIT');
      return { deleted: true, volumeId };
    });

    if (out.__err) return bad(res, out.__err.msg, out.__err.code);
    return ok(res, out);
  } catch (err) {
    console.error('deleteVolume error:', err);
    return bad(res, 'Falha ao excluir volume.', 500);
  }
}

export async function listVolumeItems(req, res) {
  const volumeId = toInt(req.params.volumeId);
  if (!volumeId) return bad(res, 'volumeId inválido.');

  try {
    const r = await pool.query(
      `SELECT
         ovi.*,
         oi.order_id,
         oi.sku,
         oi.description,
         oi.unit,
         ov.volume_number
       FROM ${TB_VI} ovi
       JOIN ${TB_ITEMS} oi ON oi.order_item_id = ovi.order_item_id
       JOIN ${TB_VOL} ov ON ov.id = ovi.volume_id
      WHERE ovi.volume_id = $1
      ORDER BY ovi.id ASC`,
      [volumeId]
    );
    return ok(res, { rows: r.rows });
  } catch (err) {
    console.error('listVolumeItems error:', err);
    return bad(res, 'Falha ao listar itens do volume.', 500);
  }
}

export async function addItemToVolume(req, res) {
  const volumeId = toInt(req.params.volumeId);
  if (!volumeId) return bad(res, 'volumeId inválido.');

  const b = req.body || {};
  const order_item_id = toInt(b.order_item_id);
  const quantity = toNum(b.quantity, 0);

  const product_unit_id = toInt(b.product_unit_id);
  const unit = String(b.unit || '').trim() || null;
  const fator = toNum(b.fator, 1);

  const weight_source = String(b.weight_source || 'PRODUCT').trim().toUpperCase();
  const dimensions_source = String(b.dimensions_source || 'PRODUCT').trim().toUpperCase();

  if (!order_item_id) return bad(res, 'order_item_id inválido.');
  if (!(quantity > 0)) return bad(res, 'quantity deve ser > 0.');

  // Se o front mandar, usamos. Se não mandar, buscamos.
  let unit_weight_kg = toNum(b.unit_weight_kg, NaN);
  let unit_height_cm = toNum(b.unit_height_cm, NaN);
  let unit_width_cm = toNum(b.unit_width_cm, NaN);
  let unit_length_cm = toNum(b.unit_length_cm, NaN);

  try {
    const out = await withClient(async (client) => {
      await client.query('BEGIN');

      const vol = await ensureVolumeExists(client, volumeId);
      if (!vol) {
        await client.query('ROLLBACK');
        return { __err: { code: 404, msg: 'Volume não encontrado.' } };
      }

      const item = await client.query(
        `SELECT order_item_id, order_id, sku
           FROM ${TB_ITEMS}
          WHERE order_item_id = $1`,
        [order_item_id]
      );
      if (!item.rowCount) {
        await client.query('ROLLBACK');
        return { __err: { code: 404, msg: 'Item do pedido não encontrado.' } };
      }

      if (Number(item.rows[0].order_id) !== Number(vol.order_id)) {
        await client.query('ROLLBACK');
        return { __err: { code: 409, msg: 'Item pertence a outro pedido (inconsistência).' } };
      }

      // fallback: busca dims no cadastro se veio NaN
      if (
        !Number.isFinite(unit_weight_kg) ||
        !Number.isFinite(unit_height_cm) ||
        !Number.isFinite(unit_width_cm) ||
        !Number.isFinite(unit_length_cm)
      ) {
        const dims = await getProductDimsBySku(client, item.rows[0].sku);
        unit_weight_kg = dims.unit_weight_kg;
        unit_height_cm = dims.unit_height_cm;
        unit_width_cm = dims.unit_width_cm;
        unit_length_cm = dims.unit_length_cm;
      }

      if (unit_weight_kg < 0 || unit_height_cm < 0 || unit_width_cm < 0 || unit_length_cm < 0) {
        await client.query('ROLLBACK');
        return { __err: { code: 400, msg: 'peso/dimensões não podem ser negativos.' } };
      }

      const existing = await client.query(
        `SELECT id, quantity
           FROM ${TB_VI}
          WHERE volume_id = $1
  AND order_item_id = $2
  AND COALESCE(product_unit_id,0) = COALESCE($3,0)`,
        [volumeId, order_item_id, product_unit_id]
      );

      let row;
      if (existing.rowCount) {
        const newQty = toNum(existing.rows[0].quantity, 0) + quantity;
        const up = await client.query(
          `UPDATE ${TB_VI}
              SET quantity = $1,
                  unit_weight_kg = $2,
                  unit_height_cm = $3,
                  unit_width_cm  = $4,
                  unit_length_cm = $5,
                  updated_at = now()
            WHERE id = $6
            RETURNING *`,
          [newQty, unit_weight_kg, unit_height_cm, unit_width_cm, unit_length_cm, existing.rows[0].id]
        );
        row = up.rows[0];
      } else {
        const ins = await client.query(
          `INSERT INTO ${TB_VI}
    (
      volume_id,
      order_item_id,
      quantity,
      product_unit_id,
      unit,
      fator,
      weight_source,
      dimensions_source,
      unit_weight_kg,
      unit_height_cm,
      unit_width_cm,
      unit_length_cm
    )
   VALUES
    ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
   RETURNING *`,
          [
            volumeId,
            order_item_id,
            quantity,
            product_unit_id,
            unit,
            fator,
            weight_source,
            dimensions_source,
            unit_weight_kg,
            unit_height_cm,
            unit_width_cm,
            unit_length_cm
          ]
        );
        row = ins.rows[0];
      }

      await recalcVolume(client, volumeId);

      await client.query('COMMIT');
      return { row };
    });

    if (out.__err) return bad(res, out.__err.msg, out.__err.code);
    return ok(res, out);
  } catch (err) {
    console.error('addItemToVolume error:', err);
    return bad(res, 'Falha ao adicionar item ao volume.', 500);
  }
}

export async function updateVolumeItem(req, res) {
  const volumeItemId = toInt(req.params.volumeItemId);
  if (!volumeItemId) return bad(res, 'volumeItemId inválido.');

  const qty = toNum(req.body?.quantity, 0);
  if (!(qty > 0)) return bad(res, 'quantity deve ser > 0.');

  try {
    const out = await withClient(async (client) => {
      await client.query('BEGIN');

      const vi = await ensureVolumeItemExists(client, volumeItemId);
      if (!vi) {
        await client.query('ROLLBACK');
        return { __err: { code: 404, msg: 'Item do volume não encontrado.' } };
      }

      const up = await client.query(
        `UPDATE ${TB_VI}
      SET quantity = $1,
          product_unit_id = $2,
          unit = $3,
          fator = $4,
          weight_source = $5,
          dimensions_source = $6,
          unit_weight_kg = $7,
          unit_height_cm = $8,
          unit_width_cm = $9,
          unit_length_cm = $10,
          updated_at = now()
    WHERE id = $11
    RETURNING *`,
        [
          newQty,
          product_unit_id,
          unit,
          fator,
          weight_source,
          dimensions_source,
          unit_weight_kg,
          unit_height_cm,
          unit_width_cm,
          unit_length_cm,
          existing.rows[0].id
        ]
      );
      await recalcVolume(client, vi.volume_id);

      await client.query('COMMIT');
      return { row: up.rows[0] };
    });

    if (out.__err) return bad(res, out.__err.msg, out.__err.code);
    return ok(res, out);
  } catch (err) {
    console.error('updateVolumeItem error:', err);
    return bad(res, 'Falha ao atualizar item do volume.', 500);
  }
}

export async function deleteVolumeItem(req, res) {
  const volumeItemId = toInt(req.params.volumeItemId);
  if (!volumeItemId) return bad(res, 'volumeItemId inválido.');

  try {
    const out = await withClient(async (client) => {
      await client.query('BEGIN');

      const vi = await ensureVolumeItemExists(client, volumeItemId);
      if (!vi) {
        await client.query('ROLLBACK');
        return { __err: { code: 404, msg: 'Item do volume não encontrado.' } };
      }

      await client.query(`DELETE FROM ${TB_VI} WHERE id = $1`, [volumeItemId]);
      await recalcVolume(client, vi.volume_id);

      await client.query('COMMIT');
      return { deleted: true, volumeItemId };
    });

    if (out.__err) return bad(res, out.__err.msg, out.__err.code);
    return ok(res, out);
  } catch (err) {
    console.error('deleteVolumeItem error:', err);
    return bad(res, 'Falha ao excluir item do volume.', 500);
  }
}

export async function moveVolumeItem(req, res) {
  const volumeItemId = toInt(req.params.volumeItemId);
  const toVolumeId = toInt(req.body?.to_volume_id);

  if (!volumeItemId) return bad(res, 'volumeItemId inválido.');
  if (!toVolumeId) return bad(res, 'to_volume_id inválido.');

  try {
    const out = await withClient(async (client) => {
      await client.query('BEGIN');

      const vi = await ensureVolumeItemExists(client, volumeItemId);
      if (!vi) {
        await client.query('ROLLBACK');
        return { __err: { code: 404, msg: 'Item do volume não encontrado.' } };
      }

      const fromVol = await ensureVolumeExists(client, vi.volume_id);
      const toVol = await ensureVolumeExists(client, toVolumeId);

      if (!fromVol || !toVol) {
        await client.query('ROLLBACK');
        return { __err: { code: 404, msg: 'Volume origem/destino não encontrado.' } };
      }

      if (Number(fromVol.order_id) !== Number(toVol.order_id)) {
        await client.query('ROLLBACK');
        return { __err: { code: 409, msg: 'Volumes pertencem a pedidos diferentes.' } };
      }

      const existingDest = await client.query(
        `SELECT id, quantity
           FROM ${TB_VI}
          WHERE volume_id = $1 AND order_item_id = $2`,
        [toVolumeId, vi.order_item_id]
      );

      let result;

      if (existingDest.rowCount) {
        const newQty = toNum(existingDest.rows[0].quantity, 0) + toNum(vi.quantity, 0);

        await client.query(
          `UPDATE ${TB_VI}
              SET quantity = $1,
                  updated_at = now()
            WHERE id = $2`,
          [newQty, existingDest.rows[0].id]

        );

        await client.query(`DELETE FROM ${TB_VI} WHERE id = $1`, [volumeItemId]);

        result = { merged_into_id: existingDest.rows[0].id, removed_id: volumeItemId, to_volume_id: toVolumeId };
      } else {
        const up = await client.query(
          `UPDATE ${TB_VI}
              SET volume_id = $1,
                  updated_at = now()
            WHERE id = $2
            RETURNING *`,
          [toVolumeId, volumeItemId]
        );
        result = { row: up.rows[0] };
      }

      await recalcVolume(client, fromVol.id);
      await recalcVolume(client, toVol.id);

      await client.query('COMMIT');
      return result;
    });

    if (out.__err) return bad(res, out.__err.msg, out.__err.code);
    return ok(res, out);
  } catch (err) {
    console.error('moveVolumeItem error:', err);
    return bad(res, 'Falha ao mover item entre volumes.', 500);
  }
}

/* ──────────────────────────────────────────────────────────────
   Search Orders (Modal)
   GET /api/packing/orders/search?q=...&limit=...
────────────────────────────────────────────────────────────── */
export async function searchOrders(req, res) {
  const q = String(req.query.q || '').trim();
  const limit = Math.max(1, Math.min(Number.parseInt(req.query.limit || '25', 10) || 25, 100));

  if (!q) return ok(res, { rows: [], cols: ['order_id'] });

  const qid = (name) => `"${String(name).replaceAll('"', '""')}"`;

  try {
    const out = await withClient(async (client) => {
      const colsR = await client.query(
        `SELECT column_name
           FROM information_schema.columns
          WHERE table_schema='public' AND table_name='orders'`
      );
      const colsSet = new Set(colsR.rows.map(r => r.column_name));

      const baseCols = ['order_id'];
      const optionalCols = [
        'status',
        'customer_name', 'customer', 'cliente_nome', 'razao_social', 'nome_fantasia',
        'cnpj', 'cpf', 'cnpj_cpf',
        'created_at', 'updated_at',
        'total', 'total_value', 'total_amount'
      ];

      const selectCols = [...baseCols];
      for (const c of optionalCols) {
        if (colsSet.has(c)) selectCols.push(c);
      }

      const isNumeric = /^[0-9]+$/.test(q.replace(/\s/g, ''));
      const params = [];
      let whereSql = '';

      if (isNumeric) {
        params.push(`%${q}%`);
        whereSql = `CAST(order_id AS TEXT) ILIKE $1`;
      } else {
        const textCandidates = [
          'customer_name', 'customer', 'cliente_nome', 'razao_social', 'nome_fantasia',
          'status', 'cnpj', 'cpf', 'cnpj_cpf'
        ].filter(c => colsSet.has(c));

        if (!textCandidates.length) {
          params.push(`%${q}%`);
          whereSql = `CAST(order_id AS TEXT) ILIKE $1`;
        } else {
          const like = `%${q}%`;
          const ors = [];
          for (const c of textCandidates) {
            params.push(like);
            ors.push(`CAST(${qid(c)} AS TEXT) ILIKE $${params.length}`);
          }
          whereSql = `(${ors.join(' OR ')})`;
        }
      }

      params.push(limit);

      const sql = `
        SELECT ${selectCols.map(qid).join(', ')}
          FROM ${TB_ORDERS}
         WHERE ${whereSql}
         ORDER BY order_id DESC
         LIMIT $${params.length};
      `;

      const r = await client.query(sql, params);
      return { rows: r.rows, cols: selectCols };
    });

    return ok(res, out);
  } catch (err) {
    console.error('searchOrders error:', err);
    return bad(res, 'Falha ao pesquisar pedidos.', 500);
  }
}

/* ──────────────────────────────────────────────────────────────
   PDF
   GET /api/packing/orders/:orderId/pdf
────────────────────────────────────────────────────────────── */
export async function getOrderPackingPdf(req, res) {
  const orderId = toInt(req.params.orderId);
  if (!orderId) return bad(res, 'orderId inválido.');

  try {
    const summary = await withClient(async (client) => {
      await recalcAllVolumesOfOrder(client, orderId);

      const orderR = await client.query(`SELECT * FROM ${TB_ORDERS} WHERE order_id = $1`, [orderId]);

      const volumesR = await client.query(
        `SELECT * FROM ${TB_VOL} WHERE order_id=$1 ORDER BY volume_number ASC`,
        [orderId]
      );

      // ✅ igual ao summary: se não existir coluna weight_kg, calcula weight_kg_calc
      const hasWeightKg = await tableHasColumn(client, 'public', 'orderVolumes', 'weight_kg');

      const volumes = [];
      for (const v of volumesR.rows) {
        if (hasWeightKg) {
          volumes.push(v);
        } else {
          const w = await computeVolumeWeight(client, v.id);
          volumes.push({ ...v, weight_kg_calc: w });
        }
      }

      const volumeItemsR = await client.query(
        `
        SELECT ovi.*, ov.order_id, ov.volume_number, oi.sku, oi.description, oi.unit
          FROM ${TB_VI} ovi
          JOIN ${TB_VOL} ov ON ov.id = ovi.volume_id
          JOIN ${TB_ITEMS} oi ON oi.order_item_id = ovi.order_item_id
         WHERE ov.order_id = $1
         ORDER BY ov.volume_number ASC, ovi.id ASC
        `,
        [orderId]
      );

      const notPackedR = await client.query(
        `
        SELECT
          np.*,
          COALESCE(d.weight, 0)  AS unit_weight_kg,
          COALESCE(d.height, 0)  AS unit_height_cm,
          COALESCE(d.width, 0)   AS unit_width_cm,
          COALESCE(d.length, 0)  AS unit_length_cm
        FROM ${VIEW_NOT_PACKED} np
        LEFT JOIN ${TB_PROD} p ON p.product_code = np.sku
        LEFT JOIN ${TB_DIM} pb  ON pb.barcode_id = p.product_dimension_id
        WHERE np.order_id = $1
        ORDER BY np.description ASC
        `,
        [orderId]
      );

      return {
        order: orderR.rows[0] || null,
        volumes,
        volumeItems: volumeItemsR.rows,
        notPacked: notPackedR.rows,
      };
    });

    const { buffer, filename } = await generateOrdersLogisticsPackingPdf(summary, { orderId });

    if (!buffer || !Buffer.isBuffer(buffer)) {
      return bad(res, 'Gerador de PDF não retornou Buffer.', 500);
    }

    // ✅ headers robustos (evita cache e ajuda viewer)
    res.status(200);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.setHeader('Content-Length', String(buffer.length));
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    return res.end(buffer);
  } catch (err) {
    console.error('getOrderPackingPdf error:', err);
    return bad(res, 'Falha ao gerar PDF do packing.', 500);
  }
}
