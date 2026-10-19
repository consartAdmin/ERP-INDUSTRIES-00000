// ╔════════════════════════════════════════════════════════════════════╗
// ║ customerTrainingsQuery.repository.js — list / getById              ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { SCHEDULED_AT_SQL, TB, TB_ATTENDEES, TB_CUSTOMERS } from './customerTrainings.constants.js';
import { normalizeDate, normalizeStatus, toPositiveInt } from './customerTrainings.sanitizers.js';
import { ensureTable } from './customerTrainingsSchema.repository.js';

const SELECT_COLUMNS = `
  t.training_id,
  t.customer_id,
  c.trade_name AS customer_trade_name,
  c.legal_name AS customer_legal_name,
  c.tax_id AS customer_tax_id,
  t.title,
  t.topics,
  ${SCHEDULED_AT_SQL} AS scheduled_at,
  t.duration_minutes,
  t.format,
  t.location_or_link,
  t.trainer_name,
  t.status,
  t.notes,
  t.pending_items,
  t.completed_at,
  t.last_email_sent_at,
  t.created_at,
  t.updated_at,
  (SELECT COUNT(*)::int FROM ${TB_ATTENDEES} a WHERE a.training_id = t.training_id) AS attendees_count
`;

export async function list({
  q = '',
  customer_id = '',
  status = '',
  trainer = '',
  date_from = '',
  date_to = '',
  page = 1,
  limit = 50,
} = {}) {
  await ensureTable();

  page = Math.max(Number(page) || 1, 1);
  limit = Math.min(Math.max(Number(limit) || 50, 1), 500);
  const offset = (page - 1) * limit;

  const where = ['t.is_active = TRUE'];
  const params = [];

  if (q) {
    params.push(`%${String(q).trim()}%`);
    const p = `$${params.length}`;
    where.push(`(t.title ILIKE ${p} OR c.trade_name ILIKE ${p} OR c.legal_name ILIKE ${p} OR t.topics ILIKE ${p})`);
  }

  const customerId = toPositiveInt(customer_id);
  if (customerId) {
    params.push(customerId);
    where.push(`t.customer_id = $${params.length}`);
  }

  const normalizedStatus = normalizeStatus(status);
  if (normalizedStatus) {
    params.push(normalizedStatus);
    where.push(`t.status = $${params.length}`);
  }

  if (trainer) {
    params.push(`%${String(trainer).trim()}%`);
    where.push(`t.trainer_name ILIKE $${params.length}`);
  }

  const from = normalizeDate(date_from);
  if (from) {
    params.push(from);
    where.push(`t.scheduled_at >= $${params.length}::date`);
  }

  const to = normalizeDate(date_to);
  if (to) {
    params.push(to);
    where.push(`t.scheduled_at < ($${params.length}::date + INTERVAL '1 day')`);
  }

  const whereSql = `WHERE ${where.join(' AND ')}`;
  const fromSql = `FROM ${TB} t LEFT JOIN ${TB_CUSTOMERS} c ON c.customer_id = t.customer_id`;

  const { rows } = await pool.query(
    `
    SELECT ${SELECT_COLUMNS}
    ${fromSql}
    ${whereSql}
    ORDER BY t.scheduled_at ASC, t.training_id ASC
    LIMIT $${params.length + 1}
    OFFSET $${params.length + 2}
    `,
    [...params, limit, offset]
  );

  const totalResult = await pool.query(
    `SELECT COUNT(*)::int AS total ${fromSql} ${whereSql}`,
    params
  );

  return {
    rows,
    total: totalResult.rows[0]?.total || 0,
    page,
    limit,
  };
}

export async function getAttendees(trainingId, client = pool) {
  const { rows } = await client.query(
    `
    SELECT attendee_id, training_id, name, email, phone, attended, sort_order
    FROM ${TB_ATTENDEES}
    WHERE training_id = $1
    ORDER BY sort_order ASC, attendee_id ASC
    `,
    [trainingId]
  );

  return rows;
}

export async function getById(id, client = pool) {
  await ensureTable();

  const trainingId = toPositiveInt(id);
  if (!trainingId) return null;

  const { rows } = await client.query(
    `
    SELECT ${SELECT_COLUMNS},
      c.contact_name AS customer_contact_name,
      c.email AS customer_email,
      c.phone_number AS customer_phone,
      c.mobile_number AS customer_mobile
    FROM ${TB} t
    LEFT JOIN ${TB_CUSTOMERS} c ON c.customer_id = t.customer_id
    WHERE t.training_id = $1
      AND t.is_active = TRUE
    `,
    [trainingId]
  );

  if (!rows[0]) return null;

  return {
    ...rows[0],
    attendees: await getAttendees(trainingId, client),
  };
}
