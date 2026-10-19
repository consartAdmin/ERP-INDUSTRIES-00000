// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: debts.payments.js                                             ║
// ║ MODULE: Debt Payments                                               ║
// ║ DESCRIPTION: Payment modal, installments, list, summary, create     ║
// ║              and delete                                             ║
// ║ PRODNEX ERP                                                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { els } from './debts.config.js';
import { state } from './debts.state.js';
import { API_BASE, fetchJSON } from './debts.api.js';

import {
  toNumber,
  formatMoney,
  formatDate,
  escapeHtml,
  showToast
} from './debts.utils.js';

import { refreshAll } from './debts.filters.js';
import { openDebtPaymentsModal } from './debts.modal.js';
import { actionIconsHtml } from '/public/includes/js/actionIcons.js';
import {
  applyPaymentCashDefaults,
  setPaymentCashValues,
  getPaymentCashPayload,
  hasPaymentCashFiles,
  uploadPaymentCashFiles
} from './debts.paymentCash.js';

/* ──────────────────────────────────────────────────────────────────────
 * Installments state
 * ────────────────────────────────────────────────────────────────────── */

function endOfMonth(year, monthIndexZeroBased) {
  return new Date(year, monthIndexZeroBased + 1, 0).getDate();
}

function addMonthsKeepingDueDay(baseDateStr, index, dueDay = 31) {
  const base = new Date(`${baseDateStr}T00:00:00`);
  if (Number.isNaN(base.getTime())) return null;

  const year = base.getFullYear();
  const month = base.getMonth() + index;

  const targetYear = year + Math.floor(month / 12);
  const targetMonth = ((month % 12) + 12) % 12;

  const lastDay = endOfMonth(targetYear, targetMonth);
  const day = Math.min(Number(dueDay || 31), lastDay);

  const dt = new Date(targetYear, targetMonth, day);
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');

  return `${yyyy}-${mm}-${dd}`;
}

function parseDateOnly(value) {
  if (!value) return '';
  return String(value).slice(0, 10);
}

function todayLocalYmd() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function getInstallmentAmountByPlans(
  installmentNumber,
  plans = [],
  fallbackAmount = 0
) {
  const plan = plans.find((item) => {
    const start = Number(item.start_installment || 0);
    const end = Number(item.end_installment || 0);

    return installmentNumber >= start && installmentNumber <= end;
  });

  if (!plan) {
    return fallbackAmount;
  }

  return toNumber(plan.installment_amount, fallbackAmount);
}

function buildInstallments(debt = {}, paymentRows = [], plans = []) {
  const total = Number(debt.installment_total || 0);

  const firstDueDate = parseDateOnly(
    debt.first_installment_due_at ||
    debt.due_date ||
    debt.issue_date
  );

  const dueDay = Number(debt.due_day || 31);
  const originalAmount = toNumber(debt.original_amount || 0);

  const fallbackPerInstallment =
    total > 0
      ? originalAmount / total
      : 0;

  const today = todayLocalYmd();

  if (!total || !firstDueDate) {
    return [];
  }

  const paidMap = new Map();

  for (const row of paymentRows || []) {
    const installmentNumber = Number(row.installment_number || 0);

    if (!installmentNumber) continue;

    paidMap.set(installmentNumber, {
      id: row.id,
      payment_date: row.payment_date,
      installment_due_date: row.installment_due_date,
      amount: toNumber(row.amount),
      interest_amount: toNumber(row.interest_amount),
      fine_amount: toNumber(row.fine_amount),
      discount_amount: toNumber(row.discount_amount),
      effective_amount: toNumber(row.effective_amount),
      payment_method: row.payment_method || '',
      receipt_number: row.receipt_number || ''
    });
  }

  const installments = [];

  for (let number = 1; number <= total; number += 1) {
    const dueDate = addMonthsKeepingDueDay(
      firstDueDate,
      number - 1,
      dueDay
    );

    const paid = paidMap.get(number);

    const expectedAmount = getInstallmentAmountByPlans(
      number,
      plans,
      fallbackPerInstallment
    );

    let status = 'EM_ABERTO';

    if (paid) {
      status = 'PAGA';
    } else if (dueDate && dueDate < today) {
      status = 'VENCIDA';
    }

    installments.push({
      installment_number: number,
      installment_due_date: dueDate,
      amount_expected: expectedAmount,
      status,

      payment_id: paid?.id || null,
      payment_date: paid?.payment_date || null,

      amount_paid: paid?.amount || 0,
      interest_amount: paid?.interest_amount || 0,
      fine_amount: paid?.fine_amount || 0,
      discount_amount: paid?.discount_amount || 0,
      effective_amount: paid?.effective_amount || 0,

      payment_method: paid?.payment_method || '',
      receipt_number: paid?.receipt_number || ''
    });
  }

  return installments;
}

