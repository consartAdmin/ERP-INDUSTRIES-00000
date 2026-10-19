import { apiDelete, apiGetById, apiList } from './manufacturers.api.js';
import { elements } from './manufacturers.config.js';
import {
  confirmDelete,
  fillManufacturerForm,
  openManufacturerModal,
  showMessage,
} from './manufacturers.modal.js';
import { renderTable, updatePaginationControls } from './manufacturers.render.js';
import { setLimit, setQuery, state } from './manufacturers.state.js';
import { totalPages } from './manufacturers.utils.js';

export async function loadManufacturers({ page = 1, q = state.currentQuery } = {}) {
  const result = await apiList({ page, limit: state.currentLimit, q });
  if (!result.ok) {
    showMessage(`Erro ao carregar fabricantes: ${result.error}`);
    renderTable([], actionHandlers);
    updatePaginationControls(1, state.currentLimit, 0);
    return;
  }
  renderTable(result.rows, actionHandlers);
  updatePaginationControls(result.page, result.limit, result.total);
}

export async function openEditManufacturer(id) {
  const result = await apiGetById(id);
  if (!result.ok) {
    showMessage(`Erro ao carregar fabricante: ${result.error}`);
    return;
  }
  fillManufacturerForm(result.data);
  openManufacturerModal(`Editar Fabricante #${id}`);
}

export async function handleDeleteManufacturer(id, tradeName) {
  const message = tradeName
    ? `Deseja realmente excluir o fabricante "${tradeName}" (ID ${id})?`
    : `Deseja realmente excluir o fabricante ID ${id}?`;
  if (!confirmDelete(message)) return;
  const result = await apiDelete(id);
  if (!result.ok) {
    showMessage(`Erro ao excluir fabricante: ${result.error}`);
    return;
  }
  await loadManufacturers({ page: state.currentPage, q: state.currentQuery });
}

export function handleSearchInput() {
  setQuery(elements.searchInput?.value || '');
  loadManufacturers({ page: 1, q: state.currentQuery });
}

export function handlePrevPage() {
  if (state.currentPage > 1) {
    loadManufacturers({ page: state.currentPage - 1, q: state.currentQuery });
  }
}

export function handleNextPage() {
  if (state.currentPage < totalPages(state.totalRows, state.currentLimit)) {
    loadManufacturers({ page: state.currentPage + 1, q: state.currentQuery });
  }
}

export function handleReload() {
  loadManufacturers({ page: state.currentPage, q: state.currentQuery });
}

export function handlePageSizeChange() {
  const value = Number(elements.pageSizeSelect?.value || 50);
  setLimit(Number.isFinite(value) && value > 0 ? value : 20);
  loadManufacturers({ page: 1, q: state.currentQuery });
}

const actionHandlers = {
  edit: openEditManufacturer,
  remove: handleDeleteManufacturer,
};
