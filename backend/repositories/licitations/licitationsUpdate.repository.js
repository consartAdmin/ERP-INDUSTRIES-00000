// ╔════════════════════════════════════════════════════════════════════╗
// ║ licitationsUpdate.repository.js — update / updateStatus            ║
// ║ Tabela: public.licitationitems                                     ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TABLE_NAME } from './licitations.constants.js';
import { sanitizePayload } from './licitations.sanitizers.js';
import { ensureTableReady } from './licitationsSchema.repository.js';

export async function updateLicitation(id, payload) {
    await ensureTableReady();

    const data = sanitizePayload(payload);
    const fields = Object.keys(data);

    if (!fields.length) {
        const error = new Error('Nenhum campo válido foi informado para atualização.');
        error.code = 'VALIDATION_ERROR';
        throw error;
    }

    if (Object.prototype.hasOwnProperty.call(data, 'agency_name') && !data.agency_name) {
        const error = new Error('O órgão responsável não pode ficar vazio.');
        error.code = 'VALIDATION_ERROR';
        throw error;
    }

    if (
        Object.prototype.hasOwnProperty.call(data, 'product_description') &&
        !data.product_description
    ) {
        const error = new Error('A descrição do item não pode ficar vazia.');
        error.code = 'VALIDATION_ERROR';
        throw error;
    }

    const values = [];
    const assignments = fields.map((field, index) => {
        values.push(data[field]);
        return `${field} = $${index + 1}`;
    });

    values.push(id);

    const result = await pool.query(
        `
      UPDATE ${TABLE_NAME}
      SET
        ${assignments.join(', ')},
        updated_at = NOW()
      WHERE id = $${values.length}
      RETURNING *
    `,
        values,
    );

    return result.rows[0] || null;
}

export async function updateLicitationStatus(id, status) {
    await ensureTableReady();

    const normalizedStatus = String(status || '').trim().toUpperCase();

    if (!normalizedStatus) {
        const error = new Error('O status é obrigatório.');
        error.code = 'VALIDATION_ERROR';
        throw error;
    }

    const result = await pool.query(
        `
      UPDATE ${TABLE_NAME}
      SET status = $2, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
        [id, normalizedStatus],
    );

    return result.rows[0] || null;
}
