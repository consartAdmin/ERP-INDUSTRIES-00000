// ╔════════════════════════════════════════════════════════════════════╗
// ║ priceCommissionsRemove.repository.js — remove                      ║
// ║ Tabela: public."priceCommissions"                                  ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB_PC } from './priceCommissions.constants.js';

export async function remove(id) {
  const pid = Number(id);
  if (!Number.isFinite(pid) || pid <= 0) return { ok: false, error: 'ID inválido' };

  const sql = `DELETE FROM ${TB_PC} WHERE commission_id = $1`;
  try {
    const r = await pool.query(sql, [pid]);
    return { ok: true, deleted: r.rowCount };
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
}
