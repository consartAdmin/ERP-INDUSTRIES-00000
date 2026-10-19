'use strict';

// Central catalog for public."fiscalClassificationV2".
export const FISCAL_CLASSIFICATION_V2_SCHEMA_NAME = 'public';
export const FISCAL_CLASSIFICATION_V2_TABLE_NAME = 'fiscalClassificationV2';
export const FISCAL_CLASSIFICATION_V2_TABLE =
    `${FISCAL_CLASSIFICATION_V2_SCHEMA_NAME}."${FISCAL_CLASSIFICATION_V2_TABLE_NAME}"`;
export const FISCAL_CLASSIFICATION_V2_PRIMARY_KEY = 'fiscal_classification_id';

export const FISCAL_CLASSIFICATION_V2_COLUMNS = Object.freeze({
    fiscal_classification_id: { name: 'fiscal_classification_id', type: 'integer', nullable: false, primaryKey: true, identity: true, generated: true, default: null },
    classification_name: { name: 'classification_name', type: 'varchar', length: 150, nullable: false, default: null },
    description: { name: 'description', type: 'text', nullable: true, default: null },
    ncm_code: { name: 'ncm_code', type: 'varchar', length: 10, nullable: true, default: null },
    ncm_description: { name: 'ncm_description', type: 'text', nullable: true, default: null },
    ex_tipi: { name: 'ex_tipi', type: 'varchar', length: 3, nullable: true, default: null },
    cest_code: { name: 'cest_code', type: 'varchar', length: 10, nullable: true, default: null },
    cest_description: { name: 'cest_description', type: 'text', nullable: true, default: null },
    fiscal_profile_id: { name: 'fiscal_profile_id', type: 'integer', nullable: true, default: null },
    is_cst: { name: 'is_cst', type: 'varchar', length: 3, nullable: true, default: null },
    is_classification: { name: 'is_classification', type: 'varchar', length: 10, nullable: true, default: null },
    is_rate: { name: 'is_rate', type: 'numeric', precision: 9, scale: 4, nullable: false, default: 0 },
    is_specific_rate: { name: 'is_specific_rate', type: 'numeric', precision: 15, scale: 6, nullable: false, default: 0 },
    is_unit: { name: 'is_unit', type: 'varchar', length: 6, nullable: false, default: 'UN' },
    ibscbs_cst: { name: 'ibscbs_cst', type: 'varchar', length: 3, nullable: true, default: null },
    ibscbs_classification: { name: 'ibscbs_classification', type: 'varchar', length: 6, nullable: true, default: null },
    ibs_uf_rate: { name: 'ibs_uf_rate', type: 'numeric', precision: 9, scale: 4, nullable: false, default: 0 },
    ibs_municipal_rate: { name: 'ibs_municipal_rate', type: 'numeric', precision: 9, scale: 4, nullable: false, default: 0 },
    cbs_rate: { name: 'cbs_rate', type: 'numeric', precision: 9, scale: 4, nullable: false, default: 0 },
    donation_indicator: { name: 'donation_indicator', type: 'smallint', nullable: false, default: 1, allowedValues: [0, 1] },
    tax_reform_details: { name: 'tax_reform_details', type: 'jsonb', nullable: false, default: `'{}'::jsonb` },
    is_active: { name: 'is_active', type: 'boolean', nullable: false, default: true },
    created_at: { name: 'created_at', type: 'timestamp', nullable: false, generated: true, default: 'now()' },
    updated_at: { name: 'updated_at', type: 'timestamp', nullable: false, generated: true, default: 'now()' },
});

export const FISCAL_CLASSIFICATION_V2_COLUMN_NAMES = Object.freeze(
    Object.keys(FISCAL_CLASSIFICATION_V2_COLUMNS),
);

export const FISCAL_CLASSIFICATION_V2_SELECT_COLUMNS = Object.freeze([
    'fiscal_classification_id', 'classification_name', 'description',
    'ncm_code', 'ncm_description', 'ex_tipi', 'cest_code', 'cest_description',
    'fiscal_profile_id', 'is_cst', 'is_classification', 'is_rate',
    'is_specific_rate', 'is_unit', 'ibscbs_cst', 'ibscbs_classification',
    'ibs_uf_rate', 'ibs_municipal_rate', 'cbs_rate', 'donation_indicator',
    'tax_reform_details', 'is_active', 'created_at', 'updated_at',
]);

