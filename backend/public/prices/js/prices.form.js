import { dom, state } from './prices.state.js';
import {
  closePriceEditorModal,
  openPriceEditorModal,
} from './prices.modal.js';
import { formatDateTime, normalizeNullableText, scrollToForm } from './prices.utils.js';

function getFormContainer() {
  return (
    dom.priceForm?.closest('[data-price-form-modal]') ||
    dom.priceForm?.closest('dialog') ||
    dom.priceForm?.closest('.modal') ||
    dom.priceForm?.closest('.panel-form') ||
    dom.priceForm
  );
}

export function openForm() {
  const container = getFormContainer();
  if (!container) return;

  openPriceEditorModal();
  container.hidden = false;
  container.removeAttribute('aria-hidden');
  container.classList.add('is-open', 'is-active');

  if (
    container instanceof HTMLDialogElement &&
    !container.open &&
    typeof container.showModal === 'function'
  ) {
    container.showModal();
  }

  scrollToForm();
  window.setTimeout(() => dom.priceName?.focus(), 0);
}

export function readForm() {
  return {
    name: String(dom.priceName?.value || '').trim(),
    description: normalizeNullableText(dom.priceDescription?.value),
    active: !!dom.priceActive?.checked,
  };
}

export function fillForm(row) {
  if (!row || typeof row !== 'object') return false;

  const id = Number(row.price_id ?? row.id);
  if (!Number.isFinite(id) || id <= 0) return false;

  state.editingId = id;

  if (dom.priceId) {
    dom.priceId.value = String(id);
  }

  if (dom.priceName) {
    dom.priceName.value = row.name || '';
  }

  if (dom.priceDescription) {
    dom.priceDescription.value = row.description || '';
  }

  if (dom.priceActive) {
    dom.priceActive.checked = !!row.active;
  }

  if (dom.createdAt) {
    dom.createdAt.value = formatDateTime(row.created_at);
  }

  if (dom.updatedAt) {
    dom.updatedAt.value = formatDateTime(row.updated_at);
  }

  if (dom.formTitle) {
    dom.formTitle.textContent = `Editando Tabela #${id}`;
  }

  if (dom.formSubtitle) {
    dom.formSubtitle.textContent =
      'Revise os dados abaixo e salve as alterações.';
  }

  if (dom.formModeBadge) {
    dom.formModeBadge.textContent = 'EDIÇÃO';
    dom.formModeBadge.className = 'badge badge-neutral';
  }

  openForm();
  return true;
}

export function resetForm() {
  state.editingId = null;
  dom.priceForm?.reset();
  if (dom.priceId) dom.priceId.value = '';
  if (dom.priceActive) dom.priceActive.checked = true;
  if (dom.createdAt) dom.createdAt.value = '';
  if (dom.updatedAt) dom.updatedAt.value = '';
  if (dom.formTitle) dom.formTitle.textContent = 'Nova Tabela de Preço';
  if (dom.formSubtitle) dom.formSubtitle.textContent = 'Preencha os campos abaixo para cadastrar uma nova tabela.';
  if (dom.formModeBadge) {
    dom.formModeBadge.textContent = 'NOVO';
    dom.formModeBadge.className = 'badge badge-neutral';
  }
}

export function cancelForm() {
  resetForm();
  closePriceEditorModal();
}
