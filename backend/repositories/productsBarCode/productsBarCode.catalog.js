// ╔══════════════════════════════════════════════════════════════════════╗
// ║ catalog_schema.productsBarCode.js — Códigos, unidades e dimensões   ║
// ║ CONSART ERP — ESM                                                   ║
// ║ Alinhado com public."productsBarCode" — 17 colunas                  ║
// ╚══════════════════════════════════════════════════════════════════════╝

// Este catálogo não cria nem altera tabelas.
// As dimensões físicas pertencem ao código de barras/unidade do produto.
// created_at usa DEFAULT; updated_at usa DEFAULT e trigger.

// ----------------------------------------------------------------------
// Tabela e chave primária
// ----------------------------------------------------------------------
export const PRODUCTS_BAR_CODE_TABLE = 'public."productsBarCode"';
export const PRODUCTS_BAR_CODE_PRIMARY_KEY = 'barcode_id';

// ----------------------------------------------------------------------
// Colunas na mesma ordem da tabela PostgreSQL
// ----------------------------------------------------------------------
const columns = [
    { name: 'barcode_id', type: 'BIGINT', sequence: '"productsBarCode_barcode_id_seq"', pk: true, notNull: true },
    { name: 'product_code', type: 'VARCHAR(50)', notNull: true },
    { name: 'product_unit_id', type: 'INTEGER' },
    { name: 'barcode', type: 'VARCHAR(60)', notNull: true },
    { name: 'barcode_type', type: 'VARCHAR(20)' },
    { name: 'is_active', type: 'BOOLEAN', notNull: true, default: 'TRUE' },
    { name: 'created_at', type: 'TIMESTAMP', notNull: true, default: 'NOW()' },
    { name: 'updated_at', type: 'TIMESTAMP', notNull: true, default: 'NOW()' },
    { name: 'width_cm', type: 'NUMERIC(12,4)' },
    { name: 'length_cm', type: 'NUMERIC(12,4)' },
    { name: 'height_cm', type: 'NUMERIC(12,4)' },
    { name: 'weight_kg', type: 'NUMERIC(12,4)' },
    { name: 'unit', type: 'VARCHAR(50)' },
    { name: 'fator', type: 'NUMERIC(10,2)' },
    { name: 'description', type: 'VARCHAR(100)' },
    { name: 'standard', type: 'BOOLEAN', default: 'FALSE' },
    { name: 'unit_id', type: 'INTEGER' },
];

// ----------------------------------------------------------------------
// Colunas permitidas em INSERT e UPDATE
// ----------------------------------------------------------------------
export const PRODUCTS_BAR_CODE_INSERT_COLUMNS = Object.freeze([
    'product_code',
    'product_unit_id',
    'barcode',
    'barcode_type',
    'is_active',
    'width_cm',
    'length_cm',
    'height_cm',
    'weight_kg',
    'unit',
    'fator',
    'description',
    'standard',
    'unit_id',
]);

export const PRODUCTS_BAR_CODE_UPDATE_COLUMNS = PRODUCTS_BAR_CODE_INSERT_COLUMNS;

const columnNames = new Set(columns.map(({ name }) => name));

export function isProductsBarCodeColumn(name) {
    return columnNames.has(name);
}

const inputMap = Object.fromEntries(
    PRODUCTS_BAR_CODE_INSERT_COLUMNS.map((name) => [name, [name]])
);

Object.assign(inputMap, {
    product_code: ['product_code', 'productCode'],
    product_unit_id: ['product_unit_id', 'productUnitId'],
    barcode: ['barcode', 'bar_code', 'ean', 'gtin'],
    barcode_type: ['barcode_type', 'barcodeType'],
    is_active: ['is_active', 'isActive', 'active'],
    width_cm: ['width_cm', 'widthCm', 'width'],
    length_cm: ['length_cm', 'lengthCm', 'length'],
    height_cm: ['height_cm', 'heightCm', 'height'],
    weight_kg: ['weight_kg', 'weightKg', 'weight'],
    fator: ['fator', 'factor', 'conversion_factor'],
    description: ['description', 'descricao'],
    standard: ['standard', 'is_standard', 'isStandard', 'padrao'],
    unit_id: ['unit_id', 'unitId'],
});

export const PRODUCTS_BAR_CODE_TYPES = Object.freeze([
    'GTIN13',
    'GTIN14',
    'EAN13',
    'EAN14',
    'INTERNAL',
    'OTHER',
]);