export const FISCAL_CLASSIFICATION_V2_INSERT_COLUMNS = Object.freeze([
    'classification_name', 'description', 'ncm_code', 'ncm_description',
    'ex_tipi', 'cest_code', 'cest_description', 'fiscal_profile_id', 'is_cst',
    'is_classification', 'is_rate', 'is_specific_rate', 'is_unit', 'ibscbs_cst',
    'ibscbs_classification', 'ibs_uf_rate', 'ibs_municipal_rate', 'cbs_rate',
    'donation_indicator', 'tax_reform_details', 'is_active',
]);

export const FISCAL_CLASSIFICATION_V2_UPDATE_COLUMNS =
    FISCAL_CLASSIFICATION_V2_INSERT_COLUMNS;

export const FISCAL_CLASSIFICATION_V2_NOT_NULL_COLUMNS = Object.freeze([
    'fiscal_classification_id', 'classification_name', 'is_rate',
    'is_specific_rate', 'is_unit', 'ibs_uf_rate', 'ibs_municipal_rate',
    'cbs_rate', 'donation_indicator', 'tax_reform_details', 'is_active',
    'created_at', 'updated_at',
]);

export const FISCAL_CLASSIFICATION_V2_API_REQUIRED_COLUMNS = Object.freeze([
    'classification_name',
]);

export const FISCAL_CLASSIFICATION_V2_DEFAULTS = Object.freeze({
    is_rate: 0,
    is_specific_rate: 0,
    is_unit: 'UN',
    ibs_uf_rate: 0,
    ibs_municipal_rate: 0,
    cbs_rate: 0,
    donation_indicator: 1,
    tax_reform_details: `'{}'::jsonb`,
    is_active: true,
});

export const FISCAL_CLASSIFICATION_V2_DONATION_INDICATORS = Object.freeze([0, 1]);

export const FISCAL_CLASSIFICATION_V2_CODE_FORMATS = Object.freeze({
    ncm_code: { stripNonDigits: true, pattern: /^[0-9]{8}$/, message: 'O campo ncm_code deve conter 8 dígitos.' },
    cest_code: { stripNonDigits: true, pattern: /^[0-9]{7}$/, message: 'O campo cest_code deve conter 7 dígitos.' },
    ibscbs_cst: { stripNonDigits: false, pattern: /^[0-9]{3}$/, message: 'O campo ibscbs_cst deve conter exatamente 3 dígitos.' },
    ibscbs_classification: { stripNonDigits: false, pattern: /^[0-9]{6}$/, message: 'O campo ibscbs_classification deve conter exatamente 6 dígitos.' },
});

export const FISCAL_CLASSIFICATION_V2_NUMERIC_RANGES = Object.freeze({
    is_rate: { min: 0, max: 100 },
    ibs_uf_rate: { min: 0, max: 100 },
    ibs_municipal_rate: { min: 0, max: 100 },
    cbs_rate: { min: 0, max: 100 },
});

export const FISCAL_CLASSIFICATION_V2_CHECK_CONSTRAINTS = Object.freeze({
    fiscal_classification_v2_ncm_format_chk: { columns: ['ncm_code'], rule: 'NULL_OR_DIGITS', digits: 8, stripNonDigits: true },
    fiscal_classification_v2_cest_format_chk: { columns: ['cest_code'], rule: 'NULL_OR_DIGITS', digits: 7, stripNonDigits: true },
    fiscal_classification_v2_ibscbs_cst_chk: { columns: ['ibscbs_cst'], rule: 'NULL_OR_DIGITS', digits: 3, stripNonDigits: false },
    fiscal_classification_v2_ibscbs_classification_chk: { columns: ['ibscbs_classification'], rule: 'NULL_OR_DIGITS', digits: 6, stripNonDigits: false },
    fiscal_classification_v2_is_rate_chk: { columns: ['is_rate'], rule: 'BETWEEN_0_AND_100' },
    fiscal_classification_v2_ibs_uf_rate_chk: { columns: ['ibs_uf_rate'], rule: 'BETWEEN_0_AND_100' },
    fiscal_classification_v2_ibs_municipal_rate_chk: { columns: ['ibs_municipal_rate'], rule: 'BETWEEN_0_AND_100' },
    fiscal_classification_v2_cbs_rate_chk: { columns: ['cbs_rate'], rule: 'BETWEEN_0_AND_100' },
    fiscal_classification_v2_donation_chk: { columns: ['donation_indicator'], rule: 'IN', values: FISCAL_CLASSIFICATION_V2_DONATION_INDICATORS },
    fiscal_classification_v2_details_object_chk: { columns: ['tax_reform_details'], rule: 'JSON_OBJECT' },
});

