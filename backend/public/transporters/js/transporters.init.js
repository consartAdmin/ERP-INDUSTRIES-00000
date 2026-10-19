// ╔══════════════════════════════════════════════════════════════════════╗
// ║ transporters.init.js — Entry point do módulo Transportadoras        ║
// ║ PRODNEX ERP                                                         ║
// ║ HTML importa somente este arquivo do módulo.                        ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { getPageElements } from './transporters.config.js';
import { bindTransporterFormMasks } from './transporters.form.js';
import { bindTransporterModal, ensureTransporterModal } from './transporters.modal.js';
import {
  applyFilters,
  changePageSize,
  deleteAttachment,
  handleLoadError,
  handleTableClick,
  loadTransporters,
  lookupCnpjAndFill,
  nextPage,
  normalizeSearchStateInput,
  openCreateModal,
  previousPage,
  uploadAttachments,
  saveTransporter
} from './transporters.actions.js';

function bindEnterToSearch(input) {
  input?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      applyFilters();
    }
  });
}

function bindPageEvents() {
  const els = getPageElements();

  els.btnSearch?.addEventListener('click', applyFilters);
  els.btnRefresh?.addEventListener('click', () => loadTransporters().catch(handleLoadError));
  els.btnNew?.addEventListener('click', openCreateModal);
  els.bodyTable?.addEventListener('click', handleTableClick);
  els.btnPrevious?.addEventListener('click', previousPage);
  els.btnNext?.addEventListener('click', nextPage);
  els.pageSize?.addEventListener('change', () => changePageSize(els.pageSize.value));
  els.searchStatus?.addEventListener('change', applyFilters);
  els.searchState?.addEventListener('input', normalizeSearchStateInput);

  bindEnterToSearch(els.searchInput);
  bindEnterToSearch(els.searchCity);
  bindEnterToSearch(els.searchState);
}

async function bootstrap() {
  ensureTransporterModal();
  bindTransporterFormMasks({ onCnpjComplete: lookupCnpjAndFill });
  bindTransporterModal({
    onSave: saveTransporter,
    onUploadAttachments: uploadAttachments,
    onDeleteAttachment: deleteAttachment
  });
  bindPageEvents();

  try {
    await loadTransporters();
  } catch (error) {
    handleLoadError(error);
  }
}

bootstrap();
