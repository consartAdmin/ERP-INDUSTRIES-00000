import {
  handleNextPage,
  handlePageSizeChange,
  handlePrevPage,
  handleReload,
  handleSearchInput,
  loadManufacturers,
} from './manufacturers.actions.js';
import { API_URL, elements } from './manufacturers.config.js';
import { handleNewClick, registrarFormulario } from './manufacturers.form.js';
import { closeManufacturerModal, initManufacturerModal } from './manufacturers.modal.js';

function bindEvents() {
  elements.btnNew?.addEventListener('click', handleNewClick);
  elements.btnReload?.addEventListener('click', handleReload);
  elements.pageSizeSelect?.addEventListener('change', handlePageSizeChange);
  elements.btnCancel?.addEventListener('click', closeManufacturerModal);
  registrarFormulario(loadManufacturers);

  if (elements.searchInput) {
    let timer;
    elements.searchInput.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(handleSearchInput, 350);
    });
  }
  elements.prevPageBtn?.addEventListener('click', handlePrevPage);
  elements.nextPageBtn?.addEventListener('click', handleNextPage);
}

function init() {
  console.log('[manufacturers] Inicializando módulo. API_URL =', API_URL);
  initManufacturerModal();
  bindEvents();
  loadManufacturers({ page: 1, q: '' });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
