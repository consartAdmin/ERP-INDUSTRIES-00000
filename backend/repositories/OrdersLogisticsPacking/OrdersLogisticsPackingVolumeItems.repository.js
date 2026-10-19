// ╔════════════════════════════════════════════════════════════════════╗
// ║ OrdersLogisticsPackingVolumeItems.repository.js — itens de volume  ║
// ║  PATCH  /volume-items/:volumeItemId                                ║
// ║  DELETE /volume-items/:volumeItemId                                ║
// ║  POST   /volume-items/:volumeItemId/move                           ║
// ╚════════════════════════════════════════════════════════════════════╝

import { TB_VI } from './OrdersLogisticsPacking.constants.js';
import { toNum, toInt, ok, bad } from './OrdersLogisticsPacking.utils.js';
import {
  withClient,
  ensureVolumeExists,
  ensureVolumeItemExists,
} from './OrdersLogisticsPackingLookup.repository.js';

/* ──────────────────────────────────────────────────────────────
   PATCH /volume-items/:volumeItemId
   Body: { quantity }
────────────────────────────────────────────────────────────── */
export async function updateVolumeItem(req, res) {
  const volumeItemId = toInt(req.params.volumeItemId);
  if (!volumeItemId) return bad(res, 'volumeItemId inválido.');

  const qty = toNum(req.body?.quantity, 0);
  if (!(qty > 0)) return bad(res, 'quantity deve ser > 0.');

  try {
    const out = await withClient(async (client) => {
      const vi = await ensureVolumeItemExists(client, volumeItemId);
      if (!vi) return { __err: { code: 404, msg: 'Item do volume não encontrado.' } };

      const up = await client.query(
        `UPDATE ${TB_VI}
            SET quantity = $1,
                updated_at = now()
          WHERE id = $2
          RETURNING *`,
        [qty, volumeItemId]
      );

      return { row: up.rows[0] };
    });

    if (out.__err) return bad(res, out.__err.msg, out.__err.code);
    return ok(res, out);
  } catch (err) {
    console.error('update volume item error:', err);
    return bad(res, 'Falha ao atualizar item do volume.', 500);
  }
}

/* ──────────────────────────────────────────────────────────────
   DELETE /volume-items/:volumeItemId
────────────────────────────────────────────────────────────── */
export async function deleteVolumeItem(req, res) {
  const volumeItemId = toInt(req.params.volumeItemId);
  if (!volumeItemId) return bad(res, 'volumeItemId inválido.');

  try {
    const out = await withClient(async (client) => {
      const vi = await ensureVolumeItemExists(client, volumeItemId);
      if (!vi) return { __err: { code: 404, msg: 'Item do volume não encontrado.' } };

      await client.query(`DELETE FROM ${TB_VI} WHERE id = $1`, [volumeItemId]);
      return { deleted: true, volumeItemId };
    });

    if (out.__err) return bad(res, out.__err.msg, out.__err.code);
    return ok(res, out);
  } catch (err) {
    console.error('delete volume item error:', err);
    return bad(res, 'Falha ao excluir item do volume.', 500);
  }
}

/* ──────────────────────────────────────────────────────────────
   POST /volume-items/:volumeItemId/move
   Body: { to_volume_id }
   - Move o item do volume A para volume B (mesmo pedido)
   - Se já existir o mesmo order_item_id no destino, soma quantidade e remove origem.
────────────────────────────────────────────────────────────── */
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

      // destino já tem esse item?
      const existingDest = await client.query(
        `SELECT id, quantity
           FROM ${TB_VI}
          WHERE volume_id = $1
          AND order_item_id = $2
          AND COALESCE(product_unit_id,0) =
          COALESCE($3,0)`,
        [toVolumeId, vi.order_item_id, vi.product_unit_id]
      );

      let result;

      if (existingDest.rowCount) {
        const newQty = toNum(existingDest.rows[0].quantity, 0) + toNum(vi.quantity, 0);

        // soma no destino
        await client.query(
          `UPDATE ${TB_VI}
      SET quantity = $1,
          updated_at = now()
    WHERE id = $2`,
          [newQty, existingDest.rows[0].id]
        );

        // remove origem
        await client.query(`DELETE FROM ${TB_VI} WHERE id = $1`, [volumeItemId]);

        result = { merged_into_id: existingDest.rows[0].id, removed_id: volumeItemId, to_volume_id: toVolumeId };
      } else {
        // move simples (troca volume_id)
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

      await client.query('COMMIT');
      return result;
    });

    if (out.__err) return bad(res, out.__err.msg, out.__err.code);
    return ok(res, out);
  } catch (err) {
    console.error('move volume item error:', err);
    return bad(res, 'Falha ao mover item entre volumes.', 500);
  }
}
