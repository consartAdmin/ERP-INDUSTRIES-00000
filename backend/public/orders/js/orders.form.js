// orders.form.js — Orders module
'use strict';

import { ROUTES } from './orders.config.js';
import { state } from './orders.state.js';
import { $, setVal, fmtMoney, toast } from './orders.utils.js';
import { getOrderPayments } from './orders.api.js';

// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: orders.items.js                                                ║
// ║ MODULE: Orders                                                       ║
// ║ PRODNEX ERP                                                          ║
// ║ Items rendering + totals                                             ║
// ╚══════════════════════════════════════════════════════════════════════╝


export function renderItensPedido() {

  const tbody = $('#tblItensPedido tbody');

  if (!tbody || !state.editing) return;

  tbody.innerHTML = '';

  let count = 0;

  for (const it of state.editing.items) {

    count++;

    const totalItem = Math.max(
      0,
      Number(it.quantity || 0) *
      Number(it.unit_price || 0) -
      Number(it.discount_value || 0)
    );

    const ncm  = it.ncm || it.ncm_code || '';
    const cest = it.cest || it.cest_code || '';

    const fiscalProfileName =
      it.fiscal_profile ||
      it.profile_name ||
      '';

    const fiscalClassName =
      it.fiscal_classification ||
      it.classification_name ||
      '';

    const tr = document.createElement('tr');

    tr.innerHTML = `
      <td>${it.sku || ''}</td>
      <td>${it.description || ''}</td>
      <td>${ncm}</td>
      <td>${cest}</td>
      <td>${it.grade || ''}</td>
      <td>${it.unit || ''}</td>
      <td class="ta-right">${Number(it.quantity || 0)}</td>
      <td class="ta-right">${fmtMoney(it.unit_price)}</td>
      <td class="ta-right">${fmtMoney(it.discount_value)}</td>
      <td class="ta-right">${fmtMoney(totalItem)}</td>
      <td>${fiscalProfileName}</td>
      <td>${fiscalClassName}</td>
    `;

    tbody.appendChild(tr);

  }

  const qtdSpan = $('#qtdItensPedido');

  if (qtdSpan) qtdSpan.textContent = String(count);

}

export function recalcTotaisPedido() {

  if (!state.editing) return;

  const subtotal = state.editing.items.reduce(
    (s, it) =>
      s + Number(it.quantity || 0) *
      Number(it.unit_price || 0),
    0
  );

  const descontos = state.editing.items.reduce(
    (s, it) =>
      s + Number(it.discount_value || 0),
    0
  );

  const frete =
    Number(state.editing.header?.freight_value || 0);

  const total =
    Math.max(0, subtotal - descontos + frete);

  $('#subtotalPedido').textContent   = fmtMoney(subtotal);
  $('#totdescPedido').textContent    = fmtMoney(descontos);
  $('#fretePedido').textContent      = fmtMoney(frete);
  $('#totalGeralPedido').textContent = fmtMoney(total);

}

// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: orders.editor.js                                               ║
// ║ MODULE: Orders                                                       ║
// ║ PRODNEX ERP                                                          ║
// ║ Editor controller                                                    ║
// ║ ✅ UPDATED: payments via ordersPayments                              ║
// ╚══════════════════════════════════════════════════════════════════════╝


// ✅ NEW: payments API

// ----------------------------------------------------------------------
// Bind UI
// ----------------------------------------------------------------------
export function bindEditorUI() {

  $('#btnFecharPedido')?.addEventListener(
    'click',
    closeEditorPedido
  );

}

// ----------------------------------------------------------------------
// Close editor
// ----------------------------------------------------------------------
export function closeEditorPedido() {

  state.selectedId = null;
  state.editing = null;

  // ✅ clear payments
  state.payments = [];
  state.installments = [];

}