function getOpenInstallments(installments = []) {
  return installments.filter((item) => item.status !== 'PAGA');
}

function getInstallmentLabel(item) {
  const num = String(item.installment_number).padStart(3, '0');
  const statusSuffix = item.status === 'VENCIDA' ? ' — VENCIDA' : '';

  return `Parcela ${num} — ${formatDate(item.installment_due_date)} — ${formatMoney(item.amount_expected)}${statusSuffix}`;
}

function renderInstallmentSelect(installments = []) {
  if (!els.payment_installment) return;

  const openItems = getOpenInstallments(installments);

  if (!openItems.length) {
    els.payment_installment.innerHTML = `
      <option value="">Todas as parcelas já foram pagas</option>
    `;
    els.payment_installment.disabled = true;
    return;
  }

  els.payment_installment.disabled = false;
  els.payment_installment.innerHTML = `
    <option value="">Selecione a parcela</option>
    ${openItems.map((item) => `
      <option value="${item.installment_number}">
        ${escapeHtml(getInstallmentLabel(item))}
      </option>
    `).join('')}
  `;
}

/* ──────────────────────────────────────────────────────────────────────
 * Payment Form
 * ────────────────────────────────────────────────────────────────────── */

function setPaymentEditMode(paymentId = null) {
  state.editingPaymentId = paymentId;

  const saveBtn = document.getElementById('btnSavePayment');
  if (saveBtn) {
    saveBtn.textContent = paymentId ? 'Atualizar Pagamento' : 'Salvar Pagamento';
  }

  if (els.payment_installment && !paymentId) {
    els.payment_installment.disabled = false;
  }
}

function resetPaymentForm(debtId) {
  setPaymentEditMode(null);
  els.paymentForm?.reset();

  if (els.payment_debt_id) {
    els.payment_debt_id.value = debtId || '';
  }

  if (els.payment_date) {
    els.payment_date.value = new Date().toISOString().slice(0, 10);
  }

  if (els.payment_installment) {
    els.payment_installment.value = '';
  }
}

/* ──────────────────────────────────────────────────────────────────────
 * Payment Summary
 * ────────────────────────────────────────────────────────────────────── */

function renderPaymentSummary(summary = {}, installments = []) {
  if (!els.paymentSummaryBox) return;

  const paidItems = installments.filter((i) => i.status === 'PAGA');
  const openItems = installments.filter((i) => i.status !== 'PAGA');
  const overdueItems = installments.filter((i) => i.status === 'VENCIDA');

  const paidCount = paidItems.length;
  const openCount = openItems.length;
  const overdueCount = overdueItems.length;

  const totalInstallmentAmount = installments.reduce(
    (acc, item) => acc + toNumber(item.amount_expected),
    0
  );

  const openAmount = openItems.reduce(
    (acc, item) => acc + toNumber(item.amount_expected),
    0
  );

  const overdueAmount = overdueItems.reduce(
    (acc, item) => acc + toNumber(item.amount_expected),
    0
  );

  els.paymentSummaryBox.innerHTML = `
    <div class="read-only-fields">
      <div class="read-only-field read-only-w-4">
        <span class="read-only-field__label read-only-fs-3">
          Parcelas
        </span>

        <span class="read-only-field__value read-only-field__value--number read-only-h-1 read-only-fs-5">
          ${paidCount}/${installments.length} pagas
        </span>
      </div>

      <div class="read-only-field read-only-w-4">
        <span class="read-only-field__label read-only-fs-3">
          Em aberto
        </span>

        <span class="read-only-field__value read-only-field__value--number read-only-h-1 read-only-fs-5">
          ${openCount}
        </span>
      </div>

      <div class="read-only-field read-only-w-4">
        <span class="read-only-field__label read-only-fs-3">
          Vencidas
        </span>

        <span class="read-only-field__value read-only-field__value--number read-only-field__value--danger read-only-h-1 read-only-fs-5">
          ${overdueCount}
        </span>
      </div>

      <div class="read-only-field read-only-w-4">
        <span class="read-only-field__label read-only-fs-3">
          Valor vencido
        </span>

        <span class="read-only-field__value read-only-field__value--currency read-only-field__value--danger read-only-h-1 read-only-fs-5">
          ${formatMoney(overdueAmount)}
        </span>
      </div>

      <div class="read-only-field read-only-w-4">
        <span class="read-only-field__label read-only-fs-3">
          Valor em aberto
        </span>

        <span class="read-only-field__value read-only-field__value--currency read-only-field__value--warning read-only-h-1 read-only-fs-5">
          ${formatMoney(openAmount)}
        </span>
      </div>

      <div class="read-only-field read-only-w-4">
        <span class="read-only-field__label read-only-fs-3">
          Total parcelado
        </span>

        <span class="read-only-field__value read-only-field__value--currency read-only-h-1 read-only-fs-5">
          ${formatMoney(totalInstallmentAmount)}
        </span>
      </div>

      <div class="read-only-field read-only-w-4">
        <span class="read-only-field__label read-only-fs-3">
          Valor pago
        </span>

        <span class="read-only-field__value read-only-field__value--currency read-only-field__value--success read-only-h-1 read-only-fs-5">
          ${formatMoney(summary.principal_paid)}
        </span>
      </div>

      <div class="read-only-field read-only-w-4">
        <span class="read-only-field__label read-only-fs-3">
          Total efetivo pago
        </span>

        <span class="read-only-field__value read-only-field__value--currency read-only-field__value--success read-only-h-1 read-only-fs-5">
          ${formatMoney(summary.effective_paid)}
        </span>
      </div>
    </div>
  `;
}

