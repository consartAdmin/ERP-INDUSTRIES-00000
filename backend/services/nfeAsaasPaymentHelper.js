// ╔══════════════════════════════════════════════════════════════════════╗
// ║ nfeAsaasPaymentHelper.js — Resolve pagamento do pedido p/ NF-e/Asaas║
// ║ Usa: paymentForms (forma) + paymentMethods (condição) + header order ║
// ║ Saída: isBoleto, tpag, label (texto amigável)                        ║
// ╚══════════════════════════════════════════════════════════════════════╝

import paymentFormsApi   from '../repositories/paymentForms/paymentForms.index.js';
import paymentMethodsApi from '../repositories/paymentMethods/paymentMethods.index.js';

/* =======================================================================
 * Helpers internos
 * ======================================================================= */

// normaliza string p/ comparação (sem acento/espaço)
function normalize(str) {
  return (str || '')
    .toString()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '');
}

// garante tPag com 2 dígitos (01, 02, 15, 17, 99...)
function normalizeTpag(value) {
  if (value == null) return null;
  const digits = String(value).replace(/\D+/g, '');
  if (!digits) return null;
  return digits.padStart(2, '0').slice(0, 2);
}

/* =======================================================================
 * resolveOrderPayment(header)
 *  - header = header de ordersApi.getById(orderId)
 *  - retorna: { isBoleto, tpag, label, paymentForm, paymentMethod }
 * ======================================================================= */

export async function resolveOrderPayment(header = {}) {
  const formId = header.payment_form_id;
  const termId = header.payment_term_id;

  // carrega forma (DINHEIRO / CHEQUE / BOLETO / PIX...)
  const [paymentForm, paymentMethod] = await Promise.all([
    formId ? paymentFormsApi.getById(formId)   : null,
    termId ? paymentMethodsApi.getById(termId) : null,
  ]);

  // ----------------------- label amigável -------------------------------
  let label =
    header.payment_form_name ||
    header.payment_term_name ||
    paymentForm?.name ||
    paymentMethod?.name ||
    null;

  if (!label) {
    label = 'N/D';
  }

  // ----------------------- código tPag NF-e -----------------------------
  // prioridade: paymentForms.nfe_tpag > paymentMethods.nfe_tpag
  let tpag =
    normalizeTpag(paymentForm?.nfe_tpag) ||
    normalizeTpag(paymentMethod?.nfe_tpag) ||
    null;

  // ----------------------- É BOLETO? -----------------------------------
  let isBoleto = false;

  // 1) Regra forte: tPag = '15' => boleto
  if (tpag === '15') {
    isBoleto = true;
  } else {
    // 2) Fallback textual
    const nForm  = normalize(paymentForm?.name);
    const nTerm  = normalize(paymentMethod?.name);
    const nLabel = normalize(label);

    if (
      nForm.includes('BOLETO') ||
      nTerm.includes('BOLETO') ||
      nLabel.includes('BOLETO')
    ) {
      isBoleto = true;
    }
  }

  // fallback de tPag se ainda vier vazio
  if (!tpag) {
    if (normalize(label).includes('PIX')) {
      tpag = '17';
    } else if (normalize(label).includes('CREDITO')) {
      tpag = '03';
    } else if (normalize(label).includes('DEBITO')) {
      tpag = '04';
    } else if (normalize(label).includes('DINHEIRO')) {
      tpag = '01';
    } else if (isBoleto) {
      tpag = '15';
    } else {
      tpag = '99';
    }
  }

  return {
    isBoleto,
    tpag,
    label,
    paymentForm,
    paymentMethod,
  };
}

/* =======================================================================
 * Helper específico usado pelo bridge NF-e → Asaas
 * ======================================================================= */

export async function assertBoletoFaturadoOrExplain(header) {
  const info = await resolveOrderPayment(header);

  if (!info.isBoleto) {
    return {
      ok: false,
      reason: 'NAO_E_BOLETO',
      message: `Pedido não é boleto faturado (pagamento: ${info.label || 'N/D'})`,
      paymentInfo: info,
    };
  }

  return {
    ok: true,
    paymentInfo: info,
  };
}

// export default p/ import macro, se quiser
const nfeAsaasPaymentHelper = {
  resolveOrderPayment,
  assertBoletoFaturadoOrExplain,
};

export default nfeAsaasPaymentHelper;
