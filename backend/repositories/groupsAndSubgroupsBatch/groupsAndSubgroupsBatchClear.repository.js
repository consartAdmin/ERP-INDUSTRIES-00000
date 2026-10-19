// ╔════════════════════════════════════════════════════════════════════╗
// ║ groupsAndSubgroupsBatchClear.repository.js — batchClearGroups      ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB_PRODUCTS } from './groupsAndSubgroupsBatch.constants.js';
import { toInt, notEmptyStr } from './groupsAndSubgroupsBatch.sanitizers.js';
import { columnExists, getColumnUdtName, detectSearchColumns } from './groupsAndSubgroupsBatchIntrospection.repository.js';
import { buildProductsWhere } from './groupsAndSubgroupsBatch.sql.js';

// -----------------------------------------------------------------------------
// POST /api/products-groups/batch/clear
// -----------------------------------------------------------------------------
export async function batchClearGroups(req, res) {
  const body = req.body || {};

  let hasActiveCol = false;
  let hasSubgroupCol = false;
  let searchCols = [];
  let productIdUdtName = null;

  try {
    [hasActiveCol, hasSubgroupCol, searchCols, productIdUdtName] = await Promise.all([
      columnExists(TB_PRODUCTS, 'is_active').catch(() => false),
      columnExists(TB_PRODUCTS, 'product_subgroup_id').catch(() => false),
      detectSearchColumns().catch(() => []),
      getColumnUdtName(TB_PRODUCTS, 'product_id').catch(() => null),
    ]);
  } catch {
    // segue
  }

  const { whereSql, values, meta: whereMeta } = buildProductsWhere({
    product_ids: body.product_ids,
    q: body.q,
    only_active_products: body.only_active_products,
    where_group_id: body.where_group_id,
    where_subgroup_id: body.where_subgroup_id,
    hasActiveCol,
    hasSubgroupCol,
    searchCols,
    productIdUdtName,
  });

  const hasAnyTarget =
    (Array.isArray(body.product_ids) && body.product_ids.length > 0) ||
    notEmptyStr(body.q) ||
    Number.isInteger(toInt(body.where_group_id)) ||
    Number.isInteger(toInt(body.where_subgroup_id));

  if (!hasAnyTarget) {
    return res.status(400).json({
      ok: false,
      error: 'Provide at least one target filter: product_ids, q, where_group_id or where_subgroup_id.',
    });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const hasUpdatedAt = await columnExists(TB_PRODUCTS, 'updated_at').catch(() => false);

    const sql = `
      UPDATE ${TB_PRODUCTS} p
      SET
        product_group_id = NULL
        ${hasSubgroupCol ? ', product_subgroup_id = NULL' : ''}
        ${hasUpdatedAt ? ', updated_at = now()' : ''}
      ${whereSql}
      RETURNING
        p.product_id,
        p.product_group_id
        ${hasSubgroupCol ? ', p.product_subgroup_id' : ''}
        ${hasUpdatedAt ? ', p.updated_at' : ''};
    `;

    const { rows } = await client.query(sql, values);

    await client.query('COMMIT');
    return res.json({
      ok: true,
      affected: rows.length,
      rows,
      data: rows,
      meta: {
        hasSubgroupCol,
        hasActiveCol,
        searchCols,
        whereMeta,
      },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[groupsAndSubgroupsBatchApi:batchClearGroups] error:', err);
    return res.status(500).json({ ok: false, error: 'Failed to batch clear groups/subgroups.' });
  } finally {
    client.release();
  }
}