/* ──────────────────────────────────────────────────────────────────────
 * Payments / Installments Table
 * ────────────────────────────────────────────────────────────────────── */

function renderPayments(installments = []) {
  if (!els.paymentsTableBody) return;

  if (!Array.isArray(installments) || !installments.length) {
    els.paymentsTableBody.innerHTML = `
      <tr>
        <td colspan="11" class="empty-row">Nenhuma parcela encontrada para esta dívida.</td>
      </tr>
    `;
    return;
  }

  els.paymentsTableBody.innerHTML = installments.map((row) => {
    const installmentLabel = String(row.installment_number).padStart(3, '0');
    const isPaid = row.status === 'PAGA';

    return `
      <tr>
        <td>
          <div><strong>${installmentLabel}</strong></div>
          <div class="muted">${escapeHtml(row.status)}</div>
        </td>
        <td>${escapeHtml(formatDate(row.installment_due_date))}</td>
        <td>${isPaid ? escapeHtml(formatDate(row.payment_date)) : '-'}</td>
        <td>${escapeHtml(formatMoney(isPaid ? row.amount_paid : row.amount_expected))}</td>
        <td>${escapeHtml(formatMoney(row.interest_amount))}</td>
        <td>${escapeHtml(formatMoney(row.fine_amount))}</td>
        <td>${escapeHtml(formatMoney(row.discount_amount))}</td>
        <td>${escapeHtml(formatMoney(row.effective_amount || 0))}</td>
        <td>${escapeHtml(row.payment_method || '-')}</td>
        <td>${escapeHtml(row.receipt_number || '-')}</td>
        <td class="td-actions">
          <div class="row-actions">
            ${isPaid && row.payment_id ? actionIconsHtml([
              { action: 'edit', title: 'Editar pagamento', attrs: { 'data-action': 'edit-payment', 'data-id': row.payment_id } },
              { action: 'delete', title: 'Excluir pagamento', attrs: { 'data-action': 'delete-payment', 'data-id': row.payment_id } },
            ]) : '<span class="muted">Em aberto</span>'}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

/* ──────────────────────────────────────────────────────────────────────
 * Load Payments + Debt
 * ────────────────────────────────────────────────────────────────────── */

async function loadPayments(debtId) {
  const [paymentsData, debtData, plansData] = await Promise.all([
    fetchJSON(`${API_BASE}/debts/${debtId}/payments`),
    fetchJSON(`${API_BASE}/debts/${debtId}`),
    fetchJSON(`${API_BASE}/debts/${debtId}/installment-plans`)
  ]);

  const debt = debtData?.row || debtData || {};
  const rows = Array.isArray(paymentsData?.rows)
    ? paymentsData.rows
    : [];

  const summary = paymentsData?.summary || {};

  const plans = Array.isArray(plansData?.rows)
    ? plansData.rows
    : [];

  state.activeDebt = debt;
  state.activeDebtPayments = rows;
  state.activeDebtInstallmentPlans = plans;

  state.activeDebtInstallments = buildInstallments(
    debt,
    rows,
    plans
  );

  renderInstallmentSelect(state.activeDebtInstallments);
  renderPaymentSummary(
    summary,
    state.activeDebtInstallments
  );
  renderPayments(state.activeDebtInstallments);
}

/* ──────────────────────────────────────────────────────────────────────
 * Open Payments Modal
 * ────────────────────────────────────────────────────────────────────── */

export async function openPaymentsModal(debtId, description = '') {
  state.activeDebtId = Number(debtId);
  resetPaymentForm(debtId);

  if (els.paymentModalSubtitle) {
    const debt = (state.rows || []).find(
      (row) => Number(row.id ?? row.debt_id) === Number(debtId)
    );
    const creditor = String(debt?.creditor_name || '').trim();
    const parts = [description, creditor].filter(Boolean);

    els.paymentModalSubtitle.textContent = parts.length
      ? `Histórico e parcelas — ${parts.join(' — ')}`
      : 'Histórico e parcelas da dívida.';
  }

  openDebtPaymentsModal();

  applyPaymentCashDefaults(debtId).catch((error) => {
    console.warn('[debts] padrões do caixa', error);
  });

  try {
    await loadPayments(debtId);
  } catch (error) {
    console.error('[debts] openPaymentsModal', error);
    showToast(error.message || 'Erro ao carregar pagamentos.', 'error');
  }
}

/* ──────────────────────────────────────────────────────────────────────
 * Submit Payment
 * ────────────────────────────────────────────────────────────────────── */

export async function submitPaymentForm(event) {
  event.preventDefault();

  try {
    const debtId = Number(els.payment_debt_id?.value);

    if (!debtId) {
      throw new Error('Dívida inválida para pagamento.');
    }

    if (state.editingPaymentId) {
      await submitPaymentUpdate(debtId);
      return;
    }

    const installmentNumber = Number(els.payment_installment?.value || 0);

    if (!installmentNumber) {
      throw new Error('Selecione a parcela que será paga.');
    }

    const installment = (state.activeDebtInstallments || []).find(
      (item) => item.installment_number === installmentNumber
    );

    if (!installment) {
      throw new Error('Parcela selecionada não encontrada.');
    }

    if (installment.status === 'PAGA') {
      throw new Error('Esta parcela já foi paga.');
    }

    const payload = {
      installment_number: installment.installment_number,
      installment_due_date: installment.installment_due_date,
      payment_date: els.payment_date?.value,
      amount: toNumber(els.payment_amount?.value),
      interest_amount: toNumber(els.payment_interest?.value),
      fine_amount: toNumber(els.payment_fine?.value),
      discount_amount: toNumber(els.payment_discount?.value),
      payment_method: els.payment_method?.value || null,
      receipt_number: els.receipt_number?.value.trim() || null,
      notes: els.payment_notes?.value.trim() || null,
      // Classificação da SAÍDA criada em Movimentações
      cash: getPaymentCashPayload()
    };

    if (!payload.payment_date) {
      throw new Error('Informe a data do pagamento.');
    }

    if (payload.amount <= 0) {
      throw new Error('Informe um valor de pagamento maior que zero.');
    }

    const result = await fetchJSON(`${API_BASE}/debts/${debtId}/payments`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    const cashMovementId = Number(result?.cash_movement_id || 0);
    let uploadFailed = [];

    if (cashMovementId && hasPaymentCashFiles()) {
      const upload = await uploadPaymentCashFiles(cashMovementId);
      uploadFailed = upload.failed;
    }

    if (uploadFailed.length) {
      showToast(
        `Pagamento registrado e lançado no caixa, mas não foi possível anexar: ${uploadFailed.join(', ')}. ` +
        'Anexe pela tela Movimentações.',
        'error'
      );
    } else {
      showToast('Pagamento registrado e lançado em Movimentações.', 'success');
    }

    resetPaymentForm(debtId);
    applyPaymentCashDefaults(debtId).catch(() => {});

    await loadPayments(debtId);
    await refreshAll();
  } catch (error) {
    console.error('[debts] submitPaymentForm', error);
    showToast(error.message || 'Erro ao registrar pagamento.', 'error');
  }
}

/* ──────────────────────────────────────────────────────────────────────
 * Edit Payment
 * ────────────────────────────────────────────────────────────────────── */

function moneyInput(value) {
  return toNumber(value).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

/** Carrega um pagamento já feito no formulário para edição. */
export async function startEditPayment(paymentId) {
  const payment = (state.activeDebtPayments || []).find(
    (row) => Number(row.id) === Number(paymentId)
  );

  if (!payment) {
    showToast('Pagamento não encontrado.', 'error');
    return;
  }

  const installmentNumber = Number(payment.installment_number || 0);
  const label = String(installmentNumber).padStart(3, '0');

  if (els.payment_installment) {
    els.payment_installment.innerHTML = `
      <option value="${installmentNumber}">Parcela ${label} (editando pagamento)</option>
    `;
    els.payment_installment.value = String(installmentNumber);
    els.payment_installment.disabled = true;
  }

  if (els.payment_date) els.payment_date.value = parseDateOnly(payment.payment_date);
  if (els.payment_amount) els.payment_amount.value = moneyInput(payment.amount);
  if (els.payment_interest) els.payment_interest.value = moneyInput(payment.interest_amount);
  if (els.payment_fine) els.payment_fine.value = moneyInput(payment.fine_amount);
  if (els.payment_discount) els.payment_discount.value = moneyInput(payment.discount_amount);
  if (els.payment_method) els.payment_method.value = payment.payment_method || '';
  if (els.receipt_number) els.receipt_number.value = payment.receipt_number || '';
  if (els.payment_notes) els.payment_notes.value = payment.notes || '';

  setPaymentEditMode(Number(paymentId));

  try {
    const res = await fetchJSON(`${API_BASE}/debt-payments/${paymentId}/cash`);
    if (res?.data && Object.keys(res.data).length) {
      await setPaymentCashValues(res.data);
    }
  } catch (error) {
    console.warn('[debts] caixa do pagamento', error);
  }

  els.payment_amount?.focus();
  showToast(`Editando o pagamento da parcela ${label}. Altere e clique em Atualizar Pagamento.`, 'info');
}

async function submitPaymentUpdate(debtId) {
  const paymentId = state.editingPaymentId;

  const payload = {
    payment_date: els.payment_date?.value,
    amount: toNumber(els.payment_amount?.value),
    interest_amount: toNumber(els.payment_interest?.value),
    fine_amount: toNumber(els.payment_fine?.value),
    discount_amount: toNumber(els.payment_discount?.value),
    payment_method: els.payment_method?.value || null,
    receipt_number: els.receipt_number?.value.trim() || null,
    notes: els.payment_notes?.value.trim() || null,
    cash: getPaymentCashPayload()
  };

  if (!payload.payment_date) {
    throw new Error('Informe a data do pagamento.');
  }

  if (payload.amount <= 0) {
    throw new Error('Informe um valor de pagamento maior que zero.');
  }

  const result = await fetchJSON(`${API_BASE}/debt-payments/${paymentId}`, {
    method: 'PUT',
    body: JSON.stringify(payload)
  });

  const cashMovementId = Number(result?.cash_movement_id || 0);
  let uploadFailed = [];

  if (cashMovementId && hasPaymentCashFiles()) {
    const upload = await uploadPaymentCashFiles(cashMovementId);
    uploadFailed = upload.failed;
  }

  if (uploadFailed.length) {
    showToast(
      `Pagamento atualizado, mas não foi possível anexar: ${uploadFailed.join(', ')}. Anexe pela tela Movimentações.`,
      'error'
    );
  } else {
    showToast('Pagamento atualizado (Movimentações também).', 'success');
  }

  resetPaymentForm(debtId);
  applyPaymentCashDefaults(debtId).catch(() => {});

  await loadPayments(debtId);
  await refreshAll();
}

/* ──────────────────────────────────────────────────────────────────────
 * Delete Payment
 * ────────────────────────────────────────────────────────────────────── */

export async function deletePayment(paymentId) {
  const ok = window.confirm('Deseja realmente excluir este pagamento? A movimentação dele no caixa (e os anexos) também será excluída.');
  if (!ok) return;

  try {
    await fetchJSON(`${API_BASE}/debt-payments/${paymentId}`, {
      method: 'DELETE'
    });

    showToast('Pagamento excluído com sucesso.', 'success');

    if (state.activeDebtId) {
      await loadPayments(state.activeDebtId);
    }

    await refreshAll();
  } catch (error) {
    console.error('[debts] deletePayment', error);
    showToast(error.message || 'Erro ao excluir pagamento.', 'error');
  }
}