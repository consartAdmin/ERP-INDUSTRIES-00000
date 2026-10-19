import { showCenterModal }
  from '/public/includes/js/centerAlertModal.js';

import { customerStatusTypesApi as api }
  from './customerStatusTypes.api.js';

import { clearTypeForm }
  from './customerStatusTypes.form.js';

import {
  closeTypeModal,
  confirmDeleteType,
  getEditingTypeId,
  openTypeModalForEdit
} from './customerStatusTypes.modal.js';

import {
  renderTypes,
  renderTypesError
} from './customerStatusTypes.render.js';

import { readValidTypeForm }
  from './customerStatusTypes.validation.js';

import { escapeHtml }
  from './customerStatusTypes.utils.js';

/* =====================================================================
   CARREGAR TIPOS
===================================================================== */

export async function loadTypes() {
  try {
    const data = await api.listTypes();

    const rows = Array.isArray(data?.rows)
      ? data.rows
      : [];

    renderTypes(rows);
  } catch (error) {
    console.error(
      '[customerStatusTypes] loadTypes error:',
      error
    );

    renderTypesError(error.message);
  }
}

/* =====================================================================
   CRIAR OU ATUALIZAR TIPO
===================================================================== */

export async function saveType() {
  const data = readValidTypeForm();

  if (!data) return;

  const editingTypeId = getEditingTypeId();
  const isEditing = Boolean(editingTypeId);

  try {
    if (isEditing) {
      await api.updateType(editingTypeId, data);
    } else {
      await api.createType(data);
    }

    /*
     * Fecha primeiro o modal de cadastro/edição.
     * Depois abre o modal central de sucesso.
     */
    clearTypeForm();
    closeTypeModal();

    await loadTypes();

    await showCenterModal({
      variant: 'success',

      title: isEditing
        ? 'Tipo atualizado'
        : 'Tipo criado',

      message: `
        O tipo de status
        <strong>"${escapeHtml(data.name_pt)}"</strong>
        foi ${isEditing ? 'atualizado' : 'criado'} com sucesso.
      `,

      timeoutMs: null,

      closeOnEscape: true,

      buttons: [
        {
          label: 'OK',
          variant: 'success',
          action: () => true
        }
      ]
    });
  } catch (error) {
    console.error(
      `[customerStatusTypes] ${isEditing ? 'updateType' : 'createType'
      } error:`,
      error
    );

    await showCenterModal({
      variant: 'error',

      title: isEditing
        ? 'Erro ao atualizar'
        : 'Erro ao criar',

      message: `
        Não foi possível
        ${isEditing ? 'atualizar' : 'criar'}
        o tipo de status.

        <br><br>

        <strong>
          ${escapeHtml(error.message)}
        </strong>
      `,

      timeoutMs: null,

      closeOnEscape: true,

      buttons: [
        {
          label: 'Fechar',
          variant: 'close',
          action: () => false
        }
      ]
    });
  }
}

/*
 * Compatibilidade com o init.js atual.
 */
export const createType = saveType;

/* =====================================================================
   EXCLUIR TIPO
===================================================================== */

export async function deleteTypeById(id, name) {
  const confirmed = await confirmDeleteType(
    id,
    name
  );

  if (!confirmed) return;

  try {
    await api.deleteType(id);

    await loadTypes();

    await showCenterModal({
      variant: 'success',

      title: 'Tipo excluído',

      message: `
        O tipo de status
        <strong>"${escapeHtml(name)}"</strong>
        foi excluído com sucesso.
      `,

      timeoutMs: null,

      closeOnEscape: true,

      buttons: [
        {
          label: 'OK',
          variant: 'success',
          action: () => true
        }
      ]
    });
  } catch (error) {
    console.error(
      '[customerStatusTypes] deleteTypeById error:',
      error
    );

    await showCenterModal({
      variant: 'error',

      title: 'Erro ao excluir',

      message: `
        Não foi possível excluir o tipo de status.

        <br><br>

        <strong>
          ${escapeHtml(error.message)}
        </strong>
      `,

      timeoutMs: null,

      closeOnEscape: true,

      buttons: [
        {
          label: 'Fechar',
          variant: 'close',
          action: () => false
        }
      ]
    });
  }
}

/* =====================================================================
   CLIQUES NA TABELA
===================================================================== */

export function handleTypesTableClick(event) {
  const editButton = event.target.closest(
    '[data-edit-id]'
  );

  if (editButton) {
    openTypeModalForEdit({
      id: editButton.dataset.editId,

      name_pt:
        editButton.dataset.editName || '',

      internal_code:
        editButton.dataset.editCode || '',

      color_hex:
        editButton.dataset.editColor || '#FF0000',

      sort_order: Number(
        editButton.dataset.editOrder || 0
      )
    });

    return;
  }

  const deleteButton = event.target.closest(
    '[data-delete-id]'
  );

  if (deleteButton) {
    deleteTypeById(
      deleteButton.dataset.deleteId,
      deleteButton.dataset.deleteName || 'Sem nome'
    );
  }
}