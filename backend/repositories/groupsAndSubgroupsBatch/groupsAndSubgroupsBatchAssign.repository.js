// ╔════════════════════════════════════════════════════════════════════╗
// ║ groupsAndSubgroupsBatchAssign.repository.js — batchAssignGroups    ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB_PRODUCTS, TB_GROUPS } from './groupsAndSubgroupsBatch.constants.js';
import { toInt, notEmptyStr } from './groupsAndSubgroupsBatch.sanitizers.js';
import { columnExists, getColumnUdtName, detectSearchColumns } from './groupsAndSubgroupsBatchIntrospection.repository.js';
import { buildProductsWhere } from './groupsAndSubgroupsBatch.sql.js';
import { validateSubgroupBelongsToGroup } from './groupsAndSubgroupsBatchValidate.repository.js';

// -----------------------------------------------------------------------------
// POST /api/products-groups/batch/assign
// -----------------------------------------------------------------------------
export async function batchAssignGroups(req, res) {
  const body = req.body || {};

  const product_group_id = toInt(body.product_group_id);
  const product_subgroup_id =
    body.product_subgroup_id !== undefined ? toInt(body.product_subgroup_id) : undefined;

  if (!Number.isInteger(product_group_id)) {
    return res.status(400).json({ ok: false, error: 'product_group_id must be an integer.' });
  }

  // Detect columns / types from schema
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

  // valida grupo
  try {
    const gRes = await pool.query(
      `
        SELECT product_group_id, name, is_active
        FROM ${TB_GROUPS}
        WHERE product_group_id = $1
        LIMIT 1;
      `,
      [product_group_id],
    );

    if (!gRes.rowCount) {
      return res.status(404).json({ ok: false, error: 'Group not found.' });
    }

    if (gRes.rows[0]?.is_active === false) {
      return res.status(409).json({ ok: false, error: 'Cannot assign an inactive group.' });
    }
  } catch (err) {
    console.error('[groupsAndSubgroupsBatchApi:validateGroup] error:', err);
    return res.status(500).json({ ok: false, error: 'Failed to validate group.' });
  }

  // valida subgrupo
  if (hasSubgroupCol && product_subgroup_id !== undefined) {
    if (!Number.isInteger(product_subgroup_id)) {
      return res
        .status(400)
        .json({ ok: false, error: 'product_subgroup_id must be an integer (or omit it).' });
    }

    try {
      await validateSubgroupBelongsToGroup({
        product_group_id,
        product_subgroup_id,
      });
    } catch (err) {
      const status = err?.status || 500;
      console.error('[groupsAndSubgroupsBatchApi:validateSubgroup] error:', err);
      return res.status(status).json({ ok: false, error: err?.message || 'Failed to validate subgroup.' });
    }
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

    const setParts = [];
    const params = [...values];
    let i = params.length + 1;

    params.push(product_group_id);
    setParts.push(`product_group_id = $${i++}`);

    if (hasSubgroupCol) {
      if (product_subgroup_id !== undefined) {
        params.push(product_subgroup_id);
        setParts.push(`product_subgroup_id = $${i++}`);
      }
    }

    const hasUpdatedAt = await columnExists(TB_PRODUCTS, 'updated_at').catch(() => false);
    if (hasUpdatedAt) setParts.push(`updated_at = now()`);

    const sql = `
      UPDATE ${TB_PRODUCTS} p
      SET ${setParts.join(', ')}
      ${whereSql}
      RETURNING
        p.product_id,
        p.product_group_id
        ${hasSubgroupCol ? ', p.product_subgroup_id' : ''}
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
        hasSubgroupCol,
        hasActiveCol,
        searchCols,
        whereMeta,
      },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[groupsAndSubgroupsBatchApi:batchAssignGroups] error:', err);
    return res.status(500).json({ ok: false, error: 'Failed to batch assign groups/subgroups.' });
  } finally {
    client.release();
  }
}
