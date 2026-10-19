// ╔══════════════════════════════════════════════════════════════════════╗
// ║ budgetsNfeAttemptsLookup.repository.js — consultas internas          ║
// ║ resolveStatus / getAttemptForUpdate / ensureMutable                  ║
// ║ getByIdWithClient                                                    ║
// ╚══════════════════════════════════════════════════════════════════════╝

import {
  TB_ATTEMPTS,
  TB_ITEMS,
  TB_STATUS,
} from './budgetsNfeAttempts.constants.js';
import {
  toId,
} from './budgetsNfeAttempts.sanitizers.js';

export async function resolveStatus(client, { nfe_status_id, status_code } = {}) {
    if (nfe_status_id != null && nfe_status_id !== '') {
        const id = toId(nfe_status_id, 'nfe_status_id');

        const result = await client.query(
            `
                SELECT *
                FROM ${TB_STATUS}
                WHERE nfe_status_id = $1
                  AND is_active = TRUE
                LIMIT 1
            `,
            [id],
        );

        if (result.rowCount) return result.rows[0];
    }

    const code = String(status_code || '').trim().toUpperCase();

    if (code) {
        const result = await client.query(
            `
                SELECT *
                FROM ${TB_STATUS}
                WHERE UPPER(code) = $1
                  AND is_active = TRUE
                LIMIT 1
            `,
            [code],
        );

        if (result.rowCount) return result.rows[0];
    }

    const error = new Error('Status de NF-e inexistente ou inativo.');
    error.status = 400;
    error.code = 'NFE_STATUS_NOT_FOUND';
    throw error;
}

export async function getAttemptForUpdate(client, attemptId) {
    const result = await client.query(
        `
            SELECT
                a.*,
                s.code AS status_code,
                s.is_final,
                s.is_authorized
            FROM ${TB_ATTEMPTS} a
            JOIN ${TB_STATUS} s
              ON s.nfe_status_id = a.nfe_status_id
            WHERE a.attempt_id = $1
            FOR UPDATE OF a
        `,
        [attemptId],
    );

    return result.rows[0] || null;
}

export function ensureMutable(row) {
    if (!row) {
        const error = new Error('Tentativa de NF-e não encontrada.');
        error.status = 404;
        error.code = 'ATTEMPT_NOT_FOUND';
        throw error;
    }

    if (row.is_final) {
        const error = new Error(
            `A tentativa está finalizada com status ${row.status_code}.`,
        );
        error.status = 409;
        error.code = 'ATTEMPT_IS_FINAL';
        throw error;
    }
}

export async function getByIdWithClient(client, attemptId) {
    const header = await client.query(
        `
            SELECT
                a.*,
                s.code AS status_code,
                s.name AS status_name,
                s.description AS status_description,
                s.is_final,
                s.is_authorized
            FROM ${TB_ATTEMPTS} a
            JOIN ${TB_STATUS} s
              ON s.nfe_status_id = a.nfe_status_id
            WHERE a.attempt_id = $1
            LIMIT 1
        `,
        [attemptId],
    );

    if (!header.rowCount) return null;

    const items = await client.query(
        `
            SELECT *
            FROM ${TB_ITEMS}
            WHERE attempt_id = $1
            ORDER BY item_number, attempt_item_id
        `,
        [attemptId],
    );

    return {
        ...header.rows[0],
        items: items.rows,
    };
}
