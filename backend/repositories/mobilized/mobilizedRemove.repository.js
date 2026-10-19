// ╔════════════════════════════════════════════════════════════════════╗
// ║ mobilizedRemove.repository.js — deleteMobilized                    ║
// ║ Tabela: public.mobilized                                           ║
// ╚════════════════════════════════════════════════════════════════════╝

import { TB_M } from './mobilized.constants.js';
import { asInt } from './mobilized.sanitizers.js';
import { q } from './mobilized.utils.js';

export async function deleteMobilized(mobilized_id) {
  const id = asInt(mobilized_id);
  if (!id) throw new Error('invalid mobilized_id');
  const res = await q(`DELETE FROM ${TB_M} WHERE mobilized_id = $1 RETURNING mobilized_id`, [id]);
  return res.rows[0] || null;
}
