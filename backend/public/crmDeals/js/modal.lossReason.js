// ╔══════════════════════════════════════════════════════════════════════╗
// ║ modal.lossReason.js — CRM Deals (PRODNEX ERP)                       ║
// ║ Modal de Queda de Venda                                             ║
// ║                                                                      ║
// ║ ✅ Carrega crmLossReasons no select                                  ║
// ║ ✅ Retorna { loss_reason_id, note }                                  ║
// ║ ✅ Suporta ESC / clique no backdrop / cancelar                       ║
// ║ ✅ Evita bind duplicado                                              ║
// ║ ✅ Compatível com reason_label / reason_name / name                  ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { dom } from './dom.js';
import { state, setLossReasons } from './state.js';
import { loadLossReasons } from './loaders.js';
import { apiCreateLossReason } from './api.js';
import { Modal } from '/public/includes/js/modal.js';

export {
  ensureLossReasonModalBindings,
  openLossReasonModal,
  closeLossReasonModal,
  fillLossReasonsSelect,
};

let lossReasonResolver = null;

/* --------------------------------------------------------------------- */
/* Render select                                                         */
/* --------------------------------------------------------------------- */
function fillLossReasonsSelect(listParam = null) {
  if (!dom.modalLossReasonSelect) return;

  const list = Array.isArray(listParam)
    ? listParam
    : Array.isArray(state.lossReasons)
      ? state.lossReasons
      : [];

  dom.modalLossReasonSelect.innerHTML =
    '<option value="">Selecione o motivo</option>';

  if (!list.length) return;

  list.forEach((item) => {
    if (!item || !item.id) return;

    const option = document.createElement('option');
    option.value = String(item.id);

    const label =
      item.reason_label ||
      item.reason_name ||
      item.reasonName ||
      item.name ||
      `Motivo #${item.id}`;

    option.textContent = String(label).trim();

    dom.modalLossReasonSelect.appendChild(option);
  });
}

/* --------------------------------------------------------------------- */
/* Close                                                                 */
/* --------------------------------------------------------------------- */
function closeLossReasonModal() {
  if (!dom.modalLossReason) return;

  Modal.close(dom.modalLossReason);

  if (dom.modalLossReasonSelect) {
    dom.modalLossReasonSelect.value = '';
  }

  if (dom.modalLossReasonNotes) {
    dom.modalLossReasonNotes.value = '';
  }
}

/* --------------------------------------------------------------------- */
/* Resolve modal promise                                                 */
/* --------------------------------------------------------------------- */
function resolveLossReasonModal(payload) {
  if (typeof lossReasonResolver === 'function') {
    lossReasonResolver(payload);
    lossReasonResolver = null;
  }
}

/* --------------------------------------------------------------------- */
/* Cancel                                                                */
/* --------------------------------------------------------------------- */
function cancelLossReasonModal() {
  closeLossReasonModal();
  resolveLossReasonModal(null);
}

/* --------------------------------------------------------------------- */
/* Confirm                                                               */
/* --------------------------------------------------------------------- */
function confirmLossReasonModal() {
  const lossReasonId = Number(dom.modalLossReasonSelect?.value || '');
  const note = String(dom.modalLossReasonNotes?.value || '').trim();

  if (!Number.isFinite(lossReasonId) || lossReasonId <= 0) {
    alert('Selecione um motivo da perda.');
    dom.modalLossReasonSelect?.focus();
    return;
  }

  // Resolve antes de fechar: o evento modal:close resolve como cancelado
  resolveLossReasonModal({
    loss_reason_id: lossReasonId,
    note: note || null,
  });

  closeLossReasonModal();
}

/* --------------------------------------------------------------------- */
/* Open modal                                                            */
/* --------------------------------------------------------------------- */
async function openLossReasonModal() {
  if (!dom.modalLossReason) return null;

  let list = Array.isArray(state.lossReasons) ? state.lossReasons : [];

  if (!list.length) {
    list = await loadLossReasons();
  }

  if (Array.isArray(list)) {
    setLossReasons(list);
  }

  fillLossReasonsSelect(list);

  Modal.setup();
  Modal.open(dom.modalLossReason, { focusSelector: '#crm-loss-reason-select' });

  if (dom.modalLossReasonSelect) {
    dom.modalLossReasonSelect.value = '';

    setTimeout(() => {
      dom.modalLossReasonSelect?.focus();
    }, 0);
  }

  if (dom.modalLossReasonNotes) {
    dom.modalLossReasonNotes.value = '';
  }

  return new Promise((resolve) => {
    lossReasonResolver = resolve;
  });
}

