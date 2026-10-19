// ╔══════════════════════════════════════════════════════════════════════╗
// ║ catalog_schema.suppliers.js — Schema de Fornecedores — ESM          ║
// ║ CONSART ERP                                                         ║
// ║ Alinhado com public."suppliers" — 27 colunas                        ║
// ╚══════════════════════════════════════════════════════════════════════╝

// Este catálogo não cria nem altera tabelas.
// O campo address é mantido por compatibilidade com registros legados.
// created_at e updated_at usam DEFAULT no PostgreSQL.

// ----------------------------------------------------------------------
// Tabela e chave primária
// ----------------------------------------------------------------------
export const SUPPLIERS_TABLE = 'public."suppliers"';
export const SUPPLIERS_PRIMARY_KEY = 'supplier_id';

// ----------------------------------------------------------------------
// Colunas na mesma ordem da tabela PostgreSQL
// ----------------------------------------------------------------------
const columns = [
    { name: 'supplier_id', type: 'INTEGER', identity: 'BY DEFAULT', pk: true, notNull: true },
    { name: 'name', type: 'VARCHAR(200)', notNull: true },
    { name: 'tax_id', type: 'VARCHAR(20)' },
    { name: 'state_registration', type: 'VARCHAR(30)' },
    { name: 'phone', type: 'VARCHAR(20)' },
    { name: 'email', type: 'VARCHAR(100)' },
    { name: 'website', type: 'VARCHAR(200)' },
    { name: 'login', type: 'VARCHAR(150)' },
    { name: 'password', type: 'VARCHAR(255)' },
    { name: 'observations', type: 'TEXT' },
    { name: 'address', type: 'TEXT', legacy: true },
    { name: 'address_street_type', type: 'VARCHAR(30)' },
    { name: 'address_street', type: 'VARCHAR(200)' },
    { name: 'address_number', type: 'VARCHAR(30)' },
    { name: 'address_complement', type: 'VARCHAR(120)' },
    { name: 'address_district', type: 'VARCHAR(120)' },
    { name: 'city', type: 'VARCHAR(100)' },
    { name: 'state', type: 'VARCHAR(2)' },
    { name: 'postal_code', type: 'VARCHAR(10)' },
    { name: 'sales_rep', type: 'VARCHAR(100)' },
    { name: 'sales_rep_email', type: 'VARCHAR(100)' },
    { name: 'finance_email', type: 'VARCHAR(100)' },
    { name: 'chart_account_id', type: 'INTEGER' },
    { name: 'cash_category_id', type: 'INTEGER' },
    { name: 'cash_subcategory_id', type: 'INTEGER' },
    { name: 'created_at', type: 'TIMESTAMPTZ', default: 'NOW()' },
    { name: 'updated_at', type: 'TIMESTAMPTZ', default: 'NOW()' },
];

// ----------------------------------------------------------------------
// Colunas permitidas em INSERT e UPDATE
// ----------------------------------------------------------------------
export const SUPPLIERS_INSERT_COLUMNS = Object.freeze([
    'name',
    'tax_id',
    'state_registration',
    'phone',
    'email',
    'website',
    'login',
    'password',
    'observations',
    'address',
    'address_street_type',
    'address_street',
    'address_number',
    'address_complement',
    'address_district',
    'city',
    'state',
    'postal_code',
    'sales_rep',
    'sales_rep_email',
    'finance_email',
    'chart_account_id',
    'cash_category_id',
    'cash_subcategory_id',
]);

export const SUPPLIERS_UPDATE_COLUMNS = SUPPLIERS_INSERT_COLUMNS;

const columnNames = new Set(columns.map(({ name }) => name));

export function isSupplierColumn(name) {
    return columnNames.has(name);
}

// Aliases de entrada não são colunas SQL.
const inputMap = Object.fromEntries(
    SUPPLIERS_INSERT_COLUMNS.map((name) => [name, [name]])
);

