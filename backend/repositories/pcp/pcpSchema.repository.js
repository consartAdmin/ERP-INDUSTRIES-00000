// ╔════════════════════════════════════════════════════════════════════╗
// ║ pcpSchema.repository.js — ensureTables do PCP (+ itens de menu)    ║
// ║ Cria as tabelas na primeira chamada; seguro rodar várias vezes.    ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import {
  TB_WORK_CENTERS, TB_BOM, TB_BOM_ITEMS, TB_BOM_OPERATIONS,
  TB_ORDERS, TB_ORDER_MATERIALS, TB_REPORTS, TB_MODULES,
} from './pcp.constants.js';

const MENU_ITEMS = [
  { name: 'Ordens de Produção', path: '/public/pcpProductionOrders/pcpProductionOrders.html' },
  { name: 'Ficha Técnica (Estrutura)', path: '/public/pcpBom/pcpBom.html' },
  { name: 'Centros de Trabalho', path: '/public/pcpWorkCenters/pcpWorkCenters.html' },
  { name: 'Necessidade de Materiais (MRP)', path: '/public/pcpMrp/pcpMrp.html' },
];

let ensured = null;

/** Garante as tabelas uma única vez por processo. */
export function ensureOnce() {
  if (!ensured) ensured = ensureTables().catch((e) => { ensured = null; throw e; });
  return ensured;
}

