// ╔════════════════════════════════════════════════════════════════════╗
// ║ OrdersLogisticsPackingVolumes.repository.js — handlers por volume  ║
// ║  PATCH  /volumes/:volumeId                                         ║
// ║  DELETE /volumes/:volumeId                                         ║
// ║  GET    /volumes/:volumeId/items                                   ║
// ║  POST   /volumes/:volumeId/items                                   ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB_ITEMS, TB_VOL, TB_VI } from './OrdersLogisticsPacking.constants.js';
import { toNum, toInt, ok, bad } from './OrdersLogisticsPacking.utils.js';
import { withClient, ensureVolumeExists } from './OrdersLogisticsPackingLookup.repository.js';

/* ──────────────────────────────────────────────────────────────
   PATCH /volumes/:volumeId
   Atualiza metadata/dimensões/tara/status
────────────────────────────────────────────────────────────── */
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

  if (b.height_cm !== undefined) {
    const v = toNum(b.height_cm, 0); if (v < 0) return bad(res, 'height_cm inválido.');
    setIf('height_cm', v);
  }
  if (b.width_cm !== undefined) {
    const v = toNum(b.width_cm, 0); if (v < 0) return bad(res, 'width_cm inválido.');
    setIf('width_cm', v);
  }
  if (b.length_cm !== undefined) {
    const v = toNum(b.length_cm, 0); if (v < 0) return bad(res, 'length_cm inválido.');
    setIf('length_cm', v);
  }
  if (b.tare_kg !== undefined) {
    const v = toNum(b.tare_kg, 0); if (v < 0) return bad(res, 'tare_kg inválido.');
    setIf('tare_kg', v);
  }

  if (!fields.length) return bad(res, 'Nada para atualizar.');

  try {
    const out = await withClient(async (client) => {
      const vol = await ensureVolumeExists(client, volumeId);
      if (!vol) return { __err: { code: 404, msg: 'Volume não encontrado.' } };

      vals.push(volumeId);
      const q = `
        UPDATE ${TB_VOL}
           SET ${fields.join(', ')},
               updated_at = now()
         WHERE id = $${i}
         RETURNING *`;
      const r = await client.query(q, vals);
      return { row: r.rows[0] };
    });

    if (out.__err) return bad(res, out.__err.msg, out.__err.code);
    return ok(res, out);
  } catch (err) {
    console.error('update volume error:', err);
    return bad(res, 'Falha ao atualizar volume.', 500);
  }
}

/* ──────────────────────────────────────────────────────────────
   DELETE /volumes/:volumeId
   - ON DELETE CASCADE remove itens
────────────────────────────────────────────────────────────── */
export async function deleteVolume(req, res) {
  const volumeId = toInt(req.params.volumeId);
  if (!volumeId) return bad(res, 'volumeId inválido.');

  try {
    const out = await withClient(async (client) => {
      const vol = await ensureVolumeExists(client, volumeId);
      if (!vol) return { __err: { code: 404, msg: 'Volume não encontrado.' } };

      await client.query(`DELETE FROM ${TB_VOL} WHERE id = $1`, [volumeId]);
      return { deleted: true, volumeId };
    });

    if (out.__err) return bad(res, out.__err.msg, out.__err.code);
    return ok(res, out);
  } catch (err) {
    console.error('delete volume error:', err);
    return bad(res, 'Falha ao excluir volume.', 500);
  }
}

/* ──────────────────────────────────────────────────────────────
   GET /volumes/:volumeId/items
────────────────────────────────────────────────────────────── */
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
    console.error('list volume items error:', err);
    return bad(res, 'Falha ao listar itens do volume.', 500);
  }
}

