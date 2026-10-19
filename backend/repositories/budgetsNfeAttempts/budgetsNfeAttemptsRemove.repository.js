// ╔══════════════════════════════════════════════════════════════════════╗
// ║ budgetsNfeAttemptsRemove.repository.js — remove                      ║
// ╚══════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import {
  TB_ATTEMPTS,
} from './budgetsNfeAttempts.constants.js';
import {
  toId,
} from './budgetsNfeAttempts.sanitizers.js';
import {
  getAttemptForUpdate,
  ensureMutable,
} from './budgetsNfeAttemptsLookup.repository.js';

export async function remove(attemptId) {
    const id = toId(attemptId, 'attempt_id');
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const current = await getAttemptForUpdate(client, id);
        ensureMutable(current);

        if (current.invoice_id) {
            const error = new Error(
                'Não é possível excluir uma tentativa vinculada a uma NF-e.',
            );
            error.status = 409;
            error.code = 'ATTEMPT_HAS_INVOICE';
            throw error;
        }

        await client.query(
            `
                DELETE FROM ${TB_ATTEMPTS}
                WHERE attempt_id = $1
            `,
            [id],
        );

        await client.query('COMMIT');

        return {
            deleted: true,
            attempt_id: id,
        };
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
