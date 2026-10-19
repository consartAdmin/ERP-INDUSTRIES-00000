// ╔══════════════════════════════════════════════════════════════════════╗
// ║ cancelarNfe.modal.js — Controle dos modais                         ║
// ║ PRODNEX ERP                                                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { $ } from './cancelarNfe.utils.js';

function syncBodyModalState() {
  const hasOpenModal =
    document.querySelector('.modal.is-open');

  document.body.classList.toggle(
    'modal-open',
    Boolean(hasOpenModal)
  );
}

export function openModal(
  modal,
  focusElement = null
) {
  if (!modal) return;

  modal.classList.add('is-open');
  modal.setAttribute('aria-hidden', 'false');
  syncBodyModalState();

  requestAnimationFrame(() => {
    focusElement?.focus();
  });
}

export function closeModal(modal) {
  if (!modal) return;

  modal.classList.remove('is-open');
  modal.setAttribute('aria-hidden', 'true');
  syncBodyModalState();
}

export function openCancelamentoModal() {
  openModal(
    $('#modalCancelarNfe'),
    $('#btnBuscarNfeEmitida')
  );
}

export function closeCancelamentoModal() {
  closeModal($('#modalCancelarNfe'));
}

export function openConsultaStatusModal() {
  openModal(
    $('#modalConsultaStatus'),
    $('#btnBuscarNfeStatus')
  );
}

export function closeConsultaStatusModal() {
  closeModal($('#modalConsultaStatus'));
}

export function openNfeEmitidaModal() {
  openModal(
    $('#modalBuscarNfeEmitida'),
    $('#buscaNfeEmitida')
  );
}

export function closeNfeEmitidaModal() {
  closeModal($('#modalBuscarNfeEmitida'));
}

export function closeTopModal() {
  const picker = $('#modalBuscarNfeEmitida');
  if (picker?.classList.contains('is-open')) {
    closeNfeEmitidaModal();
    return true;
  }

  const status = $('#modalConsultaStatus');
  if (status?.classList.contains('is-open')) {
    closeConsultaStatusModal();
    return true;
  }

  const cancel = $('#modalCancelarNfe');
  if (cancel?.classList.contains('is-open')) {
    closeCancelamentoModal();
    return true;
  }

  return false;
}