/* ──────────────────────────────────────────────────────────────
   POST /volumes/:volumeId/items
   Body:
     {
       order_item_id, quantity,
       unit_weight_kg, unit_height_cm, unit_width_cm, unit_length_cm
     }
   - Se já existir (mesmo order_item_id no volume), soma quantidade.
   - Trigger no banco recalcula line_weight_kg/line_volume_m3 e volume totals.
────────────────────────────────────────────────────────────── */
export async function addVolumeItem(req, res) {
  const volumeId = toInt(req.params.volumeId);
  if (!volumeId) return bad(res, 'volumeId inválido.');

  const b = req.body || {};
  const order_item_id = toInt(b.order_item_id);
  const quantity = toNum(b.quantity, 0);

  const product_unit_id = toInt(b.product_unit_id);
  const unit = String(b.unit || '').trim() || null;
  const fator = toNum(b.fator, 1);

  if (!order_item_id) return bad(res, 'order_item_id inválido.');
  if (!(quantity > 0)) return bad(res, 'quantity deve ser > 0.');

  let unit_weight_kg = toNum(b.unit_weight_kg, 0);
  let unit_height_cm = toNum(b.unit_height_cm, 0);
  let unit_width_cm = toNum(b.unit_width_cm, 0);
  let unit_length_cm = toNum(b.unit_length_cm, 0);

  if (unit_weight_kg < 0 || unit_height_cm < 0 || unit_width_cm < 0 || unit_length_cm < 0) {
    return bad(res, 'peso/dimensões não podem ser negativos.');
  }

  try {
    const out = await withClient(async (client) => {
      await client.query('BEGIN');

      const vol = await ensureVolumeExists(client, volumeId);
      if (!vol) {
        await client.query('ROLLBACK');
        return { __err: { code: 404, msg: 'Volume não encontrado.' } };
      }

      // garante item existe e pega order_id pra consistência
      const item = await client.query(
        `SELECT order_item_id, order_id, sku, description, unit, quantity AS order_quantity
           FROM ${TB_ITEMS}
          WHERE order_item_id = $1`,
        [order_item_id]
      );
      if (!item.rowCount) {
        await client.query('ROLLBACK');
        return { __err: { code: 404, msg: 'Item do pedido não encontrado.' } };
      }

      // Consistência: item e volume têm que ser do mesmo pedido (também há trigger no banco)
      if (Number(item.rows[0].order_id) !== Number(vol.order_id)) {
        await client.query('ROLLBACK');
        return { __err: { code: 409, msg: 'Item pertence a outro pedido (inconsistência).' } };
      }

      // ==========================================================
      // Peso/dimensões oficiais vêm do productsBarCode
      // Não confia no frontend se veio 0
      // ==========================================================
      const pbc = await client.query(
        `
  SELECT
      weight_kg,
      height_cm,
      width_cm,
      length_cm
  FROM public."productsBarCode"
  WHERE product_code::text = $1::text
    AND is_active IS TRUE
    AND (
      product_unit_id = $2
      OR TRIM(REPLACE(UPPER(unit), '.', '')) =
         TRIM(REPLACE(UPPER($3), '.', ''))
      OR standard IS TRUE
    )
  ORDER BY
      CASE WHEN product_unit_id = $2 THEN 0 ELSE 1 END,
      CASE
        WHEN TRIM(REPLACE(UPPER(unit), '.', '')) =
             TRIM(REPLACE(UPPER($3), '.', ''))
        THEN 0 ELSE 1
      END,
      COALESCE(standard, false) DESC,
      updated_at DESC,
      barcode_id DESC
  LIMIT 1
  `,
        [
          item.rows[0].sku,
          product_unit_id,
          unit || item.rows[0].unit
        ]
      );

      if (pbc.rowCount) {
        unit_weight_kg = toNum(pbc.rows[0].weight_kg, unit_weight_kg);
        unit_height_cm = toNum(pbc.rows[0].height_cm, unit_height_cm);
        unit_width_cm = toNum(pbc.rows[0].width_cm, unit_width_cm);
        unit_length_cm = toNum(pbc.rows[0].length_cm, unit_length_cm);
      }

      // Se já existir, soma qty
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
          product_unit_id = $2,
          unit = $3,
          fator = $4,
          unit_weight_kg = $5,
          unit_height_cm = $6,
          unit_width_cm  = $7,
          unit_length_cm = $8,
          updated_at = now()
    WHERE id = $9
    RETURNING *`,
          [
            newQty,
            product_unit_id,
            unit,
            fator,
            unit_weight_kg,
            unit_height_cm,
            unit_width_cm,
            unit_length_cm,
            existing.rows[0].id
          ]
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
            unit_weight_kg,
            unit_height_cm,
            unit_width_cm,
            unit_length_cm
            )
            VALUES
            (
            $1,$2,$3,$4,$5,$6,$7,$8,$9,$10
            )
            RETURNING *`,
          [
            volumeId,
            order_item_id,
            quantity,
            product_unit_id,
            unit,
            fator,
            unit_weight_kg,
            unit_height_cm,
            unit_width_cm,
            unit_length_cm
          ]
        );
        row = ins.rows[0];
      }

      await client.query('COMMIT');
      return { row };
    });

    if (out.__err) return bad(res, out.__err.msg, out.__err.code);
    return ok(res, out);
  } catch (err) {
    console.error('add item to volume error:', err);
    // se trigger estourar (ex: item de outro pedido), cai aqui
    return bad(res, 'Falha ao adicionar item ao volume.', 500);
  }
}
