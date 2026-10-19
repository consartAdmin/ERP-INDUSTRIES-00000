// ╔════════════════════════════════════════════════════════════════════╗
// ║ balancoPatrimonialQuery.repository.js — list (filtros/paginação)   ║
// ║ e getById | Tabela: public."balancoPatrimonial"                    ║
// ╚════════════════════════════════════════════════════════════════════╝

import { q, parseOrder, buildWhere } from './balancoPatrimonial.utils.js';

/** Lista com filtros e paginação */
export async function list({ q:search, categoria, dt_from, dt_to, limit = 50, offset = 0, orderBy = 'data_aquisicao DESC' } = {}) {
  const allowedOrder = ['data_aquisicao','valor_aquisicao','created_at','updated_at','asset_code'];
  const orderSql = parseOrder(orderBy, allowedOrder) || ' ORDER BY "data_aquisicao" DESC ';
  const { whereSql, params } = buildWhere({ q:search, categoria, dt_from, dt_to });

  const data = await q(
    `
    SELECT bp.*,
      COALESCE((
        SELECT COUNT(*) FROM public."balancoPatrimonialAnexos" a WHERE a.balanco_id = bp.id
      ),0)::int AS anexos_count
    FROM public."balancoPatrimonial" bp
    ${whereSql}
    ${orderSql}
    LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `,
    [...params, Number(limit), Number(offset)]
  );

  const [{ n: total }] = await q(
    `SELECT COUNT(*)::int AS n FROM public."balancoPatrimonial" ${whereSql}`,
    params
  );

  return { data, total };
}

/** Busca por ID */
export async function getById(id) {
  const [row] = await q(`SELECT * FROM public."balancoPatrimonial" WHERE id=$1`, [Number(id)]);
  return row || null;
}
