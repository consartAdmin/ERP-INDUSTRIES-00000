// ╔══════════════════════════════════════════════════════════════════════╗
// ║ budgetsPaymentsModal.js — Modal de Pagamentos | PRODNEX ERP         ║
// ║ ✅ Abre / fecha modal                                               ║
// ║ ✅ Fecha por ESC                                                    ║
// ║ ✅ Fecha ao clicar no backdrop                                      ║
// ║ ✅ Integra com budgets.payments.js                                  ║
// ║ ✅ Regenera parcelas                                                ║
// ║ ✅ Atualiza resumo ao abrir                                         ║
// ║ ✅ Aplicar salva novamente o orçamento                              ║
// ║ ✅ Preserva vencimentos alterados manualmente                       ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { state } from './budgets.core.js';
import { toast } from './budgets.infra.js';

import {
  renderBudgetPayments,
  renderBudgetPaymentInstallments,
  updatePaymentsSummaryUI,
  regenerateInstallmentsForBudget,
  validatePaymentsBeforeSave,
} from './budgets.payments.js';

import { saveBudget } from './budgets.actions.js';


/* =========================================================================
 * SELETORES
 * ========================================================================= */

const SEL = {
  backdrop: '#budgetPaymentsModalBackdrop',
  modal: '#budgetPaymentsModal',

  btnOpen: '#btnOpenPaymentsModal',
  btnClose: '#btnClosePaymentsModal',
  btnCancel: '#btnCancelPaymentsModal',

  btnApply: '#btnApplyPaymentsModal',
  btnRegenerate: '#btnRegenerateInstallments',
};


let _initialized = false;


/* =========================================================================
 * HELPERS
 * ========================================================================= */

function $(selector) {
  return document.querySelector(selector);
}


function getEls() {
  return {
    backdrop: $(SEL.backdrop),
    modal: $(SEL.modal),

    btnOpen: $(SEL.btnOpen),
    btnClose: $(SEL.btnClose),
    btnCancel: $(SEL.btnCancel),

    btnApply: $(SEL.btnApply),
    btnRegenerate: $(SEL.btnRegenerate),
  };
}


function ensureEditingShape() {
  state.editing = state.editing || {};

  state.editing.payments =
    Array.isArray(state.editing.payments)
      ? state.editing.payments
      : [];

  state.editing.payment_installments =
    Array.isArray(state.editing.payment_installments)
      ? state.editing.payment_installments
      : [];
}


function isOpen() {
  const {
    modal,
    backdrop,
  } = getEls();

  if (!modal || !backdrop) {
    return false;
  }

  return (
    !modal.classList.contains('hidden') &&
    !backdrop.classList.contains('hidden')
  );
}


function setAria(opened) {
  const {
    modal,
    backdrop,
  } = getEls();

  if (modal) {
    modal.setAttribute(
      'aria-hidden',
      opened ? 'false' : 'true'
    );
  }

  if (backdrop) {
    backdrop.setAttribute(
      'aria-hidden',
      opened ? 'false' : 'true'
    );
  }
}


function focusFirstFocusable() {
  const {
    modal,
  } = getEls();

  if (!modal) return;

  const target = modal.querySelector(
    [
      'button:not([disabled])',
      'select:not([disabled])',
      'input:not([disabled])',
      'textarea:not([disabled])',
    ].join(', ')
  );

  target?.focus?.();
}


function syncBodyScroll(opened) {
  document.documentElement.classList.toggle(
    'u-lock-scroll',
    opened
  );

  document.body.classList.toggle(
    'u-lock-scroll',
    opened
  );
}


/* =========================================================================
 * INSTALLMENTS — HELPERS
 * ========================================================================= */

/**
 * Retorna o ID real da parcela.
 */
function getInstallmentId(row) {
  return (
    row?.budget_payment_installment_id ??
    row?.installment_id ??
    row?.id ??
    null
  );
}


/**
 * Retorna o ID do pagamento pai.
 */
function getBudgetPaymentId(row) {
  return (
    row?.budget_payment_id ??
    row?.payment_id ??
    null
  );
}


/**
 * Cria uma chave estável para identificar a parcela.
 *
 * Preferência:
 * 1) ID da parcela
 * 2) pagamento + número da parcela
 * 3) método + número da parcela
 */
