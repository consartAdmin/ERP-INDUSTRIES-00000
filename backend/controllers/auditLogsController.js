// ╔══════════════════════════════════════════════════════════════╗
// ║ FILE: auditLogsController.js                                 ║
// ║ CONTROLLER: Auditoria                                        ║
// ╚══════════════════════════════════════════════════════════════╝

import * as auditLogsApi from '../repositories/auditLogs/auditLogs.index.js';

export async function getAuditLogs(req, res) {
  try {
    const {
      tabela = null,
      register_id = null,
      operation = null,
      limit = 50,
      offset = 0
    } = req.query;

    const rows = await auditLogsApi.listAuditLogs({
      tabela,
      register_id,
      operation,
      limit: Number(limit) || 50,
      offset: Number(offset) || 0
    });

    return res.json({
      ok: true,
      data: rows
    });
  } catch (error) {
    console.error('Erro ao buscar audit logs:', error);
    return res.status(500).json({
      ok: false,
      message: 'Erro ao buscar auditoria'
    });
  }
}