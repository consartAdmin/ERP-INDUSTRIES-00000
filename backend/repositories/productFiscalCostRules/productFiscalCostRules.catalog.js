// ╔══════════════════════════════════════════════════════════════════════╗
// ║ catalog_schema.productFiscalCostRules.js — Regras de custo fiscal    ║
// ║ CONSART ERP — ESM                                                    ║
// ║ Alinhado com public."productFiscalCostRules" — 22 colunas            ║
// ╚══════════════════════════════════════════════════════════════════════╝

// Este catálogo não cria nem altera tabelas.
// A regra deve referenciar ao menos produto, classificação ou perfil fiscal.
// created_at e updated_at utilizam os defaults definidos no PostgreSQL.

// ----------------------------------------------------------------------
// Tabela e chave primária
// ----------------------------------------------------------------------
export const PRODUCT_FISCAL_COST_RULES_TABLE =
    'public."productFiscalCostRules"';

export const PRODUCT_FISCAL_COST_RULES_PRIMARY_KEY = 'rule_id';

// ----------------------------------------------------------------------
// Colunas na mesma ordem da tabela PostgreSQL
// ----------------------------------------------------------------------
const columns = [
    { name: 'rule_id', type: 'BIGINT', identity: 'ALWAYS', pk: true, notNull: true },
    { name: 'product_code', type: 'VARCHAR(50)' },
    { name: 'fiscal_profile_id', type: 'INTEGER' },
    { name: 'price_id', type: 'BIGINT' },
    { name: 'inbound_cst', type: 'VARCHAR(3)' },
    { name: 'icms_base_pct', type: 'NUMERIC(9,4)' },
    { name: 'icms_rate', type: 'NUMERIC(9,4)' },
    { name: 'mva_pct', type: 'NUMERIC(9,4)' },
    { name: 'icms_st_base_pct', type: 'NUMERIC(9,4)' },
    { name: 'icms_st_rate', type: 'NUMERIC(9,4)' },
    { name: 'icms_st_ret_base_pct', type: 'NUMERIC(9,4)' },
    { name: 'icms_st_ret_rate', type: 'NUMERIC(9,4)' },
    { name: 'ipi_rate', type: 'NUMERIC(9,4)' },
    { name: 'pis_rate', type: 'NUMERIC(9,4)' },
    { name: 'cofins_rate', type: 'NUMERIC(9,4)' },
    { name: 'calculation_mode', type: 'VARCHAR(30)', notNull: true, default: "'PERCENTUAL'" },
    { name: 'notes', type: 'TEXT' },
    { name: 'is_active', type: 'BOOLEAN', notNull: true, default: 'TRUE' },
    { name: 'created_at', type: 'TIMESTAMPTZ', notNull: true, default: 'NOW()' },
    { name: 'updated_at', type: 'TIMESTAMPTZ', notNull: true, default: 'NOW()' },
    { name: 'user_id', type: 'BIGINT' },
    { name: 'fiscal_classification_id', type: 'INTEGER' },
];

// ----------------------------------------------------------------------
// Colunas permitidas em INSERT e UPDATE
// ----------------------------------------------------------------------
export const PRODUCT_FISCAL_COST_RULES_INSERT_COLUMNS = Object.freeze([
    'product_code',
    'fiscal_profile_id',
    'price_id',
    'inbound_cst',
    'icms_base_pct',
    'icms_rate',
    'mva_pct',
    'icms_st_base_pct',
    'icms_st_rate',
    'icms_st_ret_base_pct',
    'icms_st_ret_rate',
    'ipi_rate',
    'pis_rate',
    'cofins_rate',
    'calculation_mode',
    'notes',
    'is_active',
    'user_id',
    'fiscal_classification_id',
]);

export const PRODUCT_FISCAL_COST_RULES_UPDATE_COLUMNS =
    PRODUCT_FISCAL_COST_RULES_INSERT_COLUMNS;

const columnNames = new Set(columns.map(({ name }) => name));

export function isProductFiscalCostRuleColumn(name) {
    return columnNames.has(name);
}

// Aliases de entrada não são colunas SQL.
const inputMap = Object.fromEntries(
    PRODUCT_FISCAL_COST_RULES_INSERT_COLUMNS.map((name) => [name, [name]]),
);

Object.assign(inputMap, {
    product_code: ['product_code', 'productCode', 'sku'],
    fiscal_profile_id: ['fiscal_profile_id', 'fiscalProfileId'],
    fiscal_classification_id: [
        'fiscal_classification_id',
        'fiscalClassificationId',
    ],
    price_id: ['price_id', 'priceId'],
    inbound_cst: ['inbound_cst', 'inboundCst', 'icms_cst'],
    calculation_mode: ['calculation_mode', 'calculationMode'],
    is_active: ['is_active', 'isActive'],
    user_id: ['user_id', 'userId'],
});