function getInstallmentKey(row, index = 0) {
  const installmentId =
    getInstallmentId(row);

  if (installmentId != null) {
    return `id:${installmentId}`;
  }

  const paymentId =
    getBudgetPaymentId(row);

  const installmentNumber =
    Number(
      row?.installment_number ??
      row?.parcela ??
      index + 1
    );

  if (paymentId != null) {
    return (
      `payment:${paymentId}` +
      `:installment:${installmentNumber}`
    );
  }

  const methodId =
    row?.payment_method_id ??
    row?.paymentMethods_id ??
    row?.method_id ??
    '';

  return (
    `method:${methodId}` +
    `:installment:${installmentNumber}`
  );
}


/**
 * Captura todos os vencimentos que estão atualmente
 * no state ANTES do saveBudget().
 *
 * Isto é importante porque saveBudget() pode recarregar
 * payments/payment_installments do backend.
 */
function snapshotInstallmentDates() {
  ensureEditingShape();

  const rows =
    state.editing.payment_installments;

  const snapshot = new Map();

  rows.forEach((row, index) => {
    const dueDate =
      row?.due_date
        ? String(row.due_date).slice(0, 10)
        : null;

    snapshot.set(
      getInstallmentKey(row, index),
      {
        due_date: dueDate,

        installment_number:
          Number(
            row?.installment_number ??
            row?.parcela ??
            index + 1
          ),

        budget_payment_id:
          getBudgetPaymentId(row),

        payment_method_id:
          row?.payment_method_id ??
          row?.paymentMethods_id ??
          row?.method_id ??
          null,
      }
    );
  });

  console.log(
    '[budgetsPaymentsModal][installments][snapshot]',
    Array.from(snapshot.entries())
  );

  return snapshot;
}


/**
 * Restaura vencimentos depois do saveBudget().
 *
 * Primeiro tenta pela chave estável.
 * Depois usa número da parcela como fallback.
 */
function restoreInstallmentDates(snapshot) {
  ensureEditingShape();

  if (
    !snapshot ||
    !(snapshot instanceof Map) ||
    !snapshot.size
  ) {
    return;
  }

  const rows =
    state.editing.payment_installments;

  rows.forEach((row, index) => {
    const key =
      getInstallmentKey(row, index);

    let saved =
      snapshot.get(key);

    /*
     * Fallback:
     * saveBudget pode recriar a parcela e gerar NOVO ID.
     *
     * Nesse caso tentamos localizar pela:
     * - parcela
     * - pagamento
     * - método
     */
    if (!saved) {
      const installmentNumber =
        Number(
          row?.installment_number ??
          row?.parcela ??
          index + 1
        );

      const paymentId =
        getBudgetPaymentId(row);

      const methodId =
        row?.payment_method_id ??
        row?.paymentMethods_id ??
        row?.method_id ??
        null;

      saved =
        Array
          .from(snapshot.values())
          .find((candidate) => {

            if (
              Number(candidate.installment_number) !==
              installmentNumber
            ) {
              return false;
            }

            /*
             * Se ambos possuem payment_id,
             * exige correspondência.
             */
            if (
              candidate.budget_payment_id != null &&
              paymentId != null
            ) {
              return (
                String(candidate.budget_payment_id) ===
                String(paymentId)
              );
            }

            /*
             * Caso contrário tenta pelo método.
             */
            if (
              candidate.payment_method_id != null &&
              methodId != null
            ) {
              return (
                String(candidate.payment_method_id) ===
                String(methodId)
              );
            }

            /*
             * Último fallback:
             * número da parcela.
             */
            return true;
          });
    }

    if (!saved) {
      return;
    }

    row.due_date =
      saved.due_date || null;
  });

  console.log(
    '[budgetsPaymentsModal][installments][restored]',
    state.editing.payment_installments
  );
}


/**
 * Lê novamente os inputs de data diretamente do DOM.
 *
 * Isto garante que até mesmo uma alteração que ainda
 * não tenha sincronizado corretamente com o state seja
 * capturada antes do save.
 */
