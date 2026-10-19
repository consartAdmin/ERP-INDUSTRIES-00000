// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: debts.events.js                                               ║
// ║ MODULE: Debt Control Frontend                                       ║
// ║ DESCRIPTION: Bind events / connect HTML actions with functions       ║
// ║ PRODNEX ERP                                                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { els } from './debts.config.js';
import { state } from './debts.state.js';
import { closeModal } from './debts.utils.js';
import { loadDebts } from './debts.render.js';
import { refreshAll } from './debts.filters.js';

import {
  computeUpdatedPreview,
  openNewDebtModal,
  openEditDebtModal,
  submitDebtForm,
  deleteDebt,
  addInstallmentPlanFromInputs,
  removeInstallmentPlan
} from './debts.form.js';

import {
  openPaymentsModal,
  submitPaymentForm,
  deletePayment,
  startEditPayment
} from './debts.payments.js';

function closeAllModals() {
  closeModal(els.debtModal);
  closeModal(els.paymentModal);
}

export function bindEvents() {
  els.filtersForm?.addEventListener('submit', async (event) => {
    event.preventDefault();

    state.page = 1;
    await refreshAll();
  });

  els.btnClearFilters?.addEventListener('click', async () => {
    els.filtersForm?.reset();

    if (els.only_open) {
      els.only_open.checked = true;
    }

    state.page = 1;
    state.limit = Number(els.pageSize?.value || 50);

    await refreshAll();
  });

  els.btnReload?.addEventListener('click', refreshAll);

  els.btnNewDebt?.addEventListener('click', () => {
    openNewDebtModal();
  });

  els.pageSize?.addEventListener('change', async () => {
    state.limit = Number(els.pageSize?.value || 50);
    state.page = 1;

    await loadDebts();
  });

  els.btnPrevPage?.addEventListener('click', async () => {
    if (state.page <= 1) return;

    state.page -= 1;
    await loadDebts();
  });

  els.btnNextPage?.addEventListener('click', async () => {
    if (state.page >= state.pages) return;

    state.page += 1;
    await loadDebts();
  });

  [
    els.original_amount,
    els.interest_amount,
    els.fine_amount,
    els.discount_amount
  ].forEach((input) => {
    input?.addEventListener('input', computeUpdatedPreview);
  });

  els.debtForm?.addEventListener('submit', submitDebtForm);
  els.paymentForm?.addEventListener('submit', submitPaymentForm);

  document.addEventListener('click', async (event) => {
    if (!(event.target instanceof Element)) return;

    if (event.target.closest('#btnAddInstallmentPlan')) {
      addInstallmentPlanFromInputs();
      return;
    }

    const btn = event.target.closest('[data-action], [data-close-modal]');
    if (!btn) return;

    event.preventDefault();

    const closeName = btn.getAttribute('data-close-modal');

    if (closeName) {
      const modal = document.getElementById(closeName);
      closeModal(modal);
      return;
    }

    const action = btn.getAttribute('data-action');
    const id = Number(btn.getAttribute('data-id'));
    const description = btn.getAttribute('data-description') || '';

    try {
      if (action === 'remove-installment-plan') {
        removeInstallmentPlan(Number(btn.getAttribute('data-index')));
        return;
      }

      if (action === 'edit' && id) {
        await openEditDebtModal(id);
        return;
      }

      if (action === 'delete' && id) {
        await deleteDebt(id);
        return;
      }

      if (action === 'payments' && id) {
        await openPaymentsModal(id, description);
        return;
      }

      if (action === 'edit-payment' && id) {
        await startEditPayment(id);
        return;
      }

      if (action === 'delete-payment' && id) {
        await deletePayment(id);
      }
    } catch (error) {
      console.error('[debts] action error:', error);
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeAllModals();
    }
  });
}
