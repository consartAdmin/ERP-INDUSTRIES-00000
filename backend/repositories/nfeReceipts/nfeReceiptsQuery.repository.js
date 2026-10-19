// ╔════════════════════════════════════════════════════════════════════╗
// ║ nfeReceiptsQuery.repository.js — Listagem paginada (ERP)           ║
// ║ Tabela: public."nfeReceipts" + NF-e + pedido/orçamento + cliente   ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import {
  TB,
  TB_INVOICES,
  TB_ORDERS,
  TB_BUDGETS,
  TB_CUSTOMERS,
  RECEIPT_SELECT,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
} from './nfeReceipts.constants.js';
import { cleanDigits, isIsoDate, normalizeStatus } from './nfeReceipts.utils.js';
import { normalizeReceiptRow } from './nfeReceipts.mappers.js';
import { ensureReady } from './nfeReceiptsSchema.repository.js';

// NF-e emitida por pedido OU orçamento; o nome gravado na própria NF-e é o último recurso.
const JOIN_SQL = `
  FROM ${TB} r
  LEFT JOIN ${TB_INVOICES} i
    ON i.invoice_id = r.nfe_id
  LEFT JOIN ${TB_ORDERS} o
    ON o.order_id = i.order_id
  LEFT JOIN ${TB_BUDGETS} b
    ON b.budget_id = i.budget_id
  LEFT JOIN ${TB_CUSTOMERS} c
    ON c.customer_id = COALESCE(o.customer_id, b.customer_id)
`;

const CUSTOMER_NAME_SQL = `COALESCE(
  NULLIF(BTRIM(c.trade_name), ''),
  NULLIF(BTRIM(c.legal_name), ''),
  NULLIF(BTRIM(i.customer_name), '')
)`;

function buildWhere({ status, q, dateFrom, dateTo }) {
  const params = [];
  const where = [];

  const safeStatus = normalizeStatus(status);

  if (safeStatus) {
    params.push(safeStatus);
    where.push(`r.status = $${params.length}`);
  }

  if (q) {
    const cleanQ = cleanDigits(q);

    params.push(`%${String(q).trim()}%`);
    const textParam = `$${params.length}`;

    if (cleanQ) {
      params.push(`%${cleanQ}%`);
      const digitParam = `$${params.length}`;

      where.push(`
        (
          r.access_key ILIKE ${digitParam}
          OR r.receiver_document ILIKE ${digitParam}
          OR r.receiver_name ILIKE ${textParam}
          OR CAST(i.nfe_number AS TEXT) ILIKE ${digitParam}
          OR COALESCE(c.trade_name, '') ILIKE ${textParam}
          OR COALESCE(c.legal_name, '') ILIKE ${textParam}
          OR COALESCE(i.customer_name, '') ILIKE ${textParam}
        )
      `);
    } else {
      where.push(`
        (
          r.receiver_name ILIKE ${textParam}
          OR r.receiver_document ILIKE ${textParam}
          OR r.access_key ILIKE ${textParam}
          OR COALESCE(c.trade_name, '') ILIKE ${textParam}
          OR COALESCE(c.legal_name, '') ILIKE ${textParam}
          OR COALESCE(i.customer_name, '') ILIKE ${textParam}
        )
      `);
    }
  }

  // Período (YYYY-MM-DD, inclusivo) pela data de recebimento — ou de criação, se ainda pendente.
  if (isIsoDate(dateFrom)) {
    params.push(dateFrom);
    where.push(`COALESCE(r.received_at, r.created_at) >= $${params.length}::date`);
  }

  if (isIsoDate(dateTo)) {
    params.push(dateTo);
    where.push(`COALESCE(r.received_at, r.created_at) < ($${params.length}::date + INTERVAL '1 day')`);
  }

  return {
    params,
    whereSql: where.length ? `WHERE ${where.join(' AND ')}` : '',
  };
}

/**
 * LIST — { page, limit, total, rows }
 */
export async function listReceipts({
  page = 1,
  limit = DEFAULT_PAGE_SIZE,
  status = '',
  q = '',
  dateFrom = '',
  dateTo = '',
} = {}) {
  await ensureReady();

  const safePage = Math.max(Number(page) || 1, 1);
  const safeLimit = Math.min(Math.max(Number(limit) || DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);
  const offset = (safePage - 1) * safeLimit;

  const { params, whereSql } = buildWhere({ status, q, dateFrom, dateTo });

  const totalResult = await pool.query(
    `
    SELECT COUNT(*)::int AS total
    ${JOIN_SQL}
    ${whereSql}
    `,
    params
  );

  const dataParams = [...params, safeLimit, offset];

  const dataResult = await pool.query(
    `
    SELECT
      ${RECEIPT_SELECT},
      COALESCE(${CUSTOMER_NAME_SQL}, '-') AS customer_name
    ${JOIN_SQL}
    ${whereSql}
    ORDER BY r.created_at DESC
    LIMIT $${dataParams.length - 1}
    OFFSET $${dataParams.length}
    `,
    dataParams
  );

  return {
    page: safePage,
    limit: safeLimit,
    total: totalResult.rows[0]?.total || 0,
    rows: dataResult.rows.map(normalizeReceiptRow),
  };
}

export default listReceipts;
