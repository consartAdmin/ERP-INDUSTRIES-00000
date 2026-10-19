// ╔════════════════════════════════════════════════════════════════════╗
// ║ crmLossReasonsCreate.repository.js — create                        ║
// ║ Tabela: "crmLossReasons"                                           ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { normalizeBoolean, sanitizeText } from './crmLossReasons.sanitizers.js';
import { mapRow } from './crmLossReasons.mappers.js';

export async function create(data = {}) {
  const reasonName = sanitizeText(data.reason_name);
  const isActive = normalizeBoolean(data.is_active, true);

  if (!reasonName) {
    throw new Error('reason_name is required.');
  }

  const duplicatedSql = `
    SELECT id
    FROM "crmLossReasons"
    WHERE LOWER(reason_name) = LOWER($1)
    LIMIT 1
  `;

  const duplicated = await pool.query(duplicatedSql, [reasonName]);

  if (duplicated.rows.length > 0) {
    throw new Error('A loss reason with this name already exists.');
  }

  const insertSql = `
    INSERT INTO "crmLossReasons" (
      reason_name,
      is_active
    )
    VALUES ($1, $2)
    RETURNING
      id,
      reason_name,
      is_active,
      created_at
  `;

  const { rows } = await pool.query(insertSql, [reasonName, isActive]);
  return mapRow(rows[0]);
}
