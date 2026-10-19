// ╔════════════════════════════════════════════════════════════════════╗
// ║ productsActiveBatchSet.repository.js — batchSetActive / activate / deactivate ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB_PRODUCTS } from './productsActiveBatch.constants.js';
import { toInt, notEmptyStr } from './productsActiveBatch.sanitizers.js';
import { columnExists, getColumnUdtName, detectSearchColumns } from './productsActiveBatchIntrospection.repository.js';
import { buildProductsWhere } from './productsActiveBatch.sql.js';

// -----------------------------------------------------------------------------
// POST /api/products-active/batch/set
// body: { is_active: true|false, product_ids? / q? / where_group_id? / where_subgroup_id? }
// -----------------------------------------------------------------------------
export async function batchSetActive(req, res) {
  const body = req.body || {};

  // valida is_active
  const isActive =
    body.is_active === true ? true :
    body.is_active === false ? false :
    null;

  if (isActive === null) {
    return res.status(400).json({ ok: false, error: 'is_active must be boolean (true/false).' });
  }

  // Detect columns / types
  let hasActiveCol = false;
  let hasUpdatedAt = false;
  let hasGroupCol = false;
  let hasSubgroupCol = false;
  let searchCols = [];
  let productIdUdtName = null;

  try {
    [
      hasActiveCol,
      hasUpdatedAt,
      hasGroupCol,
      hasSubgroupCol,
      searchCols,
      productIdUdtName,
    ] = await Promise.all([
      columnExists(TB_PRODUCTS, 'is_active').catch(() => false),
      columnExists(TB_PRODUCTS, 'updated_at').catch(() => false),
      columnExists(TB_PRODUCTS, 'product_group_id').catch(() => false),
      columnExists(TB_PRODUCTS, 'product_subgroup_id').catch(() => false),
      detectSearchColumns().catch(() => []),
      getColumnUdtName(TB_PRODUCTS, 'product_id').catch(() => null),
    ]);
  } catch {
    // segue
  }

  if (!hasActiveCol) {
    return res.status(409).json({
      ok: false,
      error: 'products.is_active column not found. Cannot batch activate/deactivate.',
    });
  }

  const { whereSql, values, meta: whereMeta } = buildProductsWhere({
    product_ids: body.product_ids,
    q: body.q,
    where_group_id: body.where_group_id,
    where_subgroup_id: body.where_subgroup_id,
    status: body.status, // opcional para restringir alvo
    hasActiveCol,
    hasGroupCol,
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

    const params = [...values];
    let i = params.length + 1;

    params.push(isActive);

    const sql = `
      UPDATE ${TB_PRODUCTS} p
      SET
        is_active = $${i++}
        ${hasUpdatedAt ? ', updated_at = now()' : ''}
      ${whereSql}
      RETURNING
        p.product_id
        ${searchCols.includes('product_code') ? ', p.product_code' : ''}
        ${searchCols.includes('sku') ? ', p.sku' : ''}
        ${searchCols.includes('product_description') ? ', p.product_description' : ''}
        ${searchCols.includes('description') ? ', p.description' : ''}
        , p.is_active
        ${hasUpdatedAt ? ', p.updated_at' : ''};
    `;

    const { rows } = await client.query(sql, params);

    await client.query('COMMIT');
    return res.json({
      ok: true,
      affected: rows.length,
      rows,
      data: rows,
      meta: {
        is_active_set_to: isActive,
        hasActiveCol,
        hasUpdatedAt,
        hasGroupCol,
        hasSubgroupCol,
        searchCols,
        whereMeta,
      },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[productsActiveBatchApi:batchSetActive] error:', err);
    return res.status(500).json({ ok: false, error: 'Failed to batch set active flag.' });
  } finally {
    client.release();
  }
}

// -----------------------------------------------------------------------------
// POST /api/products-active/batch/activate
// -----------------------------------------------------------------------------
export async function batchActivate(req, res) {
  req.body = { ...(req.body || {}), is_active: true };
  return batchSetActive(req, res);
}

// -----------------------------------------------------------------------------
// POST /api/products-active/batch/deactivate
// -----------------------------------------------------------------------------
export async function batchDeactivate(req, res) {
  req.body = { ...(req.body || {}), is_active: false };
  return batchSetActive(req, res);
}
