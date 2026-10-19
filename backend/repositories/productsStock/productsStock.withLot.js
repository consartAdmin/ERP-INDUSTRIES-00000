// ╔══════════════════════════════════════════════════════════════════════╗
// ║ productsStock.withLot.js — Estratégia de estoque com lote           ║
// ║ Tabela: public."productsStockLots"                                  ║
// ║ ✅ Lotes por product_stock_id                                        ║
// ║ ✅ NOVO: suporte a product_grade_id                                  ║
// ║ ✅ Estoque por: product_stock_id + product_grade_id + lote + validade ║
// ║ ✅ Recalcula productsStock.stock_qty automaticamente                 ║
// ╚══════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';

import {
  resolveInboundFiscal,
} from '../../services/fiscal/inboundFiscalResolver.js';

const TB_LOTS = 'public."productsStockLots"';
const TB_STOCK = 'public."productsStock"';
const TB_GRADES = 'public."productsGrades"';
const TB_GRADE_CAD = 'public."grades"';
const TB_PRODUCTS = 'public.products';

const ORDER_FIELDS = new Set([
  'expires_at',
  'lot_code',
  'created_at',
  'updated_at',
  'qty_on_hand',
  'qty_reserved',
]);

async function getInboundItemForLot(client, lot) {
  if (!lot?.lot_id) {
    return null;
  }

  /* ============================================================
     PRIORITY 1
     Exact NF-e identity: chave + sequência do item
  ============================================================ */

  if (
    lot.nfe_key &&
    lot.nfe_item_seq !== null &&
    lot.nfe_item_seq !== undefined
  ) {
    const exact = await client.query(
      `
        SELECT
          ii.inbound_item_id AS id,
          ii.inbound_item_id,
          ii.inbound_id AS invoice_id,

          ii.product_code,
          ii.description,

          ii.ncm,
          ii.cfop,
          ii.unit,

          ii.quantity,
          ii.unit_price,
          ii.total_price,

          ii.ipi,
          ii.icms,

          ii.product_id,
          ii.nf_product_code,

          ii.lot_id,
          ii.product_grade_id,

          ii.icms_cst,
          ii.icms_base,
          ii.icms_rate,

          ii.icms_st_base,
          ii.icms_st_rate,
          ii.icms_st_value,

          ii.nfe_key,
          ii.nfe_item_seq,

          inv.inbound_id,
          inv.invoice_number,
          inv.series,
          TRIM(inv.access_key) AS access_key,
          inv.issue_date,
          inv.entry_date,
          inv.status AS invoice_status

        FROM public."inboundInvoiceItems" ii

        INNER JOIN public."inboundInvoices" inv
          ON inv.inbound_id = ii.inbound_id

        WHERE TRIM(ii.nfe_key) = TRIM($1)
          AND ii.nfe_item_seq = $2

        ORDER BY ii.inbound_item_id DESC

        LIMIT 1
      `,
      [
        String(lot.nfe_key).trim(),
        Number(lot.nfe_item_seq),
      ],
    );

    if (exact.rows[0]) {
      return exact.rows[0];
    }
  }

  /* ============================================================
     PRIORITY 2
     Legacy relationship through lot_id
  ============================================================ */

  const byLot = await client.query(
    `
      SELECT
        ii.inbound_item_id AS id,
        ii.inbound_item_id,
        ii.inbound_id AS invoice_id,

        ii.product_code,
        ii.description,

        ii.ncm,
        ii.cfop,
        ii.unit,

        ii.quantity,
        ii.unit_price,
        ii.total_price,

        ii.ipi,
        ii.icms,

        ii.product_id,
        ii.nf_product_code,

        ii.lot_id,
        ii.product_grade_id,

        ii.icms_cst,
        ii.icms_base,
        ii.icms_rate,

        ii.icms_st_base,
        ii.icms_st_rate,
        ii.icms_st_value,

        ii.nfe_key,
        ii.nfe_item_seq,

        inv.inbound_id,
        inv.invoice_number,
        inv.series,
        TRIM(inv.access_key) AS access_key,
        inv.issue_date,
        inv.entry_date,
        inv.status AS invoice_status

      FROM public."inboundInvoiceItems" ii

      INNER JOIN public."inboundInvoices" inv
        ON inv.inbound_id = ii.inbound_id

      WHERE ii.lot_id = $1

      ORDER BY
        inv.issue_date DESC NULLS LAST,
        ii.inbound_item_id DESC

      LIMIT 1
    `,
    [lot.lot_id],
  );

  return byLot.rows[0] || null;
}

