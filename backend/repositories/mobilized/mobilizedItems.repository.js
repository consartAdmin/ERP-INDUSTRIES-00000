// ╔════════════════════════════════════════════════════════════════════╗
// ║ mobilizedItems.repository.js — CRUD dos itens do imobilizado       ║
// ║ Tabela: public."mobilizedItems"                                    ║
// ╚════════════════════════════════════════════════════════════════════╝

import { TB_I } from './mobilized.constants.js';
import { asInt, asNumericStr, safeStr } from './mobilized.sanitizers.js';
import { q } from './mobilized.utils.js';

/* ──────────────────────────────────────────────────────────────
   Mobilized Items
────────────────────────────────────────────────────────────── */
export async function listMobilizedItems(mobilized_id) {
  const id = asInt(mobilized_id);
  if (!id) throw new Error('invalid mobilized_id');

  // ✅ SELECT * já traz model/serial_number/nfe_ref se existir no DB
  const res = await q(
    `SELECT * FROM ${TB_I} WHERE mobilized_id = $1 ORDER BY mobilized_item_id ASC`,
    [id]
  );
  return res.rows;
}

export async function getMobilizedItemById(mobilized_item_id) {
  const id = asInt(mobilized_item_id);
  if (!id) throw new Error('invalid mobilized_item_id');

  const res = await q(`SELECT * FROM ${TB_I} WHERE mobilized_item_id = $1`, [id]);
  return res.rows[0] || null;
}

export async function addMobilizedItem(mobilized_id, item = {}) {
  const id = asInt(mobilized_id);
  if (!id) throw new Error('invalid mobilized_id');

  const description = safeStr(item.description, 500);
  if (!description) throw new Error('description is required');

  const qtyStr = asNumericStr(item.quantity, { allowNull: false });
  if (qtyStr === null) throw new Error('invalid quantity');
  if (Number(qtyStr) < 0) throw new Error('quantity must be >= 0');

  const unitPriceStr = asNumericStr(item.unit_price);
  if (unitPriceStr !== null && Number(unitPriceStr) < 0) throw new Error('unit_price must be >= 0');

  // ✅ NOVOS CAMPOS
  const model = safeStr(item.model, 120) || null;
  const serial_number = safeStr(item.serial_number, 120) || null;
  const nfe_ref = safeStr(item.nfe_ref, 120) || null;

  // ✅ (opcional) image_url: requer coluna no DB
  const hasImageUrl = Object.prototype.hasOwnProperty.call(item, 'image_url');

  const sql = hasImageUrl
    ? `
      INSERT INTO ${TB_I} (
        mobilized_id,
        sku, description,
        model, serial_number, nfe_ref,
        quantity, unit, unit_price,
        notes, image_url,
        created_at
      ) VALUES (
        $1,
        $2,$3,
        $4,$5,$6,
        $7,$8,$9,
        $10,$11,
        NOW()
      )
      RETURNING *;
    `
    : `
      INSERT INTO ${TB_I} (
        mobilized_id,
        sku, description,
        model, serial_number, nfe_ref,
        quantity, unit, unit_price,
        notes,
        created_at
      ) VALUES (
        $1,
        $2,$3,
        $4,$5,$6,
        $7,$8,$9,
        $10,
        NOW()
      )
      RETURNING *;
    `;

  const params = hasImageUrl
    ? [
        id,
        safeStr(item.sku, 60) || null,
        description,

        model,
        serial_number,
        nfe_ref,

        qtyStr,
        safeStr(item.unit, 10) || null,
        unitPriceStr,

        item.notes != null ? String(item.notes) : null,
        safeStr(item.image_url, 800) || null,
      ]
    : [
        id,
        safeStr(item.sku, 60) || null,
        description,

        model,
        serial_number,
        nfe_ref,

        qtyStr,
        safeStr(item.unit, 10) || null,
        unitPriceStr,

        item.notes != null ? String(item.notes) : null,
      ];

  const res = await q(sql, params);
  return res.rows[0];
}

export async function updateMobilizedItem(mobilized_item_id, patch = {}) {
  const id = asInt(mobilized_item_id);
  if (!id) throw new Error('invalid mobilized_item_id');

  const set = [];
  const params = [];

  function add(col, val) {
    params.push(val);
    set.push(`${col} = $${params.length}`);
  }

  if (patch.sku !== undefined) add('sku', safeStr(patch.sku, 60) || null);

  if (patch.description !== undefined) {
    const d = safeStr(patch.description, 500);
    if (!d) throw new Error('description cannot be empty');
    add('description', d);
  }

  // ✅ NOVOS CAMPOS
  if (patch.model !== undefined) add('model', safeStr(patch.model, 120) || null);
  if (patch.serial_number !== undefined) add('serial_number', safeStr(patch.serial_number, 120) || null);
  if (patch.nfe_ref !== undefined) add('nfe_ref', safeStr(patch.nfe_ref, 120) || null);

  if (patch.quantity !== undefined) {
    const qtyStr = asNumericStr(patch.quantity, { allowNull: false });
    if (qtyStr === null) throw new Error('invalid quantity');
    if (Number(qtyStr) < 0) throw new Error('quantity must be >= 0');
    add('quantity', qtyStr);
  }

  if (patch.unit !== undefined) add('unit', safeStr(patch.unit, 10) || null);

  if (patch.unit_price !== undefined) {
    const unitPriceStr = asNumericStr(patch.unit_price);
    if (unitPriceStr !== null && Number(unitPriceStr) < 0) throw new Error('unit_price must be >= 0');
    add('unit_price', unitPriceStr);
  }

  if (patch.notes !== undefined) add('notes', patch.notes != null ? String(patch.notes) : null);

  // ✅ (opcional) image_url (requer coluna no DB)
  if (patch.image_url !== undefined) add('image_url', safeStr(patch.image_url, 800) || null);

  if (!set.length) return await getMobilizedItemById(id);

  const sql = `
    UPDATE ${TB_I}
    SET ${set.join(', ')}
    WHERE mobilized_item_id = $${params.length + 1}
    RETURNING *;
  `;
  params.push(id);

  const res = await q(sql, params);
  return res.rows[0] || null;
}

export async function deleteMobilizedItem(mobilized_item_id) {
  const id = asInt(mobilized_item_id);
  if (!id) throw new Error('invalid mobilized_item_id');

  const res = await q(
    `DELETE FROM ${TB_I} WHERE mobilized_item_id = $1 RETURNING mobilized_item_id`,
    [id]
  );
  return res.rows[0] || null;
}