// ----------------------------------------------------------------------
// Catálogo
// ----------------------------------------------------------------------
export const PRODUCTS_BAR_CODE_SCHEMA = {
    table: PRODUCTS_BAR_CODE_TABLE,
    primaryKey: PRODUCTS_BAR_CODE_PRIMARY_KEY,
    comment: 'Códigos de barras, unidades comerciais, fatores e dimensões físicas dos produtos.',
    columns,
    selectColumns: columns.map(({ name }) => name),
    selectProjection: columns.map(({ name }) => name).join(',\n    '),
    indexes: [
        { name: 'idx_pbc_barcode', on: ['barcode'] },
        { name: 'idx_pbc_product_code', on: ['product_code'] },
        { name: 'idx_pbc_product_unit_id', on: ['product_unit_id'] },
        { name: 'uq_pbc_barcode_active', on: ['barcode'], unique: true, where: 'is_active IS TRUE' },
    ],
    foreignKeys: [
        {
            name: 'fk_pbc_product_code',
            columns: ['product_code'],
            references: 'public."products"',
            referenceColumns: ['product_code'],
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE',
        },
    ],
    checks: [
        {
            name: 'chk_pbc_barcode_type',
            expression: `barcode_type IS NULL OR barcode_type IN (${PRODUCTS_BAR_CODE_TYPES.map((type) => `'${type}'`).join(', ')})`,
        },
    ],
    triggers: [
        {
            name: 'set_timestamp_productsbarcode',
            timing: 'BEFORE',
            events: ['UPDATE'],
            function: 'trg_set_timestamp()',
        },
    ],
    search: {
        textFields: [
            { expr: 'barcode', weight: 3 },
            { expr: 'product_code', weight: 3 },
            { expr: "LOWER(COALESCE(description, ''))", weight: 2 },
            { expr: "LOWER(COALESCE(unit, ''))", weight: 1 },
        ],
        statusField: 'is_active',
    },
    apiPayloadMap: {
        in: { barcode_id: ['barcode_id', 'barcodeId', 'id'], ...inputMap },
        out: Object.fromEntries(columns.map(({ name }) => [name, (row) => row[name] ?? null])),
    },
    required: ['product_code', 'barcode'],
    upsertColumns: PRODUCTS_BAR_CODE_INSERT_COLUMNS,
};

// ----------------------------------------------------------------------
// Preparação e validação de payload
// ----------------------------------------------------------------------
function prepare(payload, insert) {
    const data = {};
    const errors = [];

    for (const name of PRODUCTS_BAR_CODE_INSERT_COLUMNS) {
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

    for (const name of PRODUCTS_BAR_CODE_SCHEMA.required) {
        const present = Object.prototype.hasOwnProperty.call(data, name);
        if ((present || insert) && (data[name] == null || String(data[name]).trim() === '')) {
            errors.push({ field: name, message: `Campo obrigatório: ${name}` });
        }
    }

    if (data.barcode_type != null && data.barcode_type !== '') {
        data.barcode_type = String(data.barcode_type).trim().toUpperCase();
        if (!PRODUCTS_BAR_CODE_TYPES.includes(data.barcode_type)) {
            errors.push({
                field: 'barcode_type',
                message: `barcode_type deve ser: ${PRODUCTS_BAR_CODE_TYPES.join(', ')}`,
            });
        }
    }

    for (const name of ['width_cm', 'length_cm', 'height_cm', 'weight_kg']) {
        if (!Object.prototype.hasOwnProperty.call(data, name) || data[name] == null || data[name] === '') {
            continue;
        }

        const value = Number(data[name]);
        if (!Number.isFinite(value) || value < 0) {
            errors.push({ field: name, message: `${name} deve ser um número não negativo` });
        }
    }

    if (Object.prototype.hasOwnProperty.call(data, 'fator') && data.fator != null && data.fator !== '') {
        const value = Number(data.fator);
        if (!Number.isFinite(value) || value <= 0) {
            errors.push({ field: 'fator', message: 'fator deve ser um número maior que zero' });
        }
    }

    return { valid: errors.length === 0, data, errors };
}

export function prepareProductsBarCodeInsert(payload = {}) {
    return prepare(payload, true);
}

export function prepareProductsBarCodeUpdate(payload = {}) {
    return prepare(payload, false);
}

export default PRODUCTS_BAR_CODE_SCHEMA;
