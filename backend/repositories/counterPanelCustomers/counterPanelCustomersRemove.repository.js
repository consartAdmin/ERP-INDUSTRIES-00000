// ╔════════════════════════════════════════════════════════════════════╗
// ║ counterPanelCustomersRemove.repository.js — remove                 ║
// ║ Tabela: public."counterPanelCustomers"                             ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB } from './counterPanelCustomers.constants.js';

export async function remove(id, { customer_id } = {}) {
  if (!id) return { ok: false, error: 'Required: id' };
  if (!customer_id) return { ok: false, error: 'Required: customer_id' };

  const sql = `DELETE FROM ${TB} WHERE id = $1 AND customer_id = $2`;
  const client = await pool.connect();
  try {
    const r = await client.query(sql, [id, customer_id]);
    return { ok: true, deleted: r.rowCount };
  } catch (err) {
    return { ok: false, error: String(err.message || err) };
  } finally {
    client.release();
  }
}
