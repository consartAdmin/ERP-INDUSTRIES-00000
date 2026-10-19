// ╔══════════════════════════════════════════════════════════════════╗
// ║ nfeAsaasSyncPersist.repository.js — persistência                 ║
// ║ contas a receber local + ponte accountsReceivableAsaas           ║
// ╚══════════════════════════════════════════════════════════════════╝

import { TB_AR, TB_BRIDGE } from './nfeAsaasSync.constants.js';
import {
  round2,
  cleanText,
  normalizeDate,
  mapAsaasStatus,
  normalizeReceivableCollectionProvider,
  buildInvoiceNumber,
  buildDescription,
} from './nfeAsaasSync.utils.js';

// ============================================================================
// PERSISTÊNCIA — CONTAS A RECEBER + PONTE ASAAS
// ============================================================================

export async function persistLocalReceivable(client, {
  context,
  installment,
  externalReference,
  nfeNumber,
}) {
  const sequence = Number(installment.sequence || installment.installment || 1);
  const effectiveNfeNumber = cleanText(nfeNumber || context.nfe_number || 'SN');
  const invoiceNumber = buildInvoiceNumber(effectiveNfeNumber, sequence);
  const description = buildDescription(effectiveNfeNumber, sequence);
  const collectionProvider = normalizeReceivableCollectionProvider(
    installment.collection_provider,
  );

  const existing = await client.query(
    `
      SELECT id
      FROM ${TB_AR}
      WHERE document_number = $1
         OR invoice_number = $2
      ORDER BY CASE WHEN document_number = $1 THEN 0 ELSE 1 END, id
      LIMIT 1
    `,
    [externalReference, invoiceNumber],
  );

  let arId = existing.rows[0]?.id || null;
  let created = false;

  if (arId) {
    await client.query(
      `
        UPDATE ${TB_AR}
        SET
          customer_id = $1,
          description = $2,
          value = $3,
          due_date = $4,
          invoice_number = $5,
          document_number = COALESCE(document_number, $6),
          issue_date = $7,
          payment_method_id = $8,
          collection_provider = $9,
          bank_account_id = $10,
          notes = COALESCE(notes, $11),
          updated_at = NOW()
        WHERE id = $12
      `,
      [
        context.customer_id,
        description,
        installment.value,
        installment.dueDate,
        invoiceNumber,
        externalReference,
        normalizeDate(context.issue_date),
        installment.payment_method_id || null,
        collectionProvider,
        installment.bank_account_id || null,
        `Criado automaticamente após autorização da NF-e. Origem: ${cleanText(installment.collection_provider) || 'NO_INTEGRATION'}. Ref.: ${externalReference}`,
        arId,
      ],
    );
  } else {
    const inserted = await client.query(
      `
        INSERT INTO ${TB_AR} (
          customer_id,
          description,
          value,
          amount_paid,
          due_date,
          payment_date,
          status,
          invoice_number,
          document_number,
          issue_date,
          payment_method_id,
          collection_provider,
          bank_account_id,
          fine,
          interest,
          charges,
          notes
        ) VALUES (
          $1,$2,$3,0,$4,NULL,'PENDING',$5,$6,$7,$8,$9,$10,0,0,0,$11
        )
        RETURNING id
      `,
      [
        context.customer_id,
        description,
        installment.value,
        installment.dueDate,
        invoiceNumber,
        externalReference,
        normalizeDate(context.issue_date),
        installment.payment_method_id || null,
        collectionProvider,
        installment.bank_account_id || null,
        `Criado automaticamente após autorização da NF-e. Origem: ${cleanText(installment.collection_provider) || 'NO_INTEGRATION'}. Ref.: ${externalReference}`,
      ],
    );

    arId = inserted.rows[0].id;
    created = true;
  }

  return {
    accountsReceivableId: arId,
    created,
    collectionProvider,
  };
}