export async function ensureTables() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      CREATE TABLE IF NOT EXISTS ${TB_WORK_CENTERS} (
        work_center_id     SERIAL PRIMARY KEY,
        code               VARCHAR(20)   NOT NULL UNIQUE,
        name               VARCHAR(100)  NOT NULL,
        hourly_cost        NUMERIC(14,2) NOT NULL DEFAULT 0,
        capacity_hours_day NUMERIC(6,2)  NOT NULL DEFAULT 8,
        notes              TEXT,
        is_active          BOOLEAN       NOT NULL DEFAULT TRUE,
        created_at         TIMESTAMP     NOT NULL DEFAULT NOW(),
        updated_at         TIMESTAMP     NOT NULL DEFAULT NOW()
      );
    `);

    // Ficha técnica: uma estrutura ativa por produto (product_code).
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${TB_BOM} (
        bom_id       SERIAL PRIMARY KEY,
        product_code VARCHAR(50)   NOT NULL,
        version      VARCHAR(20)   NOT NULL DEFAULT '1',
        base_qty     NUMERIC(14,4) NOT NULL DEFAULT 1 CHECK (base_qty > 0),
        notes        TEXT,
        is_active    BOOLEAN       NOT NULL DEFAULT TRUE,
        created_at   TIMESTAMP     NOT NULL DEFAULT NOW(),
        updated_at   TIMESTAMP     NOT NULL DEFAULT NOW(),
        UNIQUE (product_code, version)
      );
    `);
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "pcpBom_one_active_per_product"
        ON ${TB_BOM} (product_code) WHERE is_active;
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS ${TB_BOM_ITEMS} (
        bom_item_id    SERIAL PRIMARY KEY,
        bom_id         INTEGER       NOT NULL REFERENCES ${TB_BOM}(bom_id) ON DELETE CASCADE,
        component_code VARCHAR(50)   NOT NULL,
        quantity       NUMERIC(14,6) NOT NULL CHECK (quantity > 0),
        loss_percent   NUMERIC(6,2)  NOT NULL DEFAULT 0 CHECK (loss_percent >= 0),
        notes          TEXT,
        sort_order     INTEGER       NOT NULL DEFAULT 0
      );
    `);

    // Roteiro: operações da ficha técnica, em sequência, por centro de trabalho.
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${TB_BOM_OPERATIONS} (
        operation_id          SERIAL PRIMARY KEY,
        bom_id                INTEGER       NOT NULL REFERENCES ${TB_BOM}(bom_id) ON DELETE CASCADE,
        seq                   INTEGER       NOT NULL,
        work_center_id        INTEGER       REFERENCES ${TB_WORK_CENTERS}(work_center_id),
        description           VARCHAR(150)  NOT NULL,
        setup_minutes         NUMERIC(10,2) NOT NULL DEFAULT 0,
        run_minutes_per_unit  NUMERIC(10,4) NOT NULL DEFAULT 0
      );
    `);

    await client.query(`CREATE SEQUENCE IF NOT EXISTS public."pcpProductionOrders_number_seq";`);
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${TB_ORDERS} (
        order_id          SERIAL PRIMARY KEY,
        order_number      VARCHAR(20)   NOT NULL UNIQUE,
        product_code      VARCHAR(50)   NOT NULL,
        bom_id            INTEGER       REFERENCES ${TB_BOM}(bom_id),
        quantity_planned  NUMERIC(14,4) NOT NULL CHECK (quantity_planned > 0),
        quantity_produced NUMERIC(14,4) NOT NULL DEFAULT 0,
        quantity_scrap    NUMERIC(14,4) NOT NULL DEFAULT 0,
        status            VARCHAR(20)   NOT NULL DEFAULT 'PLANEJADA',
        due_date          DATE,
        started_at        TIMESTAMP,
        finished_at       TIMESTAMP,
        sales_order_ref   VARCHAR(50),
        stock_posted      BOOLEAN       NOT NULL DEFAULT FALSE,
        notes             TEXT,
        created_by        VARCHAR(100),
        created_at        TIMESTAMP     NOT NULL DEFAULT NOW(),
        updated_at        TIMESTAMP     NOT NULL DEFAULT NOW()
      );
    `);

    // Materiais da OP: "foto" da ficha técnica no momento em que a OP foi criada.
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${TB_ORDER_MATERIALS} (
        order_material_id SERIAL PRIMARY KEY,
        order_id          INTEGER       NOT NULL REFERENCES ${TB_ORDERS}(order_id) ON DELETE CASCADE,
        component_code    VARCHAR(50)   NOT NULL,
        qty_per_unit      NUMERIC(14,6) NOT NULL,
        qty_required      NUMERIC(14,4) NOT NULL,
        qty_consumed      NUMERIC(14,4) NOT NULL DEFAULT 0
      );
    `);

    // Apontamentos de produção.
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${TB_REPORTS} (
        report_id      SERIAL PRIMARY KEY,
        order_id       INTEGER       NOT NULL REFERENCES ${TB_ORDERS}(order_id) ON DELETE CASCADE,
        operation_seq  INTEGER,
        work_center_id INTEGER       REFERENCES ${TB_WORK_CENTERS}(work_center_id),
        qty_good       NUMERIC(14,4) NOT NULL DEFAULT 0,
        qty_scrap      NUMERIC(14,4) NOT NULL DEFAULT 0,
        minutes        NUMERIC(10,2) NOT NULL DEFAULT 0,
        operator_name  VARCHAR(100),
        notes          TEXT,
        reported_at    TIMESTAMP     NOT NULL DEFAULT NOW()
      );
    `);

    await ensureMenu(client);

    await client.query('COMMIT');
    return { ok: true };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

// Cria o dropdown "PCP / Produção" no menu (moduleSystem), se ainda não existir.
async function ensureMenu(client) {
  const { rows: [table] } = await client.query(`SELECT to_regclass('public."moduleSystem"') AS t`);
  if (!table?.t) return;

  let { rows: [parent] } = await client.query(
    `SELECT id FROM ${TB_MODULES} WHERE menu_type = 'dropdown' AND html_id = 'pcp-producao' LIMIT 1`
  );

  if (!parent) {
    ({ rows: [parent] } = await client.query(
      `INSERT INTO ${TB_MODULES} (name, path, is_active, menu_type, parent_id, sort_order, html_id)
       VALUES ('PCP / Produção', '#', true, 'dropdown', NULL,
               (SELECT COALESCE(MAX(sort_order), 0) + 10 FROM ${TB_MODULES} WHERE parent_id IS NULL),
               'pcp-producao')
       RETURNING id`
    ));
  }

  for (const [i, item] of MENU_ITEMS.entries()) {
    await client.query(
      `INSERT INTO ${TB_MODULES} (name, path, is_active, menu_type, parent_id, sort_order)
       SELECT $1::varchar, $2::varchar, true, 'link', $3::bigint, $4::int
        WHERE NOT EXISTS (SELECT 1 FROM ${TB_MODULES} WHERE path = $2::varchar)`,
      [item.name, item.path, parent.id, (i + 1) * 10]
    );
  }
}
