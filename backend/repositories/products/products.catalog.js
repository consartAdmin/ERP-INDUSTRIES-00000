// ╔══════════════════════════════════════════════════════════════════════╗
// ║ catalog_schema.products.js — Schema de Produtos — ESM               ║
// ║ CONSART ERP                                                          ║
// ║ Alinhado com public.products — 16 colunas                            ║
// ╚══════════════════════════════════════════════════════════════════════╝

// Este catálogo não cria nem altera tabelas.
// Preços, grades, unidades, dimensões, dados fiscais, imagens adicionais,
// códigos de barras e logística pertencem às respectivas tabelas filhas.
// product_code pode ser informado ou gerado por trg_products_autogen_code.

// ----------------------------------------------------------------------
// Tabela e chave primária
// ----------------------------------------------------------------------
export const PRODUCTS_TABLE = 'public."products"';
export const PRODUCTS_PRIMARY_KEY = 'product_id';

// ----------------------------------------------------------------------
// Colunas na mesma ordem física da tabela PostgreSQL
// ----------------------------------------------------------------------
const columns = [
  {
    name: 'product_id',
    type: 'INTEGER',
    pk: true,
    notNull: true,
    default: "nextval('products_product_id_seq'::regclass)",
  },
  { name: 'product_code', type: 'VARCHAR(50)', notNull: true },
  { name: 'description', type: 'TEXT', notNull: true },
  { name: 'barcode', type: 'VARCHAR(100)' },
  { name: 'manufacturer_ref', type: 'VARCHAR(100)' },
  { name: 'cost_price', type: 'NUMERIC(14,2)', default: '0' },
  { name: 'product_group_id', type: 'INTEGER' },
  { name: 'product_subgroup_id', type: 'INTEGER' },
  { name: 'product_stock_id', type: 'INTEGER' },
  { name: 'product_location_id', type: 'INTEGER' },
  { name: 'supplier_id', type: 'INTEGER' },
  { name: 'manufacturer_id', type: 'INTEGER' },
  { name: 'product_imagem_id', type: 'INTEGER' },
  { name: 'created_at', type: 'TIMESTAMP', default: 'NOW()' },
  { name: 'updated_at', type: 'TIMESTAMP', default: 'NOW()' },
  { name: 'is_active', type: 'BOOLEAN', default: 'TRUE' },
];

// ----------------------------------------------------------------------
// Colunas permitidas em INSERT e UPDATE
// ----------------------------------------------------------------------
export const PRODUCTS_INSERT_COLUMNS = Object.freeze([
  'product_code',
  'description',
  'barcode',
  'manufacturer_ref',
  'cost_price',
  'product_group_id',
  'product_subgroup_id',
  'product_stock_id',
  'product_location_id',
  'supplier_id',
  'manufacturer_id',
  'product_imagem_id',
  'is_active',
]);

export const PRODUCTS_UPDATE_COLUMNS = PRODUCTS_INSERT_COLUMNS;

const columnNames = new Set(columns.map(({ name }) => name));

export function isProductColumn(name) {
  return columnNames.has(name);
}

// Aliases de entrada não são colunas SQL.
const inputMap = Object.fromEntries(
  PRODUCTS_INSERT_COLUMNS.map((name) => [name, [name]]),
);

Object.assign(inputMap, {
  product_code: ['product_code', 'code', 'codigo', 'sku'],
  description: ['description', 'descricao', 'product_description', 'name'],
  barcode: ['barcode', 'bar_code', 'ean', 'gtin', 'codigo_barras'],
  manufacturer_ref: [
    'manufacturer_ref',
    'manufacturer_reference',
    'reference',
    'referencia_fabricante',
  ],
  cost_price: ['cost_price', 'cost', 'preco_custo', 'valor_custo'],
  product_group_id: ['product_group_id', 'group_id', 'grupo_id'],
  product_subgroup_id: ['product_subgroup_id', 'subgroup_id', 'subgrupo_id'],
  product_stock_id: ['product_stock_id', 'stock_id', 'estoque_id'],
  product_location_id: ['product_location_id', 'location_id', 'localizacao_id'],
  supplier_id: ['supplier_id', 'fornecedor_id'],
  manufacturer_id: ['manufacturer_id', 'fabricante_id'],
  product_imagem_id: ['product_imagem_id', 'product_image_id', 'imagem_id'],
  is_active: ['is_active', 'active', 'ativo'],
});

// ----------------------------------------------------------------------
// Catálogo de produtos
// ----------------------------------------------------------------------
export const PRODUCTS_SCHEMA = {
  table: PRODUCTS_TABLE,
  primaryKey: PRODUCTS_PRIMARY_KEY,
  comment: 'Cadastro principal de produtos. Dados especializados permanecem nas tabelas filhas.',
  columns,
  selectColumns: columns.map(({ name }) => name),
  selectProjection: columns.map(({ name }) => name).join(',\n    '),
  indexes: [
    { name: 'products_product_code_key', on: ['product_code'], unique: true },
    { name: 'idx_products_barcode', on: ['barcode'] },
    { name: 'idx_products_description', on: ['description'] },
    { name: 'idx_products_is_active', on: ['is_active'] },
    { name: 'idx_products_manufacturer_id', on: ['manufacturer_id'] },
    { name: 'idx_products_product_group_id', on: ['product_group_id'] },
    { name: 'idx_products_product_imagem_id', on: ['product_imagem_id'] },
    { name: 'idx_products_product_location_id', on: ['product_location_id'] },
    { name: 'idx_products_product_stock_id', on: ['product_stock_id'] },
    { name: 'idx_products_product_subgroup_id', on: ['product_subgroup_id'] },
    { name: 'idx_products_supplier_id', on: ['supplier_id'] },
  ],
  foreignKeys: [
    {
      name: 'products_product_stock_id_fkey',
      columns: ['product_stock_id'],
      references: 'public."productsStock"',
      referenceColumns: ['product_stock_id'],
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    },
  ],
  search: {
    textFields: [
      { expr: 'product_code', weight: 4 },
      { expr: 'LOWER(description)', weight: 3 },
      { expr: "LOWER(COALESCE(manufacturer_ref, ''))", weight: 2 },
      { expr: "COALESCE(barcode, '')", weight: 2 },
      { expr: 'CAST(product_id AS TEXT)', weight: 1 },
    ],
    statusField: 'is_active',
  },
  apiPayloadMap: {
    in: {
      product_id: ['product_id', 'id'],
      ...inputMap,
    },
    out: Object.fromEntries(
      columns.map(({ name }) => [name, (row) => row[name] ?? null]),
    ),
  },
  required: ['description'],
  generatedOnInsert: ['product_code'],
  upsertColumns: PRODUCTS_INSERT_COLUMNS,
};