export async function persistLink(client, { order, installment, payment, externalReference, nfeNumber }) {
  const paymentId = cleanText(payment?.id);
  if (!paymentId) throw new Error('Asaas não retornou payment.id.');

  const status = mapAsaasStatus(payment.status);
  const paidValue = status === 'PAID'
    ? round2(payment.netValue ?? payment.value)
    : 0;

  const sequence = Number(installment.sequence || installment.installment || 1);
  const effectiveNfeNumber = cleanText(nfeNumber || order.nfe_number || 'SN');
  const invoiceNumber = buildInvoiceNumber(effectiveNfeNumber, sequence);
  const description = buildDescription(effectiveNfeNumber, sequence);

  const existingAr = await client.query(
    `
      SELECT id
      FROM ${TB_AR}
      WHERE document_number = $1
         OR invoice_number = $2
      ORDER BY CASE WHEN document_number = $1 THEN 0 ELSE 1 END, id
      LIMIT 1
    `,
    [externalReference, invoiceNumber],
  );

  let arId = existingAr.rows[0]?.id || null;

  if (arId) {
    await client.query(
      `
        UPDATE ${TB_AR}
        SET
          customer_id = $1,
          description = $2,
          value = $3,
          amount_paid = $4,
          due_date = $5,
          payment_date = $6,
          status = $7,
          invoice_number = $8,
          document_number = COALESCE(document_number, $9),
          issue_date = $10,
          payment_method_id = $11,
          collection_provider = 'ASAAS',
          bank_account_id = $12,
          updated_at = NOW()
        WHERE id = $13
      `,
      [
        order.customer_id,
        description,
        round2(payment.value ?? installment.value),
        paidValue,
        normalizeDate(payment.dueDate) || installment.dueDate,
        normalizeDate(payment.paymentDate),
        status,
        invoiceNumber,
        externalReference,
        normalizeDate(order.issue_date),
        installment.payment_method_id || null,
        installment.bank_account_id || null,
        arId,
      ],
    );
  } else {
    const inserted = await client.query(
      `
        INSERT INTO ${TB_AR} (
          customer_id,
          description,
          value,
          amount_paid,
          due_date,
          payment_date,
          status,
          invoice_number,
          document_number,
          issue_date,
          payment_method_id,
          collection_provider,
          bank_account_id,
          fine,
          interest,
          charges,
          notes
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'ASAAS',$12,0,0,0,$13)
        RETURNING id
      `,
      [
        order.customer_id,
        description,
        round2(payment.value ?? installment.value),
        paidValue,
        normalizeDate(payment.dueDate) || installment.dueDate,
        normalizeDate(payment.paymentDate),
        status,
        invoiceNumber,
        externalReference,
        normalizeDate(order.issue_date),
        installment.payment_method_id || null,
        installment.bank_account_id || null,
        `Criado automaticamente após autorização da NF-e. Ref.: ${externalReference}`,
      ],
    );

    arId = inserted.rows[0].id;
  }

  const raw = {
    ...payment,
    externalReference,
    boleto_pdf_url_local: payment.boleto_pdf_url_local || null,
    boleto_pdf_abs_path: payment.boleto_pdf_abs_path || null,
  };

  await client.query(
    `
      INSERT INTO ${TB_BRIDGE} (
        accounts_receivable_id,
        asaas_payment_id,
        asaas_customer_id,
        asaas_customer_name,
        last_status,
        raw
      ) VALUES ($1,$2,$3,$4,$5,$6::jsonb)
      ON CONFLICT (asaas_payment_id)
      DO UPDATE SET
        accounts_receivable_id = EXCLUDED.accounts_receivable_id,
        asaas_customer_id = EXCLUDED.asaas_customer_id,
        asaas_customer_name = EXCLUDED.asaas_customer_name,
        last_status = EXCLUDED.last_status,
        raw = EXCLUDED.raw,
        updated_at = NOW()
    `,
    [
      arId,
      paymentId,
      order.asaas_id,
      order.legal_name || order.trade_name || null,
      payment.status || 'PENDING',
      JSON.stringify(raw),
    ],
  );

  return { accountsReceivableId: arId, asaasPaymentId: paymentId, status };
}
