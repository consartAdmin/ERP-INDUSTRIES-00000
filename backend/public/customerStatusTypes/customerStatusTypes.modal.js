import {
  clearTypeForm,
  initializeTypeForm,
  syncColorFromText
} from './customerStatusTypes.form.js';

import { elements }
  from './customerStatusTypes.state.js';

import { showCenterModal }
  from '/public/includes/js/centerAlertModal.js';

import { escapeHtml }
  from './customerStatusTypes.utils.js';

/* =====================================================================
   ESTADO DO MODAL
===================================================================== */

let editingTypeId = null;

export function getEditingTypeId() {
  return editingTypeId;
}

/* =====================================================================
   ABRIR MODAL — CRIAÇÃO
===================================================================== */

export function openTypeModal() {
  editingTypeId = null;

  clearTypeForm();
  initializeTypeForm();

  if (elements.typeModalTitle) {
    elements.typeModalTitle.textContent =
      'Novo Tipo de Status';
  }

  if (elements.btnCreateType) {
    elements.btnCreateType.textContent =
      'Criar Tipo';
  }

  elements.typeModal?.classList.remove('hidden');

  document.body.classList.add('modal-open');

  window.requestAnimationFrame(() => {
    elements.typeNameInput?.focus();
  });
}

/* =====================================================================
   ABRIR MODAL — EDIÇÃO
===================================================================== */

export function openTypeModalForEdit(type) {
  editingTypeId = String(type.id);

  if (elements.typeNameInput) {
    elements.typeNameInput.value =
      type.name_pt || '';
  }

  if (elements.typeCodeInput) {
    elements.typeCodeInput.value =
      type.internal_code || '';
  }

  if (elements.typeColorInput) {
    elements.typeColorInput.value =
      type.color_hex || '#FF0000';
  }

  if (elements.typeColorPicker) {
    elements.typeColorPicker.value =
      type.color_hex || '#FF0000';
  }

  if (elements.typeOrderInput) {
    elements.typeOrderInput.value =
      type.sort_order ?? 0;
  }

  if (elements.typeModalTitle) {
    elements.typeModalTitle.textContent =
      'Editar Tipo de Status';
  }

  if (elements.btnCreateType) {
    elements.btnCreateType.textContent =
      'Salvar Alterações';
  }

  syncColorFromText();

  elements.typeModal?.classList.remove('hidden');

  document.body.classList.add('modal-open');

  window.requestAnimationFrame(() => {
    elements.typeNameInput?.focus();
  });
}

/* =====================================================================
   FECHAR MODAL
===================================================================== */

export function closeTypeModal() {
  editingTypeId = null;

  elements.typeModal?.classList.add('hidden');

  document.body.classList.remove('modal-open');

  clearTypeForm();

  if (elements.typeModalTitle) {
    elements.typeModalTitle.textContent =
      'Novo Tipo de Status';
  }

  if (elements.btnCreateType) {
    elements.btnCreateType.textContent =
      'Criar Tipo';
  }
}

/* =====================================================================
   FECHAR COM ESC
===================================================================== */

export function handleTypeModalKeydown(event) {
  const modalIsOpen =
    elements.typeModal &&
    !elements.typeModal.classList.contains('hidden');

  if (event.key === 'Escape' && modalIsOpen) {
    closeTypeModal();
  }
}

/* =====================================================================
   CONFIRMAR EXCLUSÃO
===================================================================== */

/* =====================================================================
   CONFIRMAR EXCLUSÃO
===================================================================== */

export async function confirmDeleteType(id, name) {
  const safeId = escapeHtml(id);
  const safeName = escapeHtml(name);

  const result = await showCenterModal({
    variant: 'warning',

    title: 'Excluir tipo de status',

    message: `
      <p>
        Deseja realmente excluir o tipo de status
        <strong>"${safeName}"</strong>?
      </p>

      <p>
        ID do registro: <strong>${safeId}</strong>
      </p>

      <p>
        Esta operação não poderá ser desfeita.
      </p>
    `,

    timeoutMs: null,

    closeOnEscape: true,

    buttons: [
      {
        label: 'Cancelar',
        variant: 'cancel',
        action: () => false
      },
      {
        label: 'Excluir',
        variant: 'danger',
        action: () => true
      }
    ]
  });

  return result === true;
}