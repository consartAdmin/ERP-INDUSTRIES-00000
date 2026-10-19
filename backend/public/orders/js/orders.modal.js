// orders.modal.js — Orders module
'use strict';

import { ROUTES } from './orders.config.js';
import { state } from './orders.state.js';
import { fmtMoney, dlog, dsafeStringify, toast } from './orders.utils.js';
import { getOrderPayments } from './orders.api.js';
import { emitirNFe } from './orders.actions.js';

// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: orders.details.js                                              ║
// ║ MODULE: Orders                                                       ║
// ║ PRODNEX ERP                                                          ║
// ║ Modal de detalhes do pedido                                          ║
// ║ ✅ Carrega detalhes reais via API                                    ║
// ║ ✅ Usa customer/header/budget corretamente                           ║
// ║ ✅ Resolve forma de pagamento por nome ou ID                         ║
// ║ ✅ Prioriza ordersPayments reais                                     ║
// ║ ✅ Aceita múltiplos formatos de payload                              ║
// ║ ✅ Exibe cliente, info complementar, checklist, pagamento            ║
// ║ ✅ Exibe itens e totais                                              ║
// ║ ✅ Modal com fechamento por ESC / backdrop / botão X                 ║
// ║ ✅ FIX: usa subtotal / descontos / total vindos do pedido            ║
// ║ ✅ FIX: exibe desconto geral corretamente                            ║
// ╚══════════════════════════════════════════════════════════════════════╝


export async function openOrderDetailsModal(id) {
  if (!id) return;

  const modal = ensureOrderDetailsModal();
  const title = modal.querySelector('#orderDetailsModalTitle');
  const body = modal.querySelector('#orderDetailsModalBody');

  if (!body) {
    console.error('[orders.details] Corpo do modal não encontrado.');
    return;
  }

  if (title) {
    title.textContent = `Detalhes do Pedido #${id}`;
  }

  showOrderDetailsMessage(body, 'Carregando detalhes do pedido...', 'loading');

  modal.classList.add('is-open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');

  modal.querySelector('.modal__close')?.focus();

  try {
    const url = ROUTES.orderById(id);

    const r = await fetch(url, {
      headers: { Accept: 'application/json' },
      cache: 'no-store'
    });

    const raw = await r.text();

    let o = null;

    try {
      o = raw ? JSON.parse(raw) : null;
    } catch {
      o = { __parseError: true, raw };
    }

    dlog('details payload:', dsafeStringify(o));

    if (!r.ok) {
      throw new Error(`HTTP ${r.status}`);
    }

    let paymentsPayload = null;

    try {
      paymentsPayload = await getOrderPayments(id);
      dlog('payments payload:', dsafeStringify(paymentsPayload));
    } catch (error) {
      console.warn('[orders.details] payments error:', error);
    }

    const normalizedPayments = normalizePaymentsPayload(
      paymentsPayload,
      o
    );

    renderOrderDetails(
      body,
      o,
      normalizedPayments.payments,
      normalizedPayments.installments
    );
  } catch (error) {
    console.error(
      '[orders.details] erro ao carregar detalhes:',
      error
    );

    showOrderDetailsMessage(body, 'Erro ao carregar detalhes do pedido.', 'error');
  }
}

export function closeOrderDetailsModal() {
  const modal = document.getElementById('orderDetailsModal');

  if (!modal) return;

  modal.classList.remove('is-open');
  modal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('modal-open');
}

let orderDetailsEventsInitialized = false;

