// ╔════════════════════════════════════════════════════════════════════╗
// ║ licitationsQuery.repository.js — list / getById / summary          ║
// ║ Tabela: public.licitationitems                                     ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TABLE_NAME, ALLOWED_SORT_COLUMNS } from './licitations.constants.js';
import { normalizePagination } from './licitations.sanitizers.js';
import { buildFilters } from './licitations.sql.js';
import { ensureTableReady } from './licitationsSchema.repository.js';

export async function listLicitations(filters = {}) {
    await ensureTableReady();

    const page = normalizePagination(filters.page, 1);
    const limit = normalizePagination(filters.limit ?? filters.per_page, 20, 200);
    const offset = (page - 1) * limit;

    const requestedSort = String(filters.sort_by || 'session_date');
    const sortBy = ALLOWED_SORT_COLUMNS.has(requestedSort)
        ? requestedSort
        : 'session_date';

    const sortOrder =
        String(filters.sort_order || 'asc').toLowerCase() === 'desc'
            ? 'DESC'
            : 'ASC';

    const { clause, values } = buildFilters(filters);

    const countResult = await pool.query(
        `SELECT COUNT(*)::INTEGER AS total FROM ${TABLE_NAME} ${clause}`,
        values,
    );

    const dataValues = [...values, limit, offset];
    const limitPlaceholder = `$${values.length + 1}`;
    const offsetPlaceholder = `$${values.length + 2}`;

    const dataResult = await pool.query(
        `
      SELECT *
      FROM ${TABLE_NAME}
      ${clause}
      ORDER BY ${sortBy} ${sortOrder} NULLS LAST, id DESC
      LIMIT ${limitPlaceholder}
      OFFSET ${offsetPlaceholder}
    `,
        dataValues,
    );

    const total = countResult.rows[0]?.total || 0;

    return {
        rows: dataResult.rows,
        pagination: {
            page,
            limit,
            total,
            total_pages: Math.max(1, Math.ceil(total / limit)),
        },
    };
}

export async function getLicitationById(id) {
    await ensureTableReady();

    const result = await pool.query(
        `SELECT * FROM ${TABLE_NAME} WHERE id = $1 LIMIT 1`,
        [id],
    );

    return result.rows[0] || null;
}

export async function getLicitationsSummary(filters = {}) {
    await ensureTableReady();

    const { clause, values } = buildFilters(filters);

    const result = await pool.query(
        `
      SELECT
        COUNT(*)::INTEGER AS total_items,
        COUNT(*) FILTER (WHERE participation = TRUE)::INTEGER AS participating_items,
        COUNT(*) FILTER (WHERE status = 'FOUND')::INTEGER AS found_items,
        COUNT(*) FILTER (WHERE status = 'UNDER_ANALYSIS')::INTEGER AS analysis_items,
        COUNT(*) FILTER (WHERE status = 'APPROVED')::INTEGER AS approved_items,
        COUNT(*) FILTER (WHERE status = 'PROPOSAL_SENT')::INTEGER AS proposal_sent_items,
        COUNT(*) FILTER (WHERE status = 'WON')::INTEGER AS won_items,
        COUNT(*) FILTER (WHERE status = 'LOST')::INTEGER AS lost_items,
        COALESCE(SUM(estimated_total_price), 0)::NUMERIC AS estimated_total,
        COALESCE(SUM(proposed_price * quantity), 0)::NUMERIC AS proposed_total
      FROM ${TABLE_NAME}
      ${clause}
    `,
        values,
    );

    return result.rows[0];
}