Object.assign(inputMap, {
    name: ['name', 'supplier_name', 'nome', 'razao_social'],
    tax_id: ['tax_id', 'cnpj_cpf', 'cnpj', 'cpf'],
    state_registration: ['state_registration', 'inscricao_estadual', 'ie'],
    phone: ['phone', 'telefone'],
    observations: ['observations', 'notes', 'observacao', 'observacoes'],
    address: ['address', 'endereco'],
    address_street_type: ['address_street_type', 'tipo_logradouro', 'street_type'],
    address_street: ['address_street', 'logradouro', 'street'],
    address_number: ['address_number', 'numero'],
    address_complement: ['address_complement', 'complemento'],
    address_district: ['address_district', 'bairro'],
    city: ['city', 'cidade'],
    state: ['state', 'uf'],
    postal_code: ['postal_code', 'cep', 'zipcode'],
    sales_rep: ['sales_rep', 'representative', 'representante'],
    sales_rep_email: ['sales_rep_email', 'representative_email'],
    finance_email: ['finance_email', 'financial_email', 'email_financeiro'],
    chart_account_id: ['chart_account_id', 'chartAccountId', 'conta_contabil_id'],
    cash_category_id: ['cash_category_id', 'cashCategoryId', 'categoria_financeira_id'],
    cash_subcategory_id: ['cash_subcategory_id', 'cashSubcategoryId', 'subcategoria_financeira_id'],
});

// ----------------------------------------------------------------------
// Catálogo de fornecedores
// ----------------------------------------------------------------------
export const SUPPLIERS_SCHEMA = {
    table: SUPPLIERS_TABLE,
    alias: 'sup',
    primaryKey: SUPPLIERS_PRIMARY_KEY,
    comment: 'Cadastro de fornecedores, contatos, endereço e classificação financeira.',
    columns,
    selectColumns: columns.map(({ name }) => name),
    selectProjection: columns.map(({ name }) => name).join(',\n    '),
    indexes: [
        { name: 'suppliers_tax_id_uq', on: ['tax_id'], unique: true, where: 'tax_id IS NOT NULL' },
        { name: 'idx_suppliers_name', on: ['name'] },
        { name: 'idx_suppliers_city', on: ['city'] },
        { name: 'idx_suppliers_state', on: ['state'] },
        { name: 'idx_suppliers_chart_account', on: ['chart_account_id'] },
        { name: 'idx_suppliers_cash_category', on: ['cash_category_id'] },
        { name: 'idx_suppliers_cash_subcategory', on: ['cash_subcategory_id'] },
    ],
    foreignKeys: [
        {
            name: 'fk_suppliers_chart_account',
            columns: ['chart_account_id'],
            references: 'public."chartOfAccounts"',
            referenceColumns: ['id'],
            onUpdate: 'CASCADE',
            onDelete: 'SET NULL',
        },
        {
            name: 'fk_suppliers_cash_category',
            columns: ['cash_category_id'],
            references: 'public."caixaCategorias"',
            referenceColumns: ['id'],
            onUpdate: 'CASCADE',
            onDelete: 'SET NULL',
        },
        {
            name: 'fk_suppliers_cash_subcategory',
            columns: ['cash_subcategory_id'],
            references: 'public."caixaSubCategorias"',
            referenceColumns: ['id'],
            onUpdate: 'CASCADE',
            onDelete: 'SET NULL',
        },
    ],
    search: {
        textFields: [
            { expr: "LOWER(COALESCE(name, ''))", weight: 3 },
            { expr: "LOWER(COALESCE(tax_id, ''))", weight: 3 },
            { expr: "LOWER(COALESCE(email, ''))", weight: 2 },
            { expr: "LOWER(COALESCE(website, ''))", weight: 1 },
            { expr: "LOWER(COALESCE(city, ''))", weight: 1 },
            { expr: "LOWER(COALESCE(state, ''))", weight: 1 },
            { expr: "LOWER(COALESCE(sales_rep, ''))", weight: 1 },
            { expr: 'CAST(supplier_id AS TEXT)', weight: 3 },
        ],
    },
    joins: {
        chartAccount: {
            table: 'public."chartOfAccounts"',
            alias: 'coa',
            on: 'coa.id = sup.chart_account_id',
            type: 'LEFT',
            fields: ['coa.code AS chart_account_code', 'coa.description AS chart_account_description'],
        },
        cashCategory: {
            table: 'public."caixaCategorias"',
            alias: 'cc',
            on: 'cc.id = sup.cash_category_id',
            type: 'LEFT',
            fields: ['cc.nome AS cash_category_name'],
        },
        cashSubcategory: {
            table: 'public."caixaSubCategorias"',
            alias: 'csc',
            on: 'csc.id = sup.cash_subcategory_id',
            type: 'LEFT',
            fields: ['csc.nome AS cash_subcategory_name'],
        },
    },
    apiPayloadMap: {
        in: { supplier_id: ['supplier_id', 'id'], ...inputMap },
        out: Object.fromEntries(
            columns.map(({ name }) => [name, (row) => row[name] ?? null])
        ),
    },
    required: ['name'],
    upsertColumns: SUPPLIERS_INSERT_COLUMNS,
};

