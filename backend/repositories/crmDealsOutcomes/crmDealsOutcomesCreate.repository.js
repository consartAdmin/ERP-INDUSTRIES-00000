// ╔════════════════════════════════════════════════════════════════════╗
// ║ crmDealsOutcomesCreate.repository.js — createCrmDealsOutcome       ║
// ║ Tabela: "crmDealsOutcomes"                                         ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TABLE } from './crmDealsOutcomes.constants.js';
import { mapOutcomePayload, validateOutcomePayload } from './crmDealsOutcomes.sanitizers.js';

export async function createCrmDealsOutcome(payload = {}) {
  const data = mapOutcomePayload(payload);
  const errors = validateOutcomePayload(data);

  if (errors.length) {
    const err = new Error(errors.join(' '));
    err.statusCode = 400;
    throw err;
  }

  const sql = `
    INSERT INTO ${TABLE} (
      name,
      icon,
      color,
      sort_order,
      is_active,
      code,
      outcome_type
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING
      id,
      name,
      icon,
      color,
      sort_order,
      is_active,
      created_at,
      code,
      outcome_type
  `;

  const values = [
    data.name,
    data.icon,
    data.color,
    data.sort_order,
    data.is_active,
    data.code,
    data.outcome_type
  ];

  const { rows } = await pool.query(sql, values);
  return rows[0];
}
