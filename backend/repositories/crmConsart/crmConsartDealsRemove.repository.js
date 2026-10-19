// ╔════════════════════════════════════════════════════════════════════╗
// ║ crmConsartDealsRemove.repository.js — deleteDeal                   ║
// ║ Tabela: public."crmDealsReativation"                               ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { buildError } from './crmConsart.utils.js';

export async function deleteDeal(id) {
  try {
    const sql = `
      DELETE FROM public."crmDealsReativation"
      WHERE id = $1
      RETURNING id
    `;
    const { rows } = await pool.query(sql, [id]);
    if (!rows[0]) return { ok: false, error: 'DEAL_NOT_FOUND' };
    return { ok: true, data: { id } };
  } catch (err) {
    return buildError(err, 'crmConsartApi.deleteDeal');
  }
}
