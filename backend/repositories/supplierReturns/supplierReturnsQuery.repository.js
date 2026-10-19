// ╔══════════════════════════════════════════════════════════════════╗
// ║ supplierReturnsQuery.repository.js — listagem paginada           ║
// ║ list({ page, limit, q, status })                                 ║
// ╚══════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TABLE_HEAD } from './supplierReturns.constants.js';
import { normalizeStatus } from './supplierReturns.utils.js';
import { NFE_STATUS_SELECT_SQL, NFE_STATUS_JOIN_SQL } from './supplierReturns.sql.js';
import { ensureTables } from './supplierReturnsSchema.repository.js';

export async function list({ page = 1, limit = 20, q = '', status = '' } = {}) {
    await ensureTables();

    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
    const offset = (safePage - 1) * safeLimit;

    const params = [];
    const where = [];

    if (q) {
        params.push(`%${String(q).trim()}%`);

        where.push(`(
      sr.original_nfe_key ILIKE $${params.length}
      OR sr.original_document_number ILIKE $${params.length}
      OR sr.return_reason ILIKE $${params.length}
      OR COALESCE(sr.supplier_name, '') ILIKE $${params.length}
      OR COALESCE(sr.supplier_document, '') ILIKE $${params.length}
    )`);
    }

    if (status) {
        params.push(normalizeStatus(status));
        where.push(`sr.status = $${params.length}`);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const totalResult = await pool.query(
        `
      SELECT COUNT(*)::int AS total
        FROM ${TABLE_HEAD} sr
        ${whereSql}
    `,
        params,
    );

    const dataResult = await pool.query(
        `
SELECT
    sr.*,

    COALESCE(sr.supplier_name, '') AS supplier_name,
    COALESCE(sr.supplier_document, '') AS supplier_document,

    sr.plugnotas_response->'data'->0->>'numero' AS nfe_number,
    sr.plugnotas_response->'data'->0->>'serie' AS nfe_series,
    sr.plugnotas_response->'data'->0->>'status' AS plug_status,
    ${NFE_STATUS_SELECT_SQL}
    FROM ${TABLE_HEAD} sr
      ${NFE_STATUS_JOIN_SQL}
      ${whereSql}
      ORDER BY sr.return_id DESC
      LIMIT $${params.length + 1}
      OFFSET $${params.length + 2}
    `,
        [...params, safeLimit, offset],
    );

    return {
        page: safePage,
        limit: safeLimit,
        total: totalResult.rows[0]?.total || 0,
        rows: dataResult.rows,
    };
}
