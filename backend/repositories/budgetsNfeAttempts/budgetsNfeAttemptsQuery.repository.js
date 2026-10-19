// ╔═══════════════════════════════════════════════════════════════════════╗
// ║ budgetsNfeAttemptsQuery.repository.js — list / getById / listByBudget ║
// ╚═══════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import {
  TB_ATTEMPTS,
  TB_ITEMS,
  TB_STATUS,
} from './budgetsNfeAttempts.constants.js';
import {
  toId,
} from './budgetsNfeAttempts.sanitizers.js';
import {
  getByIdWithClient,
} from './budgetsNfeAttemptsLookup.repository.js';

export async function list({
    budget_id,
    invoice_id,
    nfe_status_id,
    status_code,
    is_final,
    is_authorized,
    date_from,
    date_to,
    page = 1,
    page_size = 20,
} = {}) {
    const where = [];
    const values = [];

    const add = (sql, value) => {
        values.push(value);
        where.push(sql.replace('?', `$${values.length}`));
    };

    if (budget_id) {
        add('a.budget_id = ?', toId(budget_id, 'budget_id'));
    }

    if (invoice_id) {
        add('a.invoice_id = ?', toId(invoice_id, 'invoice_id'));
    }

    if (nfe_status_id) {
        add('a.nfe_status_id = ?', toId(nfe_status_id, 'nfe_status_id'));
    }

    if (status_code) {
        add('UPPER(s.code) = UPPER(?)', String(status_code).trim());
    }

    if (is_final !== undefined) {
        add('s.is_final = ?', Boolean(is_final));
    }

    if (is_authorized !== undefined) {
        add('s.is_authorized = ?', Boolean(is_authorized));
    }

    if (date_from) {
        add('a.requested_at >= ?::timestamptz', date_from);
    }

    if (date_to) {
        add('a.requested_at <= ?::timestamptz', date_to);
    }

    const safePage = Math.max(1, Number(page) || 1);
    const safeSize = Math.min(100, Math.max(1, Number(page_size) || 20));
    const offset = (safePage - 1) * safeSize;
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const count = await pool.query(
        `
            SELECT COUNT(*)::bigint AS total
            FROM ${TB_ATTEMPTS} a
            JOIN ${TB_STATUS} s
              ON s.nfe_status_id = a.nfe_status_id
            ${whereSql}
        `,
        values,
    );

    const rows = await pool.query(
        `
            SELECT
                a.*,
                s.code AS status_code,
                s.name AS status_name,
                s.is_final,
                s.is_authorized,
                COUNT(i.attempt_item_id)::int AS items_count
            FROM ${TB_ATTEMPTS} a
            JOIN ${TB_STATUS} s
              ON s.nfe_status_id = a.nfe_status_id
            LEFT JOIN ${TB_ITEMS} i
              ON i.attempt_id = a.attempt_id
            ${whereSql}
            GROUP BY
                a.attempt_id,
                s.nfe_status_id
            ORDER BY
                a.requested_at DESC,
                a.attempt_id DESC
            LIMIT $${values.length + 1}
            OFFSET $${values.length + 2}
        `,
        [...values, safeSize, offset],
    );

    return {
        rows: rows.rows,
        total: Number(count.rows[0]?.total || 0),
        page: safePage,
        page_size: safeSize,
    };
}

export async function getById(attemptId) {
    const id = toId(attemptId, 'attempt_id');
    return getByIdWithClient(pool, id);
}

export async function listByBudget(budgetId) {
    return list({
        budget_id: toId(budgetId, 'budget_id'),
        page_size: 100,
    });
}
