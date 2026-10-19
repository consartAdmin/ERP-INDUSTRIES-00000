// ╔════════════════════════════════════════════════════════════════════╗
// ║ productsBoxesItems.repository.js — itens da caixa (SKUs)           ║
// ╚════════════════════════════════════════════════════════════════════╝

import { TB_ITEM, TB_PRODUCT } from './productsBoxes.constants.js';
import { q } from './productsBoxes.utils.js';
import { asNum, safeStr, ensureBoxId } from './productsBoxes.sanitizers.js';

/* ──────────────────────────────────────────────────────────────
   Itens da Caixa (SKUs) + ✅ Descrição do Produto (JOIN)
────────────────────────────────────────────────────────────── */
export async function listBoxItems(box_id) {
  const id = ensureBoxId(box_id);

  const res = await q(
    `
    SELECT
      i.box_item_id,
      i.box_id,
      i.product_code,
      i.quantity,
      i.unit,
      i.notes,
      i.created_at,
      i.updated_at,

      -- ✅ descrição vinda do cadastro do produto
      p.description AS product_description

    FROM ${TB_ITEM} i
    LEFT JOIN ${TB_PRODUCT} p
      ON p.product_code = i.product_code  -- ⚠️ se sua coluna for p.product_code, troque aqui
    WHERE i.box_id = $1
    ORDER BY i.created_at ASC
    `,
    [id]
  );

  return res.rows || [];
}

export async function deleteBoxItem(box_id, product_code) {
  const id = ensureBoxId(box_id);

  const codeSafe = safeStr(product_code, 60);
  if (!codeSafe) {
    const err = new Error('product_code is required');
    err.status = 400;
    throw err;
  }

  const res = await q(
    `DELETE FROM ${TB_ITEM} WHERE box_id = $1 AND product_code = $2 RETURNING box_item_id`,
    [id, codeSafe]
  );
  return res.rows?.[0] || null;
}

export async function upsertBoxItem(box_id, item = {}) {
  const id = ensureBoxId(box_id);

  // aceita "sku" ou "product_code"
  const product_code = safeStr(item.product_code ?? item.sku, 60);
  if (!product_code) {
    const err = new Error('product_code (ou sku) is required');
    err.status = 400;
    throw err;
  }

  const quantity = asNum(item.quantity);
  if (quantity === null || quantity <= 0) {
    const err = new Error('quantity must be > 0');
    err.status = 400;
    throw err;
  }

  const unit = item.unit ? safeStr(item.unit, 20) : null;
  const notes = item.notes ? String(item.notes) : null;

  const sql = `
    INSERT INTO ${TB_ITEM} (box_id, product_code, quantity, unit, notes)
    VALUES ($1,$2,$3,$4,$5)
    ON CONFLICT (box_id, product_code)
    DO UPDATE SET
      quantity = EXCLUDED.quantity,
      unit = EXCLUDED.unit,
      notes = EXCLUDED.notes,
      updated_at = NOW()
    RETURNING *
  `;

  const res = await q(sql, [id, product_code, quantity, unit, notes]);
  return res.rows?.[0] || null;
}
