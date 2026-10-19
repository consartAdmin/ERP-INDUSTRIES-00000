// ╔════════════════════════════════════════════════════════════════════╗
// ║ salesAnalyticsByMonth.repository.js — séries mensais               ║
// ║ loadSalesByMonth / loadQuantityByMonth                             ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import {
  TB_INVOICES,
  TB_ORDERS,
  TB_ORDER_ITEMS,
  TB_PRODUCTS,
  TB_PRODUCT_GROUPS,
  TB_CUSTOMERS,
  NFE_EXCLUDED_STATUSES,
} from './salesAnalytics.constants.js';
import { toNumber } from './salesAnalytics.utils.js';

// ======================================================================
// SALES BY MONTH
// ======================================================================

export async function loadSalesByMonth({
    state,
    category,
    startDate,
    endDate,
}) {

    /*
     * Creates all 12 months even when there are no sales.
     */

    const sql = `
        WITH months AS (

            SELECT
                generate_series(
                    1,
                    12
                )::int AS month_number
        ),


        valid_invoices AS (

            SELECT
                ii.invoice_id,
                ii.order_id,
                ii.issued_date,

                COALESCE(
                    ii.total_amount,
                    0
                )::numeric AS total_amount

            FROM ${TB_INVOICES} ii

            JOIN ${TB_ORDERS} o
                ON o.order_id =
                   ii.order_id

            LEFT JOIN ${TB_CUSTOMERS} c
                ON c.customer_id =
                   o.customer_id

            WHERE

                ii.order_id IS NOT NULL

                AND ii.issued_date IS NOT NULL

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


        invoice_monthly AS (

            SELECT

                EXTRACT(
                    MONTH FROM issued_date
                )::int AS month_number,

                COALESCE(
                    SUM(total_amount),
                    0
                )::numeric AS value

            FROM valid_invoices

            GROUP BY
                EXTRACT(
                    MONTH FROM issued_date
                )
        ),


        category_monthly AS (

            SELECT

                EXTRACT(
                    MONTH FROM vi.issued_date
                )::int AS month_number,

                COALESCE(
                    SUM(
                        (
                            COALESCE(
                                oi.quantity,
                                0
                            )
                            *
                            COALESCE(
                                oi.unit_price,
                                0
                            )
                        )
                        -
                        COALESCE(
                            oi.discount_value,
                            0
                        )
                    ),
                    0
                )::numeric AS value

            FROM valid_invoices vi

            JOIN ${TB_ORDER_ITEMS} oi
                ON oi.order_id =
                   vi.order_id

            LEFT JOIN ${TB_PRODUCTS} p
                ON p.product_code =
                   oi.product_code

            LEFT JOIN ${TB_PRODUCT_GROUPS} pg
                ON pg.product_group_id =
                   p.product_group_id

            WHERE

                $3::text <> ''

                AND LOWER(
                    COALESCE(
                        pg.name::text,
                        ''
                    )
                ) = LOWER($3)

            GROUP BY
                EXTRACT(
                    MONTH FROM vi.issued_date
                )
        )


        SELECT

            m.month_number,

            CASE m.month_number
                WHEN 1  THEN 'Jan'
                WHEN 2  THEN 'Fev'
                WHEN 3  THEN 'Mar'
                WHEN 4  THEN 'Abr'
                WHEN 5  THEN 'Mai'
                WHEN 6  THEN 'Jun'
                WHEN 7  THEN 'Jul'
                WHEN 8  THEN 'Ago'
                WHEN 9  THEN 'Set'
                WHEN 10 THEN 'Out'
                WHEN 11 THEN 'Nov'
                WHEN 12 THEN 'Dez'
            END AS month,

            CASE

                WHEN $3::text = ''

                THEN COALESCE(
                    im.value,
                    0
                )

                ELSE COALESCE(
                    cm.value,
                    0
                )

            END::numeric AS value


        FROM months m


        LEFT JOIN invoice_monthly im
            ON im.month_number =
               m.month_number


        LEFT JOIN category_monthly cm
            ON cm.month_number =
               m.month_number


        ORDER BY
            m.month_number
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


    return rows.map(
        (row) => ({

            month:
                String(
                    row.month ||
                    ''
                ),

            value:
                toNumber(
                    row.value
                ),
        })
    );
}


// ======================================================================
// QUANTITY SOLD BY MONTH
// ======================================================================

export async function loadQuantityByMonth({
    state,
    category,
    startDate,
    endDate,
}) {

    const sql = `
        WITH months AS (

            SELECT
                generate_series(
                    1,
                    12
                )::int AS month_number
        ),


        monthly_quantity AS (

            SELECT

                EXTRACT(
                    MONTH FROM ii.issued_date
                )::int AS month_number,

                COALESCE(
                    SUM(
                        oi.quantity
                    ),
                    0
                )::numeric AS quantity


            FROM ${TB_INVOICES} ii


            JOIN ${TB_ORDERS} o
                ON o.order_id =
                   ii.order_id


            LEFT JOIN ${TB_CUSTOMERS} c
                ON c.customer_id =
                   o.customer_id


            JOIN ${TB_ORDER_ITEMS} oi
                ON oi.order_id =
                   o.order_id


            LEFT JOIN ${TB_PRODUCTS} p
                ON p.product_code =
                   oi.product_code


            LEFT JOIN ${TB_PRODUCT_GROUPS} pg
                ON pg.product_group_id =
                   p.product_group_id


            WHERE

                ii.order_id IS NOT NULL

                AND ii.issued_date IS NOT NULL

                AND ii.issued_date >= $4::date
                AND ii.issued_date < ($5::date + INTERVAL '1 day')

                AND ii.cancelled_at IS NULL

                AND UPPER(
                    COALESCE(
                        ii.nfe_status,
                        ''
                    )
                ) <> ALL($1::text[])


                /* UF */

                AND (
                    $2::text = ''

                    OR UPPER(
                        COALESCE(
                            c.state,
                            ''
                        )
                    ) = $2
                )


                /* CATEGORY */

                AND (
                    $3::text = ''

                    OR LOWER(
                        COALESCE(
                            pg.name::text,
                            ''
                        )
                    ) = LOWER($3)
                )


            GROUP BY
                EXTRACT(
                    MONTH FROM ii.issued_date
                )
        )


        SELECT

            m.month_number,

            CASE m.month_number
                WHEN 1  THEN 'Jan'
                WHEN 2  THEN 'Fev'
                WHEN 3  THEN 'Mar'
                WHEN 4  THEN 'Abr'
                WHEN 5  THEN 'Mai'
                WHEN 6  THEN 'Jun'
                WHEN 7  THEN 'Jul'
                WHEN 8  THEN 'Ago'
                WHEN 9  THEN 'Set'
                WHEN 10 THEN 'Out'
                WHEN 11 THEN 'Nov'
                WHEN 12 THEN 'Dez'
            END AS month,

            COALESCE(
                mq.quantity,
                0
            )::numeric AS quantity


        FROM months m


        LEFT JOIN monthly_quantity mq
            ON mq.month_number =
               m.month_number


        ORDER BY
            m.month_number
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


    return rows.map(
        (row) => ({

            month:
                String(
                    row.month ||
                    ''
                ),

            quantity:
                toNumber(
                    row.quantity
                ),
        })
    );
}
