// ╔════════════════════════════════════════════════════════════════════╗
// ║ accountsReceivableBridge.repository.js — Tabela ponte Asaas        ║
// ║ Merge do raw, campos do boleto, resolve asaas_payment_id           ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB_BRIDGE } from './accountsReceivable.constants.js';
import { toInt } from './accountsReceivable.sanitizers.js';

/**
 * PATCH/MERGE no raw da ponte sem apagar o que já existe.
 * Pode chamar por accounts_receivable_id.
 * Aceita um client opcional para rodar dentro de uma transação.
 */
export async function persistAsaasRawForAr(accountsReceivableId, patchObj, db = pool) {
  const arId = toInt(accountsReceivableId, 0);
  if (!arId) return { ok: false, error: 'accountsReceivableId inválido' };

  const patch = JSON.stringify(patchObj || {});
  const sql = `
    UPDATE ${TB_BRIDGE}
       SET raw = COALESCE(raw, '{}'::jsonb) || $2::jsonb,
           updated_at = now()
     WHERE accounts_receivable_id = $1
     RETURNING id, asaas_payment_id, accounts_receivable_id;
  `;
  const { rows } = await db.query(sql, [arId, patch]);
  return { ok: true, row: rows?.[0] || null };
}

/**
 * Busca info básica da ponte (urls + invoiceNumber + local)
 */
export async function getBridgeBoletoFieldsByArId(arId) {
  const q = `
    SELECT
      asa.asaas_payment_id,
      COALESCE(asa.raw->>'invoiceNumber', asa.asaas_payment_id) AS invoice_number,

      -- ✅ prioriza coluna real
      asa.boleto_pdf_url_local AS boleto_pdf_url_local,

      -- ✅ melhor url para baixar/exibir (local > pdf > html)
      COALESCE(
        asa.boleto_pdf_url_local,
        asa.raw->>'bankSlipPdfUrl',
        asa.raw->>'bankSlipUrl',
        asa.raw->>'invoiceUrl',
        asa.raw->>'boleto_pdf_url_local'
      ) AS best_url,

      asa.raw->>'bankSlipPdfUrl' AS "bankSlipPdfUrl",
      asa.raw->>'bankSlipUrl' AS "bankSlipUrl",
      asa.raw->>'invoiceUrl' AS "invoiceUrl",

      -- ✅ billing type (para o controller)
      COALESCE(
        asa.raw->>'billingType',
        asa.raw->>'billing_type',
        asa.raw->>'type'
      ) AS billing_type

    FROM ${TB_BRIDGE} asa
    WHERE asa.accounts_receivable_id = $1
    LIMIT 1;
  `;
  const { rows } = await pool.query(q, [arId]);
  return rows?.[0] || null;
}

// -------------------------------------------------------------------
// resolve asaas_payment_id pela conta local
// -------------------------------------------------------------------
export async function resolveAsaasPaymentIdByAccountsReceivableId(accountsReceivableId) {
  const id = toInt(accountsReceivableId, 0);
  if (!id) return null;

  const q = `
    SELECT asa.asaas_payment_id
      FROM ${TB_BRIDGE} asa
     WHERE asa.accounts_receivable_id = $1
     LIMIT 1;
  `;
  const { rows } = await pool.query(q, [id]);
  return rows[0]?.asaas_payment_id || null;
}
