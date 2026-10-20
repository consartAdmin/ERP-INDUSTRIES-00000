// ╔════════════════════════════════════════════════════════════════════╗
// ║ pcpSchema.repository.js — ensureTables do PCP (+ itens de menu)    ║
// ║ Cria as tabelas na primeira chamada; seguro rodar várias vezes.    ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import {
  TB_WORK_CENTERS, TB_BOM, TB_BOM_ITEMS, TB_BOM_OPERATIONS,
  TB_ORDERS, TB_ORDER_MATERIALS, TB_REPORTS, TB_MODULES,
  TB_RAW_MATERIALS, TB_RAW_MOVEMENTS, TB_RAW_SUPPLIER_REFS, TB_INBOUND_ITEMS,
} from './pcp.constants.js';
import { ensureItemTypeColumn } from '../products/productsItemType.js';

const MENU_ITEMS = [
  { name: 'Matérias-primas', path: '/public/pcpRawMaterials/pcpRawMaterials.html' },
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
  // products.item_type: a busca de produtos do PCP filtra por tipo do item.
  await ensureItemTypeColumn();

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

    // Matérias-primas: cadastro próprio, separado de products (decisão do Renato, 2026-10-20).
    // Estoque e custo médio ficam aqui; as notas de entrada alimentam as movimentações.
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${TB_RAW_MATERIALS} (
        raw_material_id SERIAL PRIMARY KEY,
        code            VARCHAR(50)   NOT NULL UNIQUE,
        description     VARCHAR(200)  NOT NULL,
        unit            VARCHAR(10)   NOT NULL DEFAULT 'UN',
        ncm             VARCHAR(10),
        last_cost       NUMERIC(14,6) NOT NULL DEFAULT 0,
        average_cost    NUMERIC(14,6) NOT NULL DEFAULT 0,
        stock_qty       NUMERIC(14,4) NOT NULL DEFAULT 0,
        min_stock       NUMERIC(14,4) NOT NULL DEFAULT 0,
        notes           TEXT,
        is_active       BOOLEAN       NOT NULL DEFAULT TRUE,
        created_at      TIMESTAMP     NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMP     NOT NULL DEFAULT NOW()
      );
    `);

    // Histórico de estoque da matéria-prima (entrada por NF-e, consumo por OP, ajuste manual).
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${TB_RAW_MOVEMENTS} (
        movement_id     SERIAL PRIMARY KEY,
        raw_material_id INTEGER       NOT NULL REFERENCES ${TB_RAW_MATERIALS}(raw_material_id) ON DELETE CASCADE,
        quantity        NUMERIC(14,4) NOT NULL,
        unit_cost       NUMERIC(14,6),
        balance_after   NUMERIC(14,4) NOT NULL,
        source          VARCHAR(20)   NOT NULL,
        reference       VARCHAR(100),
        notes           TEXT,
        created_by      VARCHAR(100),
        created_at      TIMESTAMP     NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS "pcpRawMaterialMovements_material_idx"
        ON ${TB_RAW_MOVEMENTS} (raw_material_id, created_at DESC);
    `);

    // Vínculo código do fornecedor (NF-e) → matéria-prima, por CNPJ do emitente.
    // conversion_factor = quantas unidades da matéria-prima vêm em 1 unidade da nota.
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${TB_RAW_SUPPLIER_REFS} (
        ref_id            SERIAL PRIMARY KEY,
        supplier_tax_id   VARCHAR(14)   NOT NULL,
        nf_product_code   VARCHAR(60)   NOT NULL,
        raw_material_id   INTEGER       NOT NULL REFERENCES ${TB_RAW_MATERIALS}(raw_material_id) ON DELETE CASCADE,
        conversion_factor NUMERIC(14,6) NOT NULL DEFAULT 1,
        created_at        TIMESTAMP     NOT NULL DEFAULT NOW(),
        updated_at        TIMESTAMP     NOT NULL DEFAULT NOW(),
        UNIQUE (supplier_tax_id, nf_product_code)
      );
    `);

    // Item da nota de entrada pode ser uma matéria-prima em vez de um produto.
    await client.query(`
      ALTER TABLE IF EXISTS ${TB_INBOUND_ITEMS} ADD COLUMN IF NOT EXISTS raw_material_id INTEGER;
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

    // Componente da ficha: matéria-prima (raw_material_id) ou produto (component_code).
    await addRawMaterialComponent(client, TB_BOM_ITEMS, 'pcpBomItems_component_check');

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

    await addRawMaterialComponent(client, TB_ORDER_MATERIALS, 'pcpProductionOrderMaterials_component_check');

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

// Tabelas criadas antes das matérias-primas só tinham component_code (produto).
async function addRawMaterialComponent(client, table, checkName) {
  await client.query(`
    ALTER TABLE ${table}
      ADD COLUMN IF NOT EXISTS raw_material_id INTEGER REFERENCES ${TB_RAW_MATERIALS}(raw_material_id);
    ALTER TABLE ${table} ALTER COLUMN component_code DROP NOT NULL;
  `);
  const { rowCount } = await client.query(`SELECT 1 FROM pg_constraint WHERE conname = $1`, [checkName]);
  if (!rowCount) {
    await client.query(`
      ALTER TABLE ${table} ADD CONSTRAINT "${checkName}"
        CHECK (raw_material_id IS NOT NULL OR component_code IS NOT NULL)
    `);
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

  await grantMenuAccess(client, parent.id);
}

// O menu esconde módulos sem linha em userModules (securityModules.js). Módulo do PCP
// que ainda não foi configurado para ninguém é liberado para todos os usuários que já
// têm permissões; depois disso, quem manda é a tela de permissões.
async function grantMenuAccess(client, parentId) {
  const { rows: [table] } = await client.query(`SELECT to_regclass('public."userModules"') AS t`);
  if (!table?.t) return;

  await client.query(
    `INSERT INTO public."userModules" (usuario_id, modulo_id, pode_acessar)
     SELECT u.usuario_id, m.id, TRUE
       FROM (SELECT DISTINCT usuario_id FROM public."userModules") u
      CROSS JOIN ${TB_MODULES} m
      WHERE (m.id = $1::bigint OR m.path = ANY($2::varchar[]))
        AND NOT EXISTS (SELECT 1 FROM public."userModules" x WHERE x.modulo_id = m.id)`,
    [parentId, MENU_ITEMS.map((item) => item.path)]
  );
}
