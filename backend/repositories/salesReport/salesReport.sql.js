// ╔════════════════════════════════════════════════════════════════════╗
// ║ salesReport.sql.js — Fragmentos SQL (custo, FROM, itens, WHERE)    ║
// ╚════════════════════════════════════════════════════════════════════╝

import {
  TB_INVOICES,
  TB_ORDERS,
  TB_ORDER_ITEMS,
  TB_BUDGET_ITEMS,
  TB_BUDGETS,
  TB_SELLER_BY_BUDGETS,
  TB_NFE_STATUS_MAP,
  NFE_VALIDAS,
  NFE_EXCLUIR,
} from './salesReport.constants.js';

export const UNIT_FACTOR_SQL = `
  COALESCE(NULLIF(oi.conversion_factor, 0), 1)
`;

export const NFE_STATUS_SQL = `
  UPPER(TRIM(COALESCE(
    nsm.code,
    to_jsonb(ii) ->> 'nfe_status',
    to_jsonb(ii) ->> 'nfe_status_code',
    to_jsonb(ii) ->> 'status',
    ''
  )))
`;

export const ISSUED_DATE_SQL = `
  COALESCE(
    NULLIF(to_jsonb(ii) ->> 'issued_date', '')::date,
    NULLIF(to_jsonb(ii) ->> 'issued_at', '')::timestamptz::date
  )
`;

export function normalizeCostMode(value) {
  return value === 'saleDay' ? 'saleDay' : 'current';
}

export function costUnitPerItemSql(costMode = 'current') {
  if (normalizeCostMode(costMode) === 'saleDay') {
    return `
      COALESCE(
        CASE
          WHEN COALESCE(to_jsonb(oi) ->> 'cost_price_at_sale', '')
            ~ '^-?[0-9]+([.][0-9]+)?$'
          THEN (to_jsonb(oi) ->> 'cost_price_at_sale')::numeric
          ELSE NULL
        END,
        p.cost_price * ${UNIT_FACTOR_SQL},
        0
      )
    `;
  }

  return `COALESCE(p.cost_price * ${UNIT_FACTOR_SQL}, 0)`;
}

export function baseFrom() {
  return `
    FROM ${TB_INVOICES} ii
    LEFT JOIN ${TB_ORDERS} o
      ON o.order_id = ii.order_id
    LEFT JOIN ${TB_BUDGETS} b
      ON b.budget_id = COALESCE(ii.budget_id, o.budget_id)
    LEFT JOIN ${TB_NFE_STATUS_MAP} nsm
      ON nsm.nfe_status_id = ii.nfe_status_id
  `;
}

export function invoiceItemsLateral(invoiceAlias = 'ii', joinType = 'JOIN') {
  return `
    ${joinType} LATERAL (
      SELECT
        oi_order.product_code,
        oi_order.description,
        oi_order.unit_code,
        oi_order.conversion_factor,
        oi_order.quantity,
        oi_order.unit_price,
        oi_order.discount_value,
        to_jsonb(oi_order) ->> 'cost_price_at_sale' AS cost_price_at_sale
      FROM ${TB_ORDER_ITEMS} oi_order
      WHERE oi_order.order_id = ${invoiceAlias}.order_id

      UNION ALL

      SELECT
        bi.product_code,
        bi.description,
        bi.unit_code,
        bi.conversion_factor,
        bi.quantity,
        bi.unit_price,
        bi.discount_value,
        to_jsonb(bi) ->> 'cost_price_at_sale' AS cost_price_at_sale
      FROM ${TB_BUDGET_ITEMS} bi
      WHERE bi.budget_id = ${invoiceAlias}.budget_id
    ) oi ON TRUE
  `;
}

export function buildWhere(filters = {}) {
  const where = [
    '(ii.order_id IS NOT NULL OR ii.budget_id IS NOT NULL)',
    `${ISSUED_DATE_SQL} IS NOT NULL`,
    `NULLIF(to_jsonb(ii) ->> 'cancelled_at', '') IS NULL`,
  ];
  const params = [];

  const addParam = (value) => {
    params.push(value);
    return `$${params.length}`;
  };

  const validParam = addParam(NFE_VALIDAS);
  const excludedParam = addParam(NFE_EXCLUIR);

  // Algumas versões da invoicesIssued guardam apenas nfe_status_id.
  // Nesses casos, uma chave/protocolo presente e ausência de cancelamento
  // identificam a NF-e fiscalmente emitida sem depender do texto do status.
  where.push(`(
    COALESCE(nsm.is_authorized, false) = true
    OR ${NFE_STATUS_SQL} = ANY(${validParam}::text[])
    OR (
      ${NFE_STATUS_SQL} = ''
      AND COALESCE(
        NULLIF(to_jsonb(ii) ->> 'nfe_key', ''),
        NULLIF(to_jsonb(ii) ->> 'access_key', ''),
        NULLIF(to_jsonb(ii) ->> 'nfe_protocol', ''),
        NULLIF(to_jsonb(ii) ->> 'protocol', '')
      ) IS NOT NULL
    )
  )`);
  where.push(`${NFE_STATUS_SQL} <> ALL(${excludedParam}::text[])`);

  if (filters.dateStart) {
    where.push(`${ISSUED_DATE_SQL} >= ${addParam(filters.dateStart)}::date`);
  }

  if (filters.dateEnd) {
    where.push(`${ISSUED_DATE_SQL} <= ${addParam(filters.dateEnd)}::date`);
  }

  if (filters.customerId) {
    where.push(`COALESCE(o.customer_id, b.customer_id) = ${addParam(filters.customerId)}::int`);
  }

  if (filters.sellerId) {
    const sellerParam = addParam(filters.sellerId);
    where.push(`
      COALESCE(
        NULLIF(regexp_replace(b.seller_id::text, '[^0-9]', '', 'g'), '')::int,
        (
          SELECT NULLIF(
            regexp_replace(sb.seller_id::text, '[^0-9]', '', 'g'),
            '',
            'g'
          )::int
          FROM ${TB_SELLER_BY_BUDGETS} sb
          WHERE sb.budget_id = b.budget_id
            AND COALESCE(sb.active, true) = true
          ORDER BY sb.seller_id
          LIMIT 1
        )
      ) = ${sellerParam}::int
    `);
  }

  return {
    whereSql: `WHERE ${where.join('\n AND ')}`,
    params,
  };
}

export function buildProductWhere(filters = {}, params = []) {
  if (!filters.productId) {
    return { productWhereSql: '', params };
  }

  const value = `%${String(filters.productId).trim()}%`;
  params.push(value);
  const placeholder = `$${params.length}`;

  return {
    productWhereSql: `
      AND (
        oi.product_code::text ILIKE ${placeholder}
        OR COALESCE(oi.description, p.description, '') ILIKE ${placeholder}
      )
    `,
    params,
  };
}
