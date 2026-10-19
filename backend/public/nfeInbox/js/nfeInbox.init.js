/* ╔══════════════════════════════════════════════════════════════════╗
 * ║ nfeInbox.init.js — Inicialização | PRODNEX ERP (ESM)            ║
 * ╚══════════════════════════════════════════════════════════════════╝ */
'use strict';

import { createActions } from './nfeInbox.actions.js';
import { SEARCH_DEBOUNCE_MS, SYNC_STATUS_POLL_MS } from './nfeInbox.config.js';
import { clearFilters } from './nfeInbox.form.js';
import { createModalManager, notify } from './nfeInbox.modal.js';
import { setSelected, updatePagination } from './nfeInbox.render.js';
import { createSortableTable } from '/public/includes/js/sortableTable.js';
import { getDom, SORTABLE_COLUMNS, state } from './nfeInbox.state.js';
import { debounce } from './nfeInbox.utils.js';

function init() {
  const dom = getDom();
  const modals = createModalManager(dom);
  const actions = createActions(dom, state, modals);
  const reloadFirstPage = () => {
    state.currentPage = 1;
    return actions.loadInbox();
  };

  if (dom.$table) {
    createSortableTable({
      table: dom.$table,
      defaultColumn: state.sortColumn,
      defaultDirection: state.sortDirection,
      allowedColumns: SORTABLE_COLUMNS,
      // A listagem é paginada no backend, então a ordenação também é:
      // trocar de coluna recarrega a partir da primeira página.
      onSort: ({ column, direction }) => {
        state.sortColumn = column;
        state.sortDirection = direction;
        return reloadFirstPage();
      },
      onError: (sortError) => {
        console.error('[nfeInbox] sort:', sortError);
        notify('Não foi possível ordenar por esta coluna.', 'error');
      },
    });
  }

  dom.$form?.addEventListener('submit', (event) => {
    event.preventDefault();
    reloadFirstPage();
  });

  // Aplicar um intervalo no componente já recarrega a listagem
  dom.$periodo?.addEventListener('range-change', reloadFirstPage);

  dom.$btnClearFilters?.addEventListener('click', () => {
    clearFilters(dom);
    reloadFirstPage();
  });

  dom.$pageSize?.addEventListener('change', () => {
    state.pageSize = Number(dom.$pageSize.value) || 50;
    reloadFirstPage();
  });

  dom.$prevPage?.addEventListener('click', () => {
    if (state.loading || state.currentPage <= 1) return;

    state.currentPage -= 1;
    actions.loadInbox();
  });

  dom.$nextPage?.addEventListener('click', () => {
    if (
      state.loading ||
      state.currentPage >= state.totalPages
    ) {
      return;
    }

    state.currentPage += 1;
    actions.loadInbox();
  });

  // Enter busca na hora e cancela o disparo pendente do debounce; sem o
  // cancel, a mesma busca sairia duas vezes (Enter + ~350ms depois).
  const debouncedSearch = debounce(reloadFirstPage, SEARCH_DEBOUNCE_MS);
  dom.$q?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      debouncedSearch.cancel();
      reloadFirstPage();
    }
  });
  dom.$q?.addEventListener('input', debouncedSearch);

  dom.$btnImportXml?.addEventListener('click', () => dom.$fileInput?.click());
  dom.$btnSyncDfe?.addEventListener('click', actions.syncDfe);
  dom.$fileInput?.addEventListener('change', actions.importXml);
  dom.$btnDownloadXml?.addEventListener('click', actions.downloadXmlSelected);
  dom.$btnDownloadPdf?.addEventListener('click', actions.downloadPdfSelected);
  dom.$btnManifest?.addEventListener('click', actions.manifestSelected);
  dom.$btnDownloadXmlLote?.addEventListener('click', actions.downloadXmlBatch);
  dom.$btnEntradaNF?.addEventListener('click', actions.openEntry);
  dom.$entryConfirm?.addEventListener('click', actions.confirmEntry);

  dom.$modalClose?.addEventListener('click', modals.closeDetail);
  dom.$modalBackdrop?.addEventListener('click', modals.closeDetail);
  dom.$entryClose?.addEventListener('click', modals.closeEntry);
  dom.$entryCancel?.addEventListener('click', modals.closeEntry);
  dom.$entryBackdrop?.addEventListener('click', (event) => {
    if (event.target === dom.$entryBackdrop || event.target === dom.$entryBackdrop?.parentElement) {
      modals.closeEntry();
    }
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') modals.closeAll();
  });

  // Data/hora da última sincronização DF-e, atualizada periodicamente.
  actions.refreshSyncStatus();
  const syncTimer = setInterval(actions.refreshSyncStatus, SYNC_STATUS_POLL_MS);
  window.addEventListener('beforeunload', () => clearInterval(syncTimer));

  setSelected(dom, state, null);
  updatePagination(dom, state);
  actions.loadInbox().catch((error) => {
    console.error('[nfeInbox] init:', error);
    notify('Falha ao iniciar a caixa de entrada de NF-e.', 'error');
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
