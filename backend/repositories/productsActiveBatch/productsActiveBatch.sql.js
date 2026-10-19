// ╔════════════════════════════════════════════════════════════════════╗
// ║ productsActiveBatch.sql.js — WHERE dinâmico para products          ║
// ╚════════════════════════════════════════════════════════════════════╝

import { toInt, notEmptyStr, normalizeIds, onlyNumericIds } from './productsActiveBatch.sanitizers.js';

export function productIdArrayCastFromUdt(udt) {
  if (udt === 'int8') return { cast: 'bigint[]', mode: 'numeric' };
  if (udt === 'int4') return { cast: 'int[]', mode: 'numeric' };
  if (udt === 'uuid') return { cast: 'uuid[]', mode: 'text' };
  return { cast: 'text[]', mode: 'text' };
}

/**
 * buildProductsWhere
 * - product_ids (com cast correto)
 * - q (busca em colunas detectadas)
 * - where_group_id / where_subgroup_id (se existirem as colunas)
 * - status filter (active/inactive/all) se existir is_active
 */
export function buildProductsWhere({
  product_ids,
  q,
  where_group_id,
  where_subgroup_id,
  status, // 'active' | 'inactive' | 'all' | undefined
  hasActiveCol,
  hasGroupCol,
  hasSubgroupCol,
  searchCols = [],
  productIdUdtName,
}) {
  const where = [];
  const values = [];
  let i = 1;

  const { cast, mode } = productIdArrayCastFromUdt(productIdUdtName);

  // ✅ product_ids
  if (Array.isArray(product_ids) && product_ids.length) {
    if (mode === 'numeric') {
      const nums = onlyNumericIds(product_ids);
      if (nums.length) {
        values.push(nums);
        where.push(`p.product_id = ANY($${i++}::${cast})`);
      } else {
        where.push(`1=0`);
      }
    } else {
      const ids = normalizeIds(product_ids);
      if (ids.length) {
        values.push(ids);
        where.push(`p.product_id = ANY($${i++}::${cast})`);
      }
    }
  }

  // ✅ q
  if (notEmptyStr(q)) {
    const term = `%${q.trim()}%`;
    values.push(term);
    const idx = i++;

    const ors = [];
    ors.push(`CAST(p.product_id AS text) ILIKE $${idx}`);

    for (const col of searchCols) {
      ors.push(`COALESCE(CAST(p.${col} AS text),'') ILIKE $${idx}`);
    }

    where.push(`(${ors.join(' OR ')})`);
  }

  // ✅ filtro por grupo/subgrupo (se colunas existirem)
  if (hasGroupCol) {
    const g = toInt(where_group_id);
    if (Number.isInteger(g)) {
      values.push(g);
      where.push(`p.product_group_id = $${i++}`);
    }
  }

  if (hasSubgroupCol) {
    const sg = toInt(where_subgroup_id);
    if (Number.isInteger(sg)) {
      values.push(sg);
      where.push(`p.product_subgroup_id = $${i++}`);
    }
  }

  // ✅ status (is_active)
  if (hasActiveCol) {
    const st = String(status || 'all').toLowerCase();
    if (st === 'active') where.push(`p.is_active = TRUE`);
    if (st === 'inactive') where.push(`p.is_active = FALSE`);
  }

  return {
    whereSql: where.length ? `WHERE ${where.join(' AND ')}` : '',
    values,
    meta: { productIdUdtName, productIdArrayCast: cast, productIdMode: mode },
  };
}
