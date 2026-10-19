// ╔══════════════════════════════════════════════════════════════════════╗
// ║ accountsReceivable.form.js — Formulário de Contas a Receber         ║
// ║ PRODNEX ERP                                                         ║
// ║ • Nova conta a receber                                              ║
// ║ • Edição de conta existente                                         ║
// ║ • Validação e envio ao backend                                      ║
// ║ • Compatível com a coluna amount_paid                               ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { showCenterModal } from './accountsReceivable.alert.js';

import {
  createAccount,
  getAccount,
  updateAccount,
  updateBoleto,
} from './accountsReceivable.api.js';

import { $, dateISO } from './accountsReceivable.utils.js';
import { validateAccount } from './accountsReceivable.validation.js';
import { Modal } from './modal.js';
import { refreshCashSubcategorySelect } from './accountsReceivable.categories.js';
import {
  clearChartAccountPicker,
  setChartAccountPickerFromRecord,
} from './accountsReceivable.chartAccountPicker.js';

let editingAsaasBoleto = false;

const BOLETO_EDITABLE_FIELDS = new Set([
  'arDueDate',
  'arTotalValue',
]);

function setBoletoEditMode(enabled) {
  const form = $('#arForm');
  if (!form) return;

  editingAsaasBoleto = Boolean(enabled);
  form.classList.toggle('is-boleto-edit', editingAsaasBoleto);

  const controls = form.querySelectorAll('input, select, textarea');

  for (const control of controls) {
    if (control.type === 'hidden') continue;

    if (editingAsaasBoleto) {
      control.dataset.previousDisabled = control.disabled ? 'true' : 'false';
      control.disabled = !BOLETO_EDITABLE_FIELDS.has(control.id);
    } else if (control.dataset.previousDisabled !== undefined) {
      control.disabled = control.dataset.previousDisabled === 'true';
      delete control.dataset.previousDisabled;
    }
  }
}

// ---------------------------------------------------------------------
// ELEMENTOS OBRIGATÓRIOS
// ---------------------------------------------------------------------

function requireElement(selector) {
  const element = $(selector);

  if (!element) {
    throw new Error(
      `Elemento obrigatório não encontrado no HTML: ${selector}`
    );
  }

  return element;
}

function setValue(id, value = '') {
  const element = $(`#${id}`);

  if (element) {
    element.value = value ?? '';
  }
}

function getValue(id) {
  return $(`#${id}`)?.value ?? '';
}

function trimOrNull(value) {
  const normalized = String(value ?? '').trim();
  return normalized || null;
}

function numberOrNull(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number) ? number : null;
}

// ---------------------------------------------------------------------
// MODAL / DRAWER
// ---------------------------------------------------------------------

export function openDrawer(title = 'Nova Conta a Receber') {
  const overlay = requireElement('#arFormOverlay');
  const titleElement = requireElement('#arFormTitle');

  titleElement.textContent = title;

  Modal.open(overlay, {
    focusSelector: '#arCustomerSearch',
  });
}

export function closeDrawer() {
  const overlay = $('#arFormOverlay');

  if (!overlay) return;

  Modal.close(overlay);
}

// ---------------------------------------------------------------------
// LIMPEZA DO FORMULÁRIO
// ---------------------------------------------------------------------

export function resetForm() {
  const form = requireElement('#arForm');

  setBoletoEditMode(false);

  form.reset();

  const today = dateISO(new Date());

  setValue('arId', '');
  setValue('arCustomerId', '');
  setValue('arCustomerSearch', '');
  setValue('arInvoiceNumber', '');
  setValue('arIssueDate', today);
  setValue('arDueDate', today);
  setValue('arPaymentDate', '');
  setValue('arPaymentMethodId', '');
  setValue('arDocumentTypeId', '');
  setValue('arCategoryId', '');
  setValue('arSubcategoryId', '');
  setValue('arCashAccountId', '');
  setValue('arChartAccountId', '');
  clearChartAccountPicker('form');
  setValue('arFine', '0.00');
  setValue('arInterest', '0.00');
  setValue('arCharges', '0.00');
  setValue('arDocumentNumber', '');
  setValue('arTotalValue', '');
  setValue('arAmountPaid', '0.00');
  setValue('arStatus', 'PENDING');
  setValue('arDescription', '');
  setValue('arNotes', '');
  setValue('arAttachmentUrl', '');
}