function ensureOrderDetailsModal() {
  const modal = document.getElementById('orderDetailsModal');

  if (!modal) {
    throw new Error('Modal #orderDetailsModal não encontrado em orders.html.');
  }

  if (orderDetailsEventsInitialized) return modal;

  modal.addEventListener('click', (event) => {
    const closeElement = event.target.closest(
      '[data-order-details-close]'
    );

    if (closeElement) {
      closeOrderDetailsModal();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (
      event.key === 'Escape' &&
      modal.classList.contains('is-open')
    ) {
      event.preventDefault();
      closeOrderDetailsModal();
    }
  });

  orderDetailsEventsInitialized = true;

  return modal;
}

export function renderOrderDetails(body, o, payments = [], installments = []) {
  const h = o?.header || o || {};
  const customer = o?.customer || null;
  const budget = o?.budget || o?.orcamento || null;
  const items = Array.isArray(o?.items) ? o.items : [];

  const customerName = firstNonEmpty(
    customer?.legal_name,
    customer?.razao_social,
    customer?.trade_name,
    customer?.nome_fantasia,
    customer?.name,
    h.customer_legal_name,
    h.customer_name,
    h.cliente_nome,
    h.nome_cliente,
    h.customer?.legal_name,
    h.customer?.name
  );

  const customerDocument = firstNonEmpty(
    customer?.tax_id,
    customer?.cnpj_cpf,
    customer?.document,
    customer?.cpf_cnpj,
    h.customer_document,
    h.customer_tax_id,
    h.cnpj_cpf,
    h.customer_cnpj_cpf,
    h.document,
    h.cpf_cnpj,
    h.customer?.document
  );

  const customerIe = firstNonEmpty(
    customer?.state_registration,
    customer?.inscricao_estadual,
    customer?.ie,
    h.customer_ie,
    h.ie,
    h.inscricao_estadual,
    h.customer_state_registration,
    h.customer?.ie
  );

  const customerStreet = firstNonEmpty(
    customer
      ? [customer?.street_type, customer?.street_name].filter(Boolean).join(' ')
      : '',
    customer?.address,
    customer?.street,
    customer?.logradouro,
    h.customer_address,
    h.address,
    h.customer_street,
    h.street,
    h.customer_logradouro
  );

  const customerNumber = firstNonEmpty(
    customer?.street_number,
    customer?.number,
    customer?.numero,
    h.customer_number,
    h.number,
    h.customer_address_number
  );

  const customerNeighborhood = firstNonEmpty(
    customer?.neighborhood,
    customer?.bairro,
    customer?.district,
    h.customer_neighborhood,
    h.neighborhood,
    h.customer_district,
    h.customer_bairro
  );

  const customerAddress = firstNonEmpty(
    joinAddressParts(customerStreet, customerNumber, customerNeighborhood),
    customerStreet
  );

  const customerCity = firstNonEmpty(
    customer?.city,
    customer?.cidade,
    customer?.municipio,
    h.customer_city,
    h.city,
    h.customer_municipio,
    h.customer?.city
  );

  const customerState = firstNonEmpty(
    customer?.state,
    customer?.uf,
    h.customer_state,
    h.state,
    h.uf,
    h.customer_uf,
    h.customer?.state
  );

  const customerCityUf = [customerCity, customerState].filter(Boolean).join(' / ');
  const customerIbge = resolveIbgeCode({ header: h, customer, ...o });

  const customerZip = firstNonEmpty(
    customer?.postal_code,
    customer?.zip,
    customer?.zip_code,
    customer?.cep,
    h.customer_zip,
    h.zip_code,
    h.cep,
    h.customer_cep,
    h.customer_postal_code,
    h.customer?.zip
  );

  const customerPhone = firstNonEmpty(
    customer?.phone_number,
    customer?.mobile_number,
    customer?.phone,
    customer?.telefone,
    h.customer_phone,
    h.phone,
    h.telefone,
    h.customer_telephone,
    h.customer_tel,
    h.customer?.phone
  );

  const customerEmail = firstNonEmpty(
    customer?.email,
    h.customer_email,
    h.email,
    h.customer_mail,
    h.customer?.email
  );

  const customerContactLine = [customerPhone, customerEmail].filter(Boolean).join(' | ');

  const additionalInfo = firstNonEmpty(
    h.additional_info,
    h.complementary_info,
    h.complementary_information,
    h.order_notes,
    h.notes,
    h.observation,
    h.observacao,
    h.solicitante,
    budget?.notes,
    budget?.observations
  );

  const paymentMethodId = firstNonEmpty(
    h.payment_form_id,
    h.payment_method_id,
    h.paymentMethods_id,
    h.payment_method,
    budget?.payment_form_id,
    budget?.payment_method_id,
    budget?.paymentMethods_id
  );

  const paymentTermId = firstNonEmpty(
    h.payment_term_id,
    h.payment_condition_id,
    budget?.payment_term_id,
    budget?.payment_condition_id
  );

  const orderDate = firstNonEmpty(
    h.order_date,
    h.date,
    h.issue_date,
    h.created_at,
    h.createdAt,
    h.data_pedido,
    budget?.order_date,
    budget?.date,
    budget?.created_at
  );

  let fallbackPaymentMethod = firstNonEmpty(
    h.payment_method_name,
    h.payment_form_name,
    h.payment_method_name_text,
    h.payment_form,
    h.forma_pagamento,
    h.payment?.method,
    budget?.payment_method_name,
    budget?.payment_form_name,
    budget?.payment_form,
    budget?.payment_method
  );

  let fallbackPaymentTerm = firstNonEmpty(
    h.payment_condition_name,
    h.payment_term_name,
    h.payment_terms,
    h.payment_conditions,
    h.condicao_pagamento,
    h.payment?.condition,
    budget?.payment_condition_name,
    budget?.payment_term_name,
    budget?.payment_terms,
    budget?.payment_conditions,
    budget?.condicao_pagamento
  );

  if (!fallbackPaymentMethod && paymentMethodId != null && Array.isArray(state?.paymentMethods)) {
    const pm = state.paymentMethods.find((p) =>
      String(
        p.paymentMethods_id ??
        p.payment_form_id ??
        p.payment_method_id ??
        p.id
      ) === String(paymentMethodId)
    );

    if (pm) {
      fallbackPaymentMethod = firstNonEmpty(
        pm.name,
        pm.description,
        pm.nome,
        pm.label
      );
    }
  }

  if (!fallbackPaymentMethod && paymentMethodId != null) {
    fallbackPaymentMethod = `ID ${paymentMethodId}`;
  }

  if (!fallbackPaymentTerm && paymentTermId != null) {
    fallbackPaymentTerm = `ID ${paymentTermId}`;
  }

  const freightValue = toNumber(
    h.freight_value ??
    h.freight ??
    h.valor_frete ??
    0
  );

  const subtotalFromHeader = toNumber(
    h.subtotal ??
    h.subtotal_amount ??
    h.valor_subtotal ??
    0
  );

  const itemDiscountsFromHeader = toNumber(
    h.items_discount_total ??
    h.items_discounts_total ??
    h.discount_items_total ??
    0
  );

  const globalDiscountAmount = toNumber(
    h.global_discount_amount ??
    h.desconto_geral_valor ??
    h.discount_global_amount ??
    0
  );

  const totalDiscountFromHeader = toNumber(
    h.total_discount ??
    h.discount_total ??
    (itemDiscountsFromHeader + globalDiscountAmount)
  );

  const totalFromHeader = toNumber(
    h.total_amount ??
    h.total ??
    h.valor_total ??
    0
  );

  const subtotalFallback = items.reduce((sum, it) => {
    const qty = toNumber(
      it.quantity ??
      it.qty ??
      it.quantidade ??
      0
    );

    const unitPrice = toNumber(
      it.unit_price ??
      it.price ??
      it.valor_unitario ??
      0
    );

    return sum + (qty * unitPrice);
  }, 0);

  const itemDiscountsFallback = items.reduce((sum, it) => {
    return sum + toNumber(
      it.discount_value ??
      it.discount ??
      it.desconto ??
      0
    );
  }, 0);

  const subtotal = subtotalFromHeader > 0 ? subtotalFromHeader : subtotalFallback;

  const itemDiscounts = itemDiscountsFromHeader > 0
    ? itemDiscountsFromHeader
    : itemDiscountsFallback;

  const discounts = totalDiscountFromHeader > 0
    ? totalDiscountFromHeader
    : itemDiscountsFallback;

  const total = Math.max(
    0,
    totalFromHeader > 0
      ? totalFromHeader
      : (subtotal - discounts + freightValue)
  );

  const message = body.querySelector('#orderDetailsMessage');
  const content = body.querySelector('#orderDetailsContent');

  if (!content) {
    throw new Error('Container #orderDetailsContent não encontrado em orders.html.');
  }

  setDetailText(content, 'orderDetailCustomerName', customerName);
  setDetailText(content, 'orderDetailCustomerDocument', customerDocument);
  setDetailText(content, 'orderDetailCustomerIe', customerIe);
  setDetailText(content, 'orderDetailCustomerAddress', customerAddress);
  setDetailText(content, 'orderDetailCustomerCityUf', customerCityUf);
  setDetailText(content, 'orderDetailCustomerIbge', customerIbge);
  setDetailText(content, 'orderDetailCustomerZip', customerZip);
  setDetailText(content, 'orderDetailCustomerContact', customerContactLine);
  setDetailText(
    content,
    'orderDetailAdditionalInfo',
    additionalInfo || 'Sem informações complementares.'
  );

  setChecklistState(content, 'orderChecklistDocument', Boolean(customerDocument));
  setChecklistState(content, 'orderChecklistIe', Boolean(customerIe));
  setChecklistState(content, 'orderChecklistAddress', Boolean(customerAddress));
  setChecklistState(content, 'orderChecklistCityUf', Boolean(customerCityUf));
  setChecklistState(content, 'orderChecklistZip', Boolean(customerZip));
  setChecklistState(content, 'orderChecklistEmail', Boolean(customerEmail));

  renderPayments(
    content,
    payments,
    installments,
    fallbackPaymentMethod,
    fallbackPaymentTerm,
    orderDate
  );
  renderItems(content, items);

  setDetailText(content, 'orderDetailSubtotal', fmtMoney(subtotal));
  setDetailText(content, 'orderDetailItemDiscounts', fmtMoney(itemDiscounts));
  setDetailText(content, 'orderDetailGlobalDiscount', fmtMoney(globalDiscountAmount));
  setDetailText(content, 'orderDetailDiscounts', fmtMoney(discounts));
  setDetailText(content, 'orderDetailFreight', fmtMoney(freightValue));
  setDetailText(content, 'orderDetailTotal', fmtMoney(total));

  if (message) message.hidden = true;
  content.hidden = false;
}

function showOrderDetailsMessage(body, text, type = 'loading') {
  const message = body?.querySelector('#orderDetailsMessage');
  const content = body?.querySelector('#orderDetailsContent');

  if (content) content.hidden = true;
  if (!message) return;

  message.hidden = false;
  message.className = type === 'error'
    ? 'order-details-error'
    : 'order-details-loading';
  message.textContent = text;
}

function setDetailText(root, id, value, fallback = '—') {
  const element = root?.querySelector('#' + id);
  if (!element) return;

  const text = value == null ? '' : String(value).trim();
  element.textContent = text || fallback;
}

function setChecklistState(root, id, ok) {
  const item = root?.querySelector('#' + id);
  if (!item) return;

  item.classList.toggle('is-ok', ok);
  item.classList.toggle('is-missing', !ok);

  const icon = item.querySelector('.order-details-checklist__icon');
  if (icon) icon.textContent = ok ? '✔' : '⚠';
}

function requireTemplate(id) {
  const template = document.getElementById(id);
  if (!(template instanceof HTMLTemplateElement)) {
    throw new Error('Template #' + id + ' não encontrado em orders.html.');
  }
  return template;
}

function renderPayments(
  root,
  payments = [],
  installments = [],
  fallbackMethod = '',
  fallbackTerm = '',
  orderDate = ''
) {
  const paymentHost = root.querySelector('#orderDetailPayments');
  const installmentHost = root.querySelector('#orderDetailInstallments');

  if (!paymentHost || !installmentHost) return;

  paymentHost.replaceChildren();
  installmentHost.replaceChildren();

  const normalizedPayments = normalizePaymentsArray(payments);
  const normalizedInstallments = normalizeInstallmentsArray(installments);

  // ============================================================
  // HELPERS
  // ============================================================

  const splitPaymentMethodAndTerm = (value = '') => {
    const text = String(value || '').trim();

    if (!text) {
      return {
        method: '',
        term: ''
      };
    }

    /*
     * Exemplos:
     *
     * BOLETO 14/21 DIAS
     *   -> method: BOLETO
     *   -> term:   14/21 DIAS
     *
     * BOLETO 35/42/49 DIAS
     *   -> method: BOLETO
     *   -> term:   35/42/49 DIAS
     *
     * BOLETO 7 DIAS
     *   -> method: BOLETO
     *   -> term:   7 DIAS
     *
     * PIX
     *   -> method: PIX
     *   -> term:   ''
     */

    const match = text.match(
      /^(.*?)\s+((?:\d+\s*\/\s*)*\d+\s*DIAS?)$/i
    );

    if (!match) {
      return {
        method: text,
        term: ''
      };
    }

    return {
      method: String(match[1] || '').trim(),
      term: String(match[2] || '')
        .replace(/\s*\/\s*/g, '/')
        .replace(/\s+/g, ' ')
        .trim()
        .toUpperCase()
    };
  };

  // ============================================================
  // FALLBACK
  // ============================================================

  const fallbackSplit = splitPaymentMethodAndTerm(fallbackMethod);

  const fallbackMethodClean =
    fallbackSplit.method ||
    fallbackMethod ||
    '';

  const fallbackTermClean =
    fallbackTerm ||
    fallbackSplit.term ||
    '';

  // ============================================================
  // RESOLVE CONDITION
  // ============================================================

  const resolvedTerm =
    fallbackTermClean ||
    resolvePaymentTermFromPayments(
      normalizedPayments,
      normalizedInstallments,
      orderDate,
      fallbackMethod
    ) ||
    '—';

  // ============================================================
  // PAYMENT ROWS
  // ============================================================

  const rows = normalizedPayments.length
    ? normalizedPayments
    : [{
      payment_method_name: fallbackMethodClean || '—',
      payment_term_name: resolvedTerm,
      amount: 0
    }];

  const paymentTemplate =
    requireTemplate('orderDetailPaymentTemplate');

  rows.forEach((payment) => {

    const fragment =
      paymentTemplate.content.cloneNode(true);

    // ----------------------------------------------------------
    // RAW METHOD
    // ----------------------------------------------------------

    const rawMethod = firstNonEmpty(
      payment.payment_method_name,
      payment.payment_form_name,
      payment.name,
      payment.nome,
      fallbackMethod,
      'FORMA NÃO INFORMADA'
    );

    // ----------------------------------------------------------
    // SPLIT METHOD / TERM
    // ----------------------------------------------------------

    const split =
      splitPaymentMethodAndTerm(rawMethod);

    const method =
      split.method ||
      rawMethod ||
      'FORMA NÃO INFORMADA';

    // ----------------------------------------------------------
    // TERM
    // ----------------------------------------------------------

    const term = firstNonEmpty(

      // Prefer condition embedded in:
      // "BOLETO 14/21 DIAS"
      split.term,

      payment.payment_term_name,
      payment.payment_condition_name,
      payment.term_name,
      payment.condition_name,
      payment.condicao_pagamento,

      fallbackTermClean,

      resolvedTerm,

      '—'
    );

    // ----------------------------------------------------------
    // RENDER
    // ----------------------------------------------------------

    const methodElement =
      fragment.querySelector('[data-payment-method]');

    const termElement =
      fragment.querySelector('[data-payment-term]');

    const amountElement =
      fragment.querySelector('[data-payment-amount]');

    if (methodElement) {
      methodElement.textContent = method;
      methodElement.title = method;
    }

    if (termElement) {
      termElement.textContent = term;
      termElement.title = term;
    }

    if (amountElement) {
      amountElement.textContent =
        fmtMoney(toNumber(payment.amount));
    }

    paymentHost.appendChild(fragment);
  });

  // ============================================================
  // INSTALLMENTS
  // ============================================================

  const installmentTemplate =
    requireTemplate('orderDetailInstallmentTemplate');

  normalizedInstallments.forEach((installment) => {

    const fragment =
      installmentTemplate.content.cloneNode(true);

    const number =
      String(
        installment.installment_number || 1
      ).padStart(3, '0');

    fragment.querySelector(
      '[data-installment-label]'
    ).textContent =
      'Parcela ' + number + ':';

    fragment.querySelector(
      '[data-installment-date]'
    ).textContent =
      formatDateBRLoose(
        installment.due_date
      );

    fragment.querySelector(
      '[data-installment-amount]'
    ).textContent =
      fmtMoney(
        toNumber(installment.amount)
      );

    installmentHost.appendChild(fragment);
  });
}

function renderItems(root, items = []) {
  const body = root.querySelector('#orderDetailItemsBody');
  if (!body) return;

  body.replaceChildren();

  if (!items.length) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 10;
    cell.className = 'ta-center';
    cell.textContent = 'Nenhum item encontrado.';
    row.appendChild(cell);
    body.appendChild(row);
    return;
  }

  const template = requireTemplate('orderDetailItemTemplate');

  items.forEach((item) => {
    const fragment = template.content.cloneNode(true);
    const qty = toNumber(item.quantity ?? item.qty ?? item.quantidade ?? 0);
    const unitPrice = toNumber(item.unit_price ?? item.price ?? item.valor_unitario ?? 0);
    const discount = toNumber(item.discount_value ?? item.discount ?? item.desconto ?? 0);
    const total = Math.max(0, (qty * unitPrice) - discount);

    setTemplateText(fragment, '[data-item-sku]', item.sku || item.product_sku || '');
    setTemplateText(fragment, '[data-item-description]', item.description || item.descricao || item.product_name || '');
    setTemplateText(fragment, '[data-item-ncm]', item.ncm || item.ncm_code || '');
    setTemplateText(fragment, '[data-item-cest]', item.cest || item.cest_code || '');
    setTemplateText(fragment, '[data-item-unit]', item.unit || item.unidade || '');
    setTemplateText(fragment, '[data-item-quantity]', formatQty(qty));
    setTemplateText(fragment, '[data-item-unit-price]', fmtMoney(unitPrice));
    setTemplateText(fragment, '[data-item-discount]', fmtMoney(discount));
    setTemplateText(fragment, '[data-item-total]', fmtMoney(total));
    setTemplateText(
      fragment,
      '[data-item-tax-profile]',
      item.tax_profile_name || item.fiscal_profile || item.profile_name || item.perfil_fiscal || ''
    );

    body.appendChild(fragment);
  });
}

