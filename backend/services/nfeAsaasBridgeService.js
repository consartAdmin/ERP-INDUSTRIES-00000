// ╔══════════════════════════════════════════════════════════════════════╗
// ║ nfeAsaasBridgeService.js — Bridge Pedido → Cobrança Asaas (Boleto)  ║
// ║ CONSART ERP | ESM                                                   ║
// ║ ✅ Agora cria 1 cobrança por parcela                                ║
// ║ ✅ Proteção contra duplicidade                                       ║
// ║ ✅ Usa installments / duplicatas reais do pedido                    ║
// ╚══════════════════════════════════════════════════════════════════════╝

import pool from '../config/db.js';

import ordersApi from '../repositories/orders/orders.index.js';
import asaasApi, { ensureAsaasCustomerForEcommerce } from '../repositories/asaas/asaas.index.js';

import { assertBoletoFaturadoOrExplain } from './nfeAsaasPaymentHelper.js';

// ======================================================================
// Helpers de data
// ======================================================================

function todayLocalDateOnly() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function isoDateOnlyLocal(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseBRDateOnly(s) {
  const str = String(s || '').trim();
  if (!str) return null;

  const m = str.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/);
  if (!m) return null;

  const dd = Number(m[1]);
  const mm = Number(m[2]);
  const yy = Number(m[3]);

  if (!dd || !mm || !yy) return null;

  const d = new Date(yy, mm - 1, dd);
  return Number.isNaN(d.getTime()) ? null : d;
}

