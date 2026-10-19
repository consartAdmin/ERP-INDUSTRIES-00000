// ╔══════════════════════════════════════════════════════════════════════╗
// ║ orders.sql.js — SQL de pedidos                                       ║
// ║ Builders dirigidos pelo catálogo, projeções e JOIN base              ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { ORDERS_PRIMARY_KEY, ORDER_COLUMNS } from './orders.catalog.js';
import { ORDER_ITEM_COLUMNS } from './ordersItems.catalog.js';
import { TB_ORDERS, TB_ORDER_ITEMS, TB_ORDER_SHIPPING, TB_INVOICES_ISSUED, TB_CUSTOMERS_IBGE, assertCatalogColumns } from './orders.constants.js';
import { toPgDate } from './orders.utils.js';

// ----------------------------------------------------------------------
// SQL builders dirigidos pelo catálogo
// ----------------------------------------------------------------------
export const qi = (identifier) => `"${String(identifier).replace(/"/g, '""')}"`;

export function selectColumns(alias, columns) {
  return columns.map((column) => `${alias}.${qi(column)}`).join(',\n  ');
}

export function buildInsertSql(table, allowedColumns, record, returning = null) {
  assertCatalogColumns(Object.keys(record), new Set(allowedColumns), `INSERT ${table}`);

  // Colunas com valor undefined ficam de fora → default do banco.
  const columns = allowedColumns.filter((column) => record[column] !== undefined);
  const placeholders = columns.map((_, index) => `$${index + 1}`);

  return {
    sql: `
      INSERT INTO ${table} (${columns.map(qi).join(', ')})
      VALUES (${placeholders.join(', ')})
      ${returning ? `RETURNING ${qi(returning)}` : ''}
    `,
    values: columns.map((column) => record[column]),
  };
}

export function buildUpdateSql(table, primaryKey, allowedColumns, record, id) {
  assertCatalogColumns(Object.keys(record), new Set(allowedColumns), `UPDATE ${table}`);

  const columns = Object.keys(record);
  const sets = columns.map((column, index) => `${qi(column)} = $${index + 1}`);

  return {
    sql: `
      UPDATE ${table}
      SET ${sets.join(', ')}, "updated_at" = NOW()
      WHERE ${qi(primaryKey)} = $${columns.length + 1}
      RETURNING ${qi(primaryKey)}
    `,
    values: [...columns.map((column) => record[column]), id],
  };
}

export function resolveCatalogDefault(value) {
  // ORDER_DEFAULTS.issue_date é uma expressão SQL; resolvida no Node.
  if (value === 'CURRENT_DATE') return toPgDate(new Date());
  return value;
}

export function applyDefaults(record, defaults) {
  const out = { ...record };
  for (const [column, value] of Object.entries(defaults)) {
    if (out[column] === undefined || out[column] === null) {
      out[column] = resolveCatalogDefault(value);
    }
  }
  return out;
}

export function assertRequired(record, requiredColumns, context) {
  const missing = requiredColumns.filter(
    (column) => record[column] == null || String(record[column]).trim() === '',
  );
  if (missing.length) {
    const error = new Error(`${context}: campo(s) obrigatório(s) ausente(s): ${missing.join(', ')}`);
    error.status = 400;
    throw error;
  }
}
// Agregado padrão
export const AGG_FIELDS = `
  (
    SELECT COUNT(*)
    FROM ${TB_ORDER_ITEMS} oi_count
    WHERE oi_count.order_id = o.order_id
  ) AS items_count,
  COALESCE(o.subtotal, 0) AS subtotal_amount,
  COALESCE(o.total_discount, 0) AS total_discount_amount,
  COALESCE(os.freight_value, 0) AS freight_amount,
  COALESCE(o.total_amount, 0) AS total_amount_agg
`;

// Projeção padrão do cabeçalho: todas as colunas de ORDER_COLUMNS + joins
export const ORDER_SELECT = `
  ${selectColumns('o', ORDER_COLUMNS)},
  o.${qi(ORDERS_PRIMARY_KEY)} AS number,

  os.freight_mode,
  os.freight_value,

  ii.invoice_id,
  ii.nfe_status,
  ii.nfe_key,
  ii.nfe_number,
  ii.nfe_protocol,
  ii.nfe_environment,
  ii.nfe_provider_id,
  ii.xml_url AS nfe_xml_url,
  ii.danfe_url AS nfe_danfe_url,
  ii.issued_at AS nfe_issue_datetime,
  ii.issued_date AS nfe_issue_date,

  cib.codigo_ibge AS customer_codigo_ibge,
  cib.uf          AS customer_uf,
  cib.city        AS customer_city
`;

// Projeção padrão dos itens: todas as colunas de ORDER_ITEM_COLUMNS
export const ORDER_ITEM_SELECT = selectColumns('oi', ORDER_ITEM_COLUMNS);
// ----------------------------------------------------------------------
// ✅ JOIN base: resolve customer_id se o pedido estiver sem customer_id
// ----------------------------------------------------------------------
export function buildBaseFromWhere(whereSql = '') {
  return `
    FROM ${TB_ORDERS} o

    LEFT JOIN ${TB_CUSTOMERS_IBGE} cib
      ON cib.customer_id = o.customer_id

    LEFT JOIN ${TB_ORDER_SHIPPING} os
      ON os.order_shipping_id = o.order_shipping_id

    LEFT JOIN LATERAL (
      SELECT i.*
      FROM ${TB_INVOICES_ISSUED} i
      WHERE i.order_id = o.order_id
      ORDER BY
        i.issued_at DESC NULLS LAST,
        i.invoice_id DESC
      LIMIT 1
    ) ii ON TRUE

    ${whereSql}
  `;
}