function setTemplateText(fragment, selector, value) {
  const element = fragment.querySelector(selector);
  if (element) element.textContent = value == null ? '' : String(value);
}

function normalizePaymentsPayload(payload, orderPayload) {
  const candidates = [
    payload?.payments,
    payload?.orderPayments,
    payload?.rows,
    payload?.data?.payments,
    payload?.data?.orderPayments,
    payload?.data?.rows,
    orderPayload?.payments,
    orderPayload?.orderPayments,
    orderPayload?.header?.payments,
    orderPayload?.header?.orderPayments
  ];

  const payments = normalizePaymentsArray(candidates.find(Array.isArray) || []);

  const instCandidates = [
    payload?.installments,
    payload?.paymentInstallments,
    payload?.rows_installments,
    payload?.data?.installments,
    payload?.data?.paymentInstallments,
    orderPayload?.installments,
    orderPayload?.paymentInstallments
  ];

  const installments = normalizeInstallmentsArray(instCandidates.find(Array.isArray) || []);

  return { payments, installments };
}

function normalizePaymentsArray(arr) {
  if (!Array.isArray(arr)) return [];

  return arr.map((p) => ({
    payment_method_name: firstNonEmpty(
      p?.payment_method_name,
      p?.payment_form_name,
      p?.method_name,
      p?.forma_pagamento,
      p?.name,
      p?.nome
    ),
    payment_term_name: firstNonEmpty(
      p?.payment_term_name,
      p?.payment_condition_name,
      p?.term_name,
      p?.condition_name,
      p?.condicao_pagamento
    ),
    amount: toNumber(
      p?.amount ??
      p?.valor ??
      p?.value ??
      p?.vPag ??
      0
    ),
    raw: p
  })).filter((p) => p.payment_method_name || p.amount > 0);
}

