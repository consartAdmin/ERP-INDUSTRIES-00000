// ╔════════════════════════════════════════════════════════════════════╗
// ║ customersQuery.repository.js — list / search / listAllForExport    ║
// ║ Tabela: public."customers"                                         ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { tb } from './customers.table.js';
import { TB, ALIAS } from './customers.constants.js';
import { toNumOrNull, resolveCustomerOrder } from './customers.utils.js';
import { mapRow, mapSearchRow } from './customers.mappers.js';
import {
  CUSTOMER_FULL_COLUMNS,
  CUSTOMER_FULL_JOINS,
  JOIN_STATUS,
  JOIN_SEGMENT,
  buildCustomerFilters,
} from './customers.sql.js';

/* ──────────────────────────────────────────────────────────
   LIST (paginado + total)
────────────────────────────────────────────────────────── */

export async function list({
  q,
  is_active,
  status_type_id,
  business_segment, // aceito por compatibilidade; ainda não filtra
  seller_id,
  segment_id,
  limit = 100,
  offset = 0,
  orderBy = 'trade_name',
  order = 'asc',
} = {}) {
  const { expression: orderExpression, direction: dir } =
    resolveCustomerOrder(orderBy, order);

  const { params, whereSql } = buildCustomerFilters({
    q,
    is_active,
    status_type_id,
    seller_id,
    segment_id,
  });

  // Parâmetros do COUNT = só os filtros (antes de LIMIT/OFFSET)
  const countParams = [...params];

  const lim = toNumOrNull(limit) ?? 100;
  const off = toNumOrNull(offset) ?? 0;

  params.push(lim);
  const limIdx = params.length;

  params.push(off);
  const offIdx = params.length;

  const sql = `
    SELECT
      ${CUSTOMER_FULL_COLUMNS}

    FROM ${tb()} ${ALIAS}

    ${CUSTOMER_FULL_JOINS()}

    ${whereSql}

    ORDER BY ${orderExpression} ${dir}, ${ALIAS}.customer_id ASC

    LIMIT $${limIdx}
    OFFSET $${offIdx};
  `;

  const countSql = `
    SELECT COUNT(*)::INT AS total
    FROM ${tb()} ${ALIAS}

    ${CUSTOMER_FULL_JOINS()}

    ${whereSql};
  `;

  const [rowsRes, totalRes] = await Promise.all([
    pool.query(sql, params),
    pool.query(countSql, countParams),
  ]);

  return {
    rows: rowsRes.rows.map(mapRow),
    total: totalRes.rows[0]?.total ?? 0,
    limit: lim,
    offset: off,
  };
}

/* ──────────────────────────────────────────────────────────
   SEARCH (autocomplete)
────────────────────────────────────────────────────────── */

export async function search({
  q,
  is_active = true,
  limit = 10,
  offset = 0,
} = {}) {
  const params = [];
  const where = [];

  params.push(!!is_active);
  where.push(`${ALIAS}.is_active = $${params.length}`);

  let likeStart;

  if (q && String(q).trim()) {
    const norm = String(q)
      .toLowerCase()
      .trim();

    const likeAll = `%${norm}%`;
    likeStart = `${norm}%`;

    params.push(likeAll);
    params.push(likeAll);
    params.push(likeAll);

    where.push(`(
      LOWER(COALESCE(${ALIAS}.trade_name,'')) LIKE $${params.length - 2} OR
      LOWER(COALESCE(${ALIAS}.legal_name,'')) LIKE $${params.length - 1} OR
      COALESCE(${ALIAS}.tax_id,'') LIKE $${params.length}
    )`);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  let orderSql = `ORDER BY LOWER(COALESCE(${ALIAS}.trade_name,'')) ASC`;

  // Prioriza quem começa com o termo digitado
  if (q && likeStart) {
    params.push(likeStart);

    orderSql = `
      ORDER BY
        CASE
          WHEN LOWER(COALESCE(${ALIAS}.trade_name,'')) LIKE $${params.length}
            THEN 0
          ELSE 1
        END,
        LOWER(COALESCE(${ALIAS}.trade_name,'')) ASC
    `;
  }

  const lim = Number.isFinite(+limit) ? +limit : 10;
  const off = Number.isFinite(+offset) ? +offset : 0;

  params.push(lim);
  const limIdx = params.length;

  params.push(off);
  const offIdx = params.length;

  const sql = `
    SELECT
      ${ALIAS}.customer_id,
      ${ALIAS}.customer_type,
      ${ALIAS}.trade_name,
      ${ALIAS}.legal_name,
      ${ALIAS}.tax_id,
      ${ALIAS}.city,
      ${ALIAS}.state,
      ${ALIAS}.email,
      ${ALIAS}.phone_number,
      ${ALIAS}.mobile_number,

      ${ALIAS}.segment_id,
      seg.segment_name AS segment_name,

      cs.status_type_id,
      COALESCE(cst.name_pt, cst.internal_code) AS status_label

    FROM ${tb()} ${ALIAS}

    ${JOIN_STATUS()}

    ${JOIN_SEGMENT()}

    ${whereSql}

    ${orderSql}

    LIMIT $${limIdx}
    OFFSET $${offIdx};
  `;

  const { rows } = await pool.query(sql, params);

  return {
    rows: rows.map(mapSearchRow),
    limit: lim,
    offset: off,
  };
}

/* ──────────────────────────────────────────────────────────
   EXPORT (sem paginação)
────────────────────────────────────────────────────────── */

export async function listAllForExport({
  q,
  is_active,
  status_type_id,
  business_segment, // aceito por compatibilidade; ainda não filtra
  seller_id,
  segment_id,
  orderBy = 'trade_name',
  order = 'asc',
} = {}) {
  const { expression: orderExpression, direction: dir } =
    resolveCustomerOrder(orderBy, order);

  const { params, whereSql } = buildCustomerFilters({
    q,
    is_active,
    status_type_id,
    seller_id,
    segment_id,
  });

  const sql = `
    SELECT
      ${CUSTOMER_FULL_COLUMNS}

    FROM ${tb()} ${ALIAS}

    ${CUSTOMER_FULL_JOINS()}

    ${whereSql}

    ORDER BY ${orderExpression} ${dir}, ${ALIAS}.customer_id ASC;
  `;

  const { rows } = await pool.query(sql, params);

  return rows.map(mapRow);
}

export default {
  list,
  search,
  listAllForExport,
};
