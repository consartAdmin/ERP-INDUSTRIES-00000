// ╔════════════════════════════════════════════════════════════════════╗
// ║ salesCommissionsFromInvoicesGenerate.repository.js                 ║
// ║ generateSalesCommissionsFromInvoices — NF-e → comissões            ║
// ║                                                                    ║
// ║ Fonte: tentativas de NF-e AUTORIZADAS (nfe_status_id = 3), em      ║
// ║ produção, com invoice_id e NF-e não cancelada:                     ║
// ║   • budgetsNfeAttempts + budgetsNfeAttemptItems  (orçamentos)      ║
// ║   • ordersNfeAttempts  + ordersNfeAttemptItems   (pedidos)         ║
// ║ Cada item de origem gera uma linha, chave (source_type,            ║
// ║ source_item_id) = ('BUDGET', budget_item_id) ou ('ORDER',          ║
// ║ order_item_id). Rodar de novo atualiza, não duplica.               ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import {
  TB_SCI,
  TB_INVOICES,
  TB_ORDERS,
  TB_ORDER_ITEMS,
  TB_PRICES,
  TB_SELLERS,
  TB_BUDGETS,
  TB_SELLER_BY_BUDGETS,
  TB_BUDGET_ITEMS,
  TB_BUDGETS_NFE_ATTEMPTS,
  TB_BUDGETS_NFE_ATTEMPT_ITEMS,
  TB_ORDERS_NFE_ATTEMPTS,
  TB_ORDERS_NFE_ATTEMPT_ITEMS,
  NFE_STATUS_AUTHORIZED_ID,
  DEFAULT_PRICE_ID,
} from './salesCommissionsFromInvoices.constants.js';

// ──────────────────────────────────────────────────────────────────────
// Estrutura: chave por item de origem (orçamento ou pedido)
// ──────────────────────────────────────────────────────────────────────
let ensured = null;

export function ensureSalesCommissionsSourceColumns() {
    if (!ensured) {
        ensured = (async () => {
            await pool.query(`
                ALTER TABLE ${TB_SCI}
                    ADD COLUMN IF NOT EXISTS source_type varchar(10),
                    ADD COLUMN IF NOT EXISTS source_item_id bigint,
                    ADD COLUMN IF NOT EXISTS budget_id bigint
            `);

            // Itens de orçamento não têm pedido
            await pool.query(`ALTER TABLE ${TB_SCI} ALTER COLUMN order_id DROP NOT NULL`);
            await pool.query(`ALTER TABLE ${TB_SCI} ALTER COLUMN order_item_id DROP NOT NULL`);

            // Linhas antigas (geradas por pedido)
            await pool.query(`
                UPDATE ${TB_SCI}
                   SET source_type = 'ORDER',
                       source_item_id = order_item_id
                 WHERE source_type IS NULL
                   AND order_item_id IS NOT NULL
            `);

            await pool.query(`
                CREATE UNIQUE INDEX IF NOT EXISTS ux_sci_source_item
                    ON ${TB_SCI} (source_type, source_item_id)
            `);
        })().catch((err) => {
            ensured = null;
            throw err;
        });
    }

    return ensured;
}

// Tentativa autorizada, em produção, com NF-e não cancelada
function authorizedAttemptsWhere(alias) {
    return `
        ${alias}.nfe_status_id = ${NFE_STATUS_AUTHORIZED_ID}
        AND ${alias}.invoice_id IS NOT NULL
        AND COALESCE(${alias}.nfe_environment, '') NOT ILIKE 'homolog%'
    `;
}

