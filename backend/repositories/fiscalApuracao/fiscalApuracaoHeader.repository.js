// ╔════════════════════════════════════════════════════════════════════╗
// ║ fiscalApuracaoHeader.repository.js — Cabeçalho da apuração         ║
// ║ insert / updateStatus / getByPeriod / getHeaderById / list         ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TABLE_FISCAL_APURACAO, ALIAS_FISCAL_APURACAO } from './fiscalApuracao.constants.js';

/* ======================================================================
   HEADER
   ====================================================================== */

export async function insertFiscalApuracao(data, client = pool) {
  const sql = `
    INSERT INTO "${TABLE_FISCAL_APURACAO}" (
      reference_month,
      reference_year,
      date_from,
      date_to,
      regime_type,
      status,
      notes
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *
  `;

  const params = [
    data.reference_month,
    data.reference_year,
    data.date_from,
    data.date_to,
    data.regime_type || 'LUCRO_REAL',
    data.status || 'OPEN',
    data.notes || null
  ];

  const { rows } = await client.query(sql, params);
  return rows[0];
}

export async function updateFiscalApuracaoStatus(
  fiscalApuracaoId,
  status,
  client = pool
) {
  const sql = `
    UPDATE "${TABLE_FISCAL_APURACAO}"
    SET
      status = $2,
      updated_at = now()
    WHERE fiscal_apuracao_id = $1
    RETURNING *
  `;

  const { rows } = await client.query(sql, [fiscalApuracaoId, status]);
  return rows[0] || null;
}

export async function getFiscalApuracaoByPeriod(
  referenceYear,
  referenceMonth,
  regimeType = 'LUCRO_REAL',
  client = pool
) {
  const sql = `
    SELECT *
    FROM "${TABLE_FISCAL_APURACAO}" ${ALIAS_FISCAL_APURACAO}
    WHERE ${ALIAS_FISCAL_APURACAO}.reference_year = $1
      AND ${ALIAS_FISCAL_APURACAO}.reference_month = $2
      AND ${ALIAS_FISCAL_APURACAO}.regime_type = $3
    LIMIT 1
  `;

  const { rows } = await client.query(sql, [
    referenceYear,
    referenceMonth,
    regimeType
  ]);

  return rows[0] || null;
}

export async function getFiscalApuracaoHeaderById(
  fiscalApuracaoId,
  client = pool
) {
  const sql = `
    SELECT *
    FROM "${TABLE_FISCAL_APURACAO}" ${ALIAS_FISCAL_APURACAO}
    WHERE ${ALIAS_FISCAL_APURACAO}.fiscal_apuracao_id = $1
  `;

  const { rows } = await client.query(sql, [fiscalApuracaoId]);
  return rows[0] || null;
}

export async function listFiscalApuracoes(filters = {}, client = pool) {
  const where = [];
  const params = [];
  let idx = 1;

  if (filters.reference_year) {
    where.push(`${ALIAS_FISCAL_APURACAO}.reference_year = $${idx++}`);
    params.push(Number(filters.reference_year));
  }

  if (filters.reference_month) {
    where.push(`${ALIAS_FISCAL_APURACAO}.reference_month = $${idx++}`);
    params.push(Number(filters.reference_month));
  }

  if (filters.status) {
    where.push(`${ALIAS_FISCAL_APURACAO}.status = $${idx++}`);
    params.push(String(filters.status).trim().toUpperCase());
  }

  if (filters.regime_type) {
    where.push(`${ALIAS_FISCAL_APURACAO}.regime_type = $${idx++}`);
    params.push(String(filters.regime_type).trim());
  }

  /*
    IMPORTANTE:
    Não aplicamos mais filtro rígido por date_from/date_to na listagem principal,
    porque a tela de "Apurações Criadas" estava escondendo apurações existentes
    quando o usuário mudava o filtro para outro mês.

    Se no futuro quiser filtro por período na listagem, o ideal é usar interseção:
      fa.date_from <= filtro_date_to
      fa.date_to   >= filtro_date_from
    e apenas quando isso for explicitamente desejado.
  */

  const limit = Math.max(1, Math.min(Number(filters.limit) || 100, 500));
  params.push(limit);

  const sql = `
    SELECT
      ${ALIAS_FISCAL_APURACAO}.fiscal_apuracao_id,
      ${ALIAS_FISCAL_APURACAO}.reference_month,
      ${ALIAS_FISCAL_APURACAO}.reference_year,
      ${ALIAS_FISCAL_APURACAO}.date_from,
      ${ALIAS_FISCAL_APURACAO}.date_to,
      ${ALIAS_FISCAL_APURACAO}.regime_type,
      ${ALIAS_FISCAL_APURACAO}.status,
      ${ALIAS_FISCAL_APURACAO}.notes,
      ${ALIAS_FISCAL_APURACAO}.created_at,
      ${ALIAS_FISCAL_APURACAO}.updated_at
    FROM "${TABLE_FISCAL_APURACAO}" ${ALIAS_FISCAL_APURACAO}
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY
      ${ALIAS_FISCAL_APURACAO}.reference_year DESC,
      ${ALIAS_FISCAL_APURACAO}.reference_month DESC,
      ${ALIAS_FISCAL_APURACAO}.fiscal_apuracao_id DESC
    LIMIT $${idx}
  `;

  const { rows } = await client.query(sql, params);
  return rows;
}
