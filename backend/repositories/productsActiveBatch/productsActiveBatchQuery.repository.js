// ╔════════════════════════════════════════════════════════════════════╗
// ║ productsActiveBatchQuery.repository.js — batchListProducts         ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB_PRODUCTS } from './productsActiveBatch.constants.js';
import { columnExists, getColumnUdtName, detectSearchColumns } from './productsActiveBatchIntrospection.repository.js';
import { buildProductsWhere } from './productsActiveBatch.sql.js';

// -----------------------------------------------------------------------------
// GET /api/products-active/batch/list
// query:
//  - page, limit
//  - q
//  - status: active|inactive|all (default all)
//  - where_group_id / where_subgroup_id (opcional, se colunas existirem)
// -----------------------------------------------------------------------------
export async function batchListProducts(req, res) {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.max(1, Number(req.query.limit) || 20);
    const offset = (page - 1) * limit;

    const q = String(req.query.q || '').trim();
    const status = String(req.query.status || 'all').toLowerCase();

    // Detect columns / types
    const [
      hasActiveCol,
      hasGroupCol,
      hasSubgroupCol,
      hasUpdatedAt,
      searchCols,
      productIdUdtName,
    ] = await Promise.all([
      columnExists(TB_PRODUCTS, 'is_active').catch(() => false),
      columnExists(TB_PRODUCTS, 'product_group_id').catch(() => false),
      columnExists(TB_PRODUCTS, 'product_subgroup_id').catch(() => false),
      columnExists(TB_PRODUCTS, 'updated_at').catch(() => false),
      detectSearchColumns().catch(() => []),
      getColumnUdtName(TB_PRODUCTS, 'product_id').catch(() => null),
    ]);

    if (!hasActiveCol) {
      return res.status(409).json({
        ok: false,
        error: 'products.is_active column not found. Cannot list active/inactive status.',
      });
    }

    const { whereSql, values } = buildProductsWhere({
      product_ids: undefined,
      q,
      where_group_id: req.query.where_group_id,
      where_subgroup_id: req.query.where_subgroup_id,
      status,
      hasActiveCol,
      hasGroupCol,
      hasSubgroupCol,
      searchCols,
      productIdUdtName,
    });

    const selectCols = [
      'p.product_id',
      ...(searchCols.includes('product_code') ? ['p.product_code'] : []),
      ...(searchCols.includes('sku') ? ['p.sku'] : []),
      ...(searchCols.includes('code') ? ['p.code'] : []),
      ...(searchCols.includes('product_description') ? ['p.product_description'] : []),
      ...(searchCols.includes('description') ? ['p.description'] : []),
      ...(searchCols.includes('name') ? ['p.name'] : []),
      ...(hasGroupCol ? ['p.product_group_id'] : []),
      ...(hasSubgroupCol ? ['p.product_subgroup_id'] : []),
      'p.is_active',
      ...(hasUpdatedAt ? ['p.updated_at'] : []),
    ].join(', ');

    // total (best-effort)
    const countSql = `
      SELECT COUNT(*)::bigint AS total
      FROM ${TB_PRODUCTS} p
      ${whereSql};
    `;
    const countRes = await pool.query(countSql, values);
    const total = Number(countRes.rows?.[0]?.total || 0);

    const sql = `
      SELECT ${selectCols}
      FROM ${TB_PRODUCTS} p
      ${whereSql}
      ORDER BY p.product_id DESC
      LIMIT $${values.length + 1}
      OFFSET $${values.length + 2};
    `;

    const params = [...values, limit, offset];
    const { rows } = await pool.query(sql, params);

    return res.json({
      ok: true,
      page,
      limit,
      total,
      status,
      data: rows,
    });
  } catch (err) {
    console.error('[productsActiveBatchApi:batchListProducts]', err);
    return res.status(500).json({ ok: false, error: 'Failed to list products.' });
  }
}