function normalizeInstallmentsArray(arr) {
  if (!Array.isArray(arr)) return [];

  return arr.map((i, index) => ({
    installment_number: toNumber(
      i?.installment_number ??
      i?.numero_parcela ??
      i?.parcela ??
      index + 1
    ),
    due_date: firstNonEmpty(
      i?.due_date,
      i?.vencimento,
      i?.dVenc,
      i?.data_vencimento
    ),
    amount: toNumber(
      i?.amount ??
      i?.valor ??
      i?.value ??
      i?.vDup ??
      0
    ),
    raw: i
  })).filter((i) => i.amount > 0 || i.due_date);
}

function resolvePaymentTermFromPayments(
  payments = [],
  installments = [],
  orderDate = '',
  paymentMethod = ''
) {
  let directTerm = '';

  for (const p of payments) {
    const direct = firstNonEmpty(
      p?.payment_term_name,
      p?.payment_condition_name,
      p?.term_name,
      p?.condition_name,
      p?.condicao_pagamento,
      p?.raw?.payment_term_name,
      p?.raw?.payment_condition_name,
      p?.raw?.term_name,
      p?.raw?.condition_name
    );

    if (direct) {
      directTerm = direct;
      break;
    }
  }

  const directTermIsCash = /^À?\s*VISTA$/i.test(directTerm);
  if (directTerm && !directTermIsCash) return directTerm;

  if (Array.isArray(installments) && installments.length) {
    const dates = installments
      .map((i) => parseLooseDate(i.due_date))
      .filter(Boolean)
      .sort((a, b) => a.getTime() - b.getTime());

    if (dates.length >= 2) {
      const first = dates[0];
      const last = dates[dates.length - 1];
      const diffDays = Math.round((last.getTime() - first.getTime()) / 86400000);

      if (diffDays > 0) {
        return `${diffDays} DIAS`;
      }
    }

    if (dates.length === 1) {
      const parsedOrderDate = parseLooseDate(orderDate);

      if (parsedOrderDate) {
        const dueDate = dates[0];
        const orderDay = Date.UTC(
          parsedOrderDate.getFullYear(),
          parsedOrderDate.getMonth(),
          parsedOrderDate.getDate()
        );
        const dueDay = Date.UTC(
          dueDate.getFullYear(),
          dueDate.getMonth(),
          dueDate.getDate()
        );
        const diffDays = Math.round((dueDay - orderDay) / 86400000);

        if (diffDays > 0) return `${diffDays} DIAS`;
        if (diffDays === 0) return 'À VISTA';
      }

      const methodWithDays = firstNonEmpty(
        paymentMethod,
        payments[0]?.payment_method_name,
        payments[0]?.payment_form_name
      );
      const daysMatch = methodWithDays.match(/\b(\d+)\s*DIAS?\b/i);

      if (daysMatch) return `${Number(daysMatch[1])} DIAS`;

      return directTerm || 'À VISTA';
    }
  }

  return directTerm;
}

