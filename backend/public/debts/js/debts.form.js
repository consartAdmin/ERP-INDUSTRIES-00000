// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: debts.form.js                                                 ║
// ║ MODULE: Debt Form + Installment Plans                               ║
// ║ PRODNEX ERP                                                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { els } from './debts.config.js';
import { API_BASE, fetchJSON } from './debts.api.js';
import { toNumber, formatMoney, escapeHtml, showToast } from './debts.utils.js';
import { refreshAll } from './debts.filters.js';
import { validateDebtPayload } from './debts.validation.js';

import {
  openCreateDebtsModal,
  closeCreateDebtsModal
} from './debts.modal.js';

let installmentPlans = [];

function $(id) {
  return document.getElementById(id);
}

function dateValue(value) {
  return value ? String(value).slice(0, 10) : '';
}

function getDueDay() {
  const mode = $('due_day_mode')?.value || 'LAST_DAY';
  return mode === 'LAST_DAY' ? 31 : Number($('due_day')?.value || 0);
}

function clearPlanInputs() {
  if ($('plan_start_installment')) $('plan_start_installment').value = '';
  if ($('plan_end_installment')) $('plan_end_installment').value = '';
  if ($('plan_installment_amount')) $('plan_installment_amount').value = '';
}

export function renderInstallmentPlans() {
  const tbody = $('installmentPlansTableBody');
  if (!tbody) return;

  if (!installmentPlans.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" class="empty-row">Nenhuma faixa adicionada.</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = installmentPlans.map((plan, index) => `
    <tr>
      <td>${escapeHtml(plan.start_installment)}</td>
      <td>${escapeHtml(plan.end_installment)}</td>
      <td>${escapeHtml(formatMoney(plan.installment_amount))}</td>
      <td class="td-actions">
        <button class="btn btn-danger btn-sm" type="button" data-action="remove-installment-plan" data-index="${index}">
          Excluir
        </button>
      </td>
    </tr>
  `).join('');
}

export function addInstallmentPlanFromInputs() {
  const start = Number($('plan_start_installment')?.value || 0);
  const end = Number($('plan_end_installment')?.value || 0);
  const amount = toNumber($('plan_installment_amount')?.value);

  if (!Number.isInteger(start) || start <= 0) {
    showToast('Informe a parcela inicial.', 'error');
    return;
  }

  if (!Number.isInteger(end) || end < start) {
    showToast('Informe a parcela final corretamente.', 'error');
    return;
  }

  if (amount <= 0) {
    showToast('Informe o valor da parcela.', 'error');
    return;
  }

  const installmentTotal = Number(els.installment_total?.value || 0);

  if (installmentTotal > 0 && end > installmentTotal) {
    showToast('A faixa não pode ultrapassar a quantidade total de parcelas.', 'error');
    return;
  }

  installmentPlans.push({
    start_installment: start,
    end_installment: end,
    installment_amount: amount
  });

  installmentPlans.sort((a, b) => a.start_installment - b.start_installment);

  clearPlanInputs();
  renderInstallmentPlans();
}

export function removeInstallmentPlan(index) {
  installmentPlans.splice(index, 1);
  renderInstallmentPlans();
}

function collectInstallmentPlans() {
  return installmentPlans.map((plan) => ({
    start_installment: Number(plan.start_installment),
    end_installment: Number(plan.end_installment),
    installment_amount: toNumber(plan.installment_amount)
  }));
}

async function loadInstallmentPlans(debtId) {
  const data = await fetchJSON(`${API_BASE}/debts/${debtId}/installment-plans`);
  installmentPlans = Array.isArray(data?.rows) ? data.rows : [];
  renderInstallmentPlans();
}

async function saveInstallmentPlans(debtId) {
  await fetchJSON(`${API_BASE}/debts/${debtId}/installment-plans`, {
    method: 'POST',
    body: JSON.stringify({
      rows: collectInstallmentPlans()
    })
  });
}

export function computeUpdatedPreview() {
  const original = toNumber(els.original_amount?.value);
  const interest = toNumber(els.interest_amount?.value);
  const fine = toNumber(els.fine_amount?.value);
  const discount = toNumber(els.discount_amount?.value);
  const total = original + interest + fine - discount;

  if (els.updated_amount_preview) {
    els.updated_amount_preview.value = formatMoney(total);
  }
}

export function resetDebtForm() {
  if (!els.debtForm) return;

  els.debtForm.reset();

  installmentPlans = [];
  renderInstallmentPlans();
  clearPlanInputs();

  if (els.debt_id) els.debt_id.value = '';
  if ($('agreement_closed_at')) $('agreement_closed_at').value = '';
  if ($('first_installment_due_at')) $('first_installment_due_at').value = '';

  if ($('due_day_mode')) $('due_day_mode').value = 'LAST_DAY';

  if ($('due_day')) {
    $('due_day').value = '31';
    $('due_day').required = false;
  }

  if ($('due_day_manual_box')) $('due_day_manual_box').hidden = true;
  if (els.installment_total) els.installment_total.value = 1;
  if (els.updated_amount_preview) els.updated_amount_preview.value = formatMoney(0);
  if (els.debtModalTitle) els.debtModalTitle.textContent = 'Nova Dívida';
}

export function fillDebtForm(row = {}) {
  els.debt_id.value = row.id ?? '';
  els.code.value = row.code ?? '';
  els.description.value = row.description ?? '';
  els.debt_type_form.value = row.debt_type ?? '';

  els.creditor_name_form.value = row.creditor_name ?? '';
  els.creditor_document.value = row.creditor_document ?? '';
  els.company_name.value = row.company_name ?? '';
  els.category.value = row.category ?? '';
  els.cost_center.value = row.cost_center ?? '';
  els.document_number.value = row.document_number ?? '';
  els.reference_number.value = row.reference_number ?? '';
  els.issue_date.value = dateValue(row.issue_date);

  if ($('agreement_closed_at')) $('agreement_closed_at').value = dateValue(row.agreement_closed_at);
  if ($('first_installment_due_at')) $('first_installment_due_at').value = dateValue(row.first_installment_due_at);

  els.installment_total.value = row.installment_total ?? 1;

  const dueDay = Number(row.due_day || 31);

  if ($('due_day_mode')) $('due_day_mode').value = dueDay === 31 ? 'LAST_DAY' : 'MANUAL';

  if ($('due_day')) {
    $('due_day').value = dueDay;
    $('due_day').required = dueDay !== 31;
  }

  if ($('due_day_manual_box')) $('due_day_manual_box').hidden = dueDay === 31;

  els.original_amount.value = row.original_amount ?? 0;
  els.interest_amount.value = row.interest_amount ?? 0;
  els.fine_amount.value = row.fine_amount ?? 0;
  els.discount_amount.value = row.discount_amount ?? 0;
  els.notes.value = row.notes ?? '';

  computeUpdatedPreview();
}

export function collectDebtPayload() {
  return {
    code: els.code.value.trim() || null,
    description: els.description.value.trim(),
    debt_type: els.debt_type_form.value,
    creditor_name: els.creditor_name_form.value.trim() || null,
    creditor_document: els.creditor_document.value.trim() || null,
    company_name: els.company_name.value.trim() || null,
    category: els.category.value.trim() || null,
    cost_center: els.cost_center.value.trim() || null,
    document_number: els.document_number.value.trim() || null,
    reference_number: els.reference_number.value.trim() || null,
    issue_date: els.issue_date.value || null,
    agreement_closed_at: $('agreement_closed_at')?.value || null,
    first_installment_due_at: $('first_installment_due_at')?.value || null,
    installment_total: Number(els.installment_total.value || 1),
    due_day: getDueDay(),
    original_amount: toNumber(els.original_amount.value),
    interest_amount: toNumber(els.interest_amount.value),
    fine_amount: toNumber(els.fine_amount.value),
    discount_amount: toNumber(els.discount_amount.value),
    notes: els.notes.value.trim() || null
  };
}

export async function openNewDebtModal() {
  resetDebtForm();
  openCreateDebtsModal('Nova Dívida');
}

export async function openEditDebtModal(debtId) {
  resetDebtForm();
  openCreateDebtsModal('Editar Dívida');

  try {
    const data = await fetchJSON(`${API_BASE}/debts/${debtId}`);
    const row = data?.row || data;

    if (!row) throw new Error('Dívida não encontrada.');

    fillDebtForm(row);
    await loadInstallmentPlans(debtId);
  } catch (error) {
    console.error('[debts] openEditDebtModal', error);
    showToast(error.message || 'Erro ao carregar dívida.', 'error');
  }
}

export async function submitDebtForm(event) {
  event.preventDefault();

  try {
    const id = els.debt_id.value ? Number(els.debt_id.value) : null;
    const payload = collectDebtPayload();

    validateDebtPayload(payload);

    let debtId = id;

    if (id) {
      const data = await fetchJSON(`${API_BASE}/debts/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });

      debtId = Number(data?.row?.id || id);
      await saveInstallmentPlans(debtId);

      showToast('Dívida atualizada com sucesso.', 'success');
    } else {
      const data = await fetchJSON(`${API_BASE}/debts`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      debtId = Number(data?.row?.id);
      await saveInstallmentPlans(debtId);

      showToast('Dívida criada com sucesso.', 'success');
    }

    closeCreateDebtsModal();
    await refreshAll();
  } catch (error) {
    console.error('[debts] submitDebtForm', error);
    showToast(error.message || 'Erro ao salvar dívida.', 'error');
  }
}

export async function deleteDebt(debtId) {
  const ok = window.confirm('Deseja realmente excluir esta dívida?');
  if (!ok) return;

  try {
    await fetchJSON(`${API_BASE}/debts/${debtId}`, {
      method: 'DELETE'
    });

    showToast('Dívida excluída com sucesso.', 'success');
    await refreshAll();
  } catch (error) {
    console.error('[debts] deleteDebt', error);
    showToast(error.message || 'Erro ao excluir dívida.', 'error');
  }
}