// ----------------------------------------------------------------------
// Hydrate editor (MAIN)
// ----------------------------------------------------------------------
export async function hydrateEditorPedido(o) {

  const h = o.header || o;

  state.editing = o;

  setVal('numeroPedido', h.number);
  setVal('statusPedido', h.status);

  // ------------------------------------------------------------------
  // ✅ LOAD PAYMENTS FROM ordersPayments (NOT budget anymore)
  // ------------------------------------------------------------------
  try {

    const res = await getOrderPayments(h.order_id);

    if (res?.ok) {
      state.payments = Array.isArray(res.payments) ? res.payments : [];
      state.installments = Array.isArray(res.installments) ? res.installments : [];
    } else {
      state.payments = [];
      state.installments = [];
    }

  } catch (err) {
    console.error('[hydrateEditorPedido] payments error:', err);
    state.payments = [];
    state.installments = [];
  }

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------
  renderItensPedido();
  recalcTotaisPedido();

  renderPaymentsPedido();

}

// ----------------------------------------------------------------------
// Render payments (ordersPayments)
// ----------------------------------------------------------------------
function renderPaymentsPedido() {

  const el = $('#paymentMethodsPedido');

  if (!el) return;

  // No payments
  if (!state.payments || !state.payments.length) {
    el.innerHTML = `<span class="text-muted">Sem pagamento</span>`;
    return;
  }

  const lines = state.payments.map((p) => {

    const amount = Number(p.amount || 0).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });

    return `
      <div class="payment-line">
        <strong>${p.payment_method_name || 'FORMA NÃO INFORMADA'}</strong>
        <span>${amount}</span>
      </div>
    `;
  });

  el.innerHTML = lines.join('');

  // ------------------------------------------------------------------
  // Optional: render installments (duplicatas)
  // ------------------------------------------------------------------
  renderInstallmentsPedido();

}

// ----------------------------------------------------------------------
// Render installments (duplicatas)
// ----------------------------------------------------------------------
function renderInstallmentsPedido() {

  const el = $('#paymentInstallmentsPedido');

  if (!el) return;

  if (!state.installments || !state.installments.length) {
    el.innerHTML = '';
    return;
  }

  const rows = state.installments.map((i) => {

    const valor = Number(i.amount || 0).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });

    const venc = i.due_date
      ? new Date(i.due_date).toLocaleDateString('pt-BR')
      : '—';

    const parcela = String(i.installment_number || 1).padStart(3, '0');

    return `
      <div class="installment-line">
        <span>Parcela ${parcela}</span>
        <span>${venc}</span>
        <span>${valor}</span>
      </div>
    `;
  });

  el.innerHTML = rows.join('');

}

// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: orders.paymentMethods.js                                       ║
// ║ MODULE: Orders                                                       ║
// ║ PRODNEX ERP                                                          ║
// ║ Payment methods loader                                               ║
// ╚══════════════════════════════════════════════════════════════════════╝


export async function loadPaymentMethods() {

  const url = `${ROUTES.paymentMethods}?active=true&limit=100`;

  try {

    const r = await fetch(url);

    if (!r.ok) throw new Error(`HTTP ${r.status}`);

    const data = await r.json();

    const rows = data.rows || data || [];

    state.paymentMethods = Array.isArray(rows) ? rows : [];

    populatePaymentMethodsSelect();

  } catch (err) {

    console.error('[orders] payment methods error', err);

    toast.error(
      'Erro ao carregar formas de pagamento',
      'Verifique a API /api/paymentMethods'
    );

  }

}

export function populatePaymentMethodsSelect() {

  const sel = $('#paymentMethodPedido');

  if (!sel) return;

  sel.innerHTML = '<option value="">Selecione...</option>';

  for (const pm of state.paymentMethods) {

    const opt = document.createElement('option');

    opt.value = String(
      pm.paymentMethods_id ||
      pm.payment_form_id ||
      pm.id
    );

    opt.textContent =
      pm.name ||
      pm.description ||
      `ID ${opt.value}`;

    sel.appendChild(opt);

  }

}
