// ╔════════════════════════════════════════════════════════════════════╗
// ║ crmLossReasonsQuery.repository.js — listAll / listActive / getById ║
// ║ Tabela: "crmLossReasons"                                           ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { normalizeId } from './crmLossReasons.sanitizers.js';
import { mapRow } from './crmLossReasons.mappers.js';

export async function listAll({ onlyActive = false } = {}) {
  const params = [];
  let whereClause = '';

  if (onlyActive) {
    params.push(true);
    whereClause = `WHERE is_active = $${params.length}`;
  }

  const sql = `
    SELECT
      id,
      reason_name,
      is_active,
      created_at
    FROM "crmLossReasons"
    ${whereClause}
    ORDER BY reason_name ASC, id ASC
  `;

  const { rows } = await pool.query(sql, params);
  return rows.map(mapRow);
}

// Mantém a chamada via `this` como no original (invocado como método do objeto default).
export async function listActive() {
  return this.listAll({ onlyActive: true });
}

export async function getById(id) {
  const normalizedId = normalizeId(id);

  const sql = `
    SELECT
      id,
      reason_name,
      is_active,
      created_at
    FROM "crmLossReasons"
    WHERE id = $1
    LIMIT 1
  `;

  const { rows } = await pool.query(sql, [normalizedId]);
  return mapRow(rows[0] || null);
}
