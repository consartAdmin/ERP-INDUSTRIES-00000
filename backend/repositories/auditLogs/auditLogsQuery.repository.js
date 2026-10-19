// ╔════════════════════════════════════════════════════════════════════╗
// ║ auditLogsQuery.repository.js — listAuditLogs (filtros/paginação)   ║
// ║ Tabela: public."auditLogs"                                         ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB_AUDIT_LOGS } from './auditLogs.constants.js';

/**
 * Lista registros da auditoria com filtros e paginação.
 */
export async function listAuditLogs({
  tabela = null,
  register_id = null,
  operation = null,
  limit = 50,
  offset = 0,
} = {}) {
  const conditions = [];
  const values = [];
  let paramIndex = 1;

  if (tabela) {
    conditions.push(
      `tabela = $${paramIndex++}`
    );

    values.push(String(tabela));
  }

  if (
    register_id !== null &&
    register_id !== undefined
  ) {
    conditions.push(
      `register_id = $${paramIndex++}`
    );

    values.push(register_id);
  }

  if (operation) {
    conditions.push(
      `operation = $${paramIndex++}`
    );

    values.push(String(operation));
  }

  const where = conditions.length
    ? `WHERE ${conditions.join(' AND ')}`
    : '';

  const normalizedLimit = Math.min(
    200,
    Math.max(1, Number(limit) || 50)
  );

  const normalizedOffset = Math.max(
    0,
    Number(offset) || 0
  );

  values.push(normalizedLimit);
  const limitParameter = paramIndex++;

  values.push(normalizedOffset);
  const offsetParameter = paramIndex++;

  const sql = `
    SELECT
      id,
      tabela,
      register_id,
      operation,
      user_id,
      before,
      after,
      created_at
    FROM ${TB_AUDIT_LOGS}
    ${where}
    ORDER BY created_at DESC
    LIMIT $${limitParameter}
    OFFSET $${offsetParameter};
  `;

  const { rows } = await pool.query(
    sql,
    values
  );

  return rows;
}
