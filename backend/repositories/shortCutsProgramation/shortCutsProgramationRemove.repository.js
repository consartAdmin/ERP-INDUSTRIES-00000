// ╔════════════════════════════════════════════════════════════════════╗
// ║ shortCutsProgramationRemove.repository.js — remove (soft) / restore║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB } from './shortCutsProgramation.constants.js';
import { ensureTable } from './shortCutsProgramationSchema.repository.js';

export async function remove(id) {
    await ensureTable();

    const result = await pool.query(
        `
    UPDATE ${TB}
    SET active = FALSE, updated_at = NOW()
    WHERE shortcut_id = $1
    RETURNING *
    `,
        [id]
    );

    return result.rows[0] || null;
}

export async function restore(id) {
    await ensureTable();

    const result = await pool.query(
        `
    UPDATE ${TB}
    SET active = TRUE, updated_at = NOW()
    WHERE shortcut_id = $1
    RETURNING *
    `,
        [id]
    );

    return result.rows[0] || null;
}
