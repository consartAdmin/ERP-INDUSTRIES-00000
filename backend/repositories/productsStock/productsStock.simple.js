// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ productsStock.simple.js — Estratégia de estoque simples                ║
// ║ CONSART ERP | PostgreSQL | ESM                                         ║
// ║ ✅ Busca digitada por produto/SKU                                      ║
// ║ ✅ Filtros por grupo, subgrupo e fabricante                            ║
// ║ ✅ Compatível com productsManufactures/product_manufacturer_id          ║
// ║ ✅ Lista para Sugestão de Compra PDF                                   ║
// ╚══════════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';

const TB_STOCK = 'public."productsStock"';
const TB_PRODUCTS = 'public."products"';
const TB_GROUPS = 'public."productsGroups"';
const TB_SUBGROUPS = 'public."productsSubgroups"';
const TB_MANUFACTURERS = 'public."productsManufactures"';

const isFiniteNum = (v) => Number.isFinite(Number(v));
const toNumOrNull = (v) => (isFiniteNum(v) ? Number(v) : null);
const toNumOrZero = (v) => (isFiniteNum(v) ? Number(v) : 0);

function rowToModel(r) {
  return {
    product_stock_id: r.product_stock_id ?? null,
    stock_qty: Number(r.stock_qty ?? 0),
    stock_min: Number(r.stock_min ?? 0),
    stock_max: Number(r.stock_max ?? 0),
    purchase_suggestion: Math.max(0, Number(r.stock_max ?? 0) - Number(r.stock_qty ?? 0)),

    created_at: r.created_at ?? null,
    updated_at: r.updated_at ?? null,

    product_id: r.product_id ?? null,
    product_code: r.product_code ?? null,
    product_description: r.product_description ?? null,

    product_group_id: r.product_group_id ?? null,
    product_group_name: r.product_group_name ?? null,

    product_subgroup_id: r.product_subgroup_id ?? null,
    product_subgroup_name: r.product_subgroup_name ?? null,

    product_manufacturer_id: r.product_manufacturer_id ?? null,
    manufacturer_id: r.product_manufacturer_id ?? null,
    manufacturer_name: r.manufacturer_name ?? null,
  };
}

function normalizeSku(value) {
  return String(value ?? '').trim();
}

function buildWhere(filters = {}, startIndex = 1) {
  const where = [];
  const values = [];
  let idx = startIndex;

  const qRaw = String(filters.q || '').trim();
  const status = String(filters.status || '').trim();

  const groupId = toNumOrNull(filters.group_id);
  const subgroupId = toNumOrNull(filters.subgroup_id);
  const manufacturerId = toNumOrNull(filters.manufacturer_id || filters.product_manufacturer_id);

  const QTY = `COALESCE(ps.stock_qty, 0)`;
  const MIN = `COALESCE(ps.stock_min, 0)`;
  const MAX = `COALESCE(ps.stock_max, 0)`;

  if (qRaw) {
    const qSku = normalizeSku(qRaw);

    where.push(`
      (
        p.product_code ILIKE $${idx}
        OR p.description ILIKE $${idx + 1}
        OR CAST(p.product_id AS TEXT) ILIKE $${idx + 1}
      )
    `);

    values.push(`%${qSku}%`, `%${qRaw}%`);
    idx += 2;
  }

  if (status === 'positive') {
    where.push(`${QTY} > 0`);
  } else if (status === 'below_min') {
    where.push(`${QTY} < ${MIN}`);
  } else if (status === 'above_max') {
    where.push(`${QTY} > ${MAX} AND ${MAX} > 0`);
  } else if (status === 'ok') {
    where.push(`${QTY} >= ${MIN} AND (${MAX} = 0 OR ${QTY} <= ${MAX})`);
  }

  if (groupId) {
    where.push(`p.product_group_id = $${idx}`);
    values.push(groupId);
    idx++;
  }

  if (subgroupId) {
    where.push(`p.product_subgroup_id = $${idx}`);
    values.push(subgroupId);
    idx++;
  }

  if (manufacturerId) {
    where.push(`p.manufacturer_id = $${idx}`);
    values.push(manufacturerId);
    idx++;
  }

  return {
    whereSQL: where.length ? `WHERE ${where.join(' AND ')}` : '',
    values,
    nextIndex: idx,
  };
}

function orderSQL(order = 'id_desc') {
  const map = {
    id_desc: `COALESCE(ps.product_stock_id, p.product_stock_id) DESC NULLS LAST`,
    id_asc: `COALESCE(ps.product_stock_id, p.product_stock_id) ASC NULLS LAST`,
    qty_desc: `COALESCE(ps.stock_qty, 0) DESC`,
    qty_asc: `COALESCE(ps.stock_qty, 0) ASC`,
    updated_desc: `ps.updated_at DESC NULLS LAST`,
    updated_asc: `ps.updated_at ASC NULLS LAST`,
    description_asc: `p.description ASC`,
    description_desc: `p.description DESC`,
    suggestion_desc: `(COALESCE(ps.stock_max, 0) - COALESCE(ps.stock_qty, 0)) DESC`,
  };

  return map[String(order || 'id_desc')] || map.id_desc;
}

