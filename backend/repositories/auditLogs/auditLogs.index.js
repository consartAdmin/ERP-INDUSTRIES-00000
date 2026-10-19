// ╔════════════════════════════════════════════════════════════════════╗
// ║ auditLogs.index.js — ponto de entrada da auditoria central         ║
// ║ Mantém a mesma API pública do antigo auditLogsApi.js               ║
// ╚════════════════════════════════════════════════════════════════════╝

import { createAuditLog } from './auditLogsCreate.repository.js';
import { listAuditLogs } from './auditLogsQuery.repository.js';

export { createAuditLog, listAuditLogs };

export default {
  createAuditLog,
  listAuditLogs,
};
