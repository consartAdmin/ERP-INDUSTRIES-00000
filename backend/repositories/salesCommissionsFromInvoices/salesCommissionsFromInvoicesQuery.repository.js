// ╔════════════════════════════════════════════════════════════════════╗
// ║ salesCommissionsFromInvoicesQuery.repository.js                    ║
// ║ diagnostics / list — public."salesCommissionsFromInvoices"         ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB_SCI } from './salesCommissionsFromInvoices.constants.js';
import { clampInt } from './salesCommissionsFromInvoices.utils.js';

export async function diagnosticsSalesCommissionsFromInvoices({
    dateStart = null,
    dateEnd = null,
    salesperson = null,
    priceId = null,
} = {}) {
    const { rows } = await pool.query(`
        SELECT
            COUNT(*)::int AS total,
            SUM((seller_id IS NULL)::int)::int AS sem_seller_id,
            SUM((price_id IS NULL)::int)::int AS sem_price_id,
            SUM((issue_date IS NULL)::int)::int AS sem_issue_date,
            SUM((commission_id IS NULL)::int)::int AS sem_commission_id,
            COALESCE(SUM(item_total), 0)::numeric(14,2) AS total_faturado,
            COALESCE(SUM(item_commission), 0)::numeric(14,2) AS total_comissao
        FROM ${TB_SCI}
        WHERE 1=1
          AND ($1::date IS NULL OR issue_date >= $1::date)
          AND ($2::date IS NULL OR issue_date <= $2::date)
          AND (
                $3::text IS NULL
                OR CAST(seller_id AS text) = $3::text
                OR LOWER(COALESCE(seller_name, '')) LIKE LOWER('%' || $3::text || '%')
          )
          AND ($4::int IS NULL OR price_id = $4::int)
    `, [
        dateStart,
        dateEnd,
        salesperson,
        priceId,
    ]);

    return {
        ok: true,
        ...(rows[0] || {}),
    };
}

export async function listSalesCommissionsFromInvoices({
    dateStart = null,
    dateEnd = null,
    salesperson = null,
    priceId = null,
    limit = 500,
    offset = 0,
} = {}) {
    const lim = clampInt(limit, 500, 1, 5000);
    const off = clampInt(offset, 0, 0, 10000000);

    const sql = `
        WITH filtered AS (
            SELECT
                sci.*
            FROM ${TB_SCI} sci
            WHERE 1=1
              AND ($1::date IS NULL OR sci.issue_date >= $1::date)
              AND ($2::date IS NULL OR sci.issue_date <= $2::date)
              AND (
                    $3::text IS NULL
                    OR CAST(sci.seller_id AS text) = $3::text
                    OR LOWER(COALESCE(sci.seller_name, '')) LIKE LOWER('%' || $3::text || '%')
              )
              AND ($4::int IS NULL OR sci.price_id = $4::int)
        ),
        counted AS (
            SELECT COUNT(*)::bigint AS total
            FROM filtered
        )
        SELECT
            (SELECT total FROM counted) AS total,
            COALESCE(
                json_agg(
                    x
                    ORDER BY
                        x.issue_date DESC,
                        x.invoice_id DESC,
                        x.order_id DESC,
                        x.order_item_id DESC
                ),
                '[]'::json
            ) AS rows
        FROM (
            SELECT *
            FROM filtered
            ORDER BY
                issue_date DESC,
                invoice_id DESC,
                order_id DESC,
                order_item_id DESC
            LIMIT $5::int
            OFFSET $6::int
        ) x
    `;

    const { rows } = await pool.query(sql, [
        dateStart,
        dateEnd,
        salesperson,
        priceId,
        lim,
        off,
    ]);

    const out = rows?.[0] || {
        total: 0,
        rows: [],
    };

    return {
        ok: true,
        total: Number(out.total || 0),
        rows: out.rows || [],
    };
}

