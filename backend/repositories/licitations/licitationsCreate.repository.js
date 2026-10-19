// ╔════════════════════════════════════════════════════════════════════╗
// ║ licitationsCreate.repository.js — createLicitation                 ║
// ║ Tabela: public.licitationitems                                     ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TABLE_NAME } from './licitations.constants.js';
import { sanitizePayload } from './licitations.sanitizers.js';
import { ensureTableReady } from './licitationsSchema.repository.js';

export async function createLicitation(payload) {
    await ensureTableReady();

    const data = sanitizePayload(payload);

    if (!data.agency_name) {
        const error = new Error('O órgão responsável é obrigatório.');
        error.code = 'VALIDATION_ERROR';
        throw error;
    }

    if (!data.product_description) {
        const error = new Error('A descrição do item é obrigatória.');
        error.code = 'VALIDATION_ERROR';
        throw error;
    }

    const fields = Object.keys(data);

    if (!fields.length) {
        const error = new Error('Nenhum campo válido foi informado.');
        error.code = 'VALIDATION_ERROR';
        throw error;
    }

    const values = Object.values(data);
    const placeholders = values.map((_, index) => `$${index + 1}`);

    const result = await pool.query(
        `
      INSERT INTO ${TABLE_NAME} (${fields.join(', ')})
      VALUES (${placeholders.join(', ')})
      RETURNING *
    `,
        values,
    );

    return result.rows[0];
}
