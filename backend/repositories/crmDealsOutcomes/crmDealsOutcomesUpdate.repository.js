// ╔════════════════════════════════════════════════════════════════════╗
// ║ crmDealsOutcomesUpdate.repository.js — updateCrmDealsOutcome       ║
// ║ Tabela: "crmDealsOutcomes"                                         ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TABLE } from './crmDealsOutcomes.constants.js';
import {
  normalizeInteger,
  mapOutcomePayload,
  validateOutcomePayload,
} from './crmDealsOutcomes.sanitizers.js';
import { getCrmDealsOutcomeById } from './crmDealsOutcomesQuery.repository.js';

export async function updateCrmDealsOutcome(id, payload = {}) {
  const current = await getCrmDealsOutcomeById(id);

  if (!current) {
    const err = new Error('Outcome não encontrado.');
    err.statusCode = 404;
    throw err;
  }

  const merged = {
    ...current,
    ...payload
  };

  const data = mapOutcomePayload(merged);
  const errors = validateOutcomePayload(data, { partial: false });

  if (errors.length) {
    const err = new Error(errors.join(' '));
    err.statusCode = 400;
    throw err;
  }

  const sql = `
    UPDATE ${TABLE}
    SET
      name = $1,
      icon = $2,
      color = $3,
      sort_order = $4,
      is_active = $5,
      code = $6,
      outcome_type = $7
    WHERE id = $8
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
    data.outcome_type,
    normalizeInteger(id, 0)
  ];

  const { rows } = await pool.query(sql, values);
  return rows[0];
}