function syncInstallmentDatesFromDom() {
  ensureEditingShape();

  const inputs =
    document.querySelectorAll(
      '.js-budget-installment-due-date'
    );

  const rows =
    state.editing.payment_installments;

  inputs.forEach((input) => {
    const index =
      Number(
        input.dataset.installmentIndex
      );

    if (
      !Number.isInteger(index) ||
      !rows[index]
    ) {
      return;
    }

    rows[index].due_date =
      input.value
        ? String(input.value).slice(0, 10)
        : null;
  });

  console.log(
    '[budgetsPaymentsModal][installments][DOM -> state]',
    rows
  );
}


/* =========================================================================
 * OPEN
 * ========================================================================= */

export async function openBudgetPaymentsModal() {
  const {
    modal,
    backdrop,
  } = getEls();

  if (!modal || !backdrop) {
    return;
  }

  ensureEditingShape();

  modal.classList.remove('hidden');
  backdrop.classList.remove('hidden');

  setAria(true);
  syncBodyScroll(true);

  try {
    await renderBudgetPayments();

    await renderBudgetPaymentInstallments();

    updatePaymentsSummaryUI();

  } catch (e) {
    console.warn(
      '[budgetsPaymentsModal] render error:',
      e?.message || e
    );
  }

  requestAnimationFrame(() => {
    focusFirstFocusable();
  });
}


/* =========================================================================
 * CLOSE
 * ========================================================================= */

export function closeBudgetPaymentsModal() {
  const {
    modal,
    backdrop,
  } = getEls();

  if (!modal || !backdrop) {
    return;
  }

  modal.classList.add('hidden');
  backdrop.classList.add('hidden');

  setAria(false);
  syncBodyScroll(false);
}


/* =========================================================================
 * APPLY
 * ========================================================================= */

async function handleApply() {
  const {
    btnApply,
  } = getEls();

  try {
    ensureEditingShape();

    /*
     * =============================================================
     * 1. Sincroniza as datas visíveis com o STATE
     * =============================================================
     */
    syncInstallmentDatesFromDom();


    /*
     * =============================================================
     * 2. Snapshot das datas MANUAIS
     *
     * Muito importante:
     * saveBudget() pode recarregar payment_installments
     * e sobrescrever os valores existentes no state.
     * =============================================================
     */
    const installmentDatesSnapshot =
      snapshotInstallmentDates();


    /*
     * =============================================================
     * 3. Validação
     * =============================================================
     */
    const validation =
      validatePaymentsBeforeSave({
        strict: false,
      });

    if (!validation.ok) {
      return toast.warn(
        'Pagamentos',
        validation.message ||
        'Revise os pagamentos informados.'
      );
    }


    updatePaymentsSummaryUI();


    /*
     * =============================================================
     * 4. Bloqueia botão
     * =============================================================
     */
    if (btnApply) {
      btnApply.disabled = true;

      btnApply.dataset.originalText =
        btnApply.innerHTML;

      btnApply.innerHTML =
        '⏳ Salvando...';
    }


    console.log(
      '[budgetsPaymentsModal][apply] Salvando orçamento...',
      {
        budgetId:
          state.selectedId,

        payments:
          state.editing?.payments,

        installments:
          state.editing?.payment_installments,
      }
    );


    /*
     * =============================================================
     * 5. SALVA O ORÇAMENTO
     * =============================================================
     */
    await saveBudget();


    /*
     * =============================================================
     * 6. RESTAURA DATAS MANUAIS NO STATE
     *
     * saveBudget() pode ter chamado novamente:
     *
     * loadBudgetPaymentsForEditor()
     *
     * e substituído state.editing.payment_installments.
     * =============================================================
     */
    restoreInstallmentDates(
      installmentDatesSnapshot
    );


    /*
     * =============================================================
     * 7. Renderiza novamente usando as datas preservadas
     * =============================================================
     */
    await renderBudgetPaymentInstallments();

    updatePaymentsSummaryUI();


    console.log(
      '[budgetsPaymentsModal][apply] Orçamento salvo.',
      {
        budgetId:
          state.selectedId,

        installments:
          state.editing?.payment_installments,
      }
    );


    /*
     * =============================================================
     * 8. FECHA SOMENTE DEPOIS DE TODO PROCESSO
     * =============================================================
     */
    closeBudgetPaymentsModal();


  } catch (e) {
    console.error(
      '[budgetsPaymentsModal] apply/save error:',
      e
    );

    toast.error(
      'Pagamentos',
      e?.message ||
      'Erro ao aplicar pagamentos e salvar o orçamento.'
    );

  } finally {
    /*
     * =============================================================
     * 9. LIBERA BOTÃO
     * =============================================================
     */
    if (btnApply) {
      btnApply.disabled = false;

      btnApply.innerHTML =
        btnApply.dataset.originalText ||
        '✅ Aplicar';

      delete btnApply.dataset.originalText;
    }
  }
}