// ----------------------------------------------------------------------
// Preparação e validação de payload
// ----------------------------------------------------------------------
function hasOwn(object, property) {
    return Object.prototype.hasOwnProperty.call(object ?? {}, property);
}

function cleanString(value) {
    if (value === undefined) return undefined;
    if (value === null) return null;
    const text = String(value).trim();
    return text === '' ? null : text;
}

function cleanPositiveInteger(value) {
    if (value === undefined) return undefined;
    if (value === null || String(value).trim() === '') return null;
    const number = Number(value);
    return Number.isInteger(number) && number > 0 ? number : null;
}

function buildLegacyAddress(data = {}) {
    const street = [data.address_street_type, data.address_street]
        .map(cleanString).filter(Boolean).join(' ');
    const parts = [
        street,
        data.address_number,
        data.address_complement,
        data.address_district,
    ].map(cleanString).filter(Boolean);

    return parts.length ? parts.join(', ') : null;
}

function prepare(payload, insert) {
    const data = {};
    const errors = [];

    for (const name of SUPPLIERS_INSERT_COLUMNS) {
        for (const alias of inputMap[name]) {
            if (hasOwn(payload, alias) && payload[alias] !== undefined) {
                data[name] = payload[alias];
                break;
            }
        }
    }

    const integerFields = [
        'chart_account_id',
        'cash_category_id',
        'cash_subcategory_id',
    ];

    for (const name of SUPPLIERS_INSERT_COLUMNS) {
        if (!hasOwn(data, name)) continue;
        data[name] = integerFields.includes(name)
            ? cleanPositiveInteger(data[name])
            : cleanString(data[name]);
    }

    if (data.state) data.state = data.state.toUpperCase().slice(0, 2);

    if (!hasOwn(data, 'address')) {
        const composedAddress = buildLegacyAddress(data);
        if (composedAddress) data.address = composedAddress;
    }

    if (insert && !data.name) {
        errors.push({ field: 'name', message: 'Campo obrigatório: name' });
    }
    if (!insert && hasOwn(data, 'name') && !data.name) {
        errors.push({ field: 'name', message: 'Campo obrigatório: name' });
    }

    for (const name of integerFields) {
        if (!hasOwn(data, name)) continue;
        const originalAliases = inputMap[name];
        const suppliedAlias = originalAliases.find((alias) => hasOwn(payload, alias));
        const suppliedValue = suppliedAlias ? payload[suppliedAlias] : undefined;
        if (suppliedValue != null && String(suppliedValue).trim() !== '' && data[name] === null) {
            errors.push({ field: name, message: `${name} deve ser um número inteiro positivo` });
        }
    }

    if (data.cash_subcategory_id && !data.cash_category_id) {
        errors.push({
            field: 'cash_category_id',
            message: 'Selecione a categoria financeira da subcategoria.',
        });
    }

    return { valid: errors.length === 0, data, errors };
}

export function prepareSupplierInsert(payload = {}) {
    return prepare(payload, true);
}

export function prepareSupplierUpdate(payload = {}) {
    return prepare(payload, false);
}

export default SUPPLIERS_SCHEMA;