// ----------------------------------------------------------------------
// Catálogo das regras de custo fiscal
// ----------------------------------------------------------------------
export const PRODUCT_FISCAL_COST_RULES_SCHEMA = {
    table: PRODUCT_FISCAL_COST_RULES_TABLE,
    primaryKey: PRODUCT_FISCAL_COST_RULES_PRIMARY_KEY,
    comment:
        'Regras de custo fiscal por produto, classificação fiscal ou perfil fiscal.',
    columns,
    selectColumns: columns.map(({ name }) => name),
    selectProjection: columns.map(({ name }) => name).join(',\n    '),
    indexes: [
        {
            name: 'idx_productfiscalcostrules_classification',
            on: ['fiscal_classification_id'],
            where: 'is_active = TRUE',
        },
        {
            name: 'idx_productfiscalcostrules_price',
            on: ['price_id'],
            where: 'is_active = TRUE',
        },
        {
            name: 'idx_productfiscalcostrules_product',
            on: ['product_code'],
            where: 'is_active = TRUE',
        },
        {
            name: 'idx_productfiscalcostrules_profile',
            on: ['fiscal_profile_id'],
            where: 'is_active = TRUE',
        },
    ],
    checks: [
        {
            name: 'ck_productfiscalcostrules_reference',
            expression:
                'product_code IS NOT NULL OR fiscal_classification_id IS NOT NULL OR fiscal_profile_id IS NOT NULL',
        },
    ],
    foreignKeys: [
        {
            name: 'productFiscalCostRules_classification_fk',
            columns: ['fiscal_classification_id'],
            references: 'public."fiscalClassificationV2"',
            referenceColumns: ['fiscal_classification_id'],
            onUpdate: 'CASCADE',
            onDelete: 'SET NULL',
        },
        {
            name: 'productFiscalCostRules_product_fk',
            columns: ['product_code'],
            references: 'public.products',
            referenceColumns: ['product_code'],
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE',
        },
        {
            name: 'productFiscalCostRules_profile_fk',
            columns: ['fiscal_profile_id'],
            references: 'public."fiscalProfileV2"',
            referenceColumns: ['fiscal_profile_id'],
            onUpdate: 'CASCADE',
            onDelete: 'SET NULL',
        },
    ],
    search: {
        textFields: [
            { expr: 'product_code', weight: 3 },
            { expr: 'inbound_cst', weight: 2 },
            { expr: "LOWER(COALESCE(notes, ''))", weight: 1 },
            { expr: 'CAST(rule_id AS TEXT)', weight: 3 },
        ],
        statusField: 'is_active',
    },
    apiPayloadMap: {
        in: {
            rule_id: ['rule_id', 'ruleId', 'id'],
            ...inputMap,
        },
        out: Object.fromEntries(
            columns.map(({ name }) => [name, (row) => row[name] ?? null]),
        ),
    },
    requiredReference: [
        'product_code',
        'fiscal_classification_id',
        'fiscal_profile_id',
    ],
    upsertColumns: PRODUCT_FISCAL_COST_RULES_INSERT_COLUMNS,
};

// ----------------------------------------------------------------------
// Preparação e validação de payload
// ----------------------------------------------------------------------
const numericColumns = new Set(
    columns
        .filter(({ type }) => type.startsWith('NUMERIC('))
        .map(({ name }) => name),
);

function prepare(payload, insert) {
    const data = {};
    const errors = [];

    for (const name of PRODUCT_FISCAL_COST_RULES_INSERT_COLUMNS) {
        for (const alias of inputMap[name]) {
            if (
                Object.prototype.hasOwnProperty.call(payload ?? {}, alias) &&
                payload[alias] !== undefined
            ) {
                data[name] = payload[alias];
                break;
            }
        }
    }

    if (insert) {
        const hasReference =
            data.product_code != null && String(data.product_code).trim() !== '' ||
            data.fiscal_classification_id != null &&
            String(data.fiscal_classification_id).trim() !== '' ||
            data.fiscal_profile_id != null &&
            String(data.fiscal_profile_id).trim() !== '';

        if (!hasReference) {
            errors.push({
                field: 'reference',
                message:
                    'Informe product_code, fiscal_classification_id ou fiscal_profile_id.',
            });
        }
    }

    if (
        Object.prototype.hasOwnProperty.call(data, 'inbound_cst') &&
        data.inbound_cst != null &&
        String(data.inbound_cst).trim().length > 3
    ) {
        errors.push({
            field: 'inbound_cst',
            message: 'inbound_cst deve possuir no máximo 3 caracteres.',
        });
    }

    if (
        Object.prototype.hasOwnProperty.call(data, 'calculation_mode') &&
        (data.calculation_mode == null ||
            String(data.calculation_mode).trim() === '')
    ) {
        errors.push({
            field: 'calculation_mode',
            message: 'calculation_mode não pode ser vazio.',
        });
    }

    for (const name of numericColumns) {
        if (!Object.prototype.hasOwnProperty.call(data, name)) continue;

        const value = data[name];

        if (
            value !== null &&
            String(value).trim() !== '' &&
            !Number.isFinite(Number(value))
        ) {
            errors.push({
                field: name,
                message: `${name} deve ser um número válido.`,
            });
        }
    }

    return {
        valid: errors.length === 0,
        data,
        errors,
    };
}

export function prepareProductFiscalCostRuleInsert(payload = {}) {
    return prepare(payload, true);
}

export function prepareProductFiscalCostRuleUpdate(payload = {}) {
    return prepare(payload, false);
}

export default PRODUCT_FISCAL_COST_RULES_SCHEMA;