function safeOrder(field, dir) {
  const f = ORDER_FIELDS.has(field) ? field : 'expires_at';
  const d = String(dir || 'asc').toLowerCase() === 'desc' ? 'DESC' : 'ASC';
  return { field: f, dir: d };
}

function normalizeNullableNumber(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function normalizeLotCode(value) {
  return String(value || '').trim();
}

function normalizeDateOrNull(value) {
  if (!value) return null;
  return value;
}

export async function recalcStockFromLots(product_stock_id, client = pool) {
  await client.query(
    `
    UPDATE ${TB_STOCK} ps
       SET stock_qty = COALESCE((
         SELECT SUM(l.qty_on_hand - l.qty_reserved)
           FROM ${TB_LOTS} l
          WHERE l.product_stock_id = $1
            AND COALESCE(l.is_active, true) = true
            AND l.deleted_at IS NULL
       ), 0),
           updated_at = NOW()
     WHERE ps.product_stock_id = $1
    `,
    [product_stock_id]
  );
}

export async function ensureProductsStockLotsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${TB_LOTS} (
      lot_id bigserial PRIMARY KEY,

      product_stock_id bigint NOT NULL
        REFERENCES ${TB_STOCK}(product_stock_id)
        ON UPDATE CASCADE ON DELETE CASCADE,

      product_grade_id integer NULL,

      lot_code text NOT NULL,
      expires_at date NULL,

      qty_on_hand numeric(14,3) NOT NULL DEFAULT 0,
      qty_reserved numeric(14,3) NOT NULL DEFAULT 0,

      cost_unit numeric(14,6) NULL,
      supplier_id bigint NULL,
      nfe_key text NULL,
      nfe_item_seq integer NULL,

      is_active boolean NOT NULL DEFAULT true,
      deleted_at timestamp without time zone NULL,

      created_at timestamp without time zone NOT NULL DEFAULT now(),
      updated_at timestamp without time zone NOT NULL DEFAULT now(),

      CONSTRAINT ck_psl_qty_nonneg CHECK (qty_on_hand >= 0 AND qty_reserved >= 0),
      CONSTRAINT ck_psl_reserved_le_onhand CHECK (qty_reserved <= qty_on_hand)
    );
  `);

  await pool.query(`
    ALTER TABLE ${TB_LOTS}
    ADD COLUMN IF NOT EXISTS product_grade_id integer NULL,
    ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS deleted_at timestamp without time zone NULL;
  `);

  await pool.query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
          FROM information_schema.tables
         WHERE table_schema = 'public'
           AND table_name = 'productsGrades'
      )
      AND NOT EXISTS (
        SELECT 1
          FROM pg_constraint
         WHERE conname = 'fk_productsStockLots_product_grade'
      ) THEN
        ALTER TABLE ${TB_LOTS}
        ADD CONSTRAINT "fk_productsStockLots_product_grade"
        FOREIGN KEY (product_grade_id)
        REFERENCES ${TB_GRADES}(product_grade_id)
        ON UPDATE CASCADE
        ON DELETE SET NULL;
      END IF;
    END $$;
  `);

  await pool.query(`
    ALTER TABLE ${TB_LOTS}
    DROP CONSTRAINT IF EXISTS "productsStockLots_product_stock_id_lot_code_key";
  `);

  await pool.query(`DROP INDEX IF EXISTS public."ux_productsStockLots_stock_lot_norm";`);
  await pool.query(`DROP INDEX IF EXISTS public."ux_psl_stock_lot_exp";`);
  await pool.query(`DROP INDEX IF EXISTS public."ux_psl_stock_lot";`);
  await pool.query(`DROP INDEX IF EXISTS public."ux_psl_stock_grade_lot_norm";`);
  await pool.query(`DROP INDEX IF EXISTS public."ux_psl_stock_grade_lot_exp";`);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_psl_expires
      ON ${TB_LOTS} (expires_at);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_psl_stock
      ON ${TB_LOTS} (product_stock_id);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_productsStockLots_product_grade_id
      ON ${TB_LOTS} (product_grade_id);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_productsStockLots_is_active
      ON ${TB_LOTS} (is_active);
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS ux_psl_stock_grade_lot_norm_active
      ON ${TB_LOTS} (
        product_stock_id,
        COALESCE(product_grade_id, 0),
        lower(btrim(lot_code))
      )
      WHERE COALESCE(is_active, true) = true;
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS ux_psl_stock_grade_lot_exp_active
      ON ${TB_LOTS} (
        product_stock_id,
        COALESCE(product_grade_id, 0),
        lower(btrim(lot_code)),
        COALESCE(expires_at, DATE '9999-12-31')
      )
      WHERE COALESCE(is_active, true) = true;
  `);

  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'trg_productsstocklots_updated_at'
      ) THEN
        EXECUTE '
          CREATE TRIGGER trg_productsstocklots_updated_at
          BEFORE UPDATE ON ${TB_LOTS}
          FOR EACH ROW EXECUTE FUNCTION set_updated_at()
        ';
      END IF;
    END $$;
  `);

  await pool.query(`
    CREATE OR REPLACE FUNCTION public.recalc_products_stock_from_lots(p_product_stock_id bigint)
    RETURNS void
    LANGUAGE plpgsql
    AS $$
    BEGIN
      UPDATE public."productsStock" ps
         SET stock_qty = COALESCE((
           SELECT SUM(l.qty_on_hand - l.qty_reserved)
             FROM public."productsStockLots" l
            WHERE l.product_stock_id = p_product_stock_id
              AND COALESCE(l.is_active, true) = true
              AND l.deleted_at IS NULL
         ), 0)
       WHERE ps.product_stock_id = p_product_stock_id;
    END;
    $$;
  `);

  await pool.query(`
    CREATE OR REPLACE FUNCTION public.trg_psl_recalc_stock()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    DECLARE
      v_stock_id bigint;
    BEGIN
      v_stock_id := COALESCE(NEW.product_stock_id, OLD.product_stock_id);
      PERFORM public.recalc_products_stock_from_lots(v_stock_id);
      RETURN COALESCE(NEW, OLD);
    END;
    $$;
  `);

  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'trg_psl_recalc_stock'
      ) THEN
        EXECUTE '
          CREATE TRIGGER trg_psl_recalc_stock
          AFTER INSERT OR UPDATE OR DELETE ON ${TB_LOTS}
          FOR EACH ROW EXECUTE FUNCTION public.trg_psl_recalc_stock()
        ';
      END IF;
    END $$;
  `);
}

export async function getStockQtyByProductStockId(product_stock_id, client = pool) {
  const rs = await client.query(
    `
    SELECT COALESCE(stock_qty,0) AS stock_qty
      FROM ${TB_STOCK}
     WHERE product_stock_id = $1
     LIMIT 1
    `,
    [product_stock_id]
  );

  return Number(rs.rows?.[0]?.stock_qty || 0);
}

async function getProductStockIdByLotId(lot_id, client = pool) {
  const rs = await client.query(
    `
    SELECT product_stock_id
      FROM ${TB_LOTS}
     WHERE lot_id = $1
     LIMIT 1
    `,
    [lot_id]
  );

  if (!rs.rowCount) {
    const e = new Error('LOT_NOT_FOUND');
    e.status = 404;
    throw e;
  }

  return Number(rs.rows[0].product_stock_id);
}

async function assertPositiveStockByProductStockId(product_stock_id, client = pool) {
  const qty = await getStockQtyByProductStockId(product_stock_id, client);

  if (!(qty > 0)) {
    const e = new Error('BLOCKED_NO_POSITIVE_STOCK');
    e.status = 400;
    e.details = { product_stock_id, stock_qty: qty };
    throw e;
  }

  return qty;
}

async function assertCanMoveLotByLotId(lot_id, client = pool) {
  const product_stock_id = await getProductStockIdByLotId(lot_id, client);
  const stock_qty = await assertPositiveStockByProductStockId(product_stock_id, client);
  return { product_stock_id, stock_qty };
}

export async function resolveProductGradeId({ product_id, product_code, grade_id }, client = pool) {
  const gid = normalizeNullableNumber(grade_id);
  const pid = product_id || product_code;

  if (!pid || !gid) return null;

  const rs = await client.query(
    `
    SELECT product_grade_id
      FROM ${TB_GRADES}
     WHERE product_id = $1
       AND grade_id = $2
       AND COALESCE(is_active, true) = true
     LIMIT 1
    `,
    [String(pid).trim(), gid]
  );

  return rs.rows?.[0]?.product_grade_id || null;
}

export async function listLots({
  product_stock_id,
  product_grade_id = null,
  q,
  onlyAvailable = false,
  page = 1,
  limit = 20,
  orderBy = 'expires_at',
  dir = 'asc',
}) {
  const p = Math.max(1, Number(page) || 1);
  const l = Math.min(200, Math.max(1, Number(limit) || 20));
  const offset = (p - 1) * l;
  const { field, dir: safeDir } = safeOrder(orderBy, dir);

  const where = [];
  const params = [];

  if (product_stock_id) {
    params.push(Number(product_stock_id));
    where.push(`l.product_stock_id = $${params.length}`);
  }

  if (product_grade_id !== undefined && product_grade_id !== null && product_grade_id !== '') {
    params.push(normalizeNullableNumber(product_grade_id));
    where.push(`COALESCE(l.product_grade_id, 0) = COALESCE($${params.length}, 0)`);
  }

  if (q) {
    params.push(`%${q}%`);
    where.push(`l.lot_code ILIKE $${params.length}`);
  }

  if (onlyAvailable) {
    where.push(`(l.qty_on_hand - l.qty_reserved) > 0`);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const countRes = await pool.query(
    `
    SELECT COUNT(*)::bigint AS total
      FROM ${TB_LOTS} l
      ${whereSql}
    `,
    params
  );

  params.push(l, offset);

  const rowsRes = await pool.query(
    `
  SELECT
    l.*,
    pg.grade_id,
    pg.product_id AS grade_product_id,
    COALESCE(g.grade, pg.grade_id::text) AS grade_name,
    COALESCE(g.description, g.grade, pg.grade_id::text) AS grade_description,
    (l.qty_on_hand - l.qty_reserved) AS qty_available
  FROM ${TB_LOTS} l
  LEFT JOIN ${TB_GRADES} pg
    ON pg.product_grade_id = l.product_grade_id
  LEFT JOIN ${TB_GRADE_CAD} g
    ON g.grade_id = pg.grade_id
  ${whereSql}
  ORDER BY
    CASE WHEN l.expires_at IS NULL THEN 1 ELSE 0 END,
    l.${field} ${safeDir},
    l.lot_id ASC
  LIMIT $${params.length - 1} OFFSET $${params.length}
  `,
    params
  );

  return {
    page: p,
    limit: l,
    total: Number(countRes.rows[0]?.total || 0),
    rows: rowsRes.rows,
  };
}

export async function getLotById(lot_id) {
  const id = Number(lot_id);

  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }

  const client = await pool.connect();

  try {
    /* ============================================================
       LOT + PRODUCT + GRADE
    ============================================================ */

    const result = await client.query(
      `
        SELECT
          l.*,

          p.product_id,
          p.product_code,
          p.description AS product_description,
          p.cost_price AS product_cost_price,

          pg.grade_id,
          pg.product_id AS grade_product_id,

          COALESCE(
            g.grade,
            pg.grade_id::text,
            'Padrão'
          ) AS grade_name,

          COALESCE(
            g.description,
            g.grade,
            pg.grade_id::text,
            'Padrão'
          ) AS grade_description,

          (
            l.qty_on_hand -
            l.qty_reserved
          ) AS qty_available

        FROM ${TB_LOTS} l

        LEFT JOIN ${TB_PRODUCTS} p
          ON p.product_stock_id =
             l.product_stock_id

        LEFT JOIN ${TB_GRADES} pg
          ON pg.product_grade_id =
             l.product_grade_id

        LEFT JOIN ${TB_GRADE_CAD} g
          ON g.grade_id =
             pg.grade_id

        WHERE l.lot_id = $1

        LIMIT 1
      `,
      [id],
    );

    const lot = result.rows[0] || null;

    if (!lot) {
      return null;
    }

    /* ============================================================
       INBOUND NF-e ITEM

       Priority inside helper:
       1. inboundInvoiceItems.lot_id
       2. nfe_key + nfe_item_seq
    ============================================================ */

    const inboundItem =
      await getInboundItemForLot(
        client,
        lot,
      );

    /* ============================================================
       ORIGINAL QUANTITY

       Never use current lot balance when inbound quantity exists.
    ============================================================ */

    const inboundQuantity =
      inboundItem?.quantity != null
        ? Number(inboundItem.quantity)
        : null;

    /* ============================================================
       FISCAL RESOLVER
    ============================================================ */

    let fiscal = null;

    if (lot.product_code) {
      fiscal = await resolveInboundFiscal({
        client,

        productCode:
          lot.product_code,

        inboundItem:
          inboundItem || null,

        quantity:
          inboundQuantity != null &&
            inboundQuantity > 0
            ? inboundQuantity
            : 1,
      });
    }

    /* ============================================================
       RESPONSE
    ============================================================ */

    return {
      ...lot,

      inbound_invoice_item:
        inboundItem || null,

      fiscal:
        fiscal || null,
    };
  } finally {
    client.release();
  }
}

export async function listLotsOptionsByStockId(product_stock_id, product_grade_id = null) {
  const params = [Number(product_stock_id)];
  const where = [`l.product_stock_id = $1`];

  if (product_grade_id !== undefined && product_grade_id !== null && product_grade_id !== '') {
    params.push(normalizeNullableNumber(product_grade_id));
    where.push(`COALESCE(l.product_grade_id, 0) = COALESCE($${params.length}, 0)`);
  }

  const res = await pool.query(
    `
    SELECT
      l.lot_id,
      l.product_stock_id,
      l.product_grade_id,

      pg.grade_id,
      pg.product_id AS grade_product_id,

      COALESCE(g.grade, pg.grade_id::text, 'Padrão') AS grade_name,
      COALESCE(g.description, g.grade, pg.grade_id::text, 'Padrão') AS grade_description,

      l.lot_code,
      l.expires_at,
      l.qty_on_hand,
      l.qty_reserved,
      (l.qty_on_hand - l.qty_reserved) AS qty_available

    FROM ${TB_LOTS} l

    LEFT JOIN ${TB_GRADES} pg
      ON pg.product_grade_id = l.product_grade_id

    LEFT JOIN ${TB_GRADE_CAD} g
      ON g.grade_id = pg.grade_id

    WHERE ${where.join(' AND ')}

    ORDER BY
      l.expires_at NULLS LAST,
      l.lot_code ASC,
      l.lot_id ASC
    `,
    params
  );

  return res.rows;
}

export async function upsertLot({
  product_stock_id,
  product_grade_id = null,
  lot_code,
  expires_at = null,
  qty_on_hand = 0,
  cost_unit = null,
  supplier_id = null,
  nfe_key = null,
  nfe_item_seq = null,
}) {
  const stockId = Number(product_stock_id);
  const gradeId = normalizeNullableNumber(product_grade_id);
  const lotCode = normalizeLotCode(lot_code);
  const expiresAt = normalizeDateOrNull(expires_at);
  const qty = Number(qty_on_hand || 0);

  if (!stockId) throw new Error('product_stock_id is required');
  if (!lotCode) throw new Error('lot_code is required');

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const existing = await client.query(
      `
      SELECT *
        FROM ${TB_LOTS}
       WHERE product_stock_id = $1
         AND COALESCE(product_grade_id, 0) = COALESCE($2, 0)
         AND lower(btrim(lot_code)) = lower(btrim($3))
         AND COALESCE(expires_at, DATE '9999-12-31') = COALESCE($4::date, DATE '9999-12-31')
       FOR UPDATE
      `,
      [stockId, gradeId, lotCode, expiresAt]
    );

    let row;

    if (existing.rowCount) {
      const upd = await client.query(
        `
        UPDATE ${TB_LOTS}
           SET qty_on_hand = qty_on_hand + $2,
               cost_unit = COALESCE($3, cost_unit),
               supplier_id = COALESCE($4, supplier_id),
               nfe_key = COALESCE($5, nfe_key),
               nfe_item_seq = COALESCE($6, nfe_item_seq),
               product_grade_id = COALESCE($7, product_grade_id)
         WHERE lot_id = $1
        RETURNING *
        `,
        [
          existing.rows[0].lot_id,
          qty,
          cost_unit,
          supplier_id,
          nfe_key,
          nfe_item_seq,
          gradeId,
        ]
      );

      row = upd.rows[0];
    } else {
      const ins = await client.query(
        `
        INSERT INTO ${TB_LOTS}
          (
            product_stock_id,
            product_grade_id,
            lot_code,
            expires_at,
            qty_on_hand,
            cost_unit,
            supplier_id,
            nfe_key,
            nfe_item_seq
          )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        RETURNING *
        `,
        [
          stockId,
          gradeId,
          lotCode,
          expiresAt,
          qty,
          cost_unit,
          supplier_id,
          nfe_key,
          nfe_item_seq,
        ]
      );

      row = ins.rows[0];
    }

    await recalcStockFromLots(stockId, client);
    await client.query('COMMIT');

    return row;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export async function updateLot(lot_id, data) {
  const wantsReserved = Object.prototype.hasOwnProperty.call(data, 'qty_reserved');

  if (wantsReserved) {
    await assertCanMoveLotByLotId(lot_id, pool);
  }

  const fields = [];
  const params = [];

  const allowed = [
    'product_grade_id',
    'lot_code',
    'expires_at',
    'qty_on_hand',
    'qty_reserved',
    'cost_unit',
    'supplier_id',
    'nfe_key',
    'nfe_item_seq',
  ];

  for (const k of allowed) {
    if (Object.prototype.hasOwnProperty.call(data, k)) {
      let value = data[k];

      if (k === 'product_grade_id') {
        value = normalizeNullableNumber(value);
      }

      if (k === 'lot_code') {
        value = normalizeLotCode(value);
      }

      if (k === 'expires_at') {
        value = normalizeDateOrNull(value);
      }

      params.push(value);
      fields.push(`${k} = $${params.length}`);
    }
  }

  if (!fields.length) return await getLotById(lot_id);

  params.push(lot_id);

  const res = await pool.query(
    `
    UPDATE ${TB_LOTS}
       SET ${fields.join(', ')}
     WHERE lot_id = $${params.length}
    RETURNING *
    `,
    params
  );

  return res.rows[0] || null;
}

export async function removeLot(lot_id) {
  const id = Number(lot_id);

  if (!Number.isFinite(id) || id <= 0) {
    const e = new Error('INVALID_LOT_ID');
    e.status = 400;
    throw e;
  }

  const lot = await getLotById(id);

  if (!lot) {
    return {
      ok: true,
      removed: 0,
      softDeleted: false,
      message: 'Lote não encontrado ou já removido.',
    };
  }

  const used = await pool.query(
    `
    SELECT COUNT(*)::int AS total
      FROM public."inventoryItems"
     WHERE lot_id = $1
    `,
    [id]
  );

  const totalUsed = Number(used.rows[0]?.total || 0);

  if (totalUsed > 0) {
    const res = await pool.query(
      `
      UPDATE ${TB_LOTS}
         SET is_active = false,
             deleted_at = NOW()
       WHERE lot_id = $1
       RETURNING *
      `,
      [id]
    );

    return {
      ok: true,
      removed: 0,
      softDeleted: true,
      message: 'Lote inativado porque já possui vínculo com inventário.',
      lot: res.rows[0],
    };
  }

  await pool.query(`DELETE FROM ${TB_LOTS} WHERE lot_id = $1`, [id]);

  return {
    ok: true,
    removed: 1,
    softDeleted: false,
    message: 'Lote removido definitivamente.',
    lot,
  };
}

export async function reserveLot({ lot_id, qty }) {
  const q = Number(qty);

  if (!lot_id) throw new Error('lot_id is required');
  if (!(q > 0)) throw new Error('qty must be > 0');

  await assertCanMoveLotByLotId(lot_id, pool);

  const res = await pool.query(
    `
    UPDATE ${TB_LOTS}
       SET qty_reserved = qty_reserved + $2
     WHERE lot_id = $1
       AND (qty_on_hand - qty_reserved) >= $2
    RETURNING *, (qty_on_hand - qty_reserved) AS qty_available
    `,
    [lot_id, q]
  );

  if (!res.rowCount) {
    throw new Error('Insufficient available quantity to reserve in this lot');
  }

  return res.rows[0];
}

export async function unreserveLot({ lot_id, qty }) {
  const q = Number(qty);

  if (!lot_id) throw new Error('lot_id is required');
  if (!(q > 0)) throw new Error('qty must be > 0');

  await assertCanMoveLotByLotId(lot_id, pool);

  const res = await pool.query(
    `
    UPDATE ${TB_LOTS}
       SET qty_reserved = GREATEST(0, qty_reserved - $2)
     WHERE lot_id = $1
    RETURNING *, (qty_on_hand - qty_reserved) AS qty_available
    `,
    [lot_id, q]
  );

  if (!res.rowCount) throw new Error('Lot not found');

  return res.rows[0];
}

export async function consumeLot({
  lot_id,
  qty,
}) {
  const q = Number(qty);

  if (!lot_id) {
    throw new Error('lot_id is required');
  }

  if (!(q > 0)) {
    throw new Error('qty must be > 0');
  }

  /*
   * IMPORTANTE:
   * Consumo confirmado pode levar o lote e o estoque mestre a negativo.
   *
   * Não usamos assertCanMoveLotByLotId(), porque esse helper exige
   * stock_qty > 0 e bloquearia justamente o estoque negativo.
   *
   * Aqui validamos somente se o lote existe.
   */
  const product_stock_id =
    await getProductStockIdByLotId(
      lot_id,
      pool,
    );

  const res = await pool.query(
    `
      UPDATE ${TB_LOTS}
      SET
        qty_reserved =
          GREATEST(
            0,
            qty_reserved - $2
          ),

        qty_on_hand =
          COALESCE(qty_on_hand, 0) - $2,

        updated_at =
          NOW()

      WHERE lot_id = $1
        AND COALESCE(is_active, TRUE) = TRUE
        AND deleted_at IS NULL

      RETURNING
        *,
        (
          qty_on_hand -
          qty_reserved
        ) AS qty_available
    `,
    [
      lot_id,
      q,
    ],
  );

  if (!res.rowCount) {
    /*
     * getProductStockIdByLotId() já confirmou que a linha existe: ele
     * consulta apenas por lot_id, sem filtrar is_active/deleted_at.
     *
     * Portanto chegar aqui significa quase sempre que o lote EXISTE mas foi
     * inativado ou excluído logicamente depois de ter sido reservado pelo
     * orçamento — e não que ele sumiu. Relatar "LOT_NOT_FOUND" nesse caso
     * manda quem está depurando procurar a coisa errada, então buscamos o
     * estado real do lote antes de montar o erro.
     */
    const { rows: statusRows } = await pool.query(
      `
        SELECT
          lot_id,
          product_stock_id,
          lot_code,
          qty_on_hand,
          qty_reserved,
          COALESCE(is_active, TRUE) AS is_active,
          deleted_at
        FROM ${TB_LOTS}
        WHERE lot_id = $1
        LIMIT 1
      `,
      [lot_id],
    );

    const lot = statusRows[0] || null;

    const inactive =
      lot !== null &&
      (lot.is_active === false || lot.deleted_at !== null);

    const e = new Error(inactive ? 'LOT_INACTIVE' : 'LOT_NOT_FOUND');

    e.status = inactive ? 409 : 404;

    e.code = inactive ? 'LOT_INACTIVE' : 'LOT_NOT_FOUND';

    e.details = {
      lot_id,
      product_stock_id,
      lot_code: lot?.lot_code ?? null,
      is_active: lot?.is_active ?? null,
      deleted_at: lot?.deleted_at ?? null,
      qty_on_hand: lot?.qty_on_hand ?? null,
      qty_reserved: lot?.qty_reserved ?? null,
      reason: inactive
        ? 'O lote existe, mas está inativo ou excluído e não pode ser baixado.'
        : 'O lote não existe mais na tabela de lotes.',
    };

    throw e;
  }

  console.log(
    '[STOCK][LOT][CONSUME]',
    {
      product_stock_id,
      lot_id: Number(lot_id),
      qty_consumed: q,
      qty_on_hand:
        Number(res.rows[0].qty_on_hand),
      qty_reserved:
        Number(res.rows[0].qty_reserved),
      qty_available:
        Number(res.rows[0].qty_available),
    },
  );

  return res.rows[0];
}

export async function listLotsFefo(product_stock_id, product_grade_id = null) {
  const params = [Number(product_stock_id)];
  const where = [
    `l.product_stock_id = $1`,
    `(l.qty_on_hand - l.qty_reserved) > 0`,
  ];

  if (product_grade_id !== undefined && product_grade_id !== null && product_grade_id !== '') {
    params.push(normalizeNullableNumber(product_grade_id));
    where.push(`COALESCE(l.product_grade_id, 0) = COALESCE($${params.length}, 0)`);
  }

  const res = await pool.query(
    `
    SELECT
      l.*,
      pg.grade_id,
      pg.product_id AS grade_product_id,
      (l.qty_on_hand - l.qty_reserved) AS qty_available
    FROM ${TB_LOTS} l
    LEFT JOIN ${TB_GRADES} pg
      ON pg.product_grade_id = l.product_grade_id
    WHERE ${where.join(' AND ')}
    ORDER BY
      l.expires_at NULLS LAST,
      l.lot_code ASC,
      l.lot_id ASC
    `,
    params
  );

  return res.rows;
}

export async function listAvailableLotsByProduct(product_stock_id, product_grade_id = null) {
  const params = [Number(product_stock_id)];
  const where = [
    `l.product_stock_id = $1`,
    `(l.qty_on_hand - l.qty_reserved) > 0`,
  ];

  if (product_grade_id !== undefined && product_grade_id !== null && product_grade_id !== '') {
    params.push(normalizeNullableNumber(product_grade_id));
    where.push(`COALESCE(l.product_grade_id, 0) = COALESCE($${params.length}, 0)`);
  }

  const res = await pool.query(
    `
    SELECT
      l.lot_id,
      l.product_stock_id,
      l.product_grade_id,
      pg.grade_id,
      pg.product_id AS grade_product_id,
      l.lot_code,
      l.expires_at,
      l.qty_on_hand,
      l.qty_reserved,
      (l.qty_on_hand - l.qty_reserved) AS qty_available
    FROM ${TB_LOTS} l
    LEFT JOIN ${TB_GRADES} pg
      ON pg.product_grade_id = l.product_grade_id
    WHERE ${where.join(' AND ')}
    ORDER BY
      l.expires_at NULLS LAST,
      l.lot_code ASC,
      l.lot_id ASC
    `,
    params
  );

  return res.rows;
}

export async function getProductsStockLotsByProductCode(product_code, product_grade_id = null) {
  const sku = String(product_code || '').trim();

  if (!sku) throw new Error('product_code is required');

  const params = [sku];
  const where = [`p.product_code = $1`];

  if (product_grade_id !== undefined && product_grade_id !== null && product_grade_id !== '') {
    params.push(normalizeNullableNumber(product_grade_id));
    where.push(`COALESCE(psl.product_grade_id, 0) = COALESCE($${params.length}, 0)`);
  }

  const sql = `
    SELECT
      psl.lot_id,
      psl.product_stock_id,
      psl.product_grade_id,
      pg.grade_id,
      pg.product_id AS grade_product_id,
      psl.lot_code,
      psl.expires_at,
      psl.qty_on_hand,
      psl.qty_reserved,
      (psl.qty_on_hand - psl.qty_reserved) AS qty_available
    FROM ${TB_PRODUCTS} p
    JOIN ${TB_LOTS} psl
      ON psl.product_stock_id = p.product_stock_id
    LEFT JOIN ${TB_GRADES} pg
      ON pg.product_grade_id = psl.product_grade_id
    WHERE ${where.join(' AND ')}
    ORDER BY
      psl.expires_at NULLS LAST,
      psl.lot_code ASC,
      psl.lot_id ASC
  `;

  const { rows } = await pool.query(sql, params);

  return rows;
}

export default {
  ensureProductsStockLotsTable,
  recalcStockFromLots,
  getStockQtyByProductStockId,
  resolveProductGradeId,
  listLots,
  listLotsFefo,
  getLotById,
  listLotsOptionsByStockId,
  upsertLot,
  updateLot,
  removeLot,
  reserveLot,
  unreserveLot,
  consumeLot,
  listAvailableLotsByProduct,
  getProductsStockLotsByProductCode,
};
