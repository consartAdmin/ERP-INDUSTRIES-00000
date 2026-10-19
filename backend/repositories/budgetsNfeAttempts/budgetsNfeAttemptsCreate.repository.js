// ╔══════════════════════════════════════════════════════════════════════╗
// ║ budgetsNfeAttemptsCreate.repository.js — create                      ║
// ║ Cria a tentativa de NF-e e seus itens em transação                   ║
// ╚══════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import {
  TB_ATTEMPTS,
  TB_ITEMS,
  TB_BUDGETS,
  TB_SHIPPING,
  ATTEMPT_WRITABLE,
  ITEM_WRITABLE,
  BUDGETS_NFE_ATTEMPTS_INSERT_COLUMNS,
  BUDGETS_NFE_ATTEMPT_ITEMS_INSERT_COLUMNS,
} from './budgetsNfeAttempts.constants.js';
import {
  toId,
  pickWritable,
} from './budgetsNfeAttempts.sanitizers.js';
import {
  saoPauloDate,
} from './budgetsNfeAttempts.utils.js';
import {
  buildInsert,
} from './budgetsNfeAttempts.sql.js';
import {
  resolveStatus,
  getByIdWithClient,
} from './budgetsNfeAttemptsLookup.repository.js';

export async function create(
    { header = {}, items = [], status_code } = {},
    ctx = {},
) {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const budgetId = toId(header.budget_id, 'budget_id');

        const budget = await client.query(
            `
                SELECT
                    b.*,
                    COALESCE(bs.freight_value, 0) AS resolved_freight_value
                FROM ${TB_BUDGETS} b
                LEFT JOIN ${TB_SHIPPING} bs
                  ON bs.budget_shipping_id = b.budget_shipping_id
                WHERE b.budget_id = $1
                FOR UPDATE OF b
            `,
            [budgetId],
        );

        if (!budget.rowCount) {
            const error = new Error('Orçamento não encontrado.');
            error.status = 404;
            error.code = 'BUDGET_NOT_FOUND';
            throw error;
        }

        const source = budget.rows[0];

        const status = await resolveStatus(client, {
            nfe_status_id: header.nfe_status_id,
            status_code: status_code || header.status_code || 'PENDING',
        });

        // The budget row is already locked above, so attempts for the same
        // budget are serialized and the unique (budget_id, attempt_number)
        // constraint remains protected against concurrent creation.
        const numberResult = await client.query(
            `
                SELECT COALESCE(MAX(attempt_number), 0) + 1 AS next_number
                FROM ${TB_ATTEMPTS}
                WHERE budget_id = $1
            `,
            [budgetId],
        );

        const data = pickWritable(header, ATTEMPT_WRITABLE);

        Object.assign(data, {
            budget_id: budgetId,
            attempt_number: Number(numberResult.rows[0].next_number),
            nfe_status_id: status.nfe_status_id,

            operation_type_id:
                data.operation_type_id ?? source.operation_type_id,

            customer_id:
                data.customer_id ?? source.customer_id,

            customer_name:
                data.customer_name ?? source.customer_name,

            customer_tax_id:
                data.customer_tax_id ?? source.customer_tax_id,

            customer_email:
                data.customer_email ?? source.customer_email,

            customer_phone:
                data.customer_phone ?? source.customer_phone,

            issue_date: saoPauloDate(),

            subtotal:
                data.subtotal ?? Number(source.subtotal || 0),

            discount_total:
                data.discount_total ?? Number(source.total_discount || 0),

            freight_value:
                data.freight_value ??
                Number(source.resolved_freight_value || 0),

            total_amount:
                data.total_amount ?? Number(source.total_amount || 0),

            requested_by:
                data.requested_by ?? ctx.userId ?? null,
        });

        const allowedAttemptInsert = new Set(
            BUDGETS_NFE_ATTEMPTS_INSERT_COLUMNS,
        );

        const insertData = Object.fromEntries(
            Object.entries(data).filter(
                ([column]) => allowedAttemptInsert.has(column),
            ),
        );

        const inserted = await client.query(
            buildInsert(TB_ATTEMPTS, insertData),
        );

        const attempt = inserted.rows[0];

        if (!Array.isArray(items)) {
            const error = new Error('items deve ser um array.');
            error.status = 400;
            error.code = 'INVALID_ITEMS';
            throw error;
        }

        for (let index = 0; index < items.length; index += 1) {
            const raw = items[index] || {};
            const item = pickWritable(raw, ITEM_WRITABLE);

            item.attempt_id = attempt.attempt_id;
            item.item_number = Number(item.item_number || index + 1);
            item.product_code = String(item.product_code || '').trim();
            item.description = String(item.description || '').trim();

            if (
                !Number.isSafeInteger(item.item_number) ||
                item.item_number <= 0
            ) {
                const error = new Error(
                    `Item ${index + 1}: item_number inválido.`,
                );
                error.status = 400;
                error.code = 'INVALID_ATTEMPT_ITEM_NUMBER';
                throw error;
            }

            if (!item.product_code || !item.description) {
                const error = new Error(
                    `Item ${index + 1}: product_code e description são obrigatórios.`,
                );
                error.status = 400;
                error.code = 'INVALID_ATTEMPT_ITEM';
                throw error;
            }

            const allowedItemInsert = new Set(
                BUDGETS_NFE_ATTEMPT_ITEMS_INSERT_COLUMNS,
            );

            const insertItem = Object.fromEntries(
                Object.entries(item).filter(
                    ([column]) => allowedItemInsert.has(column),
                ),
            );

            await client.query(
                buildInsert(
                    TB_ITEMS,
                    insertItem,
                    'attempt_item_id',
                ),
            );
        }

        const result = await getByIdWithClient(
            client,
            attempt.attempt_id,
        );

        await client.query('COMMIT');

        return result;
    } catch (error) {
        try {
            await client.query('ROLLBACK');
        } catch {
            // Preserve the original error.
        }

        throw error;
    } finally {
        client.release();
    }
}
