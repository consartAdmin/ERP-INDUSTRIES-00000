// ╔════════════════════════════════════════════════════════════════════╗
// ║ productsBoxesCreate.repository.js — createBox                      ║
// ╚════════════════════════════════════════════════════════════════════╝

import { TB_BOX } from './productsBoxes.constants.js';
import { q } from './productsBoxes.utils.js';
import { asBool, asNum, safeStr } from './productsBoxes.sanitizers.js';

export async function createBox(payload = {}) {
  const name = safeStr(payload.name, 120);

  if (!name) {
    const err = new Error('name is required');
    err.status = 400;
    throw err;
  }

  const box_type = payload.box_type ? safeStr(payload.box_type, 40) : null;
  const location = payload.location ? safeStr(payload.location, 80) : null;

  const length_cm = asNum(payload.length_cm);
  const width_cm  = asNum(payload.width_cm);
  const height_cm = asNum(payload.height_cm);

  const max_weight_kg  = asNum(payload.max_weight_kg);
  const max_volume_cm3 = asNum(payload.max_volume_cm3);

  const notes = payload.notes ? String(payload.notes) : null;

  const active = asBool(payload.active);
  const activeFinal = active === null ? true : active;

  const sql = `
    INSERT INTO ${TB_BOX}
      (name, box_type, location, length_cm, width_cm, height_cm,
       max_weight_kg, max_volume_cm3, notes, active)
    VALUES
      ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
    RETURNING *
  `;

  const res = await q(sql, [
    name, box_type, location,
    length_cm, width_cm, height_cm,
    max_weight_kg, max_volume_cm3,
    notes, activeFinal,
  ]);

  return res.rows?.[0] || null;
}
