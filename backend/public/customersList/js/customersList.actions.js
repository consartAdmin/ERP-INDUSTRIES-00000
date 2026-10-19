// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: customersList.actions.js                                      ║
// ║ MODULE: Customers List — Actions                                    ║
// ║ PRODNEX ERP                                                         ║
// ║ Navigation, reload, pagination and report export actions            ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { ROUTES } from './customersList.config.js';
import { buildReportQuery, clearFilterForm } from './customersList.form.js';
import {
  showError,
  showExportCancelled,
  showMissingKey,
} from './customersList.modal.js';
import {
  resetFiltersState,
  state,
} from './customersList.state.js';
import { $ } from './customersList.utils.js';
import { askExportKey } from './customersList.validation.js';

export function bindActions(loadAndRender) {
  $('#btnNew')?.addEventListener('click', () => {
    location.href = (window.erpCompanyUrl ? window.erpCompanyUrl('/public/customersRegistration/customersRegistration.html') : '/public/customersRegistration/customersRegistration.html');
  });
  $('#btnBack')?.addEventListener('click', () => {
    location.href = '/public/home/home.html';
  });
  $('#btnReload')?.addEventListener('click', () => {
    resetFiltersState();
    clearFilterForm();
    void loadAndRender();
  });
  $('#btnPdf')?.addEventListener('click', onExportPdf);
  $('#btnExcel')?.addEventListener('click', onExportExcel);

  $('#firstPage')?.addEventListener('click', () => {
    if (state.page <= 1) return;
    state.page = 1;
    state.offset = 0;
    void loadAndRender();
  });
  $('#prevPage')?.addEventListener('click', () => {
    if (state.page <= 1) return;
    state.page -= 1;
    state.offset = (state.page - 1) * state.limit;
    void loadAndRender();
  });
  $('#nextPage')?.addEventListener('click', () => {
    if (state.page >= state.totalPages) return;
    state.page += 1;
    state.offset = (state.page - 1) * state.limit;
    void loadAndRender();
  });
  $('#lastPage')?.addEventListener('click', () => {
    if (state.page >= state.totalPages) return;
    state.page = state.totalPages;
    state.offset = (state.page - 1) * state.limit;
    void loadAndRender();
  });
}

async function getExportKey(typeLabel) {
  const result = await askExportKey(typeLabel);
  if (result.status === 'cancelled') {
    showExportCancelled(typeLabel);
    return null;
  }
  if (result.status === 'missing') {
    showMissingKey(typeLabel);
    return null;
  }
  return result.key;
}

async function onExportPdf() {
  try {
    const key = await getExportKey('PDF');
    if (key === null) return;
    const query = buildReportQuery({ export_key: key });
    const url = (window.erpCompanyUrl ? window.erpCompanyUrl(`${ROUTES.customersReportPdf}?${query}`) : `${ROUTES.customersReportPdf}?${query}`);
    window.open(url, '_blank', 'noopener,noreferrer');
  } catch (error) {
    console.error('[customersList.onExportPdf]', error);
    showError('Exportação PDF', 'Não foi possível iniciar a exportação PDF.');
  }
}

async function onExportExcel() {
  try {
    const key = await getExportKey('EXCEL');
    if (key === null) return;
    const query = buildReportQuery({ export_key: key });
    window.location.href = (window.erpCompanyUrl ? window.erpCompanyUrl(`${ROUTES.customersReportExcel}?${query}`) : `${ROUTES.customersReportExcel}?${query}`);
  } catch (error) {
    console.error('[customersList.onExportExcel]', error);
    showError(
      'Exportação Excel',
      'Não foi possível iniciar a exportação Excel.'
    );
  }
}
