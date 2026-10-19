// ╔════════════════════════════════════════════════════════════════════╗
// ║ counterPanelCustomersQuery.repository.js — search / list / getById ║
// ║ Tabela: public."counterPanelCustomers"                             ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB } from './counterPanelCustomers.constants.js';
import { rowToDoc } from './counterPanelCustomers.mappers.js';

// ----------------------------------------------------------------------
// Listagem & Busca (foco no cliente)
// ----------------------------------------------------------------------
export async function search({
  customer_id,
  q = '',
  doc_type,
  status,
  status_visual,              // ✅ NOVO (NEW|VIEWED|DOWNLOADED)
  competence_month,
  competence_year,
  only_unviewed = false,
  limit = 20,
  offset = 0,
} = {}) {
  const where = [];
  const args = [];
  let ai = 1;

  if (!customer_id) return { ok: false, error: 'Required: customer_id' };
  where.push(`customer_id = $${ai}`); args.push(customer_id); ai++;

  if (q && String(q).trim()) {
    const val = `%${String(q).toLowerCase().trim()}%`;
    where.push(`(
      LOWER(title) LIKE $${ai} OR
      LOWER(COALESCE(description,'')) LIKE $${ai} OR
      LOWER(file_name) LIKE $${ai}
    )`); args.push(val); ai++;
  }

  if (doc_type && String(doc_type).trim()) {
    where.push(`doc_type = $${ai}`); args.push(doc_type); ai++;
  }

  if (status && String(status).trim()) {
    where.push(`status = $${ai}`); args.push(status); ai++;
  }

  if (competence_month !== undefined && competence_month !== null && String(competence_month) !== '') {
    where.push(`competence_month = $${ai}`); args.push(Number(competence_month)); ai++;
  }

  if (competence_year !== undefined && competence_year !== null && String(competence_year) !== '') {
    where.push(`competence_year = $${ai}`); args.push(Number(competence_year)); ai++;
  }

  if (only_unviewed) where.push(`is_viewed = FALSE`);

  // ✅ filtro por status visual (prioridade pra UX)
  if (status_visual && String(status_visual).trim()) {
    const sv = String(status_visual).trim().toUpperCase();
    if (sv === 'NEW') where.push(`is_viewed = FALSE AND is_downloaded = FALSE`);
    else if (sv === 'VIEWED') where.push(`is_viewed = TRUE AND is_downloaded = FALSE`);
    else if (sv === 'DOWNLOADED') where.push(`is_downloaded = TRUE`);
  }

  // Por padrão, o cliente só deve ver "AVAILABLE" (se não passar status)
  if (!status) where.push(`status = 'AVAILABLE'`);

  const whereSql = `WHERE ${where.join(' AND ')}`;

  const sqlRows = `
    SELECT *
    FROM ${TB}
    ${whereSql}
    ORDER BY created_at DESC, id DESC
    LIMIT $${ai} OFFSET $${ai + 1}
  `;
  args.push(Number(limit) || 20, Number(offset) || 0);

  const sqlCount = `
    SELECT COUNT(*) AS total
    FROM ${TB}
    ${whereSql}
  `;

  const client = await pool.connect();
  try {
    const [rowsRes, countRes] = await Promise.all([
      client.query(sqlRows, args),
      client.query(sqlCount, args.slice(0, ai - 1)),
    ]);
    const rows = rowsRes.rows.map(rowToDoc);
    const total = Number(countRes.rows?.[0]?.total || 0);
    return { ok: true, rows, total };
  } catch (err) {
    return { ok: false, error: String(err.message || err) };
  } finally {
    client.release();
  }
}

export async function list({ customer_id, limit = 20, offset = 0 } = {}) {
  return search({ customer_id, q: '', limit, offset });
}

// ----------------------------------------------------------------------
// Read
// ----------------------------------------------------------------------
export async function getById(id, { customer_id } = {}) {
  if (!id) return { ok: false, error: 'Required: id' };
  if (!customer_id) return { ok: false, error: 'Required: customer_id' };

  const sql = `
    SELECT *
    FROM ${TB}
    WHERE id = $1 AND customer_id = $2
    LIMIT 1
  `;
  try {
    const r = await pool.query(sql, [id, customer_id]);
    if (!r.rowCount) return { ok: false, error: 'NOT_FOUND' };
    return { ok: true, row: rowToDoc(r.rows[0]) };
  } catch (err) {
    return { ok: false, error: String(err.message || err) };
  }
}
