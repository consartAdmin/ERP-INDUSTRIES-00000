// ╔══════════════════════════════════════════════════════════════════════╗
// ║ catalog_schema.productsFiscalOrigins.js — Origem fiscal do produto   ║
// ║ CONSART ERP — ESM                                                    ║
// ║ Tabela: public."productsFiscalOrigins"                               ║
// ╚══════════════════════════════════════════════════════════════════════╝
//
// PROPÓSITO
// ---------
// Guardar, por produto (e opcionalmente por lote/grade), os valores fiscais
// necessários para emitir NF-e — principalmente a origem do ICMS-ST retido
// anteriormente exigida pelo CST 60 — SEM depender de uma NF-e de entrada
// em "inboundInvoiceItems".
//
// Muitos produtos do estoque não possuem mais a NF-e do fornecedor. Esta
// tabela é preenchida pelo botão "Atualizar dados fiscais" a partir da regra
// fiscal do produto, que por sua vez é derivada exclusivamente de:
//
//   "productsFiscalV2" -> "fiscalClassificationV2" -> "fiscalProfileV2"
//
// PRECEDÊNCIA NA EMISSÃO
// ----------------------
// A NF-e de entrada real continua tendo prioridade. Esta tabela só é usada
// quando "inboundInvoiceItems" não fornece uma origem ST completa.
//
// GRÃO (suporta os dois modos de estoque do ERP)
// ----------------------------------------------
//   lot_id preenchido -> origem específica daquele lote  (STOCK_WITH_LOT)
//   lot_id NULL       -> origem padrão do produto        (STOCK_SIMPLE)
//
// product_grade_id segue a mesma lógica: NULL vale para qualquer grade.
//
// COMPATIBILIDADE DE COLUNAS
// --------------------------
// Os nomes das colunas fiscais espelham "inboundInvoiceItems" de propósito.
// Isso permite que nfeIssuanceApi reutilize normalizeInboundIcmsSt() sobre as
// linhas desta tabela, sem duplicar a lógica de normalização do ICMS-ST.
//
// CONVENÇÃO DE QUANTIDADE
// -----------------------
// As linhas geradas pela regra fiscal são gravadas POR UNIDADE:
// quantity = 1 e conversion_factor = 1, com os totais iguais aos valores
// unitários. Assim calculateRetainedIcmsSt() multiplica o ST unitário pela
// quantidade vendida, que é o comportamento esperado para CST 60.

// ----------------------------------------------------------------------
// Tabela e chave primária
// ----------------------------------------------------------------------
export const PRODUCTS_FISCAL_ORIGINS_SCHEMA_NAME = 'public';

export const PRODUCTS_FISCAL_ORIGINS_TABLE_NAME = 'productsFiscalOrigins';

export const PRODUCTS_FISCAL_ORIGINS_TABLE =
    `${PRODUCTS_FISCAL_ORIGINS_SCHEMA_NAME}."${PRODUCTS_FISCAL_ORIGINS_TABLE_NAME}"`;

export const PRODUCTS_FISCAL_ORIGINS_PRIMARY_KEY = 'fiscal_origin_id';

// Valor usado para "sem lote" / "sem grade" nos índices únicos, já que o
// PostgreSQL não considera NULLs iguais entre si.
export const PRODUCTS_FISCAL_ORIGINS_NULL_SCOPE = 0;

export const PRODUCTS_FISCAL_ORIGINS_SOURCES = Object.freeze([
    'PRODUCT_FISCAL_RULE',
    'MANUAL',
]);

