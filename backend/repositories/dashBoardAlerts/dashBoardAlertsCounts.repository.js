// ╔════════════════════════════════════════════════════════════════════╗
// ║ dashBoardAlertsCounts.repository.js — Contagens recentes           ║
// ║ getEmailRecentCount / getNfeRecentCount                            ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { NFE_INBOX_TB, EMAIL_INBOUNDS_TB } from './dashBoardAlerts.constants.js';

// ---------------------------------------------------------------------
// getEmailRecentCount — conta e-mails recentes
// ---------------------------------------------------------------------
export async function getEmailRecentCount({ lookbackMinutes = 1440 } = {}) {
  const mins = Number.isFinite(lookbackMinutes) && lookbackMinutes > 0
    ? lookbackMinutes
    : 1440; // default 24h

  const sql = `
    SELECT COUNT(*) AS recent_count
    FROM ${EMAIL_INBOUNDS_TB}
    WHERE received_at >= now() - ($1::int * INTERVAL '1 minute');
  `;

  const values = [mins];
  const { rows } = await pool.query(sql, values);
  const count = Number(rows[0]?.recent_count || 0);
  return count;
}

// ---------------------------------------------------------------------
// getNfeRecentCount — conta NF-es recentes para o CNPJ (ou geral)
// ---------------------------------------------------------------------
export async function getNfeRecentCount({
  cnpjEmpresa,
  lookbackDays = 1,
} = {}) {
  const days = Number.isFinite(lookbackDays) && lookbackDays > 0
    ? lookbackDays
    : 1;

  const where = [];
  const values = [];
  let idx = 1;

  // Filtro por CNPJ da empresa monitorada, se informado
  if (cnpjEmpresa) {
    where.push(`cnpj_empresa = $${idx++}`);
    values.push(cnpjEmpresa);
  }

  // Considera NF-es recentes pela data de autorização/emissão/criação
  where.push(`
    COALESCE(data_autorizacao, data_emissao, created_at) >=
      now() - ($${idx++}::int * INTERVAL '1 day')
  `);
  values.push(days);

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const sql = `
    SELECT COUNT(*) AS recent_count
    FROM ${NFE_INBOX_TB}
    ${whereSql};
  `;

  const { rows } = await pool.query(sql, values);
  const count = Number(rows[0]?.recent_count || 0);
  return count;
}
