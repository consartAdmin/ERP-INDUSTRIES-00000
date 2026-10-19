// ╔══════════════════════════════════════════════════════════════╗
// ║ deliveryLabels.modal.js — Controle do modal                 ║
// ║ PRODNEX ERP | Frontend ESM                                  ║
// ╚══════════════════════════════════════════════════════════════╝

import { DEFAULT_STATUS, DELIVERY_LABEL_FIELDS } from './deliveryLabels.config.js';
import { clearLabelForm } from './deliveryLabels.form.js';
import { getField } from './deliveryLabels.utils.js';

export function openLabelModal(elements, row = null) {
  clearLabelForm();

  if (row) {
    elements.modalTitulo.textContent = `Editar Etiqueta #${row.delivery_label_id}`;

    for (const field of DELIVERY_LABEL_FIELDS) {
      const element = getField(field);
      if (element) element.value = row[field] ?? '';
    }
  } else {
    elements.modalTitulo.textContent = 'Nova Etiqueta';
    getField('volumes').value = '1';
    getField('delivery_status').value = DEFAULT_STATUS;
  }

  showModal(elements.modalEtiqueta);
  getField('customer_name')?.focus();
}

export function closeLabelModal(elements) {
  hideModal(elements.modalEtiqueta);
}

/* ──────────────────────────────────────────────────────────
   Helpers do padrão global (modals.css: .modal.is-open)
────────────────────────────────────────────────────────── */

export function showModal(modal) {
  modal.hidden = false;
  modal.classList.add('is-open');
  modal.setAttribute('aria-hidden', 'false');
}

export function hideModal(modal) {
  modal.classList.remove('is-open');
  modal.setAttribute('aria-hidden', 'true');
  modal.hidden = true;
}

export function isModalOpen(modal) {
  return modal.classList.contains('is-open');
}

export function isBackdropClick(event) {
  return event.target?.dataset?.modalClose === 'backdrop';
}
