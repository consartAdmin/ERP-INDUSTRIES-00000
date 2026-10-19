// ╔══════════════════════════════════════════════════════════════════════╗
// ║ budgetsNfeAttemptsLinkInvoice.repository.js — linkInvoice            ║
// ║ Vincula a tentativa a uma NF-e emitida                               ║
// ╚══════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import {
  TB_ATTEMPTS,
  TB_INVOICES,
} from './budgetsNfeAttempts.constants.js';
import {
  toId,
} from './budgetsNfeAttempts.sanitizers.js';
import {
  getAttemptForUpdate,
  getByIdWithClient,
} from './budgetsNfeAttemptsLookup.repository.js';

export async function linkInvoice(attemptId, invoiceId) {
    const id = toId(attemptId, 'attempt_id');
    const invoice = toId(invoiceId, 'invoice_id');
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const current = await getAttemptForUpdate(client, id);

        if (!current) {
            const error = new Error('Tentativa de NF-e não encontrada.');
            error.status = 404;
            error.code = 'ATTEMPT_NOT_FOUND';
            throw error;
        }

        const invoiceResult = await client.query(
            `
                SELECT
                    invoice_id,
                    budget_id
                FROM ${TB_INVOICES}
                WHERE invoice_id = $1
                LIMIT 1
            `,
            [invoice],
        );

        if (!invoiceResult.rowCount) {
            const error = new Error('NF-e emitida não encontrada.');
            error.status = 404;
            error.code = 'INVOICE_NOT_FOUND';
            throw error;
        }

        const invoiceRow = invoiceResult.rows[0];

        if (
            invoiceRow.budget_id != null &&
            Number(invoiceRow.budget_id) !== Number(current.budget_id)
        ) {
            const error = new Error(
                'A NF-e não pertence ao orçamento desta tentativa.',
            );
            error.status = 409;
            error.code = 'INVOICE_BUDGET_MISMATCH';
            throw error;
        }

        await client.query(
            `
                UPDATE ${TB_ATTEMPTS}
                SET
                    invoice_id = $1,
                    updated_at = NOW()
                WHERE attempt_id = $2
            `,
            [invoice, id],
        );

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
