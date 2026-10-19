// ╔══════════════════════════════════════════════════════════════════════╗
// ║ nfeWebhookEventsQuery.repository.js — list / getById                 ║
// ║ NÃO cria pool: sempre receber pgPool como argumento                  ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { TB } from './nfeWebhookEvents.constants.js';

/**
 * Lista eventos com filtros + paginação + resumo por status.
 * Compatível com o frontend webhookPlugNotas.js.
 *
 * @param {import('pg').Pool} pgPool
 * @param {object} filters
 * @returns {Promise<{page:number,pageSize:number,total:number,pages:number,summary:object,rows:object[]}>}
 */
export async function listWebhookEvents(pgPool, filters = {}) {
  const {
    emitterCnpj,
    periodo = 'hoje',    // 'hoje' | 'ontem' | '7dias' | '30dias' | 'todos'
    status = 'todos',    // 'pendente' | 'autorizado' | etc...
    q = '',
    page = 1,
    pageSize = 20
  } = filters;

  const pageNum = Math.max(1, Number(page) || 1);
  const pageSizeNum = Math.min(200, Math.max(1, Number(pageSize) || 20));
  const offset = (pageNum - 1) * pageSizeNum;

  const where = [];
  const params = [];
  let idx = 1;

  if (emitterCnpj) {
    where.push(`emitter_cnpj = $${idx++}`);
    params.push(emitterCnpj.replace(/\D/g, ''));
  }

  // Período baseado em created_at
  if (periodo === 'hoje') {
    where.push(`created_at::date = CURRENT_DATE`);
  } else if (periodo === 'ontem') {
    where.push(`created_at::date = (CURRENT_DATE - INTERVAL '1 day')`);
  } else if (periodo === '7dias') {
    where.push(`created_at >= (CURRENT_DATE - INTERVAL '7 days')`);
  } else if (periodo === '30dias') {
    where.push(`created_at >= (CURRENT_DATE - INTERVAL '30 days')`);
  }
  // 'todos' = sem filtro de data

  if (status && status !== 'todos') {
    where.push(`LOWER(status) = LOWER($${idx++})`);
    params.push(status);
  }

  if (q) {
    where.push(
      `(integration_id ILIKE $${idx} OR chave_acesso ILIKE $${idx} OR motivo ILIKE $${idx})`
    );
    params.push(`%${q}%`);
    idx++;
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const baseQuery = `FROM ${TB} ${whereSql}`;

  // Total
  const countResult = await pgPool.query(
    `SELECT COUNT(*) AS total ${baseQuery}`,
    params
  );
  const total = Number(countResult.rows[0]?.total || 0);

  // Linhas
  const rowsResult = await pgPool.query(
    `
    SELECT
      id, emitter_cnpj, integration_id, plugnotas_uuid, chave_acesso,
      numero_nfe, serie, status, cstat, motivo, tipo_evento,
      created_at, updated_at
    ${baseQuery}
    ORDER BY created_at DESC
    LIMIT $${idx++} OFFSET $${idx++}
    `,
    [...params, pageSizeNum, offset]
  );
  const rows = rowsResult.rows;

  // Summary por status
  const summaryResult = await pgPool.query(
    `
    SELECT LOWER(status) AS status, COUNT(*)::int AS count
    FROM ${TB}
    ${whereSql}
    GROUP BY LOWER(status)
    `,
    params
  );

  const summary = summaryResult.rows.reduce((acc, row) => {
    acc[row.status || ''] = row.count;
    return acc;
  }, {});

  const pages = Math.max(1, Math.ceil(total / pageSizeNum || 1));

  return {
    page: pageNum,
    pageSize: pageSizeNum,
    total,
    pages,
    summary,
    rows
  };
}

/**
 * Recupera 1 evento pelo ID.
 * @param {import('pg').Pool} pgPool
 * @param {number} id
 */
export async function getWebhookEventById(pgPool, id) {
  const result = await pgPool.query(
    `SELECT * FROM ${TB} WHERE id = $1`,
    [id]
  );
  return result.rows[0] || null;
}