// ----------------------------------------------------------------------
// Preparação e validação de payload
// ----------------------------------------------------------------------
function isBlank(value) {
  return value == null || String(value).trim() === '';
}

function normalizeBoolean(value) {
  if (typeof value === 'boolean') return value;
  if (value === 1 || value === '1') return true;
  if (value === 0 || value === '0') return false;

  const normalized = String(value).trim().toLowerCase();
  if (['true', 'sim', 'yes', 'ativo'].includes(normalized)) return true;
  if (['false', 'nao', 'não', 'no', 'inativo'].includes(normalized)) return false;
  return value;
}

function prepare(payload, insert) {
  const data = {};
  const errors = [];

  for (const name of PRODUCTS_INSERT_COLUMNS) {
    for (const alias of inputMap[name]) {
      if (
        Object.prototype.hasOwnProperty.call(payload ?? {}, alias)
        && payload[alias] !== undefined
      ) {
        data[name] = payload[alias];
        break;
      }
    }
  }

  // A descrição é obrigatória. Em INSERT, product_code pode ser omitido para
  // que trg_products_autogen_code gere o próximo código automaticamente.
  if (insert && isBlank(data.description)) {
    errors.push({ field: 'description', message: 'Campo obrigatório: description' });
  }

  if (Object.prototype.hasOwnProperty.call(data, 'description') && isBlank(data.description)) {
    if (!errors.some(({ field }) => field === 'description')) {
      errors.push({ field: 'description', message: 'Campo obrigatório: description' });
    }
  }

  if (Object.prototype.hasOwnProperty.call(data, 'product_code')) {
    if (isBlank(data.product_code)) {
      if (insert) {
        delete data.product_code;
      } else {
        errors.push({ field: 'product_code', message: 'product_code não pode ser vazio' });
      }
    } else {
      data.product_code = String(data.product_code).trim();
      if (data.product_code.length > 50) {
        errors.push({ field: 'product_code', message: 'product_code deve ter no máximo 50 caracteres' });
      }
    }
  }

  if (Object.prototype.hasOwnProperty.call(data, 'barcode') && !isBlank(data.barcode)) {
    data.barcode = String(data.barcode).trim();
    if (data.barcode.length > 100) {
      errors.push({ field: 'barcode', message: 'barcode deve ter no máximo 100 caracteres' });
    }
  }

  if (
    Object.prototype.hasOwnProperty.call(data, 'manufacturer_ref')
    && !isBlank(data.manufacturer_ref)
  ) {
    data.manufacturer_ref = String(data.manufacturer_ref).trim();
    if (data.manufacturer_ref.length > 100) {
      errors.push({
        field: 'manufacturer_ref',
        message: 'manufacturer_ref deve ter no máximo 100 caracteres',
      });
    }
  }

  if (Object.prototype.hasOwnProperty.call(data, 'cost_price')) {
    if (isBlank(data.cost_price)) {
      data.cost_price = 0;
    } else if (!Number.isFinite(Number(data.cost_price)) || Number(data.cost_price) < 0) {
      errors.push({ field: 'cost_price', message: 'cost_price deve ser um número não negativo' });
    }
  }

  const integerFields = [
    'product_group_id',
    'product_subgroup_id',
    'product_stock_id',
    'product_location_id',
    'supplier_id',
    'manufacturer_id',
    'product_imagem_id',
  ];

  for (const field of integerFields) {
    if (!Object.prototype.hasOwnProperty.call(data, field)) continue;
    // Registros legados usam 0 como "sem vínculo": grava como NULL.
    if (isBlank(data[field]) || Number(data[field]) === 0) {
      data[field] = null;
      continue;
    }
    if (!Number.isInteger(Number(data[field])) || Number(data[field]) <= 0) {
      errors.push({ field, message: `${field} deve ser um inteiro positivo` });
    }
  }

  if (Object.prototype.hasOwnProperty.call(data, 'is_active')) {
    data.is_active = normalizeBoolean(data.is_active);
    if (typeof data.is_active !== 'boolean') {
      errors.push({ field: 'is_active', message: 'is_active deve ser booleano' });
    }
  }

  return {
    valid: errors.length === 0,
    data,
    errors,
  };
}

export function prepareProductInsert(payload = {}) {
  return prepare(payload, true);
}

export function prepareProductUpdate(payload = {}) {
  return prepare(payload, false);
}

export default PRODUCTS_SCHEMA;
