// ╔════════════════════════════════════════════════════════════════════╗
// ║ customerTrainingsRemove.repository.js — remove (soft)              ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB } from './customerTrainings.constants.js';
import { toPositiveInt } from './customerTrainings.sanitizers.js';
import { ensureTable } from './customerTrainingsSchema.repository.js';

export async function remove(id, userId = null) {
  await ensureTable();

  const { rows } = await pool.query(
    `
    UPDATE ${TB}
    SET is_active = FALSE,
        updated_by = $2,
        updated_at = NOW()
    WHERE training_id = $1
      AND is_active = TRUE
    RETURNING training_id
    `,
    [toPositiveInt(id), userId]
  );

  return rows[0] || null;
}
