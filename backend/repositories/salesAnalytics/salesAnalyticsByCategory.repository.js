// ╔════════════════════════════════════════════════════════════════════╗
// ║ salesAnalyticsByCategory.repository.js — loadSalesByCategory       ║
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
// SALES BY CATEGORY
// ======================================================================

export async function loadSalesByCategory({
    state,
    category,
    startDate,
    endDate,
}) {

    const sql = `
        SELECT

            COALESCE(
                pg.name::text,
                'SEM CATEGORIA'
            ) AS label,

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
            pg.product_group_id,
            pg.name


        ORDER BY
            value DESC,
            label ASC
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

            label:
                String(
                    row.label ||
                    'SEM CATEGORIA'
                ),

            value:
                toNumber(
                    row.value
                ),
        })
    );
}