// ----------------------------------------------------------------------
// Colunas na mesma ordem da tabela PostgreSQL
// ----------------------------------------------------------------------
const columns = [
    { name: 'fiscal_origin_id', type: 'BIGINT', identity: 'ALWAYS', pk: true, notNull: true },

    // Escopo
    { name: 'product_code', type: 'VARCHAR(60)', notNull: true },
    { name: 'product_id', type: 'INTEGER' },
    { name: 'product_grade_id', type: 'INTEGER' },
    { name: 'lot_id', type: 'INTEGER' },

    // Referência de quantidade a que os totais se referem
    { name: 'unit', type: 'VARCHAR(10)' },
    { name: 'quantity', type: 'NUMERIC(18,6)', notNull: true, default: '1' },
    { name: 'conversion_factor', type: 'NUMERIC(18,6)', notNull: true, default: '1' },
    { name: 'unit_cost', type: 'NUMERIC(18,6)' },

    // ICMS próprio
    { name: 'icms_cst', type: 'VARCHAR(3)' },
    { name: 'icms_base', type: 'NUMERIC(18,6)' },
    { name: 'icms_rate', type: 'NUMERIC(9,4)' },
    { name: 'icms_value', type: 'NUMERIC(18,6)' },

    // ICMS-ST
    { name: 'icms_st_mva_rate', type: 'NUMERIC(9,4)' },
    { name: 'icms_st_base', type: 'NUMERIC(18,6)' },
    { name: 'icms_st_rate', type: 'NUMERIC(9,4)' },
    { name: 'icms_st_value', type: 'NUMERIC(18,6)' },

    // FCP-ST
    { name: 'fcp_st_base', type: 'NUMERIC(18,6)' },
    { name: 'fcp_st_rate', type: 'NUMERIC(9,4)' },
    { name: 'fcp_st_value', type: 'NUMERIC(18,6)' },

    // Demais tributos da regra
    { name: 'ipi_rate', type: 'NUMERIC(9,4)' },
    { name: 'pis_rate', type: 'NUMERIC(9,4)' },
    { name: 'cofins_rate', type: 'NUMERIC(9,4)' },

    // Proveniência do cálculo
    { name: 'source', type: 'VARCHAR(40)', notNull: true, default: "'PRODUCT_FISCAL_RULE'" },
    { name: 'rule_id', type: 'BIGINT' },
    { name: 'rule_source', type: 'VARCHAR(40)' },
    { name: 'calculation_mode', type: 'VARCHAR(30)' },
    { name: 'products_fiscal_id', type: 'BIGINT' },
    { name: 'fiscal_classification_id', type: 'INTEGER' },
    { name: 'fiscal_profile_id', type: 'INTEGER' },

    // Payload completo do cálculo, para auditoria
    { name: 'raw_tax_payload', type: 'JSONB', notNull: true, default: "'{}'::jsonb" },

    { name: 'notes', type: 'TEXT' },
    { name: 'is_active', type: 'BOOLEAN', notNull: true, default: 'TRUE' },

    { name: 'calculated_at', type: 'TIMESTAMPTZ', notNull: true, default: 'NOW()' },
    { name: 'created_at', type: 'TIMESTAMPTZ', notNull: true, default: 'NOW()' },
    { name: 'updated_at', type: 'TIMESTAMPTZ', notNull: true, default: 'NOW()' },
    { name: 'user_id', type: 'BIGINT' },
];

export const PRODUCTS_FISCAL_ORIGINS_COLUMNS = Object.freeze(columns);

export const PRODUCTS_FISCAL_ORIGINS_COLUMN_NAMES = Object.freeze(
    columns.map(({ name }) => name),
);

// ----------------------------------------------------------------------
// Colunas permitidas em INSERT e UPDATE
// ----------------------------------------------------------------------
export const PRODUCTS_FISCAL_ORIGINS_INSERT_COLUMNS = Object.freeze([
    'product_code',
    'product_id',
    'product_grade_id',
    'lot_id',

    'unit',
    'quantity',
    'conversion_factor',
    'unit_cost',

    'icms_cst',
    'icms_base',
    'icms_rate',
    'icms_value',

    'icms_st_mva_rate',
    'icms_st_base',
    'icms_st_rate',
    'icms_st_value',

    'fcp_st_base',
    'fcp_st_rate',
    'fcp_st_value',

    'ipi_rate',
    'pis_rate',
    'cofins_rate',

    'source',
    'rule_id',
    'rule_source',
    'calculation_mode',
    'products_fiscal_id',
    'fiscal_classification_id',
    'fiscal_profile_id',

    'raw_tax_payload',
    'notes',
    'is_active',
    'calculated_at',
    'user_id',
]);

export const PRODUCTS_FISCAL_ORIGINS_UPDATE_COLUMNS =
    PRODUCTS_FISCAL_ORIGINS_INSERT_COLUMNS;

