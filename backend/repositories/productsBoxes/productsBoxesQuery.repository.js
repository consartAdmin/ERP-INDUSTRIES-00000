// ╔════════════════════════════════════════════════════════════════════╗
// ║ productsBoxesQuery.repository.js — listagem/busca de caixas        ║
// ╚════════════════════════════════════════════════════════════════════╝

import { TB_BOX, TB_ITEM, TB_PRODUCT } from './productsBoxes.constants.js';
import { q } from './productsBoxes.utils.js';
import { asBool, safeStr, parseOrder, ensureInt } from './productsBoxes.sanitizers.js';
import { listBoxItems } from './productsBoxesItems.repository.js';

export async function listBoxes({
  q: query,
  active,
  page = 1,
  pageSize = 20,
  orderBy = 'created_at DESC',
} = {}) {
  const where = [];
  const params = [];

  const activeBool = asBool(active);
  if (activeBool !== null) {
    params.push(activeBool);
    where.push(`active = $${params.length}`);
  }

  if (query && String(query).trim()) {
    const like = `%${safeStr(query, 200)}%`;
    params.push(like);
    where.push(`(name ILIKE $${params.length})`);
  }

  const whereSql = where.length ? ` WHERE ${where.join(' AND ')} ` : '';
  const orderSql = parseOrder(orderBy, [
    'box_id', 'name', 'box_type', 'location', 'active', 'created_at', 'updated_at',
  ]);

  const p = Math.max(1, ensureInt(page, 1));
  const ps = Math.min(200, Math.max(1, ensureInt(pageSize, 20)));
  const offset = (p - 1) * ps;

  const countSql = `SELECT COUNT(*)::bigint AS total FROM ${TB_BOX} ${whereSql}`;
  const countRes = await q(countSql, params);
  const total = Number(countRes.rows?.[0]?.total || 0);

  const params2 = [...params, ps, offset];

  const dataSql = `
  SELECT
  box_id, name, box_type, location,
  length_cm, width_cm, height_cm,
  max_weight_kg, max_volume_cm3,
  notes, active, created_at, updated_at
  FROM ${TB_BOX}
  ${whereSql}
  ${orderSql || ' ORDER BY created_at DESC '}
  LIMIT $${params2.length - 1} OFFSET $${params2.length}
  `;

  const dataRes = await q(dataSql, params2);

  return {
    page: p,
    pageSize: ps,
    total,
    rows: dataRes.rows || [],
  };
}

export async function getBoxById(box_id) {
  const id = ensureInt(box_id, NaN);
  if (!Number.isFinite(id)) return null;

  const res = await q(`SELECT * FROM ${TB_BOX} WHERE box_id = $1`, [id]);
  return res.rows?.[0] || null;
}

/* ──────────────────────────────────────────────────────────────
   Extras (úteis pro PDF/relatórios)
────────────────────────────────────────────────────────────── */
export async function getBoxWithItems(box_id) {
  const box = await getBoxById(box_id);
  if (!box) return null;
  const items = await listBoxItems(box_id); // ✅ já vem com product_description
  return { ...box, items };
}

export async function listBoxesWithItems(opts = {}) {
  const list = await listBoxes(opts);
  const ids = (list.rows || []).map((r) => r.box_id);

  if (!ids.length) return { ...list, rows: [] };

  // ✅ carrega todos itens em 1 query e inclui descrição do produto
  const itemsRes = await q(
    `
      SELECT
        i.box_item_id,
        i.box_id,
        i.product_code,
        i.quantity,
        i.unit,
        i.notes,
        i.created_at,
        i.updated_at,
        p.description AS product_description
      FROM ${TB_ITEM} i
      LEFT JOIN ${TB_PRODUCT} p
        ON p.product_code = i.product_code
      WHERE i.box_id = ANY($1::bigint[])
      ORDER BY i.box_id ASC, i.created_at ASC
    `,
    [ids.map((v) => Number(v))] // ids já vem do banco, mas garante array numérico
  );

  const map = new Map();
  for (const it of itemsRes.rows || []) {
    if (!map.has(it.box_id)) map.set(it.box_id, []);
    map.get(it.box_id).push(it);
  }

  const rows = (list.rows || []).map((b) => ({ ...b, items: map.get(b.box_id) || [] }));
  return { ...list, rows };
}

export async function listBoxesByProductCode(product_code) {
  const code = safeStr(product_code, 60);
  if (!code) {
    const err = new Error('invalid product_code');
    err.status = 400;
    throw err;
  }

  const res = await q(
    `
    SELECT
      b.box_id,
      b.name,
      b.box_type,
      b.location,
      b.active,
      i.quantity,
      i.unit,
      i.updated_at
    FROM ${TB_ITEM} i
    JOIN ${TB_BOX} b ON b.box_id = i.box_id
    WHERE i.product_code = $1
    ORDER BY b.name ASC, b.box_id ASC
    `,
    [code]
  );

  return res.rows || [];
}

export async function getBoxByProductCode(product_code) {
  const sku = safeStr(product_code, 60);
  if (!sku) return null;

  const res = await q(
    `
      SELECT b.*
      FROM ${TB_ITEM} i
      INNER JOIN ${TB_BOX} b ON b.box_id = i.box_id
      WHERE i.product_code = $1
      LIMIT 1
    `,
    [sku]
  );

  return res.rows?.[0] || null;
}