// ---------------------------------------------------------------------
// PREENCHIMENTO PARA EDIÇÃO
// ---------------------------------------------------------------------

function fillForm(data = {}) {
  const values = {
    arId:
      data.id ??
      data.account_id ??
      '',

    arCustomerId:
      data.customer_id ??
      '',

    arCustomerSearch:
      data.customer_name ??
      data.customer?.name ??
      data.customer?.corporate_name ??
      data.customer?.trade_name ??
      '',

    arInvoiceNumber:
      data.invoice_number ??
      '',

    arIssueDate:
      data.issue_date
        ? dateISO(data.issue_date)
        : '',

    arDueDate:
      data.due_date
        ? dateISO(data.due_date)
        : '',

    arPaymentDate:
      data.payment_date
        ? dateISO(data.payment_date)
        : '',

    arPaymentMethodId:
      data.payment_method_id ??
      '',

    arDocumentTypeId:
      data.document_type_id ??
      '',

    arCategoryId:
      data.category_id ??
      '',

    arSubcategoryId:
      data.subcategory_id ??
      '',

    // "Conta Caixa" = conta bancária (public."bankAccounts")
    arCashAccountId:
      data.bank_account_id ??
      data.effective_bank_account_id ??
      '',

    arChartAccountId:
      data.chart_account_id ??
      '',

    arFine:
      data.fine ??
      data.penalty ??
      0,

    arInterest:
      data.interest ??
      0,

    arCharges:
      data.charges ??
      0,

    arDocumentNumber:
      data.document_number ??
      '',

    arTotalValue:
      data.value ??
      '',

    arAmountPaid:
      data.amount_paid ??
      data.paid_value ??
      0,

    arStatus:
      data.status ??
      'PENDING',

    arDescription:
      data.description ??
      '',

    arNotes:
      data.notes ??
      '',

    arAttachmentUrl:
      data.attachment_url ??
      '',
  };

  for (const [id, value] of Object.entries(values)) {
    setValue(id, value);
  }

  refreshCashSubcategorySelect('#arCategoryId');
  setValue('arSubcategoryId', values.arSubcategoryId);
  setChartAccountPickerFromRecord('form', data);
}
// ---------------------------------------------------------------------
// ABRIR EDIÇÃO
// ---------------------------------------------------------------------

export async function openEdit(id) {
  if (!id) {
    showCenterModal({
      type: 'warning',
      title: 'Registro inválido',
      message: 'Não foi possível identificar a conta a receber.',
    });

    return;
  }

  try {
    const account = await getAccount(id);

    if (!account) {
      throw new Error('Conta a receber não encontrada.');
    }

    resetForm();
    fillForm(account);

    const isAsaasBoleto =
      Boolean(String(account?.asaas_payment_id || '').trim());

    setBoletoEditMode(isAsaasBoleto);

    openDrawer(
      isAsaasBoleto
        ? 'Editar Boleto — Vencimento e Valor'
        : 'Editar Conta a Receber'
    );
  } catch (error) {
    console.error('[accountsReceivable.form] openEdit:', error);

    showCenterModal({
      type: 'error',
      title: 'Erro ao carregar registro',
      message:
        error?.message ||
        'Não foi possível carregar a conta a receber.',
    });
  }
}

// ---------------------------------------------------------------------
// LEITURA DO FORMULÁRIO
// ---------------------------------------------------------------------