// Colunas que nfeIssuanceApi precisa ler para montar a origem do ICMS-ST.
// Mantidas com o mesmo nome de "inboundInvoiceItems".
export const PRODUCTS_FISCAL_ORIGINS_ST_COLUMNS = Object.freeze([
    'fiscal_origin_id',
    'product_code',
    'product_id',
    'product_grade_id',
    'lot_id',
    'unit',
    'quantity',
    'conversion_factor',
    'icms_cst',
    'icms_value',
    'icms_st_mva_rate',
    'icms_st_base',
    'icms_st_rate',
    'icms_st_value',
    'fcp_st_base',
    'fcp_st_rate',
    'fcp_st_value',
    'raw_tax_payload',
    'source',
    'rule_id',
    'rule_source',
    'calculated_at',
    'created_at',
]);

const columnNames = new Set(PRODUCTS_FISCAL_ORIGINS_COLUMN_NAMES);

export function isProductsFiscalOriginColumn(name) {
    return columnNames.has(name);
}

// ----------------------------------------------------------------------
// Aliases aceitos no payload de entrada
// ----------------------------------------------------------------------
const inputMap = Object.fromEntries(
    PRODUCTS_FISCAL_ORIGINS_INSERT_COLUMNS.map((name) => [name, [name]]),
);

Object.assign(inputMap, {
    product_code: ['product_code', 'productCode', 'sku'],
    product_id: ['product_id', 'productId'],
    product_grade_id: ['product_grade_id', 'productGradeId'],
    lot_id: ['lot_id', 'lotId'],
    conversion_factor: ['conversion_factor', 'conversionFactor'],
    unit_cost: ['unit_cost', 'unitCost', 'cost_unit'],
    icms_cst: ['icms_cst', 'icmsCst', 'cst', 'inbound_cst'],
    icms_st_mva_rate: ['icms_st_mva_rate', 'icmsStMvaRate', 'mva_pct'],
    rule_id: ['rule_id', 'ruleId'],
    rule_source: ['rule_source', 'ruleSource'],
    calculation_mode: ['calculation_mode', 'calculationMode'],
    products_fiscal_id: ['products_fiscal_id', 'productsFiscalId'],
    fiscal_classification_id: ['fiscal_classification_id', 'fiscalClassificationId'],
    fiscal_profile_id: ['fiscal_profile_id', 'fiscalProfileId'],
    raw_tax_payload: ['raw_tax_payload', 'rawTaxPayload'],
    calculated_at: ['calculated_at', 'calculatedAt'],
    is_active: ['is_active', 'isActive'],
    user_id: ['user_id', 'userId'],
});

// ----------------------------------------------------------------------
// Catálogo
// ----------------------------------------------------------------------
export const PRODUCTS_FISCAL_ORIGINS_SCHEMA = {
    table: PRODUCTS_FISCAL_ORIGINS_TABLE,
    primaryKey: PRODUCTS_FISCAL_ORIGINS_PRIMARY_KEY,
    comment:
        'Origem fiscal do produto calculada pela regra fiscal (productsFiscalV2), '
        + 'usada para emitir NF-e sem depender de NF-e de entrada.',
    columns,
    selectColumns: PRODUCTS_FISCAL_ORIGINS_COLUMN_NAMES,
    selectProjection: PRODUCTS_FISCAL_ORIGINS_COLUMN_NAMES.join(',\n    '),
    indexes: [
        {
            name: 'productsfiscalorigins_scope_ux',
            on: [
                'product_code',
                `COALESCE(lot_id, ${PRODUCTS_FISCAL_ORIGINS_NULL_SCOPE})`,
                `COALESCE(product_grade_id, ${PRODUCTS_FISCAL_ORIGINS_NULL_SCOPE})`,
            ],
            unique: true,
            where: 'is_active = TRUE',
        },
        {
            name: 'idx_productsfiscalorigins_product',
            on: ['product_code'],
            where: 'is_active = TRUE',
        },
        {
            name: 'idx_productsfiscalorigins_lot',
            on: ['lot_id'],
            where: 'is_active = TRUE AND lot_id IS NOT NULL',
        },
    ],
    checks: [
        {
            name: 'ck_productsfiscalorigins_quantity',
            expression: 'quantity > 0 AND conversion_factor > 0',
        },
    ],
    foreignKeys: [
        {
            name: 'productsFiscalOrigins_product_fk',
            columns: ['product_code'],
            references: 'public.products',
            referenceColumns: ['product_code'],
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE',
        },
    ],
    apiPayloadMap: {
        in: {
            fiscal_origin_id: ['fiscal_origin_id', 'fiscalOriginId', 'id'],
            ...inputMap,
        },
        out: Object.fromEntries(
            columns.map(({ name }) => [name, (row) => row[name] ?? null]),
        ),
    },
    upsertColumns: PRODUCTS_FISCAL_ORIGINS_INSERT_COLUMNS,
};

// ----------------------------------------------------------------------
// DDL
// ----------------------------------------------------------------------
export const DDL = `
CREATE TABLE IF NOT EXISTS ${PRODUCTS_FISCAL_ORIGINS_TABLE} (
  fiscal_origin_id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

  product_code             VARCHAR(60)   NOT NULL,
  product_id               INTEGER,
  product_grade_id         INTEGER,
  lot_id                   INTEGER,

  unit                     VARCHAR(10),
  quantity                 NUMERIC(18,6) NOT NULL DEFAULT 1,
  conversion_factor        NUMERIC(18,6) NOT NULL DEFAULT 1,
  unit_cost                NUMERIC(18,6),

  icms_cst                 VARCHAR(3),
  icms_base                NUMERIC(18,6),
  icms_rate                NUMERIC(9,4),
  icms_value               NUMERIC(18,6),

  icms_st_mva_rate         NUMERIC(9,4),
  icms_st_base             NUMERIC(18,6),
  icms_st_rate             NUMERIC(9,4),
  icms_st_value            NUMERIC(18,6),

  fcp_st_base              NUMERIC(18,6),
  fcp_st_rate              NUMERIC(9,4),
  fcp_st_value             NUMERIC(18,6),

  ipi_rate                 NUMERIC(9,4),
  pis_rate                 NUMERIC(9,4),
  cofins_rate              NUMERIC(9,4),

  source                   VARCHAR(40)   NOT NULL DEFAULT 'PRODUCT_FISCAL_RULE',
  rule_id                  BIGINT,
  rule_source              VARCHAR(40),
  calculation_mode         VARCHAR(30),
  products_fiscal_id       BIGINT,
  fiscal_classification_id INTEGER,
  fiscal_profile_id        INTEGER,

  raw_tax_payload          JSONB         NOT NULL DEFAULT '{}'::jsonb,
  notes                    TEXT,
  is_active                BOOLEAN       NOT NULL DEFAULT TRUE,

  calculated_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  created_at               TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  user_id                  BIGINT,

  CONSTRAINT ck_productsfiscalorigins_quantity
    CHECK (quantity > 0 AND conversion_factor > 0)
)
`.trim();

export const DDL_INDEXES = Object.freeze([
    `
    CREATE UNIQUE INDEX IF NOT EXISTS productsfiscalorigins_scope_ux
      ON ${PRODUCTS_FISCAL_ORIGINS_TABLE} (
        product_code,
        COALESCE(lot_id, ${PRODUCTS_FISCAL_ORIGINS_NULL_SCOPE}),
        COALESCE(product_grade_id, ${PRODUCTS_FISCAL_ORIGINS_NULL_SCOPE})
      )
      WHERE is_active = TRUE
    `.trim(),

    `
    CREATE INDEX IF NOT EXISTS idx_productsfiscalorigins_product
      ON ${PRODUCTS_FISCAL_ORIGINS_TABLE} (product_code)
      WHERE is_active = TRUE
    `.trim(),

    `
    CREATE INDEX IF NOT EXISTS idx_productsfiscalorigins_lot
      ON ${PRODUCTS_FISCAL_ORIGINS_TABLE} (lot_id)
      WHERE is_active = TRUE AND lot_id IS NOT NULL
    `.trim(),
]);

export default PRODUCTS_FISCAL_ORIGINS_SCHEMA;
