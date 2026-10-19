import {
  goToPage, handleTableClick, loadList, newPriceTable,
  resetFilters, search, submitForm,
} from './prices.actions.js';
import { cancelForm, resetForm } from './prices.form.js';
import {
  bindPriceEditorModalKeyboard,
  ensurePriceEditorModal,
} from './prices.modal.js';
import { dom, state } from './prices.state.js';

function mapDom() {
  [
    'searchInput',
    'filterStatus',
    'sortField',
    'sortDir',
    'pageSize',
    'btnPesquisar',
    'btnLimpar',
    'btnNovo',
    'priceForm',
    'priceId',
    'priceName',
    'priceDescription',
    'priceActive',
    'createdAt',
    'updatedAt',
    'formTitle',
    'formSubtitle',
    'formModeBadge',
    'tableBody',
    'toast',
  ].forEach((id) => {
    dom[id] = document.getElementById(id);
  });

  dom.btnSalvar = document.getElementById('btnSave');
  dom.btnCancelarEdicao = document.getElementById('btnCancel');

  dom.priceId ||= document.getElementById('priceTableId');
  dom.priceDescription ||= document.getElementById('description');

  // The footer IDs below are defined by prices.html. Keep the internal
  // property names used by the render and pagination modules.
  dom.listInfo = document.getElementById('apTableInfo');
  dom.paginationInfo = document.getElementById('pageInfo');
  dom.btnPrevPage = document.getElementById('btnPrevious');
  dom.btnNextPage = document.getElementById('btnNext');
}

function bindEvents() {
  dom.btnPesquisar?.addEventListener('click', search);
  dom.btnLimpar?.addEventListener('click', resetFilters);
  dom.btnNovo?.addEventListener('click', newPriceTable);
  [dom.pageSize, dom.sortField, dom.sortDir, dom.filterStatus]
    .filter(Boolean)
    .forEach((element) => element.addEventListener('change', search));
  dom.searchInput?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      search();
    }
  });
  dom.priceForm?.addEventListener('submit', submitForm);
  dom.btnCancelarEdicao?.addEventListener('click', cancelForm);
  dom.btnFirstPage?.addEventListener('click', () => goToPage(1));
  dom.btnPrevPage?.addEventListener('click', () => goToPage(state.page - 1));
  dom.btnNextPage?.addEventListener('click', () => goToPage(state.page + 1));
  dom.btnLastPage?.addEventListener('click', () => goToPage(state.totalPages));
  /*
   * Delegação no document:
   * continua funcionando mesmo se a tabela/tbody for recriada por outro
   * componente ou substituída durante a renderização.
   */
  document.addEventListener('click', (event) => {
    if (event.target.closest('button[data-action][data-id]')) {
      handleTableClick(event);
    }
  });
}

function init() {
  ensurePriceEditorModal();
  mapDom();
  bindEvents();
  bindPriceEditorModalKeyboard();
  resetForm();
  loadList();
}

document.readyState === 'loading'
  ? document.addEventListener('DOMContentLoaded', init, { once: true })
  : init();
