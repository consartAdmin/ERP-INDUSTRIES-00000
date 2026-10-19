// ╔════════════════════════════════════════════════════════════════════╗
// ║ accountsReceivableQuery.repository.js — Listagem e resumo          ║
// ║ listAccountsReceivable / resumoMes                                 ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import {
  TB,
  TB_BRIDGE,
  TB_CUSTOMERS,
  TB_BANK_ACCOUNTS,
  TB_CASH_DOCUMENT_TYPES,
} from './accountsReceivable.constants.js';
import { effectiveBankAccountIdSql, accountBankSql, effectiveStatusSql } from './accountsReceivable.sql.js';
import { toInt, normalizeStatusFilter } from './accountsReceivable.sanitizers.js';

/* ===================================================================
   LISTAGEM — JOIN com customers (trade_name) e bankAccounts (banco)
   =================================================================== */
export async function listAccountsReceivable({
  status,
  search,
  bankAccountId,
  dateType,
  fromDate,
  toDate,
  fromIssueDate,
  toIssueDate,
  fromDueDate,
  toDueDate,
  page = 1,
  pageSize = 20,
  orderBy = 'id',
  orderDirection = 'asc',
} = {}) {
  page = toInt(page, 1);
  pageSize = toInt(pageSize, 20);
  const effectiveStatusExpression = effectiveStatusSql('ar');
  const accountBankExpression = accountBankSql('ba', 'asa');

  // Colunas autorizadas para ordenação.
  // Nunca inserir diretamente na SQL um nome recebido pela URL.
  const allowedOrderColumns = {
    id: 'ar.id',

    created_at: 'ar.created_at',

    customer_id: 'ar.customer_id',

    customer_name: `
    COALESCE(
      c.trade_name,
      asa.asaas_customer_name,
      asa.asaas_customer_id
    )
  `,

    account_bank: accountBankExpression,

    document_type_name: 'dt.name',

    invoice_number: `
    COALESCE(
      ar.invoice_number,
      asa.raw->>'invoiceNumber',
      asa.asaas_payment_id
    )
  `,

    issue_date: `
    COALESCE(
      ar.issue_date,
      (asa.raw->>'billingDate')::date,
      (asa.raw->>'dateCreated')::date,
      ar.created_at::date
    )
  `,

    due_date: 'ar.due_date',

    status: effectiveStatusExpression,

    total: 'ar.value',

    received: 'ar.amount_paid',

    balance: `
    (
      COALESCE(ar.value, 0) -
      COALESCE(ar.amount_paid, 0)
    )
  `,
  };

  const normalizedOrderBy =
    String(orderBy || 'id')
      .trim()
      .toLowerCase();

  const orderColumn =
    allowedOrderColumns[normalizedOrderBy] ||
    allowedOrderColumns.id;

  const direction =
    String(orderDirection || 'asc')
      .trim()
      .toLowerCase() === 'desc'
      ? 'DESC'
      : 'ASC';

  const where = [];
  const params = [];
  let idx = 1;

  const normalizedDateType =
    String(dateType || '').trim().toLowerCase() === 'issue_date' ||
      (!dateType && (fromIssueDate || toIssueDate))
      ? 'issue_date'
      : 'due_date';

  const selectedFromDate = fromDate || (
    normalizedDateType === 'issue_date' ? fromIssueDate : fromDueDate
  );
  const selectedToDate = toDate || (
    normalizedDateType === 'issue_date' ? toIssueDate : toDueDate
  );

  const issueDateExpression = `COALESCE(
    ar.issue_date,
    NULLIF(asa.raw->>'billingDate', '')::date,
    NULLIF(asa.raw->>'dateCreated', '')::date,
    ar.created_at::date
  )`;

  const dateExpression = normalizedDateType === 'issue_date'
    ? issueDateExpression
    : 'ar.due_date';

  if (status) {
    where.push(`${effectiveStatusExpression} = $${idx++}`);
    params.push(normalizeStatusFilter(status));
  }

  // Filtro "Conta Bancária":
  //  - vazio  => todas
  //  - NONE   => somente títulos sem banco
  //  - número => somente a conta bancária informada
  const normalizedBankAccountId =
    String(bankAccountId ?? '').trim().toUpperCase();

  if (normalizedBankAccountId === 'NONE') {
    where.push(`${effectiveBankAccountIdSql('ar', 'asa')} IS NULL`);
  } else if (/^\d+$/.test(normalizedBankAccountId)) {
    where.push(`${effectiveBankAccountIdSql('ar', 'asa')} = $${idx++}::bigint`);
    params.push(normalizedBankAccountId);
  }

  if (selectedFromDate) {
    where.push(`${dateExpression} >= $${idx++}::date`);
    params.push(selectedFromDate);
  }

  if (selectedToDate) {
    where.push(`${dateExpression} <= $${idx++}::date`);
    params.push(selectedToDate);
  }

  if (search) {
    where.push(`
      (
        ar.description ILIKE $${idx}
        OR ar.invoice_number ILIKE $${idx}
        OR ar.document_number ILIKE $${idx}
        OR LOWER(c.trade_name) LIKE LOWER($${idx})
        OR asa.asaas_customer_name ILIKE $${idx}
        OR (asa.raw->>'invoiceNumber') ILIKE $${idx}
        OR (asa.asaas_payment_id) ILIKE $${idx}
        OR ${accountBankExpression} ILIKE $${idx}
      )
    `);
    params.push(`%${search}%`);
    idx++;
  }

  const fromAndJoins = `
    FROM ${TB} ar
    LEFT JOIN ${TB_BRIDGE} asa
      ON asa.accounts_receivable_id = ar.id
    LEFT JOIN ${TB_CUSTOMERS} c
      ON c.customer_id = ar.customer_id
         OR (c.asaas_id IS NOT NULL AND c.asaas_id = asa.asaas_customer_id)
    LEFT JOIN ${TB_BANK_ACCOUNTS} ba
      ON ba.id = ar.bank_account_id
    LEFT JOIN ${TB_CASH_DOCUMENT_TYPES} dt
      ON dt.id = ar.document_type_id
  `;

  const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';

  const offset = (page - 1) * pageSize;
  params.push(pageSize, offset);

  const sql = `
    SELECT
      ar.id,
      ar.customer_id,
      asa.asaas_customer_id AS asaas_customer_id,

      COALESCE(c.trade_name, asa.asaas_customer_name, asa.asaas_customer_id) AS customer_name,

      ar.bank_account_id,
      ${accountBankExpression} AS account_bank,

      COALESCE(ar.invoice_number, asa.raw->>'invoiceNumber', asa.asaas_payment_id) AS invoice_number,
      ar.document_number,
      ar.document_type_id,
      dt.name AS document_type_name,
      ar.category_id,
      ar.subcategory_id,
      ar.payment_method_id,
      ar.cash_account_id,
      ar.chart_account_id,
      ar.fine,
      ar.interest,
      ar.charges,
      ar.notes,
      ar.attachment_url,
      COALESCE(
        ar.issue_date,
        (asa.raw->>'billingDate')::date,
        (asa.raw->>'dateCreated')::date,
        ar.created_at::date
      ) AS issue_date,

      COALESCE(
        asa.raw->>'boleto_pdf_url_local',
        asa.raw->>'bankSlipPdfUrl',
        asa.raw->>'bankSlipUrl',
        asa.raw->>'bank_slip_pdf_url',
        asa.raw->>'bank_slip_url',
        asa.raw->>'boleto_pdf_url',
        asa.raw->>'boleto_url'
      ) AS bank_slip_url,

      COALESCE(
        asa.raw->>'invoiceUrl',
        asa.raw->>'invoice_url'
      ) AS invoice_url,

      ar.description,
      ar.value,
      ar.amount_paid AS paid_value,
      ar.due_date,
      ar.payment_date,
      ${effectiveStatusExpression} AS status,
      ar.created_at,
      ar.updated_at
    ${fromAndJoins}
    ${whereSql}
    ORDER BY ${orderColumn} ${direction}, ar.id ${direction}
    LIMIT $${idx++} OFFSET $${idx};
  `;

  const { rows } = await pool.query(sql, params);

  const paramsCount = params.slice(0, params.length - 2);
  const sqlCount = `
    SELECT COUNT(*) AS total
    ${fromAndJoins}
    ${whereSql}
  `;
  const { rows: countRows } = await pool.query(sqlCount, paramsCount);
  const total = Number(countRows[0]?.total || 0);

  return {
    ok: true,
    data: rows,
    total,
    page,
    pageSize,
    pages: Math.ceil(total / pageSize) || 1,
  };
}

