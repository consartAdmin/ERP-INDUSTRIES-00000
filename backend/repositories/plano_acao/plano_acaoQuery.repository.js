// ╔════════════════════════════════════════════════════════════════════╗
// ║ plano_acaoQuery.repository.js — list (paginada) / getById          ║
// ╚════════════════════════════════════════════════════════════════════╝

import { TB } from './plano_acao.constants.js';
import { q, clamp } from './plano_acao.utils.js';
import { toInt } from './plano_acao.sanitizers.js';
import { buildWhere, parseOrder } from './plano_acao.sql.js';

export async function list(filters = {}) {
  const page = clamp(toInt(filters.page, 1), 1, 1_000_000);
  const pageSize = clamp(toInt(filters.pageSize, 20), 1, 200);
  const offset = (page - 1) * pageSize;

  const params = [];
  const { sql: whereSql, params: p2 } = buildWhere(filters, params);
  const orderSql = parseOrder(filters.orderBy);

  const countSql = `SELECT COUNT(*)::bigint AS total FROM ${TB} ${whereSql};`;
  const dataSql = `
    SELECT
      id, item, empresa, causa, acao, responsavel, "data", status,
      situacao_atual, observ_evidencias, campo_extra_01,
      created_at, updated_at
    FROM ${TB}
    ${whereSql}
    ${orderSql}
    LIMIT $${p2.length + 1} OFFSET $${p2.length + 2};
  `;

  const countRes = await q(countSql, p2);
  const total = Number(countRes.rows?.[0]?.total ?? 0);

  const dataRes = await q(dataSql, [...p2, pageSize, offset]);

  return {
    page,
    pageSize,
    total,
    rows: dataRes.rows,
  };
}

export async function getById(id) {
  const res = await q(
    `
    SELECT
      id, item, empresa, causa, acao, responsavel, "data", status,
      situacao_atual, observ_evidencias, campo_extra_01,
      created_at, updated_at
    FROM ${TB}
    WHERE id = $1
    LIMIT 1;
    `,
    [id]
  );
  return res.rows[0] || null;
}