export const FISCAL_CLASSIFICATION_V2_FOREIGN_KEYS = Object.freeze({
    fiscal_profile_id: {
        constraint: 'fiscal_classification_v2_profile_fk',
        column: 'fiscal_profile_id',
        references: { schema: 'public', table: 'fiscalProfileV2', column: 'fiscal_profile_id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
    },
});

export const FISCAL_CLASSIFICATION_V2_INDEXES = Object.freeze({
    fiscal_classification_v2_pk: { columns: ['fiscal_classification_id'], primaryKey: true, unique: true },
    fiscal_classification_v2_active_idx: { columns: ['is_active'] },
    fiscal_classification_v2_cest_idx: { columns: ['cest_code'] },
    fiscal_classification_v2_ibscbs_class_idx: { columns: ['ibscbs_classification'] },
    fiscal_classification_v2_ibscbs_cst_idx: { columns: ['ibscbs_cst'] },
    fiscal_classification_v2_name_unique: { expression: 'lower(classification_name)', unique: true },
    fiscal_classification_v2_ncm_idx: { columns: ['ncm_code'] },
    fiscal_classification_v2_profile_idx: { columns: ['fiscal_profile_id'] },
});

export const FISCAL_CLASSIFICATION_V2_REFERENCED_BY = Object.freeze([
    { schema: 'public', table: 'budgetsNfeAttemptItems', foreignKey: 'fiscal_classification_id', references: 'fiscal_classification_id', constraint: 'fk_budgetsNfeAttemptItems_classification', onUpdate: 'CASCADE', onDelete: 'SET NULL' },
    { schema: 'public', table: 'ordersNfeAttemptItems', foreignKey: 'fiscal_classification_id', references: 'fiscal_classification_id', constraint: 'fk_ordersNfeAttemptItems_classification', onUpdate: 'CASCADE', onDelete: 'SET NULL' },
    { schema: 'public', table: 'productFiscalCostRules', foreignKey: 'fiscal_classification_id', references: 'fiscal_classification_id', constraint: 'productFiscalCostRules_classification_fk', onUpdate: 'CASCADE', onDelete: 'SET NULL' },
    { schema: 'public', table: 'productsFiscalV2', foreignKey: 'fiscal_classification_id', references: 'fiscal_classification_id', constraint: 'products_fiscal_v2_classification_fk', onUpdate: 'CASCADE', onDelete: 'RESTRICT' },
]);

export const FISCAL_CLASSIFICATION_V2_TRIGGERS = Object.freeze({
    fiscal_classification_v2_updated_at: { timing: 'BEFORE', event: 'UPDATE', scope: 'FOR EACH ROW', function: 'set_timestamp()' },
});

export const FISCAL_CLASSIFICATION_V2_NCM_CEST_COLUMNS = Object.freeze([
    'ncm_code', 'ncm_description', 'ex_tipi', 'cest_code', 'cest_description',
]);
export const FISCAL_CLASSIFICATION_V2_SELECTIVE_TAX_COLUMNS = Object.freeze([
    'is_cst', 'is_classification', 'is_rate', 'is_specific_rate', 'is_unit',
]);
export const FISCAL_CLASSIFICATION_V2_IBS_CBS_COLUMNS = Object.freeze([
    'ibscbs_cst', 'ibscbs_classification', 'ibs_uf_rate', 'ibs_municipal_rate',
    'cbs_rate', 'donation_indicator', 'tax_reform_details',
]);

export const FISCAL_CLASSIFICATION_V2_SELECT_SQL =
    FISCAL_CLASSIFICATION_V2_SELECT_COLUMNS
        .map((column) => `fc."${column}"`)
        .join(',\n');

const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isBlankValue = (value) => value === null || (typeof value === 'string' && value.trim() === '');

function isJsonObjectValue(value) {
    if (isPlainObject(value)) return true;
    if (typeof value !== 'string') return false;
    try { return isPlainObject(JSON.parse(value)); } catch { return false; }
}

export function isFiscalClassificationColumn(column) {
    return hasOwn(FISCAL_CLASSIFICATION_V2_COLUMNS, String(column || ''));
}
export function isFiscalClassificationInsertColumn(column) {
    return FISCAL_CLASSIFICATION_V2_INSERT_COLUMNS.includes(String(column || ''));
}
export function isFiscalClassificationUpdateColumn(column) {
    return FISCAL_CLASSIFICATION_V2_UPDATE_COLUMNS.includes(String(column || ''));
}
export function getFiscalClassificationColumnDefinition(column) {
    return FISCAL_CLASSIFICATION_V2_COLUMNS[String(column || '')] || null;
}

function pickPayload(payload, columns) {
    if (!isPlainObject(payload)) return {};
    return Object.fromEntries(columns.filter((column) => hasOwn(payload, column)).map((column) => [column, payload[column]]));
}

export function pickFiscalClassificationInsertPayload(payload = {}) {
    return pickPayload(payload, FISCAL_CLASSIFICATION_V2_INSERT_COLUMNS);
}
export function pickFiscalClassificationUpdatePayload(payload = {}) {
    return pickPayload(payload, FISCAL_CLASSIFICATION_V2_UPDATE_COLUMNS);
}

export function validateFiscalClassificationRequiredFields(payload = {}) {
    if (!isPlainObject(payload)) return { valid: false, errors: [{ field: null, message: 'Payload de classificação fiscal inválido.' }] };
    const errors = FISCAL_CLASSIFICATION_V2_API_REQUIRED_COLUMNS
        .filter((column) => payload[column] === undefined || isBlankValue(payload[column]))
        .map((field) => ({ field, message: `Campo obrigatório: ${field}.` }));
    return { valid: errors.length === 0, errors };
}

export function validateFiscalClassificationCodes(payload = {}) {
    const errors = [];
    if (!isPlainObject(payload)) return { valid: true, errors };
    for (const [column, format] of Object.entries(FISCAL_CLASSIFICATION_V2_CODE_FORMATS)) {
        if (!hasOwn(payload, column) || payload[column] === undefined || payload[column] === null) continue;
        let value = String(payload[column]);
        if (format.stripNonDigits) value = value.replace(/[^0-9]/g, '');
        if (!format.pattern.test(value)) errors.push({ field: column, message: format.message });
    }
    return { valid: errors.length === 0, errors };
}

export function validateFiscalClassificationRates(payload = {}) {
    const errors = [];
    if (!isPlainObject(payload)) return { valid: true, errors };
    for (const [column, range] of Object.entries(FISCAL_CLASSIFICATION_V2_NUMERIC_RANGES)) {
        if (!hasOwn(payload, column) || payload[column] === undefined) continue;
        const rawValue = payload[column];
        if (isBlankValue(rawValue)) {
            if (!FISCAL_CLASSIFICATION_V2_COLUMNS[column].nullable) errors.push({ field: column, message: `O campo ${column} não pode ser nulo.` });
            continue;
        }
        const value = Number(rawValue);
        if (!Number.isFinite(value)) errors.push({ field: column, message: `O campo ${column} precisa ser um número válido.` });
        else if (value < range.min || value > range.max) errors.push({ field: column, message: `O campo ${column} deve estar entre ${range.min} e ${range.max}.` });
    }
    return { valid: errors.length === 0, errors };
}

export function isValidFiscalClassificationDonationIndicator(value) {
    return !isBlankValue(value) && FISCAL_CLASSIFICATION_V2_DONATION_INDICATORS.includes(Number(value));
}

export function validateFiscalClassificationTaxReformDetails(payload = {}) {
    const errors = [];
    if (!isPlainObject(payload) || !hasOwn(payload, 'tax_reform_details') || payload.tax_reform_details === undefined) return { valid: true, errors };
    if (payload.tax_reform_details === null) errors.push({ field: 'tax_reform_details', message: 'O campo tax_reform_details não pode ser nulo.' });
    else if (!isJsonObjectValue(payload.tax_reform_details)) errors.push({ field: 'tax_reform_details', message: 'O campo tax_reform_details deve ser um objeto JSON.' });
    return { valid: errors.length === 0, errors };
}

export function validateFiscalClassificationPayload(payload = {}, { requireRequiredFields = true } = {}) {
    if (!isPlainObject(payload)) return { valid: false, errors: [{ field: null, message: 'Payload de classificação fiscal inválido.' }] };
    const errors = [];
    if (requireRequiredFields) errors.push(...validateFiscalClassificationRequiredFields(payload).errors);
    errors.push(...validateFiscalClassificationCodes(payload).errors);
    errors.push(...validateFiscalClassificationRates(payload).errors);
    if (hasOwn(payload, 'donation_indicator') && payload.donation_indicator !== undefined && !isValidFiscalClassificationDonationIndicator(payload.donation_indicator)) {
        errors.push({ field: 'donation_indicator', message: 'donation_indicator deve ser 0 ou 1.' });
    }
    errors.push(...validateFiscalClassificationTaxReformDetails(payload).errors);
    return { valid: errors.length === 0, errors };
}

export function prepareFiscalClassificationInsert(payload = {}) {
    const data = pickFiscalClassificationInsertPayload(payload);
    return { data, ...validateFiscalClassificationPayload(data, { requireRequiredFields: true }) };
}
export function prepareFiscalClassificationUpdate(payload = {}) {
    const data = pickFiscalClassificationUpdatePayload(payload);
    return { data, ...validateFiscalClassificationPayload(data, { requireRequiredFields: false }) };
}

const fiscalClassificationV2Schema = Object.freeze({
    schema: FISCAL_CLASSIFICATION_V2_SCHEMA_NAME,
    table: FISCAL_CLASSIFICATION_V2_TABLE_NAME,
    qualifiedTable: FISCAL_CLASSIFICATION_V2_TABLE,
    primaryKey: FISCAL_CLASSIFICATION_V2_PRIMARY_KEY,
    columns: FISCAL_CLASSIFICATION_V2_COLUMNS,
    columnNames: FISCAL_CLASSIFICATION_V2_COLUMN_NAMES,
    selectColumns: FISCAL_CLASSIFICATION_V2_SELECT_COLUMNS,
    selectSql: FISCAL_CLASSIFICATION_V2_SELECT_SQL,
    insertColumns: FISCAL_CLASSIFICATION_V2_INSERT_COLUMNS,
    updateColumns: FISCAL_CLASSIFICATION_V2_UPDATE_COLUMNS,
    notNullColumns: FISCAL_CLASSIFICATION_V2_NOT_NULL_COLUMNS,
    apiRequiredColumns: FISCAL_CLASSIFICATION_V2_API_REQUIRED_COLUMNS,
    defaults: FISCAL_CLASSIFICATION_V2_DEFAULTS,
    allowedValues: { donationIndicators: FISCAL_CLASSIFICATION_V2_DONATION_INDICATORS },
    codeFormats: FISCAL_CLASSIFICATION_V2_CODE_FORMATS,
    numericRanges: FISCAL_CLASSIFICATION_V2_NUMERIC_RANGES,
    checks: FISCAL_CLASSIFICATION_V2_CHECK_CONSTRAINTS,
    foreignKeys: FISCAL_CLASSIFICATION_V2_FOREIGN_KEYS,
    indexes: FISCAL_CLASSIFICATION_V2_INDEXES,
    referencedBy: FISCAL_CLASSIFICATION_V2_REFERENCED_BY,
    triggers: FISCAL_CLASSIFICATION_V2_TRIGGERS,
    groups: { ncmCest: FISCAL_CLASSIFICATION_V2_NCM_CEST_COLUMNS, selectiveTax: FISCAL_CLASSIFICATION_V2_SELECTIVE_TAX_COLUMNS, ibsCbs: FISCAL_CLASSIFICATION_V2_IBS_CBS_COLUMNS },
    helpers: {
        isColumn: isFiscalClassificationColumn,
        isInsertColumn: isFiscalClassificationInsertColumn,
        isUpdateColumn: isFiscalClassificationUpdateColumn,
        getColumnDefinition: getFiscalClassificationColumnDefinition,
        pickInsertPayload: pickFiscalClassificationInsertPayload,
        pickUpdatePayload: pickFiscalClassificationUpdatePayload,
        validateRequiredFields: validateFiscalClassificationRequiredFields,
        validateCodes: validateFiscalClassificationCodes,
        validateRates: validateFiscalClassificationRates,
        isValidDonationIndicator: isValidFiscalClassificationDonationIndicator,
        validateTaxReformDetails: validateFiscalClassificationTaxReformDetails,
        validatePayload: validateFiscalClassificationPayload,
        prepareInsert: prepareFiscalClassificationInsert,
        prepareUpdate: prepareFiscalClassificationUpdate,
    },
});

export default fiscalClassificationV2Schema;
