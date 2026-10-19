// ╔══════════════════════════════════════════════════════════════════════╗
// ║ budgetsNfeAttemptsUpdate.repository.js — update / setStatus          ║
// ╚══════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import {
  TB_ATTEMPTS,
  ATTEMPT_WRITABLE,
} from './budgetsNfeAttempts.constants.js';
import {
  toId,
  pickWritable,
} from './budgetsNfeAttempts.sanitizers.js';
import {
  normalizeProviderDateTime,
} from './budgetsNfeAttempts.utils.js';
import {
  buildUpdate,
} from './budgetsNfeAttempts.sql.js';
import {
  resolveStatus,
  getAttemptForUpdate,
  ensureMutable,
  getByIdWithClient,
} from './budgetsNfeAttemptsLookup.repository.js';

export async function update(attemptId, changes = {}) {
    const id = toId(attemptId, 'attempt_id');
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const current = await getAttemptForUpdate(client, id);
        ensureMutable(current);

        const data = pickWritable(changes, ATTEMPT_WRITABLE);

        // Status transitions must always use setStatus().
        delete data.nfe_status_id;

        const query = buildUpdate(
            TB_ATTEMPTS,
            data,
            'attempt_id',
            id,
        );

        if (query) {
            await client.query(query);
        }

        const result = await getByIdWithClient(client, id);

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

export async function setStatus(attemptId, payload = {}, ctx = {}) {
    const id = toId(attemptId, 'attempt_id');
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const current = await getAttemptForUpdate(client, id);

        if (!current) {
            ensureMutable(current);
        }

        const status = await resolveStatus(client, payload);

        const isCancellation =
            current.is_authorized &&
            [
                'CANCELLED',
                'CANCELED',
                'CANCELADA',
                'CANCELADO',
            ].includes(
                String(status.code || '').trim().toUpperCase(),
            );

        if (current.is_final && !isCancellation) {
            ensureMutable(current);
        }

        const now = new Date().toISOString();
        const data = pickWritable(payload, ATTEMPT_WRITABLE);

        data.nfe_status_id = status.nfe_status_id;
        data.last_checked_at = data.last_checked_at ?? now;

        if (status.is_authorized) {
            data.authorized_at =
                normalizeProviderDateTime(data.authorized_at) ?? now;
            data.rejected_at = null;
            data.error_code = null;
            data.error_message = null;
        } else if (status.is_final) {
            data.rejected_at = data.rejected_at ?? now;
        }

        if (ctx.userId && data.requested_by == null) {
            data.requested_by = current.requested_by;
        }

        const query = buildUpdate(
            TB_ATTEMPTS,
            data,
            'attempt_id',
            id,
        );

        if (query) {
            await client.query(query);
        }

        const result = await getByIdWithClient(client, id);

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
