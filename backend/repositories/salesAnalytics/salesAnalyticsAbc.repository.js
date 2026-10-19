// ╔════════════════════════════════════════════════════════════════════╗
// ║ salesAnalyticsAbc.repository.js — Curva ABC                        ║
// ║ loadAbcProducts / loadAbcCustomers                                 ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import {
  TB_INVOICES,
  TB_ORDERS,
  TB_ORDER_ITEMS,
  TB_BUDGETS,
  TB_BUDGET_ITEMS,
  TB_PRODUCTS,
  TB_PRODUCT_GROUPS,
  TB_CUSTOMERS,
  NFE_EXCLUDED_STATUSES,
} from './salesAnalytics.constants.js';
import { toNumber } from './salesAnalytics.utils.js';

// ======================================================================
// CURVA ABC — PRODUCTS
// ======================================================================

export async function loadAbcProducts({
    state,
    category,
    startDate,
    endDate,
}) {
    const sql = `
        WITH valid_invoices AS (
            SELECT
                ii.invoice_id,
                ii.order_id,
                ii.budget_id

            FROM ${TB_INVOICES} ii

            WHERE
                ii.issued_date IS NOT NULL
                AND ii.issued_date >= $4::date
                AND ii.issued_date < ($5::date + INTERVAL '1 day')
                AND ii.cancelled_at IS NULL
                AND UPPER(COALESCE(ii.nfe_status, ''))
                    <> ALL($1::text[])
        ),

        invoice_items AS (
            SELECT
                vi.invoice_id,
                o.customer_id,
                oi.product_code AS product_code,
                oi.description,
                COALESCE(oi.quantity, 0)::numeric AS quantity,
                COALESCE(oi.unit_price, 0)::numeric AS unit_price,
                COALESCE(oi.discount_value, 0)::numeric AS discount_value

            FROM valid_invoices vi
            JOIN ${TB_ORDERS} o ON o.order_id = vi.order_id
            JOIN ${TB_ORDER_ITEMS} oi ON oi.order_id = vi.order_id

            WHERE vi.order_id IS NOT NULL

            UNION ALL

            SELECT
                vi.invoice_id,
                b.customer_id,
                bi.product_code,
                bi.description,
                COALESCE(bi.quantity, 0)::numeric AS quantity,
                COALESCE(bi.unit_price, 0)::numeric AS unit_price,
                COALESCE(bi.discount_value, 0)::numeric AS discount_value

            FROM valid_invoices vi
            JOIN ${TB_BUDGETS} b ON b.budget_id = vi.budget_id
            JOIN ${TB_BUDGET_ITEMS} bi ON bi.budget_id = vi.budget_id

            WHERE vi.budget_id IS NOT NULL
        ),

        product_sales AS (
            SELECT
                CONCAT_WS(
                    ' - ',
                    NULLIF(TRIM(p.manufacturer_ref), ''),
                    COALESCE(
                        NULLIF(TRIM(si.description), ''),
                        NULLIF(TRIM(si.product_code), ''),
                        'SEM PRODUTO'
                    )
                ) AS label,

                COALESCE(
                    SUM(
                        (si.quantity * si.unit_price)
                        - si.discount_value
                    ),
                    0
                )::numeric AS value

            FROM invoice_items si

            LEFT JOIN ${TB_CUSTOMERS} c
                ON c.customer_id = si.customer_id

            LEFT JOIN ${TB_PRODUCTS} p
                ON p.product_code = si.product_code

            LEFT JOIN ${TB_PRODUCT_GROUPS} pg
                ON pg.product_group_id = p.product_group_id

            WHERE
                (
                    $2::text = ''
                    OR UPPER(COALESCE(c.state, '')) = $2
                )
                AND (
                    $3::text = ''
                    OR LOWER(COALESCE(pg.name::text, '')) = LOWER($3)
                )

            GROUP BY
                si.product_code,
                si.description,
                p.manufacturer_ref
        ),

        ranked AS (
            SELECT
                label,
                value,
                COALESCE(
                    value / NULLIF(SUM(value) OVER (), 0) * 100,
                    0
                ) AS percentage,
                COALESCE(
                    SUM(value) OVER (
                        ORDER BY value DESC, label ASC
                        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
                    ) / NULLIF(SUM(value) OVER (), 0) * 100,
                    0
                ) AS accumulated
            FROM product_sales
            WHERE value > 0
        )

        SELECT
            label,
            value,
            percentage,
            accumulated,
            CASE
                WHEN accumulated <= 80 THEN 'A'
                WHEN accumulated <= 95 THEN 'B'
                ELSE 'C'
            END AS class
        FROM ranked
        ORDER BY value DESC, label ASC
    `;

    const { rows } = await pool.query(sql, [
        NFE_EXCLUDED_STATUSES,
        state,
        category,
        startDate,
        endDate,
    ]);

    return rows.map((row) => ({
        label: String(row.label || 'SEM PRODUTO'),
        value: toNumber(row.value),
        percentage: toNumber(row.percentage),
        accumulated: toNumber(row.accumulated),
        class: String(row.class || '').toUpperCase(),
    }));
}


// ======================================================================
// CURVA ABC — CUSTOMERS
// ======================================================================