function baseSelect() {
  return `
    SELECT
      COALESCE(ps.product_stock_id, p.product_stock_id) AS product_stock_id,
      COALESCE(ps.stock_qty, 0) AS stock_qty,
      COALESCE(ps.stock_min, 0) AS stock_min,
      COALESCE(ps.stock_max, 0) AS stock_max,
      ps.created_at,
      ps.updated_at,

      p.product_id,
      p.product_code,
      p.description AS product_description,

      p.product_group_id,
      pg.name AS product_group_name,

      p.product_subgroup_id,
      psg.name AS product_subgroup_name,

      p.manufacturer_id AS product_manufacturer_id,
      pm.name AS manufacturer_name

    FROM ${TB_PRODUCTS} p
    LEFT JOIN ${TB_STOCK} ps
      ON ps.product_stock_id = p.product_stock_id
    LEFT JOIN ${TB_GROUPS} pg
      ON pg.product_group_id = p.product_group_id
    LEFT JOIN ${TB_SUBGROUPS} psg
      ON psg.product_subgroup_id = p.product_subgroup_id
    LEFT JOIN ${TB_MANUFACTURERS} pm
      ON pm.product_manufacturer_id = p.manufacturer_id
  `;
}

export async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public."productsStock" (
      product_stock_id SERIAL PRIMARY KEY,
      stock_qty NUMERIC(14,3) NOT NULL DEFAULT 0,
      stock_min NUMERIC(14,3) NOT NULL DEFAULT 0,
      stock_max NUMERIC(14,3) NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  return { ok: true };
}

export async function list({
  limit = 20,
  offset = 0,
  status = '',
  q = '',
  group_id = null,
  subgroup_id = null,
  manufacturer_id = null,
  product_manufacturer_id = null,
  order = 'id_desc',
} = {}) {
  const lim = Math.max(1, Math.min(300, Number(limit) || 20));
  const off = Math.max(0, Number(offset) || 0);

  const built = buildWhere({
    status,
    q,
    group_id,
    subgroup_id,
    manufacturer_id,
    product_manufacturer_id,
  });

  const { rows } = await pool.query(
    `
    ${baseSelect()}
    ${built.whereSQL}
    ORDER BY ${orderSQL(order)}
    LIMIT $${built.nextIndex} OFFSET $${built.nextIndex + 1};
    `,
    [...built.values, lim, off]
  );

  const { rows: countRows } = await pool.query(
    `
    SELECT COUNT(*)::int AS total
    FROM ${TB_PRODUCTS} p
    LEFT JOIN ${TB_STOCK} ps
      ON ps.product_stock_id = p.product_stock_id
    LEFT JOIN ${TB_GROUPS} pg
      ON pg.product_group_id = p.product_group_id
    LEFT JOIN ${TB_SUBGROUPS} psg
      ON psg.product_subgroup_id = p.product_subgroup_id
    LEFT JOIN ${TB_MANUFACTURERS} pm
      ON pm.product_manufacturer_id = p.manufacturer_id
    ${built.whereSQL};
    `,
    built.values
  );

  return {
    rows: rows.map(rowToModel),
    total: countRows[0]?.total ?? 0,
    limit: lim,
    offset: off,
  };
}

export async function listPurchaseSuggestion(filters = {}) {
  const built = buildWhere(filters);

  const extraWhere = built.whereSQL
    ? `${built.whereSQL} AND COALESCE(ps.stock_max, 0) > COALESCE(ps.stock_qty, 0)`
    : `WHERE COALESCE(ps.stock_max, 0) > COALESCE(ps.stock_qty, 0)`;

  const { rows } = await pool.query(
    `
    ${baseSelect()}
    ${extraWhere}
    ORDER BY
      (COALESCE(ps.stock_max, 0) - COALESCE(ps.stock_qty, 0)) DESC,
      p.description ASC;
    `,
    built.values
  );

  return rows.map(rowToModel);
}

export async function getById(product_stock_id) {
  const { rows } = await pool.query(
    `
    ${baseSelect()}
    WHERE ps.product_stock_id = $1
       OR p.product_stock_id = $1
    LIMIT 1;
    `,
    [product_stock_id]
  );

  return rows[0] ? rowToModel(rows[0]) : null;
}

