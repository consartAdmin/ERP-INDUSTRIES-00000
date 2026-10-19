// ╔════════════════════════════════════════════════════════════════════╗
// ║ accountsReceivableGetById.repository.js — getById                  ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import {
  TB,
  TB_BRIDGE,
  TB_CUSTOMERS,
  TB_BANK_ACCOUNTS,
  TB_CHART_OF_ACCOUNTS,
} from './accountsReceivable.constants.js';
import { effectiveBankAccountIdSql, accountBankSql } from './accountsReceivable.sql.js';

/* ===================================================================
   GET by ID
   =================================================================== */
export async function getById(id) {
  const sql = `
    SELECT
      ar.id,
      ar.customer_id,

      asa.asaas_payment_id,
      asa.asaas_customer_id AS asaas_customer_id,
      COALESCE(c.trade_name, asa.asaas_customer_name, asa.asaas_customer_id) AS customer_name,

      ar.bank_account_id,
      ${effectiveBankAccountIdSql('ar', 'asa')} AS effective_bank_account_id,
      ${accountBankSql('ba', 'asa')} AS account_bank,

      COALESCE(ar.invoice_number, asa.raw->>'invoiceNumber', asa.asaas_payment_id) AS invoice_number,
      ar.document_number,
      ar.document_type_id,
      ar.category_id,
      ar.subcategory_id,
      ar.payment_method_id,
      ar.cash_account_id,
      ar.chart_account_id,
      coa.code AS chart_account_code,
      coa.description AS chart_account_description,
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

      -- ✅ billing type
      COALESCE(
        asa.raw->>'billingType',
        asa.raw->>'billing_type',
        asa.raw->>'type'
      ) AS billing_type,

      -- ✅ local salvo em coluna
      asa.boleto_pdf_url_local,

      -- ✅ URL do boleto priorizando local e PDF
      COALESCE(
        asa.boleto_pdf_url_local,
        asa.raw->>'bankSlipPdfUrl',
        asa.raw->>'bankSlipUrl',
        ar.boleto_url,
        asa.raw->>'invoiceUrl'
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
      ar.status,
      ar.created_at,
      ar.updated_at

    FROM ${TB} ar
    LEFT JOIN ${TB_BRIDGE} asa
      ON asa.accounts_receivable_id = ar.id
    LEFT JOIN ${TB_CUSTOMERS} c
      ON c.customer_id = ar.customer_id
         OR (c.asaas_id IS NOT NULL AND c.asaas_id = asa.asaas_customer_id)
    LEFT JOIN ${TB_BANK_ACCOUNTS} ba
      ON ba.id = ar.bank_account_id
    LEFT JOIN ${TB_CHART_OF_ACCOUNTS} coa
      ON coa.id = ar.chart_account_id
    WHERE ar.id = $1;
  `;
  const { rows } = await pool.query(sql, [id]);
  return rows[0] || null;
}