export async function loadAbcCustomers({
    state,
    category,
    startDate,
    endDate,
}) {
    const sql = `
        WITH invoice_base AS (
            SELECT
                ii.invoice_id,
                ii.order_id,
                ii.budget_id,
                COALESCE(
                    o.customer_id,
                    b.customer_id
                ) AS customer_id,
                COALESCE(
                    COALESCE(o.customer_id, b.customer_id)::text,
                    NULLIF(TRIM(ii.customer_tax_id), ''),
                    'INVOICE-' || ii.invoice_id::text
                ) AS customer_key,
                COALESCE(
                    NULLIF(TRIM(ii.customer_name), ''),
                    NULLIF(TRIM(c.legal_name), ''),
                    NULLIF(TRIM(c.trade_name), ''),
                    'CLIENTE NÃO INFORMADO'
                ) AS label,
                COALESCE(ii.total_amount, 0)::numeric AS total_amount

            FROM ${TB_INVOICES} ii

            LEFT JOIN ${TB_ORDERS} o
                ON o.order_id = ii.order_id

            LEFT JOIN ${TB_BUDGETS} b
                ON b.budget_id = ii.budget_id

            LEFT JOIN ${TB_CUSTOMERS} c
                ON c.customer_id = COALESCE(o.customer_id, b.customer_id)

            WHERE
                ii.issued_date IS NOT NULL
                AND ii.issued_date >= $4::date
                AND ii.issued_date < ($5::date + INTERVAL '1 day')
                AND ii.cancelled_at IS NULL
                AND UPPER(COALESCE(ii.nfe_status, ''))
                    <> ALL($1::text[])
                AND (
                    $2::text = ''
                    OR UPPER(COALESCE(c.state, '')) = $2
                )
        ),

        invoice_items AS (
            SELECT
                ib.invoice_id,
                oi.product_code AS product_code,
                COALESCE(oi.quantity, 0)::numeric AS quantity,
                COALESCE(oi.unit_price, 0)::numeric AS unit_price,
                COALESCE(oi.discount_value, 0)::numeric AS discount_value

            FROM invoice_base ib
            JOIN ${TB_ORDER_ITEMS} oi ON oi.order_id = ib.order_id

            WHERE ib.order_id IS NOT NULL

            UNION ALL

            SELECT
                ib.invoice_id,
                bi.product_code,
                COALESCE(bi.quantity, 0)::numeric AS quantity,
                COALESCE(bi.unit_price, 0)::numeric AS unit_price,
                COALESCE(bi.discount_value, 0)::numeric AS discount_value

            FROM invoice_base ib
            JOIN ${TB_BUDGET_ITEMS} bi ON bi.budget_id = ib.budget_id

            WHERE ib.budget_id IS NOT NULL
        ),

        customer_invoice_values AS (
            SELECT
                ib.invoice_id,
                ib.customer_key,
                ib.label,
                ib.total_amount AS value

            FROM invoice_base ib

            WHERE $3::text = ''

            UNION ALL

            SELECT
                ib.invoice_id,
                ib.customer_key,
                ib.label,
                COALESCE(
                    SUM((items.quantity * items.unit_price) - items.discount_value),
                    0
                )::numeric AS value

            FROM invoice_base ib
            JOIN invoice_items items ON items.invoice_id = ib.invoice_id
            LEFT JOIN ${TB_PRODUCTS} p ON p.product_code = items.product_code
            LEFT JOIN ${TB_PRODUCT_GROUPS} pg
                ON pg.product_group_id = p.product_group_id

            WHERE
                $3::text <> ''
                AND LOWER(COALESCE(pg.name::text, '')) = LOWER($3)

            GROUP BY
                ib.invoice_id,
                ib.customer_key,
                ib.label
        ),

        customer_sales AS (
            SELECT
                customer_key,
                label,
                COALESCE(SUM(value), 0)::numeric AS value

            FROM customer_invoice_values

            GROUP BY customer_key, label
        ),

        ranked AS (
            SELECT
                label,
                value,
                COALESCE(
                    value / NULLIF(SUM(value) OVER (), 0) * 100,
                    0
                ) AS percentage,
                COALESCE(
                    SUM(value) OVER (
                        ORDER BY value DESC, label ASC
                        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
                    ) / NULLIF(SUM(value) OVER (), 0) * 100,
                    0
                ) AS accumulated
            FROM customer_sales
            WHERE value > 0
        )

        SELECT
            label,
            value,
            percentage,
            accumulated,
            CASE
                WHEN accumulated <= 80 THEN 'A'
                WHEN accumulated <= 95 THEN 'B'
                ELSE 'C'
            END AS class
        FROM ranked
        ORDER BY value DESC, label ASC
    `;

    const { rows } = await pool.query(sql, [
        NFE_EXCLUDED_STATUSES,
        state,
        category,
        startDate,
        endDate,
    ]);

    return rows.map((row) => ({
        label: String(row.label || 'SEM CLIENTE'),
        value: toNumber(row.value),
        percentage: toNumber(row.percentage),
        accumulated: toNumber(row.accumulated),
        class: String(row.class || '').toUpperCase(),
    }));
}


