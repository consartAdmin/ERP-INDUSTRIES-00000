// ╔══════════════════════════════════════════════════════════════════════╗
// ║ ordersNfeAttemptsCreate.repository.js — Criação de tentativas        ║
// ║ transaction / createAttempt / addItems / replaceItems                ║
// ╚══════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { ORDERS_NFE_ATTEMPTS_TABLE, ORDERS_NFE_ATTEMPT_ITEMS_TABLE } from './ordersNfeAttempts.catalog.js';
import { ATTEMPT_INSERT, ATTEMPT_JSON, ITEM_INSERT, ITEM_JSON } from './ordersNfeAttempts.constants.js';
import { positiveBigInt, positiveInteger } from './ordersNfeAttempts.sanitizers.js';
import { buildInsert } from './ordersNfeAttempts.sql.js';

export async function transaction(work) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await work(client);
        await client.query('COMMIT');
        return result;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

export async function ensureOrder(client, orderId) {
    const result = await client.query(
        `SELECT order_id FROM public.orders WHERE order_id = $1 FOR UPDATE`,
        [orderId],
    );
    if (result.rowCount === 0) {
        const error = new Error(`Pedido ${orderId} não encontrado.`);
        error.status = 404;
        throw error;
    }
}

export async function insertItems(client, attemptId, items = []) {
    const rows = [];

    for (let index = 0; index < items.length; index += 1) {
        const item = items[index] ?? {};
        const payload = {
            ...item,
            item_number: item.item_number ?? index + 1,
        };

        if (!String(payload.product_code ?? '').trim()) {
            const error = new Error(`Item ${index + 1}: product_code é obrigatório.`);
            error.status = 400;
            throw error;
        }
        if (!String(payload.description ?? '').trim()) {
            const error = new Error(`Item ${index + 1}: description é obrigatória.`);
            error.status = 400;
            throw error;
        }

        payload.item_number = positiveInteger(payload.item_number, 'item_number');
        const insert = buildInsert(payload, ITEM_INSERT, ITEM_JSON);
        const names = ['"attempt_id"', ...insert.columns.map(
            (column) => `"${column}"`,
        )].join(', ');
        const placeholders = ['$1', ...insert.columns.map(
            (_, position) => `$${position + 2}`,
        )].join(', ');

        const result = await client.query(
            `INSERT INTO ${ORDERS_NFE_ATTEMPT_ITEMS_TABLE} (${names})
       VALUES (${placeholders})
       RETURNING *`,
            [attemptId, ...insert.values],
        );
        rows.push(result.rows[0]);
    }

    return rows;
}

export async function createAttempt(data = {}, items = []) {
    const orderId = positiveBigInt(data.order_id, 'order_id');
    positiveInteger(data.nfe_status_id, 'nfe_status_id');

    return transaction(async (client) => {
        await ensureOrder(client, orderId);

        const sequenceResult = await client.query(
            `SELECT COALESCE(MAX(attempt_number), 0) + 1 AS attempt_number
         FROM ${ORDERS_NFE_ATTEMPTS_TABLE}
        WHERE order_id = $1`,
            [orderId],
        );
        const attemptNumber = Number(sequenceResult.rows[0].attempt_number);

        const insert = buildInsert(
            { ...data, order_id: orderId },
            ATTEMPT_INSERT,
            ATTEMPT_JSON,
        );

        const result = await client.query(
            `INSERT INTO ${ORDERS_NFE_ATTEMPTS_TABLE}
         (${insert.names}, attempt_number)
       VALUES (${insert.placeholders}, $${insert.values.length + 1})
       RETURNING *`,
            [...insert.values, attemptNumber],
        );

        const attempt = result.rows[0];
        const savedItems = await insertItems(client, attempt.attempt_id, items);
        return { ...attempt, items: savedItems };
    });
}

export async function addItems(attemptId, items = []) {
    const id = positiveBigInt(attemptId, 'attempt_id');
    return transaction(async (client) => {
        const attempt = await client.query(
            `SELECT attempt_id
         FROM ${ORDERS_NFE_ATTEMPTS_TABLE}
        WHERE attempt_id = $1
        FOR UPDATE`,
            [id],
        );
        if (attempt.rowCount === 0) {
            const error = new Error(`Tentativa ${id} não encontrada.`);
            error.status = 404;
            throw error;
        }
        return insertItems(client, id, items);
    });
}

export async function replaceItems(attemptId, items = []) {
    const id = positiveBigInt(attemptId, 'attempt_id');
    return transaction(async (client) => {
        const attempt = await client.query(
            `SELECT attempt_id
         FROM ${ORDERS_NFE_ATTEMPTS_TABLE}
        WHERE attempt_id = $1
        FOR UPDATE`,
            [id],
        );
        if (attempt.rowCount === 0) {
            const error = new Error(`Tentativa ${id} não encontrada.`);
            error.status = 404;
            throw error;
        }
        await client.query(
            `DELETE FROM ${ORDERS_NFE_ATTEMPT_ITEMS_TABLE} WHERE attempt_id = $1`,
            [id],
        );
        return insertItems(client, id, items);
    });
}
