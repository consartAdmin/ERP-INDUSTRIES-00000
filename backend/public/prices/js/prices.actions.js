// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: prices.actions.js                                             ║
// ║ MODULE: Price Tables — Actions                                     ║
// ║ DESCRIPTION: Orquestra listagem, filtros, formulário e ações CRUD  ║
// ║ PRODNEX ERP · Frontend · ESM                                       ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { showCenterModal } from '/public/includes/js/centerAlertModal.js';

import {
  createPriceTable,
  deactivatePriceTable,
  deletePriceTablePermanently,
  getPriceTable,
  listPriceTables,
  restorePriceTable,
  updatePriceTable,
} from './prices.api.js';

import {
  buildListParams,
  clearFilters,
  syncFiltersFromDom,
} from './prices.filters.js';

import {
  fillForm,
  openForm,
  readForm,
  resetForm,
} from './prices.form.js';

import {
  closePriceEditorModal,
  confirmDeactivate,
  confirmPermanentDelete,
  confirmRestore,
} from './prices.modal.js';

import {
  renderPagination,
  renderTable,
  renderTableError,
  renderTableLoading,
  setLoading,
  updateListInfo,
} from './prices.render.js';

import { dom, state } from './prices.state.js';
import { validatePriceTable } from './prices.validation.js';

/* =====================================================================
   CENTER MODAL FEEDBACK
===================================================================== */

function showFeedback({
  variant = 'info',
  title = 'Informação',
  message = '',
  timeoutMs,
} = {}) {
  showCenterModal({
    variant,
    title,
    message,
    ...(timeoutMs ? { timeoutMs } : {}),
  });
}

/* =====================================================================
   LOAD PRICE TABLES
===================================================================== */

export async function loadList() {
  try {
    syncFiltersFromDom();
    setLoading(true);
    renderTableLoading();

    const response = await listPriceTables(buildListParams());
    const payload = response?.data || {};

    let rows = Array.isArray(payload.rows) ? payload.rows : [];
    let total = Number(payload.total || 0);

    if (state.status === 'inactive') {
      rows = rows.filter((row) => !row.active);
      total = rows.length;
    }

    state.rows = rows;
    state.total = total;
    state.totalPages = Math.max(
      1,
      Math.ceil((state.total || 0) / state.limit),
    );

    if (state.page > state.totalPages) {
      state.page = state.totalPages;
      return loadList();
    }

    renderTable();
    renderPagination();
  } catch (error) {
    console.error('[prices.loadList]', error);

    renderTableError(error.message || 'Falha ao carregar registros.');
    updateListInfo('Falha ao carregar tabelas de preço.');

    showFeedback({
      variant: 'error',
      title: 'Erro ao carregar',
      message:
        error.message || 'Não foi possível carregar as tabelas de preço.',
    });
  } finally {
    setLoading(false);
  }
}

/* =====================================================================
   SEARCH AND FILTERS
===================================================================== */

export function search() {
  syncFiltersFromDom();
  state.page = 1;
  loadList();
}

export function resetFilters() {
  clearFilters();
  loadList();
}

/* =====================================================================
   PAGINATION
===================================================================== */

export function goToPage(page) {
  const target = Math.max(
    1,
    Math.min(Number(page) || 1, state.totalPages || 1),
  );

  if (target === state.page) return;

  state.page = target;
  loadList();
}

/* =====================================================================
   CREATE OR UPDATE
===================================================================== */

export async function submitForm(event) {
  event?.preventDefault();

  const payload = readForm();
  const validationError = validatePriceTable(payload);

  if (validationError) {
    showFeedback({
      variant: 'warning',
      title: 'Dados obrigatórios',
      message: validationError,
    });

    dom.priceName?.focus();
    return;
  }

  try {
    setLoading(true);

    if (state.editingId) {
      await updatePriceTable(state.editingId, payload);

      showFeedback({
        variant: 'success',
        title: 'Tabela atualizada',
        message: 'A tabela de preço foi atualizada com sucesso.',
        timeoutMs: 4200,
      });
    } else {
      await createPriceTable(payload);

      showFeedback({
        variant: 'success',
        title: 'Tabela criada',
        message: 'A tabela de preço foi criada com sucesso.',
        timeoutMs: 4200,
      });
    }

    resetForm();
    closePriceEditorModal();
    await loadList();
  } catch (error) {
    console.error('[prices.submit]', error);

    showFeedback({
      variant: 'error',
      title: 'Erro ao salvar',
      message: error.message || 'Não foi possível salvar a tabela de preço.',
    });
  } finally {
    setLoading(false);
  }
}

