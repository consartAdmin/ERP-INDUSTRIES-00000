// ╔══════════════════════════════════════════════════════════════════════╗
// ║ suppliersQuery.repository.js — list / search                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB, ALIAS } from './suppliers.constants.js';
import { ok, fail } from './suppliers.utils.js';
import { normalizeRow } from './suppliers.mappers.js';

/* ──────────────────────────────────────────────────────────────
   list — lista fornecedores com paginação + filtro q
────────────────────────────────────────────────────────────── */
export async function list({
  page = 1,
  limit = 20,
  sort = 'supplier_id',
  dir = 'asc',
  q,
} = {}) {
  try {
    const pg = Number(page) > 0 ? Number(page) : 1;
    const lim = Number(limit) > 0 && Number(limit) <= 200 ? Number(limit) : 20;
    const offset = (pg - 1) * lim;

    const allowedSort = new Set([
      'supplier_id',
      'name',
      'tax_id',
      'city',
      'state',
      'email',
      'phone',
    ]);

    const sortCol = allowedSort.has(sort) ? sort : 'supplier_id';
    const sortDir = String(dir || '').toLowerCase() === 'desc' ? 'DESC' : 'ASC';

    const params = [];
    const where = [];

    if (q && String(q).trim()) {
      params.push(`%${String(q).trim().toLowerCase()}%`);
      const idx = params.length;

      where.push(`
        (
          LOWER(COALESCE(${ALIAS}.name, '')) LIKE $${idx}
          OR LOWER(COALESCE(${ALIAS}.tax_id, '')) LIKE $${idx}
          OR LOWER(COALESCE(${ALIAS}.email, '')) LIKE $${idx}
          OR LOWER(COALESCE(${ALIAS}.website, '')) LIKE $${idx}
          OR LOWER(COALESCE(${ALIAS}.city, '')) LIKE $${idx}
          OR LOWER(COALESCE(${ALIAS}.state, '')) LIKE $${idx}
          OR LOWER(COALESCE(${ALIAS}.sales_rep, '')) LIKE $${idx}
        )
      `);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    params.push(lim);
    const limitIdx = params.length;

    params.push(offset);
    const offsetIdx = params.length;

    const sql = `
      SELECT
        ${ALIAS}.supplier_id,
        ${ALIAS}.name,
        ${ALIAS}.tax_id,
        ${ALIAS}.state_registration,
        ${ALIAS}.phone,
        ${ALIAS}.email,
        ${ALIAS}.website,
        ${ALIAS}.address,
        ${ALIAS}.address_street_type,
        ${ALIAS}.address_street,
        ${ALIAS}.address_number,
        ${ALIAS}.address_complement,
        ${ALIAS}.address_district,
        ${ALIAS}.city,
        ${ALIAS}.state,
        ${ALIAS}.postal_code,
        ${ALIAS}.sales_rep,
        ${ALIAS}.sales_rep_email,
        ${ALIAS}.finance_email,
        ${ALIAS}.chart_account_id,
        coa.code AS chart_account_code,
        coa.description AS chart_account_description,
        ${ALIAS}.cash_category_id,
        cc.name AS cash_category_name,
        ${ALIAS}.cash_subcategory_id,
        csc.name AS cash_subcategory_name,
        COUNT(*) OVER() AS total_count
      FROM ${TB} ${ALIAS}
      LEFT JOIN public."chartOfAccounts" coa ON coa.id = ${ALIAS}.chart_account_id
      LEFT JOIN public."cashCategories" cc ON cc.id = ${ALIAS}.cash_category_id
      LEFT JOIN public."cashSubcategories" csc ON csc.id = ${ALIAS}.cash_subcategory_id
      ${whereSql}
      ORDER BY ${ALIAS}.${sortCol} ${sortDir}
      LIMIT $${limitIdx}
      OFFSET $${offsetIdx};
    `;

    const { rows } = await pool.query(sql, params);

    const total = rows.length ? Number(rows[0].total_count) : 0;
    const dataRows = rows.map(normalizeRow);

    return ok({
      rows: dataRows,
      total,
      page: pg,
      limit: lim,
    });
  } catch (err) {
    console.error('[suppliersApi:list] Erro:', err);
    return fail(err.message || 'Erro ao listar fornecedores', 500);
  }
}

/* ──────────────────────────────────────────────────────────────
   search — atalho para list com q
────────────────────────────────────────────────────────────── */
export async function search(q, { page = 1, limit = 20 } = {}) {
  return list({ page, limit, q });
}
