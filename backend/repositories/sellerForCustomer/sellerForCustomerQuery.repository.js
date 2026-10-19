// ╔════════════════════════════════════════════════════════════════════╗
// ║ sellerForCustomerQuery.repository.js — list / bulk / getById /     ║
// ║ helpers por vendedor/cliente / ping                                ║
// ║ Tabela: public."SellerForCustomer" (JOIN sellers + customers)      ║
// ╚════════════════════════════════════════════════════════════════════╝

import { tbl } from './sellerForCustomer.constants.js';
import { erpTable } from '../../utils/erpCompanyContext.js';
import { toInt, toBool } from './sellerForCustomer.sanitizers.js';
import { q, parseOrder } from './sellerForCustomer.utils.js';

/* =========================================================================
   LIST (com filtros + paginação)
   ========================================================================= */

export async function listSellerForCustomer({
  seller_id,
  customer_id,
  active,
  limit = 50,
  offset = 0,
  orderBy,
} = {}) {
  const where = [];
  const params = [];
  let i = 1;

  const sid = toInt(seller_id);
  const cid = toInt(customer_id);
  const act = toBool(active);

  if (sid != null) {
    where.push(`sfc.seller_id = $${i++}`);
    params.push(sid);
  }
  if (cid != null) {
    where.push(`sfc.customer_id = $${i++}`);
    params.push(cid);
  }
  if (act !== undefined) {
    where.push(`sfc.active = $${i++}`);
    params.push(act);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const allowedOrder = ['id', 'seller_id', 'customer_id', 'active', 'created_at', 'updated_at'];
  const orderSql = parseOrder(orderBy, allowedOrder);

  params.push(Number(limit) || 50);
  const limIdx = i++;
  params.push(Number(offset) || 0);
  const offIdx = i++;

  const sql = `
    SELECT
      sfc.id,
      sfc.seller_id,
      sfc.customer_id,
      sfc.active,
      sfc.created_at,
      sfc.updated_at,
      COALESCE(s.nickname, s.name)        AS seller_name,
      COALESCE(c.trade_name, c.legal_name) AS customer_name
    FROM ${tbl()} sfc
    LEFT JOIN ${erpTable('public."sellers"')} s
      ON s.id = sfc.seller_id
    LEFT JOIN ${erpTable('public."customers"')} c
      ON c.customer_id = sfc.customer_id
    ${whereSql}
    ${orderSql}
    LIMIT $${limIdx}
    OFFSET $${offIdx};
  `;

  const countSql = `
    SELECT COUNT(*)::INT AS total
    FROM ${tbl()} sfc
    ${whereSql};
  `;

  const [rowsRes, countRes] = await Promise.all([
    q(sql, params),
    q(countSql, params.slice(0, params.length - 2)),
  ]);

  return {
    items: rowsRes.rows,
    total: countRes.rows?.[0]?.total ?? 0,
    limit: Number(limit) || 50,
    offset: Number(offset) || 0,
  };
}

/* =========================================================================
   BULK: retorna links por lista de customer_ids (para a tela de clientes)
   ========================================================================= */

export async function listByCustomerIds(customerIds = []) {
  const ids = (Array.isArray(customerIds) ? customerIds : [])
    .map((v) => Number(v))
    .filter((n) => Number.isFinite(n));

  if (!ids.length) return [];

  const sql = `
    SELECT
      sfc.id,
      sfc.seller_id,
      sfc.customer_id,
      sfc.active,
      sfc.created_at,
      sfc.updated_at,
      COALESCE(s.nickname, s.name)         AS seller_name,
      COALESCE(c.trade_name, c.legal_name) AS customer_name
    FROM ${tbl()} sfc
    LEFT JOIN ${erpTable('public."sellers"')} s
      ON s.id = sfc.seller_id
    LEFT JOIN ${erpTable('public."customers"')} c
      ON c.customer_id = sfc.customer_id
    WHERE sfc.customer_id = ANY($1::INT[])
      AND (sfc.active IS NULL OR sfc.active = TRUE)
    ORDER BY sfc.created_at DESC;
  `;

  const res = await q(sql, [ids]);
  return res.rows || [];
}

/* =========================================================================
   GET BY ID
   ========================================================================= */

export async function getSellerForCustomerById(id) {
  const iid = toInt(id);
  if (!iid) return null;

  const sql = `
    SELECT
      sfc.id,
      sfc.seller_id,
      sfc.customer_id,
      sfc.active,
      sfc.created_at,
      sfc.updated_at,
      COALESCE(s.nickname, s.name)         AS seller_name,
      COALESCE(c.trade_name, c.legal_name) AS customer_name
    FROM ${tbl()} sfc
    LEFT JOIN ${erpTable('public."sellers"')} s
      ON s.id = sfc.seller_id
    LEFT JOIN ${erpTable('public."customers"')} c
      ON c.customer_id = sfc.customer_id
    WHERE sfc.id = $1
    LIMIT 1;
  `;

  const res = await q(sql, [iid]);
  return res.rows[0] || null;
}

/* =========================================================================
   HELPERS
   ========================================================================= */

export async function listCustomersBySeller(seller_id) {
  const sid = toInt(seller_id);
  if (!sid) return [];

  const sql = `
    SELECT
      c.*,
      sfc.id         AS link_id,
      sfc.active     AS link_active,
      sfc.created_at AS link_created_at,
      sfc.updated_at AS link_updated_at
    FROM ${tbl()} sfc
    INNER JOIN ${erpTable('public."customers"')} c
      ON c.customer_id = sfc.customer_id
    WHERE sfc.seller_id = $1
    ORDER BY COALESCE(c.trade_name, c.legal_name) ASC;
  `;
  const res = await q(sql, [sid]);
  return res.rows || [];
}

export async function listSellersByCustomer(customer_id) {
  const cid = toInt(customer_id);
  if (!cid) return [];

  const sql = `
    SELECT
      s.*,
      sfc.id         AS link_id,
      sfc.active     AS link_active,
      sfc.created_at AS link_created_at,
      sfc.updated_at AS link_updated_at
    FROM ${tbl()} sfc
    INNER JOIN ${erpTable('public."sellers"')} s
      ON s.id = sfc.seller_id
    WHERE sfc.customer_id = $1
    ORDER BY COALESCE(s.nickname, s.name) ASC;
  `;
  const res = await q(sql, [cid]);
  return res.rows || [];
}

export async function ping() {
  const r = await q('SELECT 1 AS ok');
  return r.rows?.[0]?.ok === 1;
}
