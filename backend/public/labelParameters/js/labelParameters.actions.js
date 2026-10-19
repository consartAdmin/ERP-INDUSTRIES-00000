import { deleteParameter, listParameters, saveParameter } from './labelParameters.api.js';
import { showCenterModal } from '/public/includes/js/centerAlertModal.js';
import { readFilters, readLabelSearch } from './labelParameters.filters.js';
import { collectPayload, fillForm, resetForm } from './labelParameters.form.js';
import { toast } from './labelParameters.modal.js';
import { renderCurrentPage, renderLoadError, renderLoading } from './labelParameters.render.js';
import { state } from './labelParameters.state.js';
import { $ } from './labelParameters.utils.js';
import { validateParameter } from './labelParameters.validation.js';

export async function loadParameters({ resetPage = false } = {}) {
  renderLoading();
  try {
    const completeList = await listParameters(readFilters());
    const search = readLabelSearch();
    state.currentList = search
      ? completeList.filter((parameter) =>
          String(parameter.name || '').toLocaleLowerCase('pt-BR').includes(search))
      : completeList;
    if (resetPage) state.pagination.page = 1;
    renderCurrentPage();
  } catch (error) {
    console.error('[labelParameters] load:', error);
    renderLoadError();
    toast.error('Erro ao carregar', error.message);
  }
}

export function goToPreviousPage() {
  if (state.pagination.page <= 1) return;
  state.pagination.page -= 1;
  renderCurrentPage();
}

export function goToNextPage() {
  const totalPages = Math.max(1, Math.ceil(state.currentList.length / state.pagination.rowsPerPage));
  if (state.pagination.page >= totalPages) return;
  state.pagination.page += 1;
  renderCurrentPage();
}

export function changeRowsPerPage(value) {
  state.pagination.rowsPerPage = Math.max(1, Number(value) || 50);
  state.pagination.page = 1;
  renderCurrentPage();
}

export async function submitParameter(event) {
  event?.preventDefault();
  const button = $('#btnSaveParameter');
  if (button) {
    button.disabled = true;
    button.textContent = 'Salvando...';
  }
  try {
    const payload = collectPayload();
    const validationError = validateParameter(payload);
    if (validationError) throw new Error(validationError);
    const saved = await saveParameter(state.currentEditId, payload);
    toast.success(
      state.currentEditId ? 'Parâmetro atualizado' : 'Parâmetro criado',
      `Parâmetro "${saved?.name || payload.name}" salvo com sucesso.`,
    );
    state.currentEditId = saved?.id ?? state.currentEditId;
    await loadParameters();
    const found = state.currentList.find((item) => String(item.id) === String(state.currentEditId));
    if (found) fillForm(found, { openDesigner: false });
  } catch (error) {
    console.error('[labelParameters] submit:', error);
    toast.error('Erro ao salvar', error.message);
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = 'Salvar';
    }
  }
}

export async function removeParameter(parameterId = state.currentEditId) {
  const targetId = parameterId && typeof parameterId === 'object'
    ? state.currentEditId
    : parameterId;
  if (!targetId) {
    toast.warn('Nenhum registro selecionado', 'Selecione um parâmetro antes de excluir.');
    return;
  }
  const confirmed = await showCenterModal({
    variant: 'warning',
    title: 'Excluir parâmetro',
    message: 'Tem certeza que deseja excluir este parâmetro? Esta ação não pode ser desfeita.',
    closeOnEscape: true,
    buttons: [
      {
        label: 'Cancelar',
        variant: 'cancel',
        action: () => false,
      },
      {
        label: '🗑️ Excluir',
        variant: 'danger',
        action: () => true,
      },
    ],
  });

  if (confirmed !== true) return;
  const button = $('#btnDeleteParameter');
  if (button) {
    button.disabled = true;
    button.textContent = 'Excluindo...';
  }
  try {
    await deleteParameter(targetId);
    toast.success('Parâmetro excluído', 'O parâmetro foi removido com sucesso.');
    if (String(state.currentEditId) === String(targetId)) resetForm();
    await loadParameters();
  } catch (error) {
    toast.error('Erro ao excluir', error.message);
  } finally {
    if (button) {
      button.disabled = !state.currentEditId;
      button.textContent = 'Excluir';
    }
  }
}
