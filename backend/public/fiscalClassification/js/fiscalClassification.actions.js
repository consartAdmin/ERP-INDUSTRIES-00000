// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: fiscalClassification.actions.js                              ║
// ║ MODULE: Fiscal Classification — Actions                            ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import {
  createFiscalClassification,
  deactivateFiscalClassification,
  listFiscalClassifications,
  updateFiscalClassification,
} from './fiscalClassification.api.js';
import { buildListUrl, syncFiltersFromDom } from './fiscalClassification.filters.js';
import {
  clearClassificationForm,
  fillClassificationForm,
  focusClassificationName,
  getEditingClassificationId,
  readClassificationForm,
} from './fiscalClassification.form.js';
import {
  confirmDeleteClassification,
  showError,
  showSuccess,
} from './fiscalClassification.modal.js';
import {
  activateTab,
  renderClassificationTable,
  renderListError,
  renderListLoading,
  renderPagination,
} from './fiscalClassification.render.js';
import { state } from './fiscalClassification.state.js';
import { $, logError, normalizeRows } from './fiscalClassification.utils.js';
import { validateFiscalClassification } from './fiscalClassification.validation.js';

export async function loadClassifications() {
  renderListLoading();

  try {
    const response = await listFiscalClassifications(buildListUrl());
    const rows = normalizeRows(response);
    const offset = (state.page - 1) * state.pageSize;
    state.total = Number(response?.total ?? (offset + rows.length + (rows.length === state.pageSize ? 1 : 0)));

    renderClassificationTable(rows, {
      onEdit: editClassification,
      onDelete: removeClassification,
    });
    renderPagination();
  } catch (error) {
    logError('Erro ao carregar classificações', error);
    renderListError();
  }
}

export function applyFilters() {
  syncFiltersFromDom();
  loadClassifications();
}

export function newClassification() {
  clearClassificationForm();
  activateTab('form');
  focusClassificationName();
}

export function editClassification(row) {
  fillClassificationForm(row);
  activateTab('form');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

export async function removeClassification(row) {
  const id = row.fiscal_classification_id;
  if (!id || !confirmDeleteClassification(row)) return;

  try {
    await deactivateFiscalClassification(id);
    await loadClassifications();

    if (String(getEditingClassificationId()) === String(id)) {
      clearClassificationForm();
    }
    showSuccess('Classificação desativada com sucesso.');
  } catch (error) {
    logError('Erro ao remover classificação', error);
    showError(`Erro ao remover classificação: ${error.message}`);
  }
}

export async function saveClassification(event) {
  event.preventDefault();

  const { id, payload } = readClassificationForm();
  const validation = validateFiscalClassification(payload);

  if (!validation.isValid) {
    showError(validation.errors[0].message);
    $(`#${validation.errors[0].field}`)?.focus();
    return;
  }

  try {
    if (id) {
      await updateFiscalClassification(id, payload);
    } else {
      await createFiscalClassification(payload);
    }

    clearClassificationForm();
    await loadClassifications();
    activateTab('list');
    showSuccess('Classificação fiscal salva com sucesso.');
  } catch (error) {
    logError('Erro ao salvar classificação', error);
    showError(`Erro ao salvar classificação fiscal: ${error.message}`);
  }
}

export function goToPreviousPage() {
  if (state.page <= 1) return;
  state.page -= 1;
  loadClassifications();
}

export function goToNextPage() {
  const totalPages = Math.max(1, Math.ceil(state.total / state.pageSize));
  if (state.page >= totalPages) return;
  state.page += 1;
  loadClassifications();
}
