// ╔══════════════════════════════════════════════════════════════════════╗
// ║ search.repository.js — CONSART ERP | Notas Fiscais Emitidas          ║
// ║ Busca paginada com filtro de texto, status, período e ordenação      ║
// ║ Retorna linhas + contagem + somatório (exceto canceladas)            ║
// ╚══════════════════════════════════════════════════════════════════════╝

import {
  pool,
  TB_INVOICES,
  TB_NFE_STATUS_MAP,
  TB_ORDERS,
  TB_BUDGETS,
  normalizeNfeStatusCode,
  rowToInvoice,
} from './_shared.js';

export async function search({
  q = '',
  status,
  dateFrom,
  dateTo,

  sortBy = 'nfe_number',
  sortDirection = 'desc',

  limit = 50,
  offset = 0,
} = {}) {
  // ======================================================================
  // SORT
  // ======================================================================

  const SORT_COLUMNS = Object.freeze({

    // Frontend "ID" = invoice_id
    id: 'i.invoice_id',

    // Pedido
    order_id: 'i.order_id',

    // NF-e
    nfe_number: 'i.nfe_number',

    // Cliente exibido pela consulta
    customer_name: `
      COALESCE(
        o.customer_name,
        i.customer_name,
        ''
      )
    `,

    // CNPJ / CPF exibido pela consulta
    customer_tax_id: `
      COALESCE(
        o.customer_tax_id,
        i.customer_tax_id,
        ''
      )
    `,

    // Status
    nfe_status: 'COALESCE(nsm.code, i.nfe_status)',

    // Emissão
    issued_date: 'i.issued_date',

    // Total
    total_amount: 'i.total_amount',

  });

  const requestedSortBy =
    String(sortBy || '')
      .trim();

  const sortColumn =
    SORT_COLUMNS[requestedSortBy] ||
    SORT_COLUMNS.nfe_number;

  const sortDir =
    String(sortDirection || '')
      .trim()
      .toLowerCase() === 'asc'
      ? 'ASC'
      : 'DESC';

  const where = [];
  const args = [];
  let ai = 1;

  // ======================================================================
  // TEXT SEARCH
  // ======================================================================

  if (q && String(q).trim()) {
    const val = `%${String(q).trim().toLowerCase()}%`;

    where.push(`
      (
        LOWER(COALESCE(o.customer_name, i.customer_name, '')) LIKE $${ai}
        OR LOWER(COALESCE(o.customer_tax_id, i.customer_tax_id, '')) LIKE $${ai}
        OR LOWER(COALESCE(i.nfe_key, '')) LIKE $${ai}
        OR CAST(i.nfe_number AS TEXT) LIKE $${ai}
        OR CAST(o.order_id AS TEXT) LIKE $${ai}
        OR CAST(i.budget_id AS TEXT) LIKE $${ai}
      )
    `);

    args.push(val);
    ai++;
  }

  // ======================================================================
  // STATUS
  // ======================================================================

  if (
    status &&
    String(status).trim().toUpperCase() !== 'TODOS'
  ) {
    where.push(`
      COALESCE(
        nsm.code,
        UPPER(
          TRANSLATE(
            COALESCE(i.nfe_status, ''),
            'ÁÀÂÃÉÈÊÍÌÎÓÒÔÕÚÙÛÇ',
            'AAAAEEEIIIOOOOUUUC'
          )
        )
      ) = $${ai}
    `);

    args.push(normalizeNfeStatusCode(status));
    ai++;
  }

  // ======================================================================
  // DATE RANGE — INCLUSIVE
  // ======================================================================

  if (dateFrom) {
    where.push(`
      i.issued_date >= $${ai}::date
    `);

    args.push(dateFrom);
    ai++;
  }

  if (dateTo) {
    where.push(`
      i.issued_date <= $${ai}::date
    `);

    args.push(dateTo);
    ai++;
  }

  // ======================================================================
  // WHERE
  // ======================================================================

  const whereSql = where.length
    ? `WHERE ${where.join(' AND ')}`
    : '';

  // ======================================================================
  // ROWS
  // ======================================================================

  const sqlRows = `
    SELECT
      i.*,

      nsm.code AS nfe_status_code,
      nsm.name AS nfe_status_name,

      COALESCE(
        o.order_id::text,
        i.budget_id::text
      ) AS order_number,

      COALESCE(
        o.customer_name,
        i.customer_name
      ) AS customer_name,

      COALESCE(
        o.customer_tax_id,
        i.customer_tax_id
      ) AS customer_tax_id,

      o.customer_email AS order_email,

      COALESCE(
        NULLIF(TRIM(i.customer_email), ''),
        NULLIF(TRIM(c.email), ''),
        NULLIF(TRIM(b.customer_email), '')
      ) AS customer_email,

      COALESCE(
        NULLIF(TRIM(o.customer_email), ''),
        NULLIF(TRIM(i.customer_email), ''),
        NULLIF(TRIM(c.email), ''),
        NULLIF(TRIM(b.customer_email), '')
      ) AS final_email

    FROM ${TB_INVOICES} i

    LEFT JOIN ${TB_NFE_STATUS_MAP} nsm
      ON nsm.nfe_status_id = i.nfe_status_id

    LEFT JOIN ${TB_ORDERS} o
      ON o.order_id = i.order_id

    LEFT JOIN public."customers" c
      ON c.customer_id = o.customer_id

    LEFT JOIN ${TB_BUDGETS} b
      ON b.budget_id = i.budget_id

    ${whereSql}

    ORDER BY
      ${sortColumn} ${sortDir} NULLS LAST,
      i.invoice_id DESC

    LIMIT $${ai}
    OFFSET $${ai + 1}
  `;

  // ======================================================================
  // COUNT
  // ======================================================================

  const sqlCount = `
    SELECT
      COUNT(*) AS total

    FROM ${TB_INVOICES} i

    LEFT JOIN ${TB_NFE_STATUS_MAP} nsm
      ON nsm.nfe_status_id = i.nfe_status_id

    LEFT JOIN ${TB_ORDERS} o
      ON o.order_id = i.order_id

    LEFT JOIN public."customers" c
      ON c.customer_id = o.customer_id

    LEFT JOIN ${TB_BUDGETS} b
      ON b.budget_id = i.budget_id

    ${whereSql}
  `;

  // ======================================================================
  // TOTAL AMOUNT
  // ======================================================================

  const sumWhere = [...where];

  sumWhere.push(`
    COALESCE(
      nsm.code,
      UPPER(
        TRANSLATE(
          COALESCE(i.nfe_status, ''),
          'ÁÀÂÃÉÈÊÍÌÎÓÒÔÕÚÙÛÇ',
          'AAAAEEEIIIOOOOUUUC'
        )
      )
    ) <> 'CANCELADO'
  `);

  const sqlSum = `
    SELECT
      COALESCE(
        SUM(i.total_amount),
        0
      ) AS total_amount

    FROM ${TB_INVOICES} i

    LEFT JOIN ${TB_NFE_STATUS_MAP} nsm
      ON nsm.nfe_status_id = i.nfe_status_id

    LEFT JOIN ${TB_ORDERS} o
      ON o.order_id = i.order_id

    LEFT JOIN public."customers" c
      ON c.customer_id = o.customer_id

    LEFT JOIN ${TB_BUDGETS} b
      ON b.budget_id = i.budget_id

    WHERE ${sumWhere.join(' AND ')}
  `;

  // ======================================================================
  // QUERY ARGUMENTS
  // ======================================================================

  const rowsArgs = [
    ...args,
    Number(limit) || 50,
    Number(offset) || 0,
  ];

  // ======================================================================
  // EXECUTE
  // ======================================================================

  const [
    rowsRes,
    countRes,
    sumRes,
  ] = await Promise.all([
    pool.query(sqlRows, rowsArgs),
    pool.query(sqlCount, args),
    pool.query(sqlSum, args),
  ]);

  // ======================================================================
  // RESPONSE
  // ======================================================================

  return {
    ok: true,
    rows: rowsRes.rows.map(rowToInvoice),
    total: Number(
      countRes.rows?.[0]?.total || 0
    ),
    total_amount: Number(
      sumRes.rows?.[0]?.total_amount || 0
    ),
  };
}

export default search;
