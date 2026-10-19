// ╔════════════════════════════════════════════════════════════════════╗
// ║ counterPanelCustomersCreate.repository.js — create                 ║
// ║ Tabela: public."counterPanelCustomers"                             ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB } from './counterPanelCustomers.constants.js';
import { rowToDoc } from './counterPanelCustomers.mappers.js';
import { normalizeCreate } from './counterPanelCustomers.sanitizers.js';

// ----------------------------------------------------------------------
// Create / Update / Delete
// ----------------------------------------------------------------------
export async function create(data = {}) {
  const d = normalizeCreate(data);

  const cols = [
    'customer_id','customer_name',
    'doc_type','title','description',
    'competence_month','competence_year',
    'file_name','file_url','mime_type','file_size_bytes',
    'status',
    'storage_driver','gcs_bucket','gcs_key'
  ];
  const vals = cols.map((_, i) => `$${i + 1}`);
  const args = cols.map((c) => d[c]);

  const sql = `
    INSERT INTO ${TB} (${cols.join(',')})
    VALUES (${vals.join(',')})
    RETURNING *
  `;

  const client = await pool.connect();
  try {
    const r = await client.query(sql, args);
    return { ok: true, row: rowToDoc(r.rows[0]) };
  } catch (err) {
    return { ok: false, error: String(err.message || err) };
  } finally {
    client.release();
  }
}