/* =====================================================================
   EDIT
===================================================================== */

async function editOne(id) {
  const cachedRow = state.rows.find(
    (row) => Number(row.price_id ?? row.id) === Number(id),
  );

  if (cachedRow) {
    fillForm(cachedRow);
    return;
  }

  try {
    setLoading(true);

    const response = await getPriceTable(id);

    const row =
      response?.data?.row ||
      response?.data?.item ||
      response?.data ||
      response?.row ||
      response?.item ||
      response;

    if (!row) {
      showFeedback({
        variant: 'warning',
        title: 'Tabela não encontrada',
        message: 'A tabela de preço selecionada não foi encontrada.',
      });
      return;
    }

    fillForm(row);
  } catch (error) {
    console.error('[prices.editOne]', error);

    showFeedback({
      variant: 'error',
      title: 'Erro ao editar',
      message: error.message || 'Não foi possível carregar a tabela de preço.',
    });
  } finally {
    setLoading(false);
  }
}

/* =====================================================================
   DEACTIVATE
===================================================================== */

async function deactivateOne(id) {
  if (!(await confirmDeactivate())) return;

  try {
    setLoading(true);

    await deactivatePriceTable(id);

    if (state.editingId === id) {
      resetForm();
      closePriceEditorModal();
    }

    showFeedback({
      variant: 'success',
      title: 'Tabela inativada',
      message: 'A tabela de preço foi inativada com sucesso.',
      timeoutMs: 4200,
    });

    await loadList();
  } catch (error) {
    console.error('[prices.deactivateOne]', error);

    showFeedback({
      variant: 'error',
      title: 'Erro ao inativar',
      message: error.message || 'Não foi possível inativar a tabela de preço.',
    });
  } finally {
    setLoading(false);
  }
}

/* =====================================================================
   PERMANENT DELETE
===================================================================== */

async function deleteOnePermanently(id) {
  if (!(await confirmPermanentDelete())) return;

  try {
    setLoading(true);
    await deletePriceTablePermanently(id);

    if (state.editingId === id) {
      resetForm();
      closePriceEditorModal();
    }

    showFeedback({
      variant: 'success',
      title: 'Tabela excluída',
      message: 'A tabela de preço foi excluída permanentemente.',
      timeoutMs: 4200,
    });

    await loadList();
  } catch (error) {
    console.error('[prices.deleteOnePermanently]', error);

    showFeedback({
      variant: 'error',
      title: 'Erro ao excluir',
      message: error.message || 'Não foi possível excluir a tabela de preço.',
    });
  } finally {
    setLoading(false);
  }
}

/* =====================================================================
   RESTORE
===================================================================== */

async function restoreOne(id) {
  if (!confirmRestore()) return;

  try {
    setLoading(true);

    await restorePriceTable(id);

    showFeedback({
      variant: 'success',
      title: 'Tabela restaurada',
      message: 'A tabela de preço foi restaurada com sucesso.',
      timeoutMs: 4200,
    });

    await loadList();
  } catch (error) {
    console.error('[prices.restoreOne]', error);

    showFeedback({
      variant: 'error',
      title: 'Erro ao restaurar',
      message: error.message || 'Não foi possível restaurar a tabela de preço.',
    });
  } finally {
    setLoading(false);
  }
}

/* =====================================================================
   TABLE ACTION DELEGATION
===================================================================== */

export function handleTableClick(event) {
  const button = event.target.closest(
    'button[data-action][data-id], [data-action="edit"][data-id]',
  );

  if (!button) return;

  const id = Number(button.dataset.id);
  if (!Number.isFinite(id) || id <= 0) return;

  const action = button.dataset.action;

  if (action === 'edit') {
    editOne(id);
    return;
  }

  if (action === 'delete') {
    deactivateOne(id);
    return;
  }

  if (action === 'remove') {
    deleteOnePermanently(id);
    return;
  }

  if (action === 'restore') {
    restoreOne(id);
  }
}

/* =====================================================================
   NEW PRICE TABLE
===================================================================== */

export function newPriceTable() {
  resetForm();
  openForm();
}
