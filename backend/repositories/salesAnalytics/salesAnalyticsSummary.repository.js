// ╔════════════════════════════════════════════════════════════════════╗
// ║ salesAnalyticsSummary.repository.js — loadSummary                  ║
// ║ Receita, unidades, notas, ticket médio, produto top                ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import {
  TB_INVOICES,
  TB_ORDERS,
  TB_ORDER_ITEMS,
  TB_BUDGET_ITEMS,
  TB_PRODUCTS,
  TB_PRODUCT_GROUPS,
  TB_CUSTOMERS,
  NFE_EXCLUDED_STATUSES,
} from './salesAnalytics.constants.js';
import { toNumber } from './salesAnalytics.utils.js';

// ======================================================================
// SUMMARY
// ======================================================================

export async function loadSummary({
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
                ii.budget_id,
                ii.issued_date,
                COALESCE(ii.total_amount, 0)::numeric AS total_amount

            FROM ${TB_INVOICES} ii

            LEFT JOIN ${TB_ORDERS} o
                ON o.order_id = ii.order_id

            LEFT JOIN ${TB_CUSTOMERS} c
                ON c.customer_id = o.customer_id

            WHERE
                ii.issued_date IS NOT NULL

                AND ii.issued_date >= $4::date
                AND ii.issued_date < ($5::date + INTERVAL '1 day')

                AND ii.cancelled_at IS NULL

                AND UPPER(
                    COALESCE(
                        ii.nfe_status,
                        ''
                    )
                ) <> ALL($1::text[])

                AND (
                    $2::text = ''
                    OR UPPER(
                        COALESCE(
                            c.state,
                            ''
                        )
                    ) = $2
                )
        ),


        invoice_items AS (

            SELECT
                vi.invoice_id,
                vi.order_id,
                vi.budget_id,
                vi.issued_date,
                oi.product_code AS product_code,
                oi.description,
                COALESCE(oi.quantity, 0)::numeric AS quantity,
                COALESCE(oi.unit_price, 0)::numeric AS unit_price,
                COALESCE(oi.discount_value, 0)::numeric AS discount_value

            FROM valid_invoices vi

            JOIN ${TB_ORDER_ITEMS} oi
                ON oi.order_id = vi.order_id

            WHERE vi.order_id IS NOT NULL

            UNION ALL

            SELECT
                vi.invoice_id,
                vi.order_id,
                vi.budget_id,
                vi.issued_date,
                bi.product_code,
                bi.description,
                COALESCE(bi.quantity, 0)::numeric AS quantity,
                COALESCE(bi.unit_price, 0)::numeric AS unit_price,
                COALESCE(bi.discount_value, 0)::numeric AS discount_value

            FROM valid_invoices vi

            JOIN ${TB_BUDGET_ITEMS} bi
                ON bi.budget_id = vi.budget_id

            WHERE vi.budget_id IS NOT NULL
        ),


        filtered_items AS (

            SELECT
                vi.invoice_id,
                vi.order_id,
                vi.issued_date,

                si.product_code AS sku,
                si.description,

                COALESCE(
                    si.quantity,
                    0
                )::numeric AS quantity,

                COALESCE(
                    si.unit_price,
                    0
                )::numeric AS unit_price,

                COALESCE(
                    si.discount_value,
                    0
                )::numeric AS discount_value,

                (
                    COALESCE(
                        si.quantity,
                        0
                    )
                    *
                    COALESCE(
                        si.unit_price,
                        0
                    )
                    -
                    COALESCE(
                        si.discount_value,
                        0
                    )
                )::numeric AS item_total,

                p.product_id,
                p.product_code,
                p.product_group_id,

                COALESCE(
                    pg.name::text,
                    'SEM CATEGORIA'
                ) AS category_name

            FROM valid_invoices vi

            JOIN invoice_items si
                ON si.invoice_id = vi.invoice_id

            LEFT JOIN ${TB_PRODUCTS} p
                ON p.product_code = si.product_code

            LEFT JOIN ${TB_PRODUCT_GROUPS} pg
                ON pg.product_group_id =
                   p.product_group_id

            WHERE
                (
                    $3::text = ''

                    OR LOWER(
                        COALESCE(
                            pg.name::text,
                            ''
                        )
                    ) = LOWER($3)
                )
        ),


        selected_invoices AS (

            SELECT DISTINCT
                vi.invoice_id,
                vi.order_id,
                vi.total_amount

            FROM valid_invoices vi

            WHERE
                $3::text = ''

                OR EXISTS (

                    SELECT 1

                    FROM filtered_items fi

                    WHERE
                        fi.invoice_id =
                        vi.invoice_id
                )
        ),


        invoice_summary AS (

            SELECT
                COALESCE(
                    SUM(total_amount),
                    0
                )::numeric AS invoice_revenue,

                COUNT(*)::int AS total_orders

            FROM selected_invoices
        ),


        item_summary AS (

            SELECT
                COALESCE(
                    SUM(item_total),
                    0
                )::numeric AS item_revenue,

                COALESCE(
                    SUM(quantity),
                    0
                )::numeric AS total_units

            FROM filtered_items
        ),


        top_product AS (

            SELECT
                COALESCE(
                    NULLIF(
                        TRIM(fi.description),
                        ''
                    ),
                    fi.sku,
                    '—'
                ) AS product_name,

                COALESCE(
                    SUM(fi.item_total),
                    0
                )::numeric AS revenue

            FROM filtered_items fi

            GROUP BY
                fi.sku,
                fi.description

            ORDER BY
                revenue DESC,
                product_name ASC

            LIMIT 1
        )


        SELECT

            /*
             * Without a category filter we preserve the official
             * invoicesIssued.total_amount revenue.
             *
             * When filtering one category, only that category's
             * item totals can be used.
             */

            CASE

                WHEN $3::text = ''
                THEN COALESCE(
                    ins.invoice_revenue,
                    0
                )

                ELSE COALESCE(
                    its.item_revenue,
                    0
                )

            END AS total_revenue,


            COALESCE(
                its.total_units,
                0
            ) AS total_units,


            COALESCE(
                ins.total_orders,
                0
            ) AS total_orders,


            CASE

                WHEN COALESCE(
                    ins.total_orders,
                    0
                ) > 0

                THEN (

                    CASE

                        WHEN $3::text = ''
                        THEN COALESCE(
                            ins.invoice_revenue,
                            0
                        )

                        ELSE COALESCE(
                            its.item_revenue,
                            0
                        )

                    END

                    /

                    ins.total_orders

                )

                ELSE 0

            END AS average_ticket,


            COALESCE(
                tp.product_name,
                '—'
            ) AS top_product


        FROM invoice_summary ins

        CROSS JOIN item_summary its

        LEFT JOIN top_product tp
            ON TRUE
    `;


    const { rows } =
        await pool.query(
            sql,
            [
                NFE_EXCLUDED_STATUSES,
                state,
                category,
                startDate,
                endDate,
            ]
        );


    const row =
        rows[0] || {};


    return {

        totalRevenue:
            toNumber(
                row.total_revenue
            ),

        totalUnits:
            toNumber(
                row.total_units
            ),

        totalInvoices:
            Number(
                row.total_orders || 0
            ),

        // Backward compatibility
        totalOrders:
            Number(
                row.total_orders || 0
            ),

        averageTicket:
            toNumber(
                row.average_ticket
            ),

        topProduct:
            String(
                row.top_product ||
                '—'
            ),
    };
}


