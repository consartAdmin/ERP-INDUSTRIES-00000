// ╔══════════════════════════════════════════════════════════════════════╗
// ║ budgetsShippingCrud.repository.js — Frete do orçamento               ║
// ║ getByBudgetId / upsert / remove                                      ║
// ╚══════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { LOOKUP_KEY, WRITE_COLUMNS } from './budgetsShipping.constants.js';
import { normalizePayload } from './budgetsShipping.sanitizers.js';
import { SELECT_SQL, UPSERT_SQL, DELETE_SQL } from './budgetsShipping.sql.js';

// ── API ──────────────────────────────────────────────────────────────

export async function getByBudgetId(budgetId) {
  const { rows } = await pool.query(SELECT_SQL, [budgetId]);

  return rows[0] || null;
}

export async function upsert(budgetId, body = {}) {
  const data = normalizePayload(body);

  const params = WRITE_COLUMNS.map((column) =>
    column === LOOKUP_KEY ? budgetId : data[column]
  );

  const { rows } = await pool.query(UPSERT_SQL, params);

  return rows[0];
}

export async function remove(budgetId) {
  await pool.query(DELETE_SQL, [budgetId]);

  return true;
}
