// ╔════════════════════════════════════════════════════════════════════╗
// ║ auditLogsCreate.repository.js — createAuditLog                     ║
// ║ Tabela: public."auditLogs"                                         ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB_AUDIT_LOGS } from './auditLogs.constants.js';

/**
 * Registra uma operação na auditoria.
 *
 * O parâmetro `db` pode receber um client PostgreSQL para que
 * a auditoria participe da mesma transação da operação principal.
 */
export async function createAuditLog({
  tabela,
  register_id = null,
  operation,
  user_id = null,
  before = null,
  after = null,
  db = pool,
}) {
  if (!tabela) {
    throw new Error(
      '[AUDIT] O campo tabela é obrigatório.'
    );
  }

  if (!operation) {
    throw new Error(
      '[AUDIT] O campo operation é obrigatório.'
    );
  }

  const sql = `
    INSERT INTO ${TB_AUDIT_LOGS}
    (
      tabela,
      register_id,
      operation,
      user_id,
      before,
      after
    )
    VALUES
    (
      $1,
      $2,
      $3,
      $4,
      $5::jsonb,
      $6::jsonb
    )
    RETURNING *;
  `;

  const values = [
    String(tabela),
    register_id,
    String(operation),
    user_id,
    before !== null
      ? JSON.stringify(before)
      : null,
    after !== null
      ? JSON.stringify(after)
      : null,
  ];

  const { rows } = await db.query(sql, values);

  return rows[0] || null;
}
