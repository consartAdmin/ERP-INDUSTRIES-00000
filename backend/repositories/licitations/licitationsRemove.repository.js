// ╔════════════════════════════════════════════════════════════════════╗
// ║ licitationsRemove.repository.js — deleteLicitation                 ║
// ║ Tabela: public.licitationitems                                     ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TABLE_NAME } from './licitations.constants.js';
import { ensureTableReady } from './licitationsSchema.repository.js';

export async function deleteLicitation(id) {
    await ensureTableReady();

    const result = await pool.query(
        `DELETE FROM ${TABLE_NAME} WHERE id = $1 RETURNING *`,
        [id],
    );

    return result.rows[0] || null;
}
