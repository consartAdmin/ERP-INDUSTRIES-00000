// ╔════════════════════════════════════════════════════════════════════╗
// ║ groupsAndSubgroupsBatch.sql.js — WHERE dinâmico para products      ║
// ╚════════════════════════════════════════════════════════════════════╝

import { toInt, notEmptyStr, normalizeIds, onlyNumericIds } from './groupsAndSubgroupsBatch.sanitizers.js';

export function productIdArrayCastFromUdt(udt) {
  // udt_name commonly: int4, int8, uuid, varchar, text
  if (udt === 'int8') return { cast: 'bigint[]', mode: 'numeric' };
  if (udt === 'int4') return { cast: 'int[]', mode: 'numeric' };
  if (udt === 'uuid') return { cast: 'uuid[]', mode: 'text' };
  // default text-ish
  return { cast: 'text[]', mode: 'text' };
}

// ✅ monta WHERE de produtos (corrigido para product_id type)
export function buildProductsWhere({
  product_ids,
  q,
  only_active_products,
  where_group_id,
  where_subgroup_id,
  hasActiveCol,
  hasSubgroupCol,
  searchCols = [],
  productIdUdtName, // <-- NEW
}) {
  const where = [];
  const values = [];
  let i = 1;

  const { cast, mode } = productIdArrayCastFromUdt(productIdUdtName);

  // ✅ product_ids (com cast correto)
  if (Array.isArray(product_ids) && product_ids.length) {
    if (mode === 'numeric') {
      const nums = onlyNumericIds(product_ids);
      if (nums.length) {
        values.push(nums);
        where.push(`p.product_id = ANY($${i++}::${cast})`);
      } else {
        // se vier tudo inválido, força 0 resultados sem explodir
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
    const pIdx = i++;

    const ors = [];
    ors.push(`CAST(p.product_id AS text) ILIKE $${pIdx}`);

    for (const col of searchCols) {
      ors.push(`CAST(p.${col} AS text) ILIKE $${pIdx}`);
    }

    where.push(`(${ors.join(' OR ')})`);
  }

  // ✅ only_active
  if (hasActiveCol) {
    const onlyActive = only_active_products !== false; // default true
    if (onlyActive) where.push(`p.is_active = TRUE`);
  }

  // ✅ where_group_id / where_subgroup_id
  const g = toInt(where_group_id);
  if (Number.isInteger(g)) {
    values.push(g);
    where.push(`p.product_group_id = $${i++}`);
  }

  if (hasSubgroupCol) {
    const sg = toInt(where_subgroup_id);
    if (Number.isInteger(sg)) {
      values.push(sg);
      where.push(`p.product_subgroup_id = $${i++}`);
    }
  }

  return {
    whereSql: where.length ? `WHERE ${where.join(' AND ')}` : '',
    values,
    meta: { productIdUdtName, productIdArrayCast: cast, productIdMode: mode },
  };
}
