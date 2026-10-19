// ╔══════════════════════════════════════════════════════════════════════╗
// ║ ordersNfeAttemptsUpdate.repository.js — Atualização                  ║
// ║ updateAttempt / mark* / attachInvoice                                ║
// ╚══════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { ORDERS_NFE_ATTEMPTS_TABLE } from './ordersNfeAttempts.catalog.js';
import { positiveBigInt } from './ordersNfeAttempts.sanitizers.js';
import { normalizeProviderDateTime } from './ordersNfeAttempts.utils.js';
import { buildUpdate } from './ordersNfeAttempts.sql.js';

export async function updateAttempt(attemptId, changes = {}) {
    const id = positiveBigInt(attemptId, 'attempt_id');
    const update = buildUpdate(changes);
    if (update.columns.length === 0) {
        const error = new Error('Nenhum campo válido foi informado para atualização.');
        error.status = 400;
        throw error;
    }

    const result = await pool.query(
        `UPDATE ${ORDERS_NFE_ATTEMPTS_TABLE}
        SET ${update.setClause}, updated_at = NOW()
      WHERE attempt_id = $${update.values.length + 1}
      RETURNING *`,
        [...update.values, id],
    );
    return result.rows[0] ?? null;
}

export function markAuthorized(attemptId, data = {}) {
    return updateAttempt(attemptId, {
        ...data,
        authorized_at:
            normalizeProviderDateTime(data.authorized_at) ??
            new Date(),
        rejected_at: null,
        error_code: null,
        error_message: null,
        last_checked_at: data.last_checked_at ?? new Date(),
    });
}

export function markRejected(attemptId, data = {}) {
    return updateAttempt(attemptId, {
        ...data,
        authorized_at: null,
        rejected_at: data.rejected_at ?? new Date(),
        last_checked_at: data.last_checked_at ?? new Date(),
    });
}

export function markChecked(attemptId, data = {}) {
    return updateAttempt(attemptId, {
        ...data,
        last_checked_at: data.last_checked_at ?? new Date(),
    });
}

export function attachInvoice(attemptId, invoiceId) {
    return updateAttempt(attemptId, {
        invoice_id: positiveBigInt(invoiceId, 'invoice_id'),
    });
}