function resolveIbgeCode(o) {
  const candidatesPaths = [
    'customer.code_ibge',
    'customer.ibge_code',
    'customer.city_ibge',
    'customer.municipio_ibge',
    'customer.customer_codigo_ibge',
    'customer.codigo_ibge',
    'customer.ibge',

    'header.customer_codigo_ibge',
    'header.customer_ibge_code',
    'header.customer_city_ibge',
    'header.customer_ibge',
    'header.customer_codigo_municipio',
    'header.customer_city_code_ibge',
    'header.code_ibge',
    'header.ibge_code',
    'header.ibge',

    'customer_codigo_ibge',
    'customer_ibge_code',
    'customer_city_ibge',
    'code_ibge',
    'ibge_code',
    'ibge'
  ];

  for (const path of candidatesPaths) {
    const value = dget(o, path);
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return String(value).trim();
    }
  }

  return '';
}

function dget(obj, path) {
  try {
    return path.split('.').reduce((acc, key) => (
      acc && acc[key] !== undefined ? acc[key] : undefined
    ), obj);
  } catch {
    return undefined;
  }
}

function toNumber(value) {
  if (value == null || value === '') return 0;

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  const s = String(value).trim();
  if (!s) return 0;

  const hasComma = s.includes(',');
  const hasDot = s.includes('.');

  let normalized = s;

  if (hasComma && hasDot) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      normalized = s.replace(/\./g, '').replace(',', '.');
    } else {
      normalized = s.replace(/,/g, '');
    }
  } else if (hasComma && !hasDot) {
    normalized = s.replace(',', '.');
  }

  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}

