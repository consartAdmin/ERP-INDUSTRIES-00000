// ╔══════════════════════════════════════════════════════════════════════╗
// ║ ordersNfeAttemptsQuery.repository.js — Leitura                       ║
// ║ getById / getLatest* / list                                          ║
// ╚══════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { ORDERS_NFE_ATTEMPTS_TABLE, ORDERS_NFE_ATTEMPT_ITEMS_TABLE } from './ordersNfeAttempts.catalog.js';
import { positiveBigInt, positiveInteger, pageSize, offsetValue } from './ordersNfeAttempts.sanitizers.js';
import { providerDocument } from './ordersNfeAttempts.utils.js';

export async function getById(attemptId, { includeItems = true } = {}) {
    const id = positiveBigInt(attemptId, 'attempt_id');
    const result = await pool.query(
        `SELECT a.*
       FROM ${ORDERS_NFE_ATTEMPTS_TABLE} a
      WHERE a.attempt_id = $1`,
        [id],
    );
    if (result.rowCount === 0) return null;
    if (!includeItems) return result.rows[0];

    const itemResult = await pool.query(
        `SELECT *
       FROM ${ORDERS_NFE_ATTEMPT_ITEMS_TABLE}
      WHERE attempt_id = $1
      ORDER BY item_number ASC, attempt_item_id ASC`,
        [id],
    );
    return { ...result.rows[0], items: itemResult.rows };
}

export async function getLatestByOrderId(orderId, options = {}) {
    const id = positiveBigInt(orderId, 'order_id');
    const result = await pool.query(
        `SELECT attempt_id
       FROM ${ORDERS_NFE_ATTEMPTS_TABLE}
      WHERE order_id = $1
      ORDER BY attempt_number DESC, attempt_id DESC
      LIMIT 1`,
        [id],
    );
    if (result.rowCount === 0) return null;
    return getById(result.rows[0].attempt_id, options);
}

export async function getLatestTrackableByOrderId(orderId, options = {}) {
    const id = positiveBigInt(orderId, 'order_id');
    const result = await pool.query(
        `SELECT *
           FROM ${ORDERS_NFE_ATTEMPTS_TABLE}
          WHERE order_id = $1
          ORDER BY attempt_number DESC, attempt_id DESC`,
        [id],
    );

    const attempt = result.rows.find((row) => {
        const storedDocument = providerDocument({ data: row.provider_response });
        return Boolean(
            String(row.provider_id ?? '').trim() ||
            String(row.access_key ?? '').trim() ||
            String(row.integration_id ?? '').trim() ||
            String(storedDocument?.id ?? '').trim() ||
            String(storedDocument?.chave ?? storedDocument?.chaveAcesso ?? '').trim() ||
            String(storedDocument?.idIntegracao ?? '').trim()
        );
    });

    if (!attempt) return null;
    if (!options.includeItems) return attempt;
    return getById(attempt.attempt_id, options);
}

export async function list({
    orderId,
    statusId,
    providerId,
    accessKey,
    limit = 50,
    offset = 0,
} = {}) {
    const where = [];
    const values = [];
    const add = (sql, value) => {
        values.push(value);
        where.push(sql.replace('?', `$${values.length}`));
    };

    if (orderId !== undefined && orderId !== null && orderId !== '') {
        add('a.order_id = ?', positiveBigInt(orderId, 'order_id'));
    }
    if (statusId !== undefined && statusId !== null && statusId !== '') {
        add('a.nfe_status_id = ?', positiveInteger(statusId, 'nfe_status_id'));
    }
    if (String(providerId ?? '').trim()) add('a.provider_id = ?', String(providerId).trim());
    if (String(accessKey ?? '').trim()) add('a.access_key = ?', String(accessKey).trim());

    const safeLimit = pageSize(limit);
    const safeOffset = offsetValue(offset);
    values.push(safeLimit, safeOffset);

    const result = await pool.query(
        `SELECT a.*, COUNT(*) OVER()::BIGINT AS total_count
       FROM ${ORDERS_NFE_ATTEMPTS_TABLE} a
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY a.requested_at DESC, a.attempt_id DESC
      LIMIT $${values.length - 1}
     OFFSET $${values.length}`,
        values,
    );

    return {
        rows: result.rows.map(({ total_count, ...row }) => row),
        total: Number(result.rows[0]?.total_count ?? 0),
        limit: safeLimit,
        offset: safeOffset,
    };
}
