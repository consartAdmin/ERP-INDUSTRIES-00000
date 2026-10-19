// ╔════════════════════════════════════════════════════════════════════╗
// ║ accountsReceivableAsaasSync.repository.js — Sync do Asaas          ║
// ║ upsertFromAsaasPayment (conta + ponte + caixa) / syncFromAsaas     ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import * as asaasApi from '../asaas/asaas.index.js';
import { TB, TB_BRIDGE, TB_CUSTOMERS } from './accountsReceivable.constants.js';
import { ASAAS_BANK_ACCOUNT_ID_SQL } from './accountsReceivable.sql.js';
import { mapStatusFromAsaas } from './accountsReceivable.mappers.js';
import { syncReceivableCashMovement } from './accountsReceivableCashMovement.repository.js';

// -------------------------------------------------------------------
// UPSERT de um payment do Asaas -> tabela local + ponte
// -------------------------------------------------------------------
async function upsertFromAsaasPayment(payment) {
  const {
    id: asaas_payment_id,
    customer: asaas_customer_id,
    customerName,
    clientName,
    name,
    status: asaas_status,
    description,
    billingDate,
    dueDate,
    paymentDate,
    value,
    netValue,
  } = payment;

  let asaas_customer_name = customerName || clientName || name || null;

  // tenta mapear cliente ASAAS -> ERP
  let localCustomerId = null;

  if (asaas_customer_id) {
    try {
      // 1) tenta pelo asaas_id salvo no cadastro do cliente
      const qByAsaasId = `
        SELECT customer_id, trade_name
        FROM ${TB_CUSTOMERS}
        WHERE asaas_id = $1
        LIMIT 1;
      `;
      const { rows: byAsaasId } = await pool.query(qByAsaasId, [asaas_customer_id]);

      if (byAsaasId[0]) {
        localCustomerId = byAsaasId[0].customer_id;
        if (!asaas_customer_name) asaas_customer_name = byAsaasId[0].trade_name;
      }

      // 2) fallback: busca o cliente no Asaas e tenta localizar no ERP por CPF/CNPJ ou e-mail
      if (!localCustomerId) {
        let asaasCustomer = null;

        try {
          asaasCustomer = await asaasApi.getCustomer(asaas_customer_id);
        } catch (err) {
          console.warn(
            '[AR][upsertFromAsaasPayment] não foi possível consultar customer no Asaas:',
            err?.message || err
          );
        }

        const cpfCnpj = String(
          asaasCustomer?.cpfCnpj ||
          asaasCustomer?.cpf_cnpj ||
          ''
        ).replace(/\D+/g, '');

        const email = String(asaasCustomer?.email || '').trim().toLowerCase();

        if (!asaas_customer_name) {
          asaas_customer_name =
            asaasCustomer?.name ||
            asaasCustomer?.tradeName ||
            asaasCustomer?.company ||
            null;
        }

        if (cpfCnpj) {
          const qByDoc = `
            SELECT customer_id, trade_name
            FROM ${TB_CUSTOMERS}
            WHERE regexp_replace(COALESCE(tax_id, ''), '\\D', '', 'g') = $1
            LIMIT 1;
          `;
          const { rows: byDoc } = await pool.query(qByDoc, [cpfCnpj]);

          if (byDoc[0]) {
            localCustomerId = byDoc[0].customer_id;
            if (!asaas_customer_name) asaas_customer_name = byDoc[0].trade_name;

            // opcional: já grava o vínculo do asaas_id no cadastro do cliente
            await pool.query(
              `
              UPDATE ${TB_CUSTOMERS}
              SET asaas_id = COALESCE(asaas_id, $1)
              WHERE customer_id = $2
              `,
              [asaas_customer_id, localCustomerId]
            );
          }
        }

        if (!localCustomerId && email) {
          const qByEmail = `
            SELECT customer_id, trade_name
            FROM ${TB_CUSTOMERS}
            WHERE LOWER(COALESCE(email, '')) = $1
            LIMIT 1;
          `;
          const { rows: byEmail } = await pool.query(qByEmail, [email]);

          if (byEmail[0]) {
            localCustomerId = byEmail[0].customer_id;
            if (!asaas_customer_name) asaas_customer_name = byEmail[0].trade_name;

            // opcional: já grava o vínculo do asaas_id no cadastro do cliente
            await pool.query(
              `
              UPDATE ${TB_CUSTOMERS}
              SET asaas_id = COALESCE(asaas_id, $1)
              WHERE customer_id = $2
              `,
              [asaas_customer_id, localCustomerId]
            );
          }
        }
      }
    } catch (e) {
      console.error('[AR][upsertFromAsaasPayment] erro ao mapear cliente:', e?.message || e);
    }
  }

  // 1) Procura na ponte se já existe esse payment
  const qBridge = `
    SELECT accounts_receivable_id
    FROM ${TB_BRIDGE}
    WHERE asaas_payment_id = $1
  `;
  const { rows: bridgeRows } = await pool.query(qBridge, [asaas_payment_id]);
  let arId = bridgeRows[0]?.accounts_receivable_id || null;

  const mappedStatus = mapStatusFromAsaas(asaas_status);
  const desc = description || `Asaas ${asaas_payment_id}`;
  const val = Number(value || 0);
  const paid = ['RECEIVED', 'CONFIRMED'].includes(asaas_status)
    ? Number(netValue || value || 0)
    : 0;
  const due = dueDate || billingDate || null;
  const payDt = paymentDate || null;

  // Cobranças criadas após uma NF-e usam a descrição padronizada:
  // "NF-e 8866 - Parcela 002". O número fiscal é propriedade do ERP;
  // payment.invoiceNumber é apenas o identificador interno do Asaas.
  const fiscalDescriptionMatch = String(description || '').match(
    /NF-e\s+([0-9]+)\s*-\s*Parcela\s+([0-9]+)/i
  );
  const fiscalInvoiceNumber = fiscalDescriptionMatch
    ? `${fiscalDescriptionMatch[1]}/${String(
      Number(fiscalDescriptionMatch[2]) || 1
    ).padStart(3, '0')}`
    : null;
  const externalReference = String(
    payment?.externalReference || ''
  ).trim() || null;

  if (!arId) {
    // bank_account_id: cobrança do Asaas recebe a conta bancária Asaas ativa
    const sqlInsert = `
      INSERT INTO ${TB} (
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
        bank_account_id
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, ${ASAAS_BANK_ACCOUNT_ID_SQL})
      RETURNING id;
    `;
    const paramsInsert = [
      localCustomerId,
      desc,
      val,
      paid,
      due,
      payDt,
      mappedStatus,
      fiscalInvoiceNumber,
      externalReference,
      billingDate || null,
    ];
    const { rows: newRows } = await pool.query(sqlInsert, paramsInsert);
    arId = newRows[0].id;
  } else {
    // bank_account_id: só preenche quando estiver vazio (nunca sobrescreve)
    const sqlUpdate = `
      UPDATE ${TB}
      SET
        customer_id  = COALESCE($1, customer_id),
        description  = $2,
        value        = $3,
        amount_paid  = $4,
        due_date     = $5,
        payment_date = $6,
        status       = $7,
        invoice_number = COALESCE(
          NULLIF(TRIM(invoice_number), ''),
          $8
        ),
        document_number = COALESCE(
          NULLIF(TRIM(document_number), ''),
          $9
        ),
        issue_date = COALESCE(issue_date, $10::date),
        bank_account_id = COALESCE(bank_account_id, ${ASAAS_BANK_ACCOUNT_ID_SQL}),
        updated_at   = now()
      WHERE id = $11;
    `;
    const paramsUpdate = [
      localCustomerId,
      desc,
      val,
      paid,
      due,
      payDt,
      mappedStatus,
      fiscalInvoiceNumber,
      externalReference,
      billingDate || null,
      arId,
    ];
    await pool.query(sqlUpdate, paramsUpdate);
  }

  // Upsert na ponte (raw completo)
  const raw = JSON.stringify(payment);
  const sqlBridgeUpsert = `
    INSERT INTO ${TB_BRIDGE} (
      accounts_receivable_id,
      asaas_payment_id,
      asaas_customer_id,
      asaas_customer_name,
      last_status,
      raw
    ) VALUES ($1,$2,$3,$4,$5,$6)
    ON CONFLICT (asaas_payment_id)
    DO UPDATE SET
      accounts_receivable_id = EXCLUDED.accounts_receivable_id,
      asaas_customer_id      = EXCLUDED.asaas_customer_id,
      asaas_customer_name    = EXCLUDED.asaas_customer_name,
      last_status            = EXCLUDED.last_status,
      raw                    = EXCLUDED.raw,
      updated_at             = now();
  `;
  const paramsBridge = [
    arId,
    asaas_payment_id,
    asaas_customer_id || null,
    asaas_customer_name || null,
    asaas_status || null,
    raw,
  ];
  await pool.query(sqlBridgeUpsert, paramsBridge);

  // ENTRADA no caixa (após a ponte, para identificar a conta como Asaas).
  // Falha aqui não interrompe o sync: sem vínculo criado, o próximo sync
  // tenta de novo (recebimentos a partir de AR_CASH_MOVEMENT_START_DATE).
  try {
    await syncReceivableCashMovement(pool, arId);
  } catch (err) {
    console.error('[AR][upsertFromAsaasPayment] erro ao gerar movimentação de caixa:', {
      accountId: arId,
      asaasPaymentId: asaas_payment_id,
      error: err?.message || err,
    });
  }

  return arId;
}