function formatQty(value) {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3
  }).format(toNumber(value));
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function joinAddressParts(...parts) {
  return parts
    .map((v) => String(v ?? '').trim())
    .filter(Boolean)
    .join(' - ');
}

function firstNonEmpty(...values) {
  for (const value of values) {
    if (value === undefined || value === null) continue;

    const str = String(value).trim();
    if (str) return str;
  }
  return '';
}

function parseLooseDate(value) {
  if (!value) return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  const raw = String(value).trim();
  if (!raw) return null;

  const br = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) {
    const [, dd, mm, yyyy] = br;
    const d = new Date(`${yyyy}-${mm}-${dd}T00:00:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const iso = new Date(raw);
  return Number.isNaN(iso.getTime()) ? null : iso;
}

function formatDateBRLoose(value) {
  const d = parseLooseDate(value);
  if (!d) return '—';
  return d.toLocaleDateString('pt-BR');
}

// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: orders.previewNfe.js                                           ║
// ║ MODULE: Orders                                                       ║
// ║ PRODNEX ERP                                                          ║
// ║ Pré-visualização PDF antes da emissão da NF-e                        ║
// ║ ✅ Abre modal com iframe do PDF                                      ║
// ║ ✅ Permite baixar PDF                                                ║
// ║ ✅ Só emite NF-e após confirmação                                    ║
// ╚══════════════════════════════════════════════════════════════════════╝


export function openPreviewNfeModal(orderId) {
  if (!orderId) {
    toast?.warn?.('Pedido inválido', 'Nenhum pedido foi informado.');
    return;
  }

  const modal = ensurePreviewNfeModal();
  const title = modal.querySelector('#previewNfeModalTitle');
  const frame = modal.querySelector('#previewNfeFrame');
  const btnDownload = modal.querySelector('#btnDownloadPreviewNfe');
  const btnEmit = modal.querySelector('#btnConfirmEmitNfe');
  const status = modal.querySelector('#previewNfeStatus');

  if (title) {
    title.textContent = `Prévia da NF-e / Pedido #${orderId}`;
  }

  const pdfUrl = ROUTES.orderPreviewPdf(orderId);

  if (status) {
    status.textContent = 'Carregando PDF...';
    status.className = 'preview-nfe-modal__status is-loading';
  }

  if (frame) {
    frame.src = pdfUrl;
  }

  if (btnDownload) {
    btnDownload.onclick = () => {
      window.open(pdfUrl, '_blank', 'noopener');
    };
  }

  if (btnEmit) {
    btnEmit.disabled = false;
    btnEmit.onclick = async () => {
      btnEmit.disabled = true;
      const oldText = btnEmit.textContent;
      btnEmit.textContent = '⏳ Emitindo NF-e...';

      try {
        await emitirNFe(orderId);
        closePreviewNfeModal();
      } catch (err) {
        console.error('[orders.previewNfe] erro ao emitir NF-e:', err);
      } finally {
        btnEmit.disabled = false;
        btnEmit.textContent = oldText || 'Emitir NF-e';
      }
    };
  }

  modal.classList.add('is-open');
  document.body.classList.add('modal-open');
}