export async function generateSalesCommissionsFromInvoices({
    dateStart = null,
    dateEnd = null,
    forceRegenerate = false,
} = {}) {
    await ensureSalesCommissionsSourceColumns();

    if (forceRegenerate) {
        await pool.query(`DELETE FROM ${TB_SCI}`);
    }

    const sql = `
        WITH budget_rows AS (
            SELECT
                'BUDGET'::varchar(10)               AS source_type,
                ai.budget_item_id                   AS source_item_id,
                a.invoice_id,
                NULL::bigint                        AS order_id,
                NULL::bigint                        AS order_item_id,
                a.budget_id,
                COALESCE(a.issue_date::date, a.authorized_at::date, ii.issued_date) AS issue_date,

                COALESCE(
                    sb.seller_id,
                    NULLIF(regexp_replace(b.seller_id::text, '[^0-9]', '', 'g'), '')::int
                ) AS seller_id,

                ai.product_code,

                COALESCE(
                    bi.price_id,
                    NULLIF(regexp_replace(b.price_id::text, '[^0-9]', '', 'g'), '')::int,
                    $3::int
                ) AS price_id,

                COALESCE(ai.quantity, 0)::numeric AS quantity,

                COALESCE(
                    ai.gross_total,
                    COALESCE(ai.quantity, 0) * COALESCE(ai.unit_price, 0)
                ) - COALESCE(ai.discount_amount, 0) AS item_total,

                COALESCE(NULLIF(a.customer_name, ''), NULLIF(b.customer_name::text, ''), '') AS customer_name,
                a.attempt_id

            FROM ${TB_BUDGETS_NFE_ATTEMPTS} a

            JOIN ${TB_BUDGETS_NFE_ATTEMPT_ITEMS} ai
                ON ai.attempt_id = a.attempt_id

            LEFT JOIN ${TB_INVOICES} ii
                ON ii.invoice_id = a.invoice_id

            LEFT JOIN ${TB_BUDGETS} b
                ON b.budget_id = a.budget_id

            LEFT JOIN ${TB_BUDGET_ITEMS} bi
                ON bi.budget_item_id = ai.budget_item_id

            LEFT JOIN LATERAL (
                SELECT
                    NULLIF(regexp_replace(sb2.seller_id::text, '[^0-9]', '', 'g'), '')::int AS seller_id
                FROM ${TB_SELLER_BY_BUDGETS} sb2
                WHERE sb2.budget_id = a.budget_id
                  AND COALESCE(sb2.active, true) = true
                ORDER BY sb2.seller_id
                LIMIT 1
            ) sb ON true

            WHERE ${authorizedAttemptsWhere('a')}
              AND ai.budget_item_id IS NOT NULL
              AND ii.cancelled_at IS NULL
        ),

        order_rows AS (
            SELECT
                'ORDER'::varchar(10)                AS source_type,
                ai.order_item_id                    AS source_item_id,
                a.invoice_id,
                a.order_id,
                ai.order_item_id,
                COALESCE(a.budget_id, o.budget_id)  AS budget_id,
                COALESCE(a.issue_date::date, a.authorized_at::date, ii.issued_date) AS issue_date,

                COALESCE(
                    sb.seller_id,
                    NULLIF(regexp_replace(b.seller_id::text, '[^0-9]', '', 'g'), '')::int,
                    NULLIF(regexp_replace(o.seller_id::text, '[^0-9]', '', 'g'), '')::int
                ) AS seller_id,

                ai.product_code,

                COALESCE(
                    oi.price_id,
                    o.price_id,
                    $3::int
                ) AS price_id,

                COALESCE(ai.quantity, 0)::numeric AS quantity,

                COALESCE(
                    ai.gross_total,
                    COALESCE(ai.quantity, 0) * COALESCE(ai.unit_price, 0)
                ) - COALESCE(ai.discount_amount, 0) AS item_total,

                COALESCE(NULLIF(a.customer_name, ''), NULLIF(o.customer_name, ''), '') AS customer_name,
                a.attempt_id

            FROM ${TB_ORDERS_NFE_ATTEMPTS} a

            JOIN ${TB_ORDERS_NFE_ATTEMPT_ITEMS} ai
                ON ai.attempt_id = a.attempt_id

            LEFT JOIN ${TB_INVOICES} ii
                ON ii.invoice_id = a.invoice_id

            LEFT JOIN ${TB_ORDERS} o
                ON o.order_id = a.order_id

            LEFT JOIN ${TB_ORDER_ITEMS} oi
                ON oi.order_item_id = ai.order_item_id

            LEFT JOIN ${TB_BUDGETS} b
                ON b.budget_id = COALESCE(a.budget_id, o.budget_id)

            LEFT JOIN LATERAL (
                SELECT
                    NULLIF(regexp_replace(sb2.seller_id::text, '[^0-9]', '', 'g'), '')::int AS seller_id
                FROM ${TB_SELLER_BY_BUDGETS} sb2
                WHERE sb2.budget_id = COALESCE(a.budget_id, o.budget_id)
                  AND COALESCE(sb2.active, true) = true
                ORDER BY sb2.seller_id
                LIMIT 1
            ) sb ON true

            WHERE ${authorizedAttemptsWhere('a')}
              AND ai.order_item_id IS NOT NULL
              AND ii.cancelled_at IS NULL
        ),

        source_rows AS (
            /*
             * Um item entra uma vez só, mesmo que tenha mais de uma
             * tentativa autorizada (fica a mais recente).
             */
            SELECT DISTINCT ON (u.source_type, u.source_item_id)
                u.*
            FROM (
                SELECT * FROM budget_rows
                UNION ALL
                SELECT * FROM order_rows
            ) u
            WHERE u.issue_date IS NOT NULL
              AND ($1::date IS NULL OR u.issue_date >= $1::date)
              AND ($2::date IS NULL OR u.issue_date <= $2::date)
            ORDER BY u.source_type, u.source_item_id, u.issue_date DESC, u.attempt_id DESC
        )

        INSERT INTO ${TB_SCI} (
            source_type,
            source_item_id,
            invoice_id,
            order_id,
            order_item_id,
            budget_id,
            issue_date,
            seller_id,
            seller_name,
            product_id,
            product_code,
            sku,
            price_id,
            price_table_name,
            quantity,
            item_total,
            customer_name,
            created_at,
            updated_at
        )
        SELECT
            sr.source_type,
            sr.source_item_id,
            sr.invoice_id,
            sr.order_id,
            sr.order_item_id,
            sr.budget_id,
            sr.issue_date,
            sr.seller_id,
            COALESCE(s.name, 'SEM VENDEDOR'),
            LEFT(COALESCE(sr.product_code::text, ''), 20),
            LEFT(COALESCE(sr.product_code::text, ''), 40),
            sr.product_code,
            sr.price_id,
            COALESCE(p.name, 'VAREJO'),
            sr.quantity,
            sr.item_total,
            sr.customer_name,
            NOW(),
            NOW()
        FROM source_rows sr
        LEFT JOIN ${TB_SELLERS} s
            ON s.id = sr.seller_id
        LEFT JOIN ${TB_PRICES} p
            ON p.price_id = sr.price_id
        ON CONFLICT (source_type, source_item_id)
        DO UPDATE SET
            invoice_id        = EXCLUDED.invoice_id,
            order_id          = EXCLUDED.order_id,
            order_item_id     = EXCLUDED.order_item_id,
            budget_id         = EXCLUDED.budget_id,
            issue_date        = EXCLUDED.issue_date,
            seller_id         = EXCLUDED.seller_id,
            seller_name       = EXCLUDED.seller_name,
            product_id        = EXCLUDED.product_id,
            product_code      = EXCLUDED.product_code,
            sku               = EXCLUDED.sku,
            price_id          = EXCLUDED.price_id,
            price_table_name  = EXCLUDED.price_table_name,
            quantity          = EXCLUDED.quantity,
            item_total        = EXCLUDED.item_total,
            customer_name     = EXCLUDED.customer_name,
            updated_at        = NOW()
    `;

    const res = await pool.query(sql, [
        dateStart,
        dateEnd,
        DEFAULT_PRICE_ID,
    ]);

    return {
        ok: true,
        inserted: res.rowCount || 0,
    };
}
