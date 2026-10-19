// ╔════════════════════════════════════════════════════════════════════╗
// ║ inventoryQuery.repository.js — list / getById                      ║
// ║ Tabela: public.inventories                                         ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB_INV } from './inventory.constants.js';
import { q } from './inventory.utils.js';
import { rowToInventory } from './inventory.mappers.js';

// ──────────────────────────────────────────────────────────────
// INVENTORIES
// ──────────────────────────────────────────────────────────────
export async function list({ search, status, limit = 50, offset = 0 }) {
  const params = [];
  const where = [];

  if (search) {
    const like = `%${search}%`;
    params.push(like);
    const idx = params.length;
    where.push(`(inv.code ILIKE $${idx} OR inv.description ILIKE $${idx})`);
  }

  if (status) {
    params.push(status);
    const idx = params.length;
    where.push(`inv.status = $${idx}`);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const limitIdx = params.length + 1;
  const offsetIdx = params.length + 2;

  const sql = `
    SELECT
      inv.inventory_id,
      inv.code,
      inv.description,
      inv.type,
      inv.status,
      inv.reference_date,
      inv.notes,
      inv.created_by,
      inv.finalized_by,
      inv.created_at,
      inv.updated_at
    FROM ${TB_INV} inv
    ${whereSql}
    ORDER BY inv.created_at DESC
    LIMIT $${limitIdx}
    OFFSET $${offsetIdx};
  `;

  const countSql = `SELECT COUNT(*)::int AS total FROM ${TB_INV} inv ${whereSql};`;
  const filterParams = [...params];

  params.push(limit, offset);
  const [{ rows }, countRes] = await Promise.all([
    q(pool, 'inventory.list', sql, params),
    q(pool, 'inventory.count', countSql, filterParams),
  ]);
  return { rows, total: countRes.rows[0]?.total ?? rows.length, limit, offset };
}

export async function getById(inventory_id) {
  const { rows } = await q(
    pool,
    'inventory.getById',
    `SELECT * FROM ${TB_INV} WHERE inventory_id = $1;`,
    [inventory_id],
  );
  return rows[0] ? rowToInventory(rows[0]) : null;
}
