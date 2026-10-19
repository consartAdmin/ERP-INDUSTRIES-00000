// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ listInvoices.repository.js — CONSART ERP | Notas de Entrada             ║
// ║ Listagem paginada com busca, filtro de datas e nome do fornecedor        ║
// ╚══════════════════════════════════════════════════════════════════════════╝

'use strict';

import {
  TB_INVOICES,
  q,
  toNum,
  invoiceResponse,
} from './_shared.js';

// ==========================================================================
// Ordenação
// ==========================================================================
const ORDER_COLUMNS = Object.freeze({
  inbound_id: 'ii.inbound_id',
  // Compatibilidade temporária com clientes que ainda enviam orderBy=id.
  id: 'ii.inbound_id',
  supplier_name: 'supplier_name',
  access_key: 'ii.access_key',
  invoice_number: `NULLIF(REGEXP_REPLACE(ii.invoice_number, '\\D', '', 'g'), '')::BIGINT`,
  series: 'ii.series',
  issuer: 'ii.issuer',
  recipient: 'ii.recipient',
  total_amount: 'ii.total_amount',
  issue_date: 'ii.issue_date',
  created_at: 'ii.created_at',
  status: 'ii.status',
});

function parseOrder(orderBy) {
  const [columnRaw, directionRaw] = String(orderBy || 'created_at DESC')
    .trim()
    .split(/\s+/);

  const expression = ORDER_COLUMNS[columnRaw] || ORDER_COLUMNS.created_at;
  const direction = String(directionRaw || '').toUpperCase() === 'ASC'
    ? 'ASC'
    : 'DESC';

  return ` ORDER BY ${expression} ${direction} NULLS LAST, ii.inbound_id ${direction} `;
}

export async function listInvoices({
  search,
  dateFrom,
  dateTo,
  limit = 50,
  offset = 0,
  orderBy = 'created_at DESC',
} = {}) {
  const order = parseOrder(orderBy);

  const where = [];
  const params = [];
  let i = 1;

  const normalizedSearch = String(search ?? '').trim();

  if (normalizedSearch) {
    // O nome do fornecedor não está em inboundInvoices: ele vem de suppliers,
    // ligado pelo CNPJ do emitente. O EXISTS abaixo permite pesquisar por ele
    // sem depender do JOIN, de modo que a mesma cláusula serve para a listagem
    // e para a contagem.
    where.push(`
      (
        ii.access_key ILIKE $${i}
        OR ii.invoice_number ILIKE $${i}
        OR ii.issuer ILIKE $${i}
        OR ii.recipient ILIKE $${i}
        OR EXISTS (
             SELECT 1
               FROM public."suppliers" s
              WHERE s.tax_id IS NOT NULL
                AND regexp_replace(s.tax_id, '\\D', '', 'g')
                    = regexp_replace(ii.issuer, '\\D', '', 'g')
                AND s.name ILIKE $${i}
           )
      )
    `);

    params.push(`%${normalizedSearch}%`);
    i++;
  }

  if (dateFrom) {
    where.push(`ii.created_at >= $${i}::date`);
    params.push(dateFrom);
    i++;
  }

  if (dateTo) {
    where.push(`ii.created_at < ($${i}::date + INTERVAL '1 day')`);
    params.push(dateTo);
    i++;
  }

  const sqlWhere = where.length
    ? `WHERE ${where.join(' AND ')}`
    : '';

  const safeLimit = Math.min(
    100,
    Math.max(1, toNum(limit, 50))
  );

  const safeOffset = Math.max(
    0,
    toNum(offset, 0)
  );

  const rows = await q(
    `
    SELECT
      ii.inbound_id,
      ii.access_key,
      ii.invoice_number,
      ii.series,
      ii.issuer,
      ii.recipient,
      ii.issue_date,
      ii.entry_date,
      ii.total_amount,
      ii.created_at,
      ii.status,
      ii.stock_applied,
      ii.stock_applied_at,
      ii.xml_url,
      ii.danfe_url,

      COALESCE(
        supplier_data.supplier_name,
        'Fornecedor não cadastrado'
      ) AS supplier_name

    FROM ${TB_INVOICES} AS ii

    LEFT JOIN (
      SELECT
        regexp_replace(tax_id, '\\D', '', 'g') AS normalized_tax_id,
        MAX(name) AS supplier_name
      FROM public."suppliers"
      WHERE tax_id IS NOT NULL
      GROUP BY regexp_replace(tax_id, '\\D', '', 'g')
    ) AS supplier_data
      ON supplier_data.normalized_tax_id =
         regexp_replace(ii.issuer, '\\D', '', 'g')

    ${sqlWhere}
    ${order}

    LIMIT $${i}
    OFFSET $${i + 1}
  `,
    [
      ...params,
      safeLimit,
      safeOffset,
    ]
  );

  const count = await q(
    `
      SELECT COUNT(*)::integer AS total
      FROM ${TB_INVOICES} AS ii
      ${sqlWhere}
    `,
    params
  );

  return {
    items: rows.rows.map(invoiceResponse),
    total: Number(count.rows[0]?.total || 0),
    limit: safeLimit,
    offset: safeOffset,
    filters: {
      search: normalizedSearch || null,
      dateFrom: dateFrom || null,
      dateTo: dateTo || null,
    },
  };
}

export default listInvoices;
