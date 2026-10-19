// ╔════════════════════════════════════════════════════════════════════╗
// ║ counterPanelCustomersUpdate.repository.js — update / markViewed /  ║
// ║ markDownloaded                                                     ║
// ║ Tabela: public."counterPanelCustomers"                             ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB } from './counterPanelCustomers.constants.js';
import { rowToDoc } from './counterPanelCustomers.mappers.js';
import { normStr, normNullableStr, validateMonthYear, validateSize } from './counterPanelCustomers.sanitizers.js';

export async function update(id, data = {}, { customer_id } = {}) {
  if (!id) return { ok: false, error: 'Required: id' };
  if (!customer_id) return { ok: false, error: 'Required: customer_id' };

  const allowed = [
    'title','description',
    'doc_type',
    'competence_month','competence_year',
    'file_name','file_url','mime_type','file_size_bytes',
    'status',
    'customer_name',
    'storage_driver','gcs_bucket','gcs_key'
  ];

  const patch = {};
  for (const k of allowed) if (data[k] !== undefined) patch[k] = data[k];
  if (!Object.keys(patch).length) return { ok: false, error: 'NO_FIELDS' };

  if (patch.title !== undefined) patch.title = normStr(patch.title);
  if (patch.doc_type !== undefined) patch.doc_type = normStr(patch.doc_type);
  if (patch.file_name !== undefined) patch.file_name = normStr(patch.file_name);

  if (patch.file_url !== undefined) patch.file_url = normNullableStr(patch.file_url);
  if (patch.gcs_bucket !== undefined) patch.gcs_bucket = normNullableStr(patch.gcs_bucket);
  if (patch.gcs_key !== undefined) patch.gcs_key = normNullableStr(patch.gcs_key);
  if (patch.storage_driver !== undefined) patch.storage_driver = normNullableStr(patch.storage_driver);

  const my = validateMonthYear({
    competence_month: patch.competence_month,
    competence_year: patch.competence_year,
  });
  if (patch.competence_month !== undefined) patch.competence_month = my.competence_month;
  if (patch.competence_year !== undefined) patch.competence_year = my.competence_year;

  if (patch.file_size_bytes !== undefined) patch.file_size_bytes = validateSize(patch.file_size_bytes);

  if (patch.file_url === '' ) patch.file_url = null;

  const keys = Object.keys(patch);
  const sets = keys.map((k, i) => `${k} = $${i + 1}`);
  const args = keys.map((k) => patch[k]);
  args.push(id, customer_id);

  const sql = `
    UPDATE ${TB}
    SET ${sets.join(', ')}, updated_at = NOW()
    WHERE id = $${args.length - 1} AND customer_id = $${args.length}
    RETURNING *
  `;

  const client = await pool.connect();
  try {
    const r = await client.query(sql, args);
    if (!r.rowCount) return { ok: false, error: 'NOT_FOUND' };
    return { ok: true, row: rowToDoc(r.rows[0]) };
  } catch (err) {
    return { ok: false, error: String(err.message || err) };
  } finally {
    client.release();
  }
}

// ----------------------------------------------------------------------
// Cliente marca como visto
// ----------------------------------------------------------------------
export async function markViewed(id, { customer_id } = {}) {
  if (!id) return { ok: false, error: 'Required: id' };
  if (!customer_id) return { ok: false, error: 'Required: customer_id' };

  const sql = `
    UPDATE ${TB}
    SET is_viewed = TRUE, viewed_at = COALESCE(viewed_at, NOW()), updated_at = NOW()
    WHERE id = $1 AND customer_id = $2
    RETURNING *
  `;
  const client = await pool.connect();
  try {
    const r = await client.query(sql, [id, customer_id]);
    if (!r.rowCount) return { ok: false, error: 'NOT_FOUND' };
    return { ok: true, row: rowToDoc(r.rows[0]) };
  } catch (err) {
    return { ok: false, error: String(err.message || err) };
  } finally {
    client.release();
  }
}

// ----------------------------------------------------------------------
// Cliente marca como baixado ✅
// ----------------------------------------------------------------------
export async function markDownloaded(id, { customer_id } = {}) {
  if (!id) return { ok: false, error: 'Required: id' };
  if (!customer_id) return { ok: false, error: 'Required: customer_id' };

  const sql = `
    UPDATE ${TB}
    SET is_downloaded = TRUE,
        downloaded_at = COALESCE(downloaded_at, NOW()),
        updated_at = NOW()
    WHERE id = $1 AND customer_id = $2
    RETURNING *
  `;
  const client = await pool.connect();
  try {
    const r = await client.query(sql, [id, customer_id]);
    if (!r.rowCount) return { ok: false, error: 'NOT_FOUND' };
    return { ok: true, row: rowToDoc(r.rows[0]) };
  } catch (err) {
    return { ok: false, error: String(err.message || err) };
  } finally {
    client.release();
  }
}