/* =========================================================================
 * REGENERATE INSTALLMENTS
 * ========================================================================= */

async function handleRegenerateInstallments() {
  try {
    const budgetId =
      state.selectedId ||
      state.editing?.header?.budget_id ||
      null;

    if (!budgetId) {
      return toast.warn(
        'Pagamentos',
        'Salve o orçamento antes de regenerar parcelas.'
      );
    }


    /*
     * ATENÇÃO:
     *
     * Este botão É o único ponto onde queremos
     * deliberadamente recalcular as parcelas.
     */
    await regenerateInstallmentsForBudget(
      budgetId
    );


    await renderBudgetPaymentInstallments();

    updatePaymentsSummaryUI();


    toast.success(
      'Pagamentos',
      '✅ Parcelas regeneradas com sucesso.'
    );

  } catch (e) {
    console.warn(
      '[budgetsPaymentsModal] regenerate error:',
      e?.message || e
    );

    toast.error(
      'Pagamentos',
      e?.message ||
      'Erro ao regenerar parcelas.'
    );
  }
}


/* =========================================================================
 * KEYBOARD
 * ========================================================================= */

function handleKeydown(e) {
  if (!isOpen()) {
    return;
  }

  if (e.key === 'Escape') {
    e.preventDefault();

    closeBudgetPaymentsModal();
  }
}


/* =========================================================================
 * INIT
 * ========================================================================= */

export function initBudgetPaymentsModal() {
  if (_initialized) {
    return;
  }

  _initialized = true;


  const {
    backdrop,
    btnOpen,
    btnClose,
    btnCancel,
    btnApply,
    btnRegenerate,
    modal,
  } = getEls();


  /* -----------------------------------------------------------------------
   * OPEN
   * --------------------------------------------------------------------- */

  btnOpen?.addEventListener(
    'click',
    async () => {
      await openBudgetPaymentsModal();
    }
  );


  /* -----------------------------------------------------------------------
   * CLOSE X
   * --------------------------------------------------------------------- */

  btnClose?.addEventListener(
    'click',
    () => {
      closeBudgetPaymentsModal();
    }
  );


  /* -----------------------------------------------------------------------
   * CANCEL / FECHAR
   * --------------------------------------------------------------------- */

  btnCancel?.addEventListener(
    'click',
    () => {
      closeBudgetPaymentsModal();
    }
  );


  /* -----------------------------------------------------------------------
   * APPLY
   * --------------------------------------------------------------------- */

  btnApply?.addEventListener(
    'click',
    async () => {
      await handleApply();
    }
  );


  /* -----------------------------------------------------------------------
   * REGENERATE
   * --------------------------------------------------------------------- */

  btnRegenerate?.addEventListener(
    'click',
    async () => {
      await handleRegenerateInstallments();
    }
  );


  /* -----------------------------------------------------------------------
   * BACKDROP
   * --------------------------------------------------------------------- */

  backdrop?.addEventListener(
    'click',
    () => {
      closeBudgetPaymentsModal();
    }
  );


  /* -----------------------------------------------------------------------
   * CLICK FORA DO CARD
   * --------------------------------------------------------------------- */

  modal?.addEventListener(
    'click',
    (e) => {
      const card =
        e.target.closest(
          '.budget-payments-modal__card'
        );

      if (!card) {
        closeBudgetPaymentsModal();
      }
    }
  );


  /* -----------------------------------------------------------------------
   * ESC
   * --------------------------------------------------------------------- */

  document.addEventListener(
    'keydown',
    handleKeydown
  );
}


/* =========================================================================
 * DEFAULT
 * ========================================================================= */

export default {
  initBudgetPaymentsModal,
  openBudgetPaymentsModal,
  closeBudgetPaymentsModal,
};