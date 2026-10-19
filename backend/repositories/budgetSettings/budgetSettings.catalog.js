// ╔══════════════════════════════════════════════════════════════════════╗
// ║ catalog_schema.budgetSettings.js — Catálogo da tabela budgetSettings ║
// ║ CONSART ERP | PostgreSQL | ESM                                       ║
// ╚══════════════════════════════════════════════════════════════════════╝
//
// Fonte única da estrutura de public."budgetSettings" (tabela singleton:
// sempre existe no máximo uma linha, com setting_id = 1).

export const TABLE = Object.freeze({
    schema: 'public',
    name: 'budgetSettings',
    qualifiedName: 'public."budgetSettings"',
});

export const SETTINGS_ID = 1;

export const OUT_OF_STOCK_MODES = Object.freeze(['BLOCK', 'PASSWORD', 'ALLOW']);

export const MAX_DISCOUNT_PERCENT_RANGE = Object.freeze({ min: 0, max: 100 });

export const UPDATED_BY_MAX_LENGTH = 100;

export const COLUMNS = Object.freeze({
    setting_id: Object.freeze({
        type: 'smallint',
        nullable: false,
        default: SETTINGS_ID,
        primaryKey: true,
    }),
    allow_out_of_stock: Object.freeze({
        type: 'boolean',
        nullable: false,
        default: false,
    }),
    require_stock_lot: Object.freeze({
        type: 'boolean',
        nullable: false,
        default: false,
    }),
    allow_manual_unit_price: Object.freeze({
        type: 'boolean',
        nullable: false,
        default: true,
    }),
    max_discount_percent: Object.freeze({
        type: 'numeric',
        precision: 5,
        scale: 2,
        nullable: false,
        default: 100,
        min: MAX_DISCOUNT_PERCENT_RANGE.min,
        max: MAX_DISCOUNT_PERCENT_RANGE.max,
    }),
    updated_at: Object.freeze({
        type: 'timestamp with time zone',
        nullable: false,
        default: 'now()',
        defaultIsExpression: true,
    }),
    updated_by: Object.freeze({
        type: 'character varying',
        maxLength: UPDATED_BY_MAX_LENGTH,
        nullable: true,
        default: null,
    }),
    out_of_stock_mode: Object.freeze({
        type: 'character varying',
        maxLength: 20,
        nullable: false,
        default: 'BLOCK',
        enum: OUT_OF_STOCK_MODES,
    }),
});

// Ordem física das colunas na tabela.
export const COLUMN_NAMES = Object.freeze(Object.keys(COLUMNS));

// Valores padrão para as colunas de dados (sem expressões SQL como now()).
export const DEFAULTS = Object.freeze({
    setting_id: SETTINGS_ID,
    allow_out_of_stock: false,
    require_stock_lot: false,
    allow_manual_unit_price: true,
    max_discount_percent: 100,
    updated_by: null,
    out_of_stock_mode: 'BLOCK',
});

export const CONSTRAINTS = Object.freeze({
    primaryKey: Object.freeze({
        name: 'budgetSettings_pkey',
        columns: Object.freeze(['setting_id']),
        method: 'btree',
    }),
    checks: Object.freeze([
        Object.freeze({
            name: 'budgetSettings_max_discount_percent_check',
            column: 'max_discount_percent',
            expression: 'max_discount_percent >= 0::numeric AND max_discount_percent <= 100::numeric',
        }),
        Object.freeze({
            name: 'budgetSettings_setting_id_check',
            column: 'setting_id',
            expression: 'setting_id = 1',
        }),
        Object.freeze({
            name: 'budget_settings_out_of_stock_mode_check',
            column: 'out_of_stock_mode',
            expression: "out_of_stock_mode::text = ANY (ARRAY['BLOCK', 'PASSWORD', 'ALLOW']::text[])",
        }),
    ]),
});

export const DDL = `
CREATE TABLE IF NOT EXISTS public."budgetSettings" (
  setting_id              smallint                 NOT NULL DEFAULT 1,
  allow_out_of_stock      boolean                  NOT NULL DEFAULT false,
  require_stock_lot       boolean                  NOT NULL DEFAULT false,
  allow_manual_unit_price boolean                  NOT NULL DEFAULT true,
  max_discount_percent    numeric(5,2)             NOT NULL DEFAULT 100,
  updated_at              timestamp with time zone NOT NULL DEFAULT now(),
  updated_by              character varying(100),
  out_of_stock_mode       character varying(20)    NOT NULL DEFAULT 'BLOCK'::character varying,
  CONSTRAINT "budgetSettings_pkey" PRIMARY KEY (setting_id),
  CONSTRAINT "budgetSettings_max_discount_percent_check"
    CHECK (max_discount_percent >= 0::numeric AND max_discount_percent <= 100::numeric),
  CONSTRAINT "budgetSettings_setting_id_check"
    CHECK (setting_id = 1),
  CONSTRAINT budget_settings_out_of_stock_mode_check
    CHECK (out_of_stock_mode::text = ANY (ARRAY['BLOCK'::character varying, 'PASSWORD'::character varying, 'ALLOW'::character varying]::text[]))
);
`.trim();

export default {
    TABLE,
    SETTINGS_ID,
    OUT_OF_STOCK_MODES,
    MAX_DISCOUNT_PERCENT_RANGE,
    UPDATED_BY_MAX_LENGTH,
    COLUMNS,
    COLUMN_NAMES,
    DEFAULTS,
    CONSTRAINTS,
    DDL,
};
