// ╔════════════════════════════════════════════════════════════════════╗
// ║ productsBoxesUpdate.repository.js — updateBox                      ║
// ╚════════════════════════════════════════════════════════════════════╝

import { TB_BOX } from './productsBoxes.constants.js';
import { q } from './productsBoxes.utils.js';
import { asBool, asNum, safeStr, ensureBoxId } from './productsBoxes.sanitizers.js';
import { getBoxById } from './productsBoxesQuery.repository.js';

export async function updateBox(box_id, payload = {}) {
  const id = ensureBoxId(box_id);

  const fields = [];
  const params = [];

  function pushField(col, val) {
    params.push(val);
    fields.push(`${col} = $${params.length}`);
  }

  if (payload.name !== undefined) pushField('name', payload.name ? safeStr(payload.name, 120) : null);
  if (payload.box_type !== undefined) pushField('box_type', payload.box_type ? safeStr(payload.box_type, 40) : null);
  if (payload.location !== undefined) pushField('location', payload.location ? safeStr(payload.location, 80) : null);

  if (payload.length_cm !== undefined) pushField('length_cm', asNum(payload.length_cm));
  if (payload.width_cm !== undefined) pushField('width_cm', asNum(payload.width_cm));
  if (payload.height_cm !== undefined) pushField('height_cm', asNum(payload.height_cm));

  if (payload.max_weight_kg !== undefined) pushField('max_weight_kg', asNum(payload.max_weight_kg));
  if (payload.max_volume_cm3 !== undefined) pushField('max_volume_cm3', asNum(payload.max_volume_cm3));

  if (payload.notes !== undefined) pushField('notes', payload.notes ? String(payload.notes) : null);

  if (payload.active !== undefined) {
    const b = asBool(payload.active);
    if (b === null) {
      const err = new Error('active must be boolean');
      err.status = 400;
      throw err;
    }
    pushField('active', b);
  }

  if (!fields.length) {
    const current = await getBoxById(id);
    return current;
  }

  params.push(id);

  const sql = `
    UPDATE ${TB_BOX}
    SET ${fields.join(', ')}, updated_at = NOW()
    WHERE box_id = $${params.length}
    RETURNING *
  `;

  const res = await q(sql, params);
  return res.rows?.[0] || null;
}
