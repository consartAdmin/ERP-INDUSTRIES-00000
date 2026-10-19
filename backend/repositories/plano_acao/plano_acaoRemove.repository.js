// ╔════════════════════════════════════════════════════════════════════╗
// ║ plano_acaoRemove.repository.js — removeById                        ║
// ╚════════════════════════════════════════════════════════════════════╝

import { TB } from './plano_acao.constants.js';
import { q } from './plano_acao.utils.js';

export async function removeById(id) {
  const res = await q(`DELETE FROM ${TB} WHERE id = $1 RETURNING id;`, [id]);
  return res.rows[0]?.id ?? null;
}