function formPayload() {
  return {
    customer_id:
      numberOrNull(getValue('arCustomerId')),

    invoice_number:
      trimOrNull(getValue('arInvoiceNumber')),

    issue_date:
      trimOrNull(getValue('arIssueDate')),

    due_date:
      trimOrNull(getValue('arDueDate')),

    payment_date:
      trimOrNull(getValue('arPaymentDate')),

    payment_method_id:
      numberOrNull(getValue('arPaymentMethodId')),

    document_type_id:
      numberOrNull(getValue('arDocumentTypeId')),

    category_id:
      numberOrNull(getValue('arCategoryId')),

    subcategory_id:
      numberOrNull(getValue('arSubcategoryId')),

    // "Conta Caixa" grava em bank_account_id.
    // cash_account_id não é enviado, então o backend preserva o valor atual.
    bank_account_id:
      numberOrNull(getValue('arCashAccountId')),

    chart_account_id:
      numberOrNull(getValue('arChartAccountId')),

    fine:
      Number(getValue('arFine') || 0),

    interest:
      Number(getValue('arInterest') || 0),

    charges:
      Number(getValue('arCharges') || 0),

    document_number:
      trimOrNull(getValue('arDocumentNumber')),

    value:
      Number(getValue('arTotalValue') || 0),

    amount_paid:
      Number(getValue('arAmountPaid') || 0),

    status:
      getValue('arStatus') || 'PENDING',

    description:
      trimOrNull(getValue('arDescription')),

    notes:
      trimOrNull(getValue('arNotes')),

    attachment_url:
      trimOrNull(getValue('arAttachmentUrl')),
  };
}

// ---------------------------------------------------------------------
// ENVIO DO FORMULÁRIO
// ---------------------------------------------------------------------

async function handleSubmit(event, onSaved) {
  event.preventDefault();

  const form = event.currentTarget;
  const submitButton = form.querySelector('[type="submit"]');
  const id = trimOrNull(getValue('arId'));

  try {
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.setAttribute('aria-busy', 'true');
    }

    const payload = formPayload();

    if (id && editingAsaasBoleto) {
      if (!payload.due_date) {
        throw new Error('Informe o novo vencimento do boleto.');
      }

      if (!Number.isFinite(payload.value) || payload.value <= 0) {
        throw new Error('Informe um valor de boleto maior que zero.');
      }

      await updateBoleto(id, {
        due_date: payload.due_date,
        value: payload.value,
      });
    } else if (id) {
      validateAccount(payload);
      await updateAccount(id, payload);
    } else {
      validateAccount(payload);
      await createAccount(payload);
    }

    showCenterModal({
      type: 'success',
      title: id ? 'Conta atualizada' : 'Conta criada',
      message: id
        ? editingAsaasBoleto
          ? 'Vencimento e valor atualizados no Asaas e no ERP.'
          : 'Conta a receber atualizada com sucesso.'
        : 'Nova conta a receber criada com sucesso.',
    });

    closeDrawer();

    if (typeof onSaved === 'function') {
      await onSaved();
    }
  } catch (error) {
    console.error('[accountsReceivable.form] handleSubmit:', error);

    showCenterModal({
      type: 'error',
      title: 'Erro ao salvar conta',
      message:
        error?.message ||
        'Não foi possível salvar a conta a receber.',
    });
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.removeAttribute('aria-busy');
      submitButton.blur();
    }
  }
}

// ---------------------------------------------------------------------
// EVENTOS
// ---------------------------------------------------------------------

export function bindForm(onSaved) {
  const form = $('#arForm');
  const newButton = $('#btnNew');
  const closeButton = $('#btnCloseForm');
  const cancelButton = $('#btnCancelForm');
  const overlay = $('#arFormOverlay');

  if (!form) {
    console.error(
      '[accountsReceivable.form] O elemento #arForm não existe no HTML.'
    );

    return;
  }

  newButton?.addEventListener('click', () => {
    try {
      resetForm();
      openDrawer('Nova Conta a Receber');
    } catch (error) {
      console.error('[accountsReceivable.form] btnNew:', error);

      showCenterModal({
        type: 'error',
        title: 'Erro ao abrir formulário',
        message: error.message,
      });
    }
  });

  closeButton?.addEventListener('click', closeDrawer);
  cancelButton?.addEventListener('click', closeDrawer);

  form.addEventListener('submit', (event) => {
    handleSubmit(event, onSaved);
  });

  // Fecha ao clicar fora do conteúdo
  overlay?.addEventListener('click', (event) => {
    if (event.target === overlay) {
      closeDrawer();
    }
  });

}