export function closePreviewNfeModal() {
  const modal = document.getElementById('previewNfeModal');
  if (!modal) return;

  const frame = modal.querySelector('#previewNfeFrame');
  if (frame) {
    frame.src = 'about:blank';
  }

  modal.classList.remove('is-open');
  document.body.classList.remove('modal-open');
}

function ensurePreviewNfeModal() {
  let modal = document.getElementById('previewNfeModal');
  if (modal) return modal;

  modal = document.createElement('div');
  modal.id = 'previewNfeModal';
  modal.className = 'preview-nfe-modal';

  modal.innerHTML = `
    <div class="preview-nfe-modal__backdrop" data-close="true"></div>

    <div
      class="preview-nfe-modal__dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="previewNfeModalTitle"
    >
      <div class="preview-nfe-modal__header">
        <h3 id="previewNfeModalTitle">Prévia da NF-e</h3>

        <button
          type="button"
          class="preview-nfe-modal__close"
          aria-label="Fechar"
          title="Fechar"
        >✕</button>
      </div>

      <div class="preview-nfe-modal__toolbar">
        <div id="previewNfeStatus" class="preview-nfe-modal__status is-loading">
          Carregando PDF...
        </div>

        <div class="preview-nfe-modal__actions">
          <button
            type="button"
            id="btnDownloadPreviewNfe"
            class="btn btn-flat"
          >
            📄 Baixar PDF
          </button>

          <button
            type="button"
            id="btnConfirmEmitNfe"
            class="btn btn-primary"
          >
            🧾 Emitir NF-e
          </button>
        </div>
      </div>

      <div class="preview-nfe-modal__body">
        <iframe
          id="previewNfeFrame"
          class="preview-nfe-modal__iframe"
          title="Pré-visualização PDF do pedido"
          src="about:blank"
        ></iframe>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const frame = modal.querySelector('#previewNfeFrame');
  const status = modal.querySelector('#previewNfeStatus');

  if (frame) {
    frame.addEventListener('load', () => {
      if (status) {
        status.textContent = 'PDF carregado. Revise antes de emitir a NF-e.';
        status.className = 'preview-nfe-modal__status is-ok';
      }
    });

    frame.addEventListener('error', () => {
      if (status) {
        status.textContent = 'Não foi possível carregar o PDF.';
        status.className = 'preview-nfe-modal__status is-error';
      }
    });
  }

  modal.addEventListener('click', (event) => {
    const closeBtn = event.target.closest('.preview-nfe-modal__close');
    const backdrop = event.target.closest('[data-close="true"]');

    if (closeBtn || backdrop) {
      closePreviewNfeModal();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && modal.classList.contains('is-open')) {
      closePreviewNfeModal();
    }
  });

  return modal;
}
