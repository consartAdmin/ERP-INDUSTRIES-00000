import { deleteGrade, getGrades } from './grades.api.js';
import { openEditModal } from './grades.modal.js';
import {
  renderGrades,
  renderPagination,
  renderSummary,
  showState,
} from './grades.render.js';
import { elements, state } from './grades.state.js';
import { showToast } from './grades.utils.js';

export async function loadGrades() {
  elements.inputBusca.disabled = true;
  elements.selectStatus.disabled = true;
  elements.btnFiltrar.disabled = true;
  elements.listaGrades.ariaBusy = 'true';

  if (!state.rows.length) {
    showState('Carregando grades...');
  }

  try {
    const data = await getGrades({
      query: state.q,
      status: state.status,
      limit: state.limit,
      offset: state.offset,
    });

    state.rows = Array.isArray(data?.rows) ? data.rows : [];
    state.total = Number(data?.total || 0);
    state.limit = Number(data?.limit || state.limit);
    state.offset = Number(data?.offset || state.offset);

    renderGrades();
    renderSummary();
    renderPagination();
  } catch (error) {
    console.error(error);
    state.rows = [];
    elements.listaGrades.innerHTML = '';
    elements.apTableInfo.textContent = 'Falha ao carregar os dados';

    showState(
      'Não foi possível carregar as grades. Tente novamente.',
      'erro',
    );
    showToast('Erro ao carregar grades.', 'erro');
  } finally {
    elements.inputBusca.disabled = false;
    elements.selectStatus.disabled = false;
    elements.btnFiltrar.disabled = false;
    elements.listaGrades.ariaBusy = 'false';
  }
}

export function applyFilters() {
  state.q = elements.inputBusca.value.trim();
  state.status = elements.selectStatus.value;
  state.offset = 0;
  loadGrades();
}

export function goToPreviousPage() {
  if (state.offset === 0) return;

  state.offset = Math.max(0, state.offset - state.limit);
  loadGrades();
}

export function goToNextPage() {
  if (state.offset + state.limit >= state.total) return;

  state.offset += state.limit;
  loadGrades();
}

export function changePageSize(event) {
  state.limit = Number(event.target.value) || 50;
  state.offset = 0;
  loadGrades();
}

export async function removeGrade(id) {
  const row = state.rows.find(
    (item) => String(item.grade_id) === String(id),
  );
  const gradeName = row?.grade ? ` “${row.grade}”` : '';
  const confirmed = confirm(
    `Deseja realmente excluir a grade${gradeName}?`,
  );

  if (!confirmed) return;

  try {
    await deleteGrade(id);
    showToast('Grade excluída com sucesso.');

    if (state.rows.length === 1 && state.offset > 0) {
      state.offset = Math.max(0, state.offset - state.limit);
    }

    await loadGrades();
  } catch (error) {
    console.error(error);
    showToast(error.message || 'Erro ao excluir grade.', 'erro');
  }
}

export function handleTableAction(event) {
  const button = event.target.closest('button[data-action]');

  if (!button) return;

  if (button.dataset.action === 'edit') {
    openEditModal(button.dataset.id);
  } else if (button.dataset.action === 'delete') {
    removeGrade(button.dataset.id);
  }
}
