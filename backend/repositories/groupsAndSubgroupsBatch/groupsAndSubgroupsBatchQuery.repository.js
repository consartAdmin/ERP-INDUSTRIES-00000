// ╔════════════════════════════════════════════════════════════════════╗
// ║ groupsAndSubgroupsBatchQuery.repository.js — batchListProducts     ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB_PRODUCTS } from './groupsAndSubgroupsBatch.constants.js';
import { notEmptyStr } from './groupsAndSubgroupsBatch.sanitizers.js';
import { columnExists, detectSearchColumns } from './groupsAndSubgroupsBatchIntrospection.repository.js';

// -----------------------------------------------------------------------------
// GET /api/products-groups/batch/list
// -----------------------------------------------------------------------------
export async function batchListProducts(req, res) {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.max(1, Number(req.query.limit) || 20);
    const offset = (page - 1) * limit;

    const q = String(req.query.q || '').trim();
    const linked = req.query.linked; // 'true' | 'false' | undefined
    const onlyActive = req.query.only_active === 'true' || req.query.only_active_products !== 'false';

    const [hasActiveCol, hasSubgroupCol, searchCols] = await Promise.all([
      columnExists(TB_PRODUCTS, 'is_active').catch(() => false),
      columnExists(TB_PRODUCTS, 'product_subgroup_id').catch(() => false),
      detectSearchColumns().catch(() => []),
    ]);

    const where = [];
    const values = [];
    let i = 1;

    if (notEmptyStr(q)) {
      values.push(`%${q}%`);
      const idx = i++;

      const ors = [];
      ors.push(`p.product_id::text ILIKE $${idx}`);
      for (const col of searchCols) {
        ors.push(`COALESCE(CAST(p.${col} AS text),'') ILIKE $${idx}`);
      }
      where.push(`(${ors.join(' OR ')})`);
    }

    if (hasActiveCol && onlyActive) {
      where.push(`p.is_active = TRUE`);
    }

    if (linked === 'true') where.push(`p.product_group_id IS NOT NULL`);
    if (linked === 'false') where.push(`p.product_group_id IS NULL`);

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const selectCols = [
      'p.product_id',
      ...(searchCols.includes('product_code') ? ['p.product_code'] : []),
      ...(searchCols.includes('product_description') ? ['p.product_description'] : []),
      ...(searchCols.includes('name') ? ['p.name'] : []),
      ...(searchCols.includes('description') ? ['p.description'] : []),
      'p.product_group_id',
      ...(hasSubgroupCol ? ['p.product_subgroup_id'] : []),
      ...(hasActiveCol ? ['p.is_active'] : []),
    ].join(', ');

    const sql = `
      SELECT ${selectCols}
      FROM ${TB_PRODUCTS} p
      ${whereSql}
      ORDER BY p.product_id DESC
      LIMIT $${i++}
      OFFSET $${i++};
    `;

    values.push(limit);
    values.push(offset);

    const { rows } = await pool.query(sql, values);

    return res.json({
      ok: true,
      page,
      limit,
      data: rows,
    });
  } catch (err) {
    console.error('[batchListProducts]', err);
    return res.status(500).json({
      ok: false,
      error: 'Failed to list products.',
    });
  }
}