/* --------------------------------------------------------------------- */
/* Novo motivo da perda (botão +)                                        */
/* --------------------------------------------------------------------- */
function getNewLossReasonEls() {
  return {
    modal: document.getElementById('crm-modal-new-loss-reason'),
    form: document.getElementById('crm-new-loss-reason-form'),
    input: document.getElementById('crm-new-loss-reason-name'),
    error: document.getElementById('crm-new-loss-reason-error'),
    save: document.getElementById('crm-new-loss-reason-save'),
  };
}

function showNewLossReasonError(message) {
  const { error } = getNewLossReasonEls();
  if (!error) return;

  error.textContent = message || '';
  error.hidden = !message;
}

function openNewLossReasonModal() {
  const { modal, input } = getNewLossReasonEls();
  if (!modal) return;

  if (input) input.value = '';
  showNewLossReasonError('');

  Modal.open(modal, { focusSelector: '#crm-new-loss-reason-name' });
}

async function saveNewLossReason() {
  const { modal, input, save } = getNewLossReasonEls();
  const name = String(input?.value || '').trim();

  if (!name) {
    showNewLossReasonError('Informe o motivo.');
    input?.focus();
    return;
  }

  if (save) save.disabled = true;
  showNewLossReasonError('');

  try {
    const json = await apiCreateLossReason(name);
    const body = json?.data && typeof json.data === 'object' ? json.data : {};
    const created = body.data || body;

    if (!json?.ok || body.success === false || !created?.id) {
      const msg = body.message || json?.message || json?.error || '';
      showNewLossReasonError(
        json?.status === 409 || /already exists/i.test(msg)
          ? 'Já existe um motivo com esse nome.'
          : 'Não foi possível salvar o motivo.'
      );
      return;
    }

    const list = [...(Array.isArray(state.lossReasons) ? state.lossReasons : []), created];
    setLossReasons(list);
    fillLossReasonsSelect(list);

    Modal.close(modal);

    if (dom.modalLossReasonSelect) {
      dom.modalLossReasonSelect.value = String(created.id);
      dom.modalLossReasonSelect.focus();
    }
  } catch (err) {
    console.error('[CRM] Erro ao criar motivo da perda:', err);
    showNewLossReasonError('Não foi possível salvar o motivo.');
  } finally {
    if (save) save.disabled = false;
  }
}

/* --------------------------------------------------------------------- */
/* Bindings                                                              */
/* --------------------------------------------------------------------- */
function ensureLossReasonModalBindings() {
  /* Fechou pelo X, backdrop ou ESC (modal.js) = cancelar */
  if (
    dom.modalLossReason &&
    dom.modalLossReason.dataset.boundLossReasonModal !== '1'
  ) {
    dom.modalLossReason.dataset.boundLossReasonModal = '1';

    dom.modalLossReason.addEventListener('modal:close', () => {
      resolveLossReasonModal(null);
    });
  }

  /* Botão + (novo motivo) */
  const addBtn = document.getElementById('crm-loss-reason-add');
  if (addBtn && addBtn.dataset.boundLossReasonAdd !== '1') {
    addBtn.dataset.boundLossReasonAdd = '1';
    addBtn.addEventListener('click', openNewLossReasonModal);
  }

  const { form } = getNewLossReasonEls();
  if (form && form.dataset.boundNewLossReason !== '1') {
    form.dataset.boundNewLossReason = '1';
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      saveNewLossReason();
    });
  }

  /* Confirm */
  if (
    dom.btnLossReasonConfirm &&
    dom.btnLossReasonConfirm.dataset.boundLossReasonConfirm !== '1'
  ) {
    dom.btnLossReasonConfirm.dataset.boundLossReasonConfirm = '1';

    dom.btnLossReasonConfirm.addEventListener(
      'click',
      confirmLossReasonModal
    );
  }

  /* Cancel */
  if (
    dom.btnLossReasonCancel &&
    dom.btnLossReasonCancel.dataset.boundLossReasonCancel !== '1'
  ) {
    dom.btnLossReasonCancel.dataset.boundLossReasonCancel = '1';

    dom.btnLossReasonCancel.addEventListener(
      'click',
      cancelLossReasonModal
    );
  }

}