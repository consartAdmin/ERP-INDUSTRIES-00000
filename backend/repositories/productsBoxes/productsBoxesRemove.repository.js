// ╔════════════════════════════════════════════════════════════════════╗
// ║ productsBoxesRemove.repository.js — deleteBox                      ║
// ╚════════════════════════════════════════════════════════════════════╝

import { TB_BOX } from './productsBoxes.constants.js';
import { q } from './productsBoxes.utils.js';
import { ensureBoxId } from './productsBoxes.sanitizers.js';

export async function deleteBox(box_id) {
  const id = ensureBoxId(box_id);
  const res = await q(`DELETE FROM ${TB_BOX} WHERE box_id = $1 RETURNING box_id`, [id]);
  return res.rows?.[0] || null;
}