// -------------------------------------------------------------------
// SYNC FROM ASAAS
// Só atualiza contas já vinculadas ao Asaas (ponte) que ainda estão
// em aberto no ERP: Pendente ou Vencido. Pagas/canceladas não mudam
// mais, então não são consultadas. Os filtros da tela são ignorados de
// propósito: uma conta vencida fora do período também precisa atualizar.
// -------------------------------------------------------------------
const OPEN_STATUSES = ['PENDING', 'OVERDUE'];

/** onProgress (opcional) recebe { type: 'start', total } e { type: 'item', index, total, item }. */
export async function syncFromAsaas({ onProgress } = {}) {
  const { rows } = await pool.query(
    `
      SELECT
        ar.id AS accounts_receivable_id,
        b.asaas_payment_id,
        ar.status,
        ar.invoice_number,
        ar.due_date,
        ar.value,
        b.asaas_customer_name
      FROM ${TB} ar
      JOIN ${TB_BRIDGE} b ON b.accounts_receivable_id = ar.id
      WHERE ar.status = ANY($1::text[])
        AND NULLIF(TRIM(b.asaas_payment_id), '') IS NOT NULL
      ORDER BY ar.due_date ASC NULLS LAST, ar.id ASC
    `,
    [OPEN_STATUSES],
  );

  let synced = 0;
  const failed = [];
  const items = [];
  const total = rows.length;
  const report = (event) => {
    try {
      onProgress?.(event);
    } catch {
      // progresso é só informativo: nunca interrompe o sync
    }
  };

  report({ type: 'start', total });

  for (const [position, row] of rows.entries()) {
    const item = {
      accountsReceivableId: row.accounts_receivable_id,
      asaasPaymentId: row.asaas_payment_id,
      invoiceNumber: row.invoice_number || null,
      customerName: row.asaas_customer_name || null,
      dueDate: row.due_date,
      value: Number(row.value || 0),
      statusBefore: row.status,
    };

    try {
      const payment = await asaasApi.getPayment(row.asaas_payment_id);

      // Cobrança excluída no Asaas continua com o status antigo no payload.
      const effective = payment?.deleted ? { ...payment, status: 'CANCELLED' } : payment;
      await upsertFromAsaasPayment(effective);

      items.push({
        ...item,
        ok: true,
        statusAfter: mapStatusFromAsaas(effective.status),
        dueDate: effective.dueDate || item.dueDate,
        value: Number(effective.value ?? item.value),
      });
      synced += 1;
    } catch (err) {
      const error = err?.response?.data?.errors?.[0]?.description || err?.message || String(err);
      failed.push({ ...item, error });
      items.push({ ...item, ok: false, statusAfter: row.status, error });
    }

    report({ type: 'item', index: position + 1, total, item: items[items.length - 1] });
  }

  if (failed.length) {
    console.error('[AR][syncFromAsaas] falhas ao sincronizar:', failed);
  }

  return { ok: failed.length === 0, total, synced, failed, items };
}
