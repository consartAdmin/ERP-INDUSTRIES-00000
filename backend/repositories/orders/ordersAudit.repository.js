// ╔══════════════════════════════════════════════════════════════════════╗
// ║ ordersAudit.repository.js — AuditLogs de pedidos                     ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { createAuditLog } from '../auditLogs/auditLogs.index.js';
import { ordersSchema } from './orders.catalog.js';

// ----------------------------------------------------------------------
// AuditLogs
// ----------------------------------------------------------------------
export async function safeCreateOrderAuditLog({
  tabela = ordersSchema.tableName,
  register_id,
  operation,
  user_id = null,
  before = null,
  after = null,
}) {
  try {
    await createAuditLog({
      tabela,
      register_id: register_id != null ? String(register_id) : null,
      operation,
      user_id: user_id != null ? String(user_id) : null,
      before,
      after,
    });
  } catch (err) {
    console.warn('[ordersApi.auditLog] WARN:', err?.message || err);
  }
}
