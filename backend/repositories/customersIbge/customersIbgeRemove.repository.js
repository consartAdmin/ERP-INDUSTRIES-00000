// ╔════════════════════════════════════════════════════════════════════╗
// ║ customersIbgeRemove.repository.js — remove (delete por customer_id)║
// ║ Tabela: public."customersIbge"                                     ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB_CUSTOMERS_IBGE } from './customersIbge.constants.js';
import { ensureTable } from './customersIbgeSchema.repository.js';

// ----------------------------------------------------------------------
// Delete
// ----------------------------------------------------------------------
export async function remove(customerId) {
  await ensureTable();

  const id = Number(customerId);
  if (!Number.isFinite(id) || id <= 0) return { ok: false, error: 'ID inválido' };

  try {
    const r = await pool.query(
      `DELETE FROM ${TB_CUSTOMERS_IBGE} WHERE customer_id = $1`,
      [id],
    );
    return { ok: true, deleted: r.rowCount };
  } catch (err) {
    console.error('[customersIbgeApi.remove] ERR:', err);
    return { ok: false, error: String(err.message || err) };
  }
}

export default remove;