function toValidDate(dateLike) {
  if (!dateLike) return null;

  if (dateLike instanceof Date) {
    return Number.isNaN(dateLike.getTime()) ? null : dateLike;
  }

  if (typeof dateLike === 'number') {
    const d = new Date(dateLike);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const s = String(dateLike).trim();
  if (!s) return null;

  const isoTry = new Date(s);
  if (!Number.isNaN(isoTry.getTime())) return isoTry;

  if (/^\d{8}$/.test(s)) {
    const iso = `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
    const d2 = new Date(iso + 'T00:00:00');
    return Number.isNaN(d2.getTime()) ? null : d2;
  }

  const br = parseBRDateOnly(s);
  if (br) return br;

  return null;
}

function clampDueDateNotPast(dateISOorAny) {
  const candidate = toValidDate(dateISOorAny);
  const today = todayLocalDateOnly();

  const final = !candidate || candidate < today ? today : candidate;
  return isoDateOnlyLocal(final);
}

// ======================================================================
// Banco
// ======================================================================

async function getOrderDueDateISO(orderId) {
  const id = Number(orderId);
  if (!Number.isFinite(id) || id <= 0) return null;

  try {
    const { rows } = await pool.query(
      `
      SELECT due_date
      FROM public."orders"
      WHERE order_id = $1
      LIMIT 1
      `,
      [id]
    );

    const due = rows?.[0]?.due_date ?? null;
    if (!due) return null;

    if (due instanceof Date) {
      return isoDateOnlyLocal(
        new Date(due.getFullYear(), due.getMonth(), due.getDate())
      );
    }

    const s = String(due).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
    return s;
  } catch (e) {
    console.error('[NF-e→Asaas] Falha ao ler orders.due_date:', e.message || e);
    return null;
  }
}

async function resolveOrderTotal(header, orderId) {
  if (header.total_amount != null) {
    return Number(header.total_amount) || 0;
  }
  const totals = await ordersApi.getTotals(orderId);
  return Number(totals?.total_amount || 0);
}

function resolveNfeNumber(header) {
  return (
    header?.nfe_number ||
    header?.nfe_numero ||
    header?.nfe?.numero ||
    header?.nfe_invoice_number ||
    header?.invoice_number ||
    null
  );
}

// ======================================================================
// Installments
// ======================================================================

function normalizeMoney(v) {
  const n = Number(v || 0);
  return Number.isFinite(n) ? Number(n.toFixed(2)) : 0;
}

function pickInstallmentDueDate(inst) {
  return (
    inst?.due_date ||
    inst?.dueDate ||
    inst?.vencimento ||
    inst?.data_vencimento ||
    inst?.dataVencimento ||
    inst?.date ||
    null
  );
}

function pickInstallmentAmount(inst) {
  return (
    inst?.amount ??
    inst?.value ??
    inst?.valor ??
    inst?.installment_amount ??
    inst?.valor_parcela ??
    null
  );
}

function pickInstallmentNumber(inst, idx) {
  return (
    Number(inst?.installment_number) ||
    Number(inst?.installmentNumber) ||
    Number(inst?.parcela) ||
    idx + 1
  );
}

function resolveInstallmentsFromOrder(orderData) {
  const candidates = [
    orderData?.installments,
    orderData?.duplicatas,
    orderData?.header?.installments,
    orderData?.header?.duplicatas,
    orderData?.header?.parcelas
  ];

  for (const src of candidates) {
    if (!Array.isArray(src) || !src.length) continue;

    const normalized = src
      .map((inst, idx) => ({
        installment_number: pickInstallmentNumber(inst, idx),
        due_date: pickInstallmentDueDate(inst),
        amount: normalizeMoney(pickInstallmentAmount(inst))
      }))
      .filter((inst) => inst.amount > 0);

    if (normalized.length) {
      return normalized;
    }
  }

  return [];
}

function buildFallbackSingleInstallment({ header, dueDateOption, dueDateFromDb, totalValue }) {
  const due =
    dueDateFromDb ||
    dueDateOption ||
    header?.due_date ||
    header?.dueDate ||
    null;

  return [
    {
      installment_number: 1,
      due_date: clampDueDateNotPast(due),
      amount: normalizeMoney(totalValue)
    }
  ];
}

// ======================================================================
// Duplicity guard
// ======================================================================

async function findExistingAsaasChargesByOrder(orderId) {
  const id = Number(orderId);
  if (!Number.isFinite(id) || id <= 0) return [];

  const { rows } = await pool.query(
    `
    SELECT
      asa.asaas_payment_id,
      asa.raw->>'externalReference' AS external_reference,
      asa.raw->>'invoiceNumber' AS invoice_number,
      asa.raw->>'billingType' AS billing_type,
      asa.raw->>'status' AS asaas_status,
      ar.id AS accounts_receivable_id,
      ar.value,
      ar.due_date
    FROM public."accountsReceivableAsaas" asa
    LEFT JOIN public."accountsReceivable" ar
      ON ar.id = asa.accounts_receivable_id
    WHERE
      asa.raw->>'externalReference' LIKE $1
      OR asa.raw->>'description' ILIKE $2
    ORDER BY ar.due_date ASC NULLS LAST, ar.id ASC
    `,
    [`ORDER_${id}%`, `%Pedido ${id}%`]
  );

  return rows || [];
}

// ======================================================================
// Main
// ======================================================================

export async function sendOrderToAsaas(
  orderId,
  { dueDate, finePercent, interestPercent } = {},
) {
  const id = Number(orderId);
  if (!Number.isFinite(id) || id <= 0) {
    return { ok: false, error: 'ORDER_ID_INVALIDO' };
  }

  const resOrder = await ordersApi.getById(id);
  if (!resOrder?.ok || !resOrder.header) {
    console.log('[NF-e→Asaas] Pedido %s não encontrado.', id);
    return { ok: false, error: 'PEDIDO_NAO_ENCONTRADO' };
  }

  const header = resOrder.header;

  const check = await assertBoletoFaturadoOrExplain(header);
  if (!check.ok) {
    console.log(
      '[NF-e→Asaas] Pedido %s não é boleto faturado (pagamento: %s)',
      id,
      check.paymentInfo?.label || 'N/D',
    );
    return { ok: false, error: check.reason, paymentInfo: check.paymentInfo };
  }

  const { paymentInfo } = check;

  const existingCharges = await findExistingAsaasChargesByOrder(id);
  if (existingCharges.length > 0) {
    console.log(
      '[NF-e→Asaas] Pedido %s já possui cobranças vinculadas. Nenhuma nova cobrança será criada.',
      id
    );
    return {
      ok: true,
      skipped: true,
      reason: 'CHARGES_ALREADY_EXIST',
      order_id: id,
      paymentInfo,
      existingCharges
    };
  }

  const totalValue = await resolveOrderTotal(header, id);
  if (!totalValue || totalValue <= 0) {
    return { ok: false, error: 'TOTAL_ZERADO', paymentInfo };
  }

  let customerId = header.asaas_customer_id;
  if (!customerId) {
    customerId = await ensureAsaasCustomerForEcommerce({
      name: header.customer_name || header.nome_razao_social,
      email: header.email,
      cpfCnpj: header.customer_tax_id || header.cnpj_cpf,
      phone: header.phone,
      mobilePhone: header.phone,
    });
  }

  const dueDateFromDb = await getOrderDueDateISO(id);
  const nfeNumber = resolveNfeNumber(header);
  const pedidoNumero = header.number || header.order_id || id;

  let installments = resolveInstallmentsFromOrder(resOrder);

  if (!installments.length) {
    installments = buildFallbackSingleInstallment({
      header,
      dueDateOption: dueDate,
      dueDateFromDb,
      totalValue
    });
  } else {
    installments = installments.map((inst) => ({
      installment_number: inst.installment_number,
      due_date: clampDueDateNotPast(inst.due_date || dueDateFromDb || dueDate),
      amount: normalizeMoney(inst.amount)
    }));
  }

  const sumInstallments = normalizeMoney(
    installments.reduce((acc, inst) => acc + normalizeMoney(inst.amount), 0)
  );
  const totalRounded = normalizeMoney(totalValue);

  if (installments.length > 1 && sumInstallments !== totalRounded) {
    console.warn('[NF-e→Asaas] Soma das parcelas diverge do total do pedido.', {
      orderId: id,
      totalRounded,
      sumInstallments,
      installments
    });
  }

  const createdCharges = [];

  for (const inst of installments) {
    const parcelaNo = inst.installment_number;
    const parcelaDesc = installments.length > 1 ? ` | Parcela ${String(parcelaNo).padStart(3, '0')}` : '';

    const description = nfeNumber
      ? `NF-e nº ${nfeNumber} | Pedido ${pedidoNumero}${parcelaDesc}`
      : `Pedido ${pedidoNumero}${parcelaDesc}`;

    const externalReference = `ORDER_${header.order_id || id}_PARC_${parcelaNo}`;

    console.log('[NF-e→Asaas] 🧾 Criando cobrança da parcela...', {
      orderId: id,
      customerId,
      installment: parcelaNo,
      value: inst.amount,
      dueDate: inst.due_date,
      externalReference,
      paymentLabel: paymentInfo?.label || 'N/D',
      nfeNumber: nfeNumber || null,
    });

    const charge = await asaasApi.createCharge({
      customerId,
      billingType: 'BOLETO',
      value: inst.amount,
      description,
      dueDate: inst.due_date,
      finePercent,
      interestPercent,
      externalReference,
    });

    createdCharges.push({
      installment_number: parcelaNo,
      amount: inst.amount,
      due_date: inst.due_date,
      charge,
    });
  }

  console.log(
    '[NF-e→Asaas] ✅ %s cobrança(s) criada(s) para o pedido %s.',
    createdCharges.length,
    id
  );

  return {
    ok: true,
    order_id: header.order_id || id,
    paymentInfo,
    charges: createdCharges,
    installments_created: createdCharges.length,
  };
}

export default { sendOrderToAsaas };