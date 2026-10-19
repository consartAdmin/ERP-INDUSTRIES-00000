// ╔════════════════════════════════════════════════════════════════════╗
// ║ ordersBillingCreate.repository.js — createFromAsaasCharge          ║
// ║ Tabela: public."ordersBilling"                                     ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB } from './ordersBilling.constants.js';
import { normalizeDateToYMD } from './ordersBilling.utils.js';

// ---------------------------------------------------------------------
// createFromAsaasCharge — cria registro a partir do retorno do Asaas
// ---------------------------------------------------------------------
export async function createFromAsaasCharge(orderId, charge) {
  if (!orderId || !charge) {
    throw new Error('[ordersBillingApi] orderId e charge são obrigatórios');
  }

  const {
    id: provider_payment_id,
    billingType,
    value,
    dueDate,
    paymentDate,
    status,
    bankSlipUrl,
    bankSlipPdfUrl,
    nossoNumero,
    installment,
    totalInstallments,
    statusDescription,
    description,
    externalReference,
    external_reference,
    ...rest
  } = charge;

  const externalRef =
    externalReference ||
    external_reference ||
    null;

  const amount = Number(value || 0);

  const due_date = normalizeDateToYMD(dueDate);
  const paid_date = normalizeDateToYMD(paymentDate);

  const statusFinal = status || 'PENDING';

  const statusDetails =
    statusDescription ||
    description ||
    null;

  const metadataJson =
    rest && Object.keys(rest).length ? JSON.stringify(rest) : null;

  const { rows } = await pool.query(
    `
    INSERT INTO ${TB} (
      order_id,
      billing_source,
      billing_type,
      provider_payment_id,
      external_reference,
      amount,
      due_date,
      paid_date,
      status,
      status_details,
      bank_slip_url,
      bank_slip_pdf_url,
      nosso_numero,
      installment_number,
      installments_total,
      metadata
    )
    VALUES (
      $1,                  -- order_id
      'ASAAS',             -- billing_source
      $2,                  -- billing_type
      $3,                  -- provider_payment_id
      $4,                  -- external_reference
      $5,                  -- amount
      $6,                  -- due_date
      $7,                  -- paid_date
      $8,                  -- status
      $9,                  -- status_details
      $10,                 -- bank_slip_url
      $11,                 -- bank_slip_pdf_url
      $12,                 -- nosso_numero
      $13,                 -- installment_number
      $14,                 -- installments_total
      $15                  -- metadata
    )
    RETURNING *;
    `,
    [
      orderId,                // $1
      billingType,            // $2
      provider_payment_id,    // $3
      externalRef,            // $4
      amount,                 // $5
      due_date,               // $6
      paid_date,              // $7
      statusFinal,            // $8
      statusDetails,          // $9
      bankSlipUrl || null,    // $10
      bankSlipPdfUrl || null, // $11
      nossoNumero || null,    // $12
      installment ?? null,    // $13
      totalInstallments ?? null, // $14
      metadataJson,           // $15
    ],
  );

  return rows[0];
}