// -------------------------------------------------------------------
// RESUMO MENSAL
// -------------------------------------------------------------------
export async function resumoMes({ year, month }) {
  const mm = String(month).padStart(2, '0');
  const inicio = `${year}-${mm}-01`;
  // último dia real do mês (dia 0 do mês seguinte); "-31" quebrava em meses de 30 dias e fevereiro
  const lastDay = new Date(Date.UTC(Number(year), Number(month), 0)).getUTCDate();
  const fim = `${year}-${mm}-${String(lastDay).padStart(2, '0')}`;

  const sql = `
    SELECT
      COALESCE(SUM(CASE WHEN ${effectiveStatusSql('ar')} IN ('PENDING','OVERDUE') THEN ar.value END), 0) AS total_aberto,
      COALESCE(SUM(CASE WHEN ${effectiveStatusSql('ar')} = 'PENDING' THEN ar.value END), 0)               AS total_pendente,
      COALESCE(SUM(CASE WHEN ${effectiveStatusSql('ar')} = 'OVERDUE' THEN ar.value END), 0)               AS total_vencido,
      COALESCE(SUM(CASE WHEN ${effectiveStatusSql('ar')} = 'PAID' THEN ar.amount_paid END), 0)            AS total_pago
    FROM ${TB} ar
    WHERE ar.due_date BETWEEN $1 AND $2;
  `;

  const { rows } = await pool.query(sql, [inicio, fim]);
  return rows[0] || {
    total_aberto: 0,
    total_pendente: 0,
    total_vencido: 0,
    total_pago: 0,
  };
}