export async function getByProductCode(productCode) {
  const code = String(productCode ?? '').trim();

  if (!code) {
    throw new Error('product_code é obrigatório');
  }

  const { rows } = await pool.query(
    `
      SELECT
        ps.*,

        p.product_id,
        p.product_code,
        p.description AS product_description,

        COALESCE(ps.stock_qty, 0) AS stock_qty,
        COALESCE(ps.stock_min, 0) AS stock_min,
        COALESCE(ps.stock_max, 0) AS stock_max

      FROM public.products p

      LEFT JOIN public."productsStock" ps
        ON ps.product_stock_id = p.product_stock_id

      WHERE p.product_code = $1

      LIMIT 1
    `,
    [code],
  );

  if (!rows.length) {
    return null;
  }

  const row = rows[0];

  /*
   * Product exists but has no productsStock record.
   *
   * We still return the product identity so the frontend knows
   * that this is the correct SKU, but product_stock_id remains null.
   */
  return {
    ...row,

    product_id:
      row.product_id == null
        ? null
        : Number(row.product_id),

    product_code:
      String(row.product_code ?? '').trim(),

    product_stock_id:
      row.product_stock_id == null
        ? null
        : Number(row.product_stock_id),

    stock_qty:
      Number(row.stock_qty ?? 0),

    stock_min:
      Number(row.stock_min ?? 0),

    stock_max:
      Number(row.stock_max ?? 0),
  };
}

export async function create(payload = {}) {
  const qty = toNumOrZero(payload.stock_qty);
  const smin = toNumOrZero(payload.stock_min);
  const smax = toNumOrZero(payload.stock_max);
  const product_id = toNumOrNull(payload.product_id);

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { rows: created } = await client.query(
      `
      INSERT INTO ${TB_STOCK} (stock_qty, stock_min, stock_max)
      VALUES ($1, $2, $3)
      RETURNING *;
      `,
      [qty, smin, smax]
    );

    const stockId = created[0]?.product_stock_id;

    if (product_id && stockId) {
      await client.query(
        `
        UPDATE ${TB_PRODUCTS}
        SET product_stock_id = $1,
            updated_at = NOW()
        WHERE product_id = $2;
        `,
        [stockId, product_id]
      );
    }

    await client.query('COMMIT');

    return getById(stockId);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function update(product_stock_id, payload = {}) {
  const sets = [];
  const vals = [];
  let idx = 1;

  const map = {
    stock_qty: toNumOrNull(payload.stock_qty),
    stock_min: toNumOrNull(payload.stock_min),
    stock_max: toNumOrNull(payload.stock_max),
  };

  for (const [col, val] of Object.entries(map)) {
    if (val !== null && val !== undefined) {
      sets.push(`${col} = $${idx++}`);
      vals.push(val);
    }
  }

  if (!sets.length) return getById(product_stock_id);

  vals.push(product_stock_id);

  const { rows } = await pool.query(
    `
    UPDATE ${TB_STOCK}
    SET ${sets.join(', ')},
        updated_at = NOW()
    WHERE product_stock_id = $${idx}
    RETURNING *;
    `,
    vals
  );

  return rows[0] ? getById(product_stock_id) : null;
}

export async function adjust(product_stock_id, delta) {
  const d = Number(delta);
  if (!Number.isFinite(d)) throw new Error('delta inválido');

  const { rows } = await pool.query(
    `
    UPDATE ${TB_STOCK}
    SET stock_qty = COALESCE(stock_qty, 0) + $1,
        updated_at = NOW()
    WHERE product_stock_id = $2
    RETURNING *;
    `,
    [d, product_stock_id]
  );

  return rows[0] ? getById(product_stock_id) : null;
}

export async function remove(product_stock_id) {
  const { rows } = await pool.query(
    `
    DELETE FROM ${TB_STOCK}
    WHERE product_stock_id = $1
    RETURNING *;
    `,
    [product_stock_id]
  );

  return rows[0] ? rowToModel(rows[0]) : null;
}

export async function filterOptions() {
  const [groups, subgroups, manufacturers] = await Promise.all([
    pool.query(`
      SELECT product_group_id AS id, name
      FROM public."productsGroups"
      WHERE COALESCE(is_active, true) = true
      ORDER BY name ASC;
    `),

    pool.query(`
      SELECT product_subgroup_id AS id, name
      FROM public."productsSubgroups"
      WHERE COALESCE(is_active, true) = true
      ORDER BY name ASC;
    `),

    pool.query(`
      SELECT product_manufacturer_id AS id, name
      FROM public."productsManufactures"
      WHERE COALESCE(is_active, true) = true
      ORDER BY name ASC;
    `),
  ]);

  return {
    ok: true,
    groups: groups.rows,
    subgroups: subgroups.rows,
    manufacturers: manufacturers.rows,
  };
}

export default {
  ensureTable,
  list,
  listPurchaseSuggestion,
  getById,
  getByProductCode,
  create,
  update,
  adjust,
  remove,
  filterOptions,
};
