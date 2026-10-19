// ╔════════════════════════════════════════════════════════════════════╗
// ║ salesCommissionsFromInvoicesRecalc.repository.js                   ║
// ║ recalcSalesCommissionsFromInvoices — reaplica priceCommissions     ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB_SCI, TB_PC } from './salesCommissionsFromInvoices.constants.js';

export async function recalcSalesCommissionsFromInvoices({
    onlyMissing = true,
} = {}) {
    const whereMissing = onlyMissing
        ? `
            AND (
                sci.commission_id IS NULL
                OR sci.percent_value IS NULL
                OR sci.fixed_value IS NULL
                OR COALESCE(sci.item_commission, 0) = 0
            )
        `
        : '';

    const sql = `
        WITH pick_rule AS (
            SELECT
                sci.sales_commission_invoice_id,
                pc.commission_id,
                pc.commission_type,
                pc.percent_value,
                pc.fixed_value,

                CASE
                    WHEN pc.commission_type = 'PERCENT'
                        THEN ROUND((
                            COALESCE(sci.item_total, 0)
                            * COALESCE(pc.percent_value, 0)
                            / 100.0
                        )::numeric, 4)

                    WHEN pc.commission_type = 'FIXED'
                        THEN ROUND((
                            COALESCE(sci.quantity, 0)
                            * COALESCE(pc.fixed_value, 0)
                        )::numeric, 4)

                    ELSE 0
                END AS calc_item_commission

            FROM ${TB_SCI} sci

            LEFT JOIN LATERAL (
                SELECT
                    pc2.commission_id,
                    pc2.commission_type,
                    pc2.percent_value,
                    pc2.fixed_value
                FROM ${TB_PC} pc2
                WHERE pc2.active = true
                  AND pc2.price_id = sci.price_id
                  AND pc2.seller_id = sci.seller_id
                  AND pc2.valid_from <= sci.issue_date
                  AND (
                        pc2.valid_to IS NULL
                        OR pc2.valid_to >= sci.issue_date
                  )
                ORDER BY
                    pc2.valid_from DESC,
                    pc2.commission_id DESC
                LIMIT 1
            ) pc ON true

            WHERE sci.seller_id IS NOT NULL
              AND COALESCE(sci.price_id, 0) > 0
              AND sci.issue_date IS NOT NULL
              ${whereMissing}
              AND pc.commission_id IS NOT NULL
        )

        UPDATE ${TB_SCI} sci
           SET commission_id   = pr.commission_id,
               commission_type = pr.commission_type,
               percent_value   = pr.percent_value,
               fixed_value     = pr.fixed_value,
               item_commission = pr.calc_item_commission,
               updated_at      = NOW()
          FROM pick_rule pr
         WHERE pr.sales_commission_invoice_id = sci.sales_commission_invoice_id
    `;

    const res = await pool.query(sql);

    return {
        ok: true,
        updated: res.rowCount || 0,
    };
}

