/* ╔══════════════════════════════════════════════════════════════════════╗
   ║ FILE: chartOfAccounts.js                                            ║
   ║ MODULE: Chart Of Accounts                                           ║
   ║ DESCRIPTION: Frontend logic for Chart Of Accounts page              ║
   ║ PRODNEX ERP · ESM                                                   ║
   ╚══════════════════════════════════════════════════════════════════════╝ */

'use strict';

import { actionIconsHtml } from '/public/includes/js/actionIcons.js';

const API_BASE = '/api/chart-of-accounts';

const state = {
  rows: [],
  loading: false,
  page: 1,
  limit: 50,
  total: 0,
  pages: 1,
  autoLimit: false,
  filters: {
    search: '',
    account_type: '',
    nature: '',
    allows_posting: '',
    is_active: '',
  },
};

const els = {
  searchInput: document.getElementById('searchInput'),
  filterType: document.getElementById('filterType'),
  filterNature: document.getElementById('filterNature'),
  filterPosting: document.getElementById('filterPosting'),
  filterActive: document.getElementById('filterActive'),

  btnReload: document.getElementById('btnReload'),
  btnNewAccount: document.getElementById('btnNewAccount'),
  btnFirstPage: document.getElementById('btnFirstPage'),
  btnPrevPage: document.getElementById('btnPreviousPage'),
  btnNextPage: document.getElementById('btnNextPage'),
  btnLastPage: document.getElementById('btnLastPage'),

  accountsTableBody: document.getElementById('accountsTableBody'),
  paginationInfo: document.getElementById('coaTableInfo'),
  pageInfo: document.getElementById('coaPageInfo'),
  rowsPerPage: document.getElementById('coaRowsPerPage'),
  paginationNumbers: document.getElementById('paginationNumbers'),
  gridScrollArea: document.getElementById('gridScrollArea'),
};

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function debounce(fn, wait = 350) {
  let timer = null;
  return (...args) => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => fn(...args), wait);
  };
}

function showToast(message, type = 'info') {
  if (typeof window.showToast === 'function') {
    window.showToast(message, type);
    return;
  }
  if (typeof window.toast === 'function') {
    window.toast(message, type);
    return;
  }
  console.log(`[${type}] ${message}`);
}

function confirmAction(message) {
  return window.confirm(message);
}

async function fetchJson(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    const error = new Error(data?.message || `HTTP_${res.status}`);
    error.status = res.status;
    error.payload = data;
    throw error;
  }

  return data;
}

function calculateDynamicLimit() {
  const wrap = els.gridScrollArea;
  if (!wrap) return 20;

  const headerHeight = 38;
  const rowHeight = 34;
  const availableHeight = wrap.clientHeight || 0;

  if (!availableHeight) return 20;

  const visibleRows = Math.floor((availableHeight - headerHeight) / rowHeight);
  return Math.max(Math.min(visibleRows + 2, 100), 10);
}

function syncDynamicLimit() {
  if (!state.autoLimit) return false;
  const nextLimit = calculateDynamicLimit();
  if (nextLimit !== state.limit) {
    state.limit = nextLimit;
    return true;
  }
  return false;
}

function getQueryParams() {
  const params = new URLSearchParams();

  params.set('page', String(state.page));
  params.set('limit', String(state.limit));
  params.set('sort_by', 'code');
  params.set('sort_order', 'asc');

  if (state.filters.search) params.set('search', state.filters.search);
  if (state.filters.account_type) params.set('account_type', state.filters.account_type);
  if (state.filters.nature) params.set('nature', state.filters.nature);
  if (state.filters.allows_posting !== '') params.set('allows_posting', state.filters.allows_posting);
  if (state.filters.is_active !== '') params.set('is_active', state.filters.is_active);

  return params.toString();
}

function getTypeLabel(type) {
  switch (String(type || '').toUpperCase()) {
    case 'ASSET': return 'Ativo';
    case 'LIABILITY': return 'Passivo';
    case 'EQUITY': return 'Patrimônio';
    case 'REVENUE': return 'Receita';
    case 'EXPENSE': return 'Despesa';
    default: return type || '-';
  }
}

function getNatureLabel(nature) {
  switch (String(nature || '').toUpperCase()) {
    case 'DEBIT': return 'Débito';
    case 'CREDIT': return 'Crédito';
    default: return nature || '-';
  }
}

function getTypeBadgeClass(type) {
  switch (String(type || '').toUpperCase()) {
    case 'ASSET': return 'coa-badge--asset';
    case 'LIABILITY': return 'coa-badge--liability';
    case 'EQUITY': return 'coa-badge--equity';
    case 'REVENUE': return 'coa-badge--revenue';
    case 'EXPENSE': return 'coa-badge--expense';
    default: return '';
  }
}

function getNatureBadgeClass(nature) {
  switch (String(nature || '').toUpperCase()) {
    case 'DEBIT': return 'coa-badge--debit';
    case 'CREDIT': return 'coa-badge--credit';
    default: return '';
  }
}

function renderLoadingRow(message = 'Carregando contas...') {
  if (!els.accountsTableBody) return;
  els.accountsTableBody.innerHTML = `
    <tr class="row-loading">
      <td colspan="9">${escapeHtml(message)}</td>
    </tr>
  `;
}

function renderEmptyRow(message = 'Nenhuma conta encontrada.') {
  if (!els.accountsTableBody) return;
  els.accountsTableBody.innerHTML = `
    <tr class="row-empty">
      <td colspan="9">${escapeHtml(message)}</td>
    </tr>
  `;
}

function buildIndent(level) {
  const safeLevel = Math.max(Number(level) || 1, 1);
  const px = Math.max((safeLevel - 1) * 16, 0);
  return `<span class="coa-indent" style="width:${px}px;"></span>`;
}

function renderRows(rows) {
  if (!els.accountsTableBody) return;

  if (!Array.isArray(rows) || rows.length === 0) {
    renderEmptyRow();
    return;
  }

  els.accountsTableBody.innerHTML = rows.map((row) => {
    const isActive = Boolean(row.is_active);
    const isPosting = Boolean(row.allows_posting);
    const parentLabel = row.parent_code
      ? `${escapeHtml(row.parent_code)} - ${escapeHtml(row.parent_description || '')}`
      : '<span class="coa-muted">—</span>';

    return `
      <tr class="${isActive ? '' : 'is-inactive'}" data-id="${row.id}">
        <td>
          <span class="coa-code">${escapeHtml(row.code)}</span>
        </td>

        <td>
          <div class="coa-description" title="${escapeHtml(row.description || '')}">
            ${buildIndent(row.level)}
            <span class="coa-level-indicator">L${Number(row.level) || 1}</span>
            <span class="coa-description-text">${escapeHtml(row.description)}</span>
          </div>
        </td>

        <td>
          <span class="coa-badge ${getTypeBadgeClass(row.account_type)}">
            ${escapeHtml(getTypeLabel(row.account_type))}
          </span>
        </td>

        <td>
          <span class="coa-badge ${getNatureBadgeClass(row.nature)}">
            ${escapeHtml(getNatureLabel(row.nature))}
          </span>
        </td>

        <td>${escapeHtml(row.level)}</td>

        <td>
          <span class="coa-parent">${parentLabel}</span>
        </td>

        <td>
          <span class="coa-badge ${isPosting ? 'coa-badge--posting' : 'coa-badge--group'}">
            ${isPosting ? 'Lançamento' : 'Grupo'}
          </span>
        </td>

        <td>
          <span class="coa-badge ${isActive ? 'coa-badge--active' : 'coa-badge--inactive'}">
            ${isActive ? 'Ativo' : 'Inativo'}
          </span>
        </td>

        <td>
          ${actionIconsHtml([
            { action: 'edit', title: 'Editar', attrs: { 'data-action': 'edit', 'data-id': row.id } },
            {
              action: isActive ? 'pause' : 'play',
              title: isActive ? 'Inativar' : 'Ativar',
              attrs: { 'data-action': 'toggle', 'data-id': row.id, 'data-active': isActive ? 'true' : 'false' },
            },
            { action: 'delete', title: 'Excluir', attrs: { 'data-action': 'delete', 'data-id': row.id } },
          ])}
        </td>
      </tr>
    `;
  }).join('');
}

function buildPageList(currentPage, totalPages) {
  const pages = [];
  const maxVisible = 5;

  if (totalPages <= maxVisible + 2) {
    for (let page = 1; page <= totalPages; page += 1) {
      pages.push(page);
    }
    return pages;
  }

  pages.push(1);

  let start = Math.max(currentPage - 1, 2);
  let end = Math.min(currentPage + 1, totalPages - 1);

  if (currentPage <= 3) {
    start = 2;
    end = 4;
  }

  if (currentPage >= totalPages - 2) {
    start = totalPages - 3;
    end = totalPages - 1;
  }

  if (start > 2) pages.push('ellipsis-left');

  for (let page = start; page <= end; page += 1) {
    pages.push(page);
  }

  if (end < totalPages - 1) pages.push('ellipsis-right');

  pages.push(totalPages);

  return pages;
}

function renderPaginationNumbers() {
  if (!els.paginationNumbers) return;

  const totalPages = Math.max(Number(state.pages) || 1, 1);
  const currentPage = Math.min(Math.max(Number(state.page) || 1, 1), totalPages);
  const pageItems = buildPageList(currentPage, totalPages);

  els.paginationNumbers.innerHTML = pageItems.map((item) => {
    if (String(item).startsWith('ellipsis')) {
      return `<span class="coa-page-ellipsis">…</span>`;
    }

    const page = Number(item);
    const isActive = page === currentPage;

    return `
      <button
        type="button"
        class="coa-page-btn ${isActive ? 'is-active' : ''}"
        data-page="${page}"
        aria-label="Ir para página ${page}"
        aria-current="${isActive ? 'page' : 'false'}"
      >
        ${page}
      </button>
    `;
  }).join('');
}

function updatePagination() {
  const total = Number(state.total) || 0;
  const pages = Math.max(Number(state.pages) || 1, 1);
  const page = Math.min(Math.max(Number(state.page) || 1, 1), pages);

  if (els.paginationInfo) {
    els.paginationInfo.textContent = `${total} ${total === 1 ? 'Registro' : 'Registros'}`;
  }

  if (els.pageInfo) {
    els.pageInfo.textContent = `Página ${page} de ${pages}`;
  }

  if (els.btnFirstPage) {
    els.btnFirstPage.disabled = page <= 1 || state.loading;
  }

  if (els.btnPrevPage) {
    els.btnPrevPage.disabled = page <= 1 || state.loading;
  }

  if (els.btnNextPage) {
    els.btnNextPage.disabled = page >= pages || state.loading;
  }

  if (els.btnLastPage) {
    els.btnLastPage.disabled = page >= pages || state.loading;
  }

  renderPaginationNumbers();
}

async function loadAccounts({ preserveScroll = false } = {}) {
  if (state.loading) return;
  state.loading = true;

  const prevScrollTop = els.gridScrollArea?.scrollTop || 0;

  renderLoadingRow();
  updatePagination();

  try {
    const query = getQueryParams();
    const response = await fetchJson(`${API_BASE}?${query}`);

    state.rows = Array.isArray(response.data) ? response.data : [];
    state.total = Number(response?.pagination?.total) || 0;
    state.pages = Math.max(Number(response?.pagination?.pages) || 1, 1);
    state.page = Math.max(Number(response?.pagination?.page) || 1, 1);

    renderRows(state.rows);
    updatePagination();

    if (els.gridScrollArea) {
      els.gridScrollArea.scrollTop = preserveScroll ? prevScrollTop : 0;
    }
  } catch (error) {
    console.error('[chartOfAccounts] loadAccounts error:', error);
    renderEmptyRow(error.message || 'Falha ao carregar contas.');
    showToast(error.message || 'Falha ao carregar contas', 'error');
  } finally {
    state.loading = false;
    updatePagination();
  }
}

function goToPage(page) {
  const targetPage = Number(page);
  if (!Number.isInteger(targetPage)) return;
  if (targetPage < 1 || targetPage > state.pages) return;
  if (targetPage === state.page) return;
  if (state.loading) return;

  state.page = targetPage;
  loadAccounts();
}

function resetToFirstPageAndReload() {
  state.page = 1;
  loadAccounts();
}

function syncFiltersFromDom() {
  state.filters.search = els.searchInput?.value?.trim() || '';
  state.filters.account_type = els.filterType?.value || '';
  state.filters.nature = els.filterNature?.value || '';
  state.filters.allows_posting = els.filterPosting?.value ?? '';
  state.filters.is_active = els.filterActive?.value ?? '';
}

async function handleDelete(id) {
  const ok = confirmAction(
    'Deseja realmente excluir esta conta?\n\nSe exclusão física não estiver habilitada no backend, a conta poderá apenas ser inativada.'
  );
  if (!ok) return;

  try {
    await fetchJson(`${API_BASE}/${id}`, {
      method: 'DELETE',
    });

    showToast('Conta removida com sucesso.', 'success');
    loadAccounts();
  } catch (error) {
    console.error('[chartOfAccounts] delete error:', error);
    showToast(error.message || 'Falha ao excluir conta', 'error');
  }
}

async function handleToggle(id, currentlyActive) {
  const nextActive = !currentlyActive;
  const actionLabel = nextActive ? 'ativar' : 'inativar';

  const ok = confirmAction(`Deseja ${actionLabel} esta conta?`);
  if (!ok) return;

  try {
    await fetchJson(`${API_BASE}/${id}/active`, {
      method: 'PATCH',
      body: JSON.stringify({
        is_active: nextActive,
      }),
    });

    showToast(`Conta ${nextActive ? 'ativada' : 'inativada'} com sucesso.`, 'success');
    loadAccounts();
  } catch (error) {
    console.error('[chartOfAccounts] toggle error:', error);
    showToast(error.message || 'Falha ao atualizar status da conta', 'error');
  }
}

function handleEdit(id) {
  if (typeof window.openChartOfAccountsModal === 'function') {
    window.openChartOfAccountsModal({ id, mode: 'edit' });
    return;
  }

  showToast('Modal de edição ainda não conectado.', 'info');
}

function handleNewAccount() {
  if (typeof window.openChartOfAccountsModal === 'function') {
    window.openChartOfAccountsModal({ mode: 'create' });
    return;
  }

  showToast('Modal de Nova Conta ainda não conectado.', 'info');
}

function bindToolbar() {
  els.btnReload?.addEventListener('click', () => {
    loadAccounts();
  });

  els.btnNewAccount?.addEventListener('click', () => {
    handleNewAccount();
  });

  els.btnFirstPage?.addEventListener('click', () => {
    goToPage(1);
  });

  els.btnPrevPage?.addEventListener('click', () => {
    if (state.page <= 1 || state.loading) return;
    goToPage(state.page - 1);
  });

  els.btnNextPage?.addEventListener('click', () => {
    if (state.page >= state.pages || state.loading) return;
    goToPage(state.page + 1);
  });

  els.btnLastPage?.addEventListener('click', () => {
    goToPage(state.pages);
  });

  els.rowsPerPage?.addEventListener('change', () => {
    state.limit = Number(els.rowsPerPage.value) || 50;
    resetToFirstPageAndReload();
  });

  els.paginationNumbers?.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-page]');
    if (!button) return;

    const page = Number(button.dataset.page);
    goToPage(page);
  });
}

function bindFilters() {
  const onSearch = debounce(() => {
    syncFiltersFromDom();
    resetToFirstPageAndReload();
  }, 350);

  els.searchInput?.addEventListener('input', onSearch);

  els.filterType?.addEventListener('change', () => {
    syncFiltersFromDom();
    resetToFirstPageAndReload();
  });

  els.filterNature?.addEventListener('change', () => {
    syncFiltersFromDom();
    resetToFirstPageAndReload();
  });

  els.filterPosting?.addEventListener('change', () => {
    syncFiltersFromDom();
    resetToFirstPageAndReload();
  });

  els.filterActive?.addEventListener('change', () => {
    syncFiltersFromDom();
    resetToFirstPageAndReload();
  });
}

function bindTableActions() {
  els.accountsTableBody?.addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;

    const action = button.dataset.action;
    const id = Number(button.dataset.id);

    if (!Number.isInteger(id) || id <= 0) return;

    if (action === 'edit') {
      handleEdit(id);
      return;
    }

    if (action === 'toggle') {
      const currentlyActive = String(button.dataset.active) === 'true';
      await handleToggle(id, currentlyActive);
      return;
    }

    if (action === 'delete') {
      await handleDelete(id);
    }
  });
}

function bindResizeAutoLimit() {
  const onResize = debounce(() => {
    const changed = syncDynamicLimit();
    if (changed) {
      state.page = 1;
      loadAccounts({ preserveScroll: false });
    }
  }, 150);

  window.addEventListener('resize', onResize);
}

function init() {
  window.chartOfAccountsReload = () => loadAccounts({ preserveScroll: true });

  state.limit = Number(els.rowsPerPage?.value) || state.limit;
  syncDynamicLimit();
  bindToolbar();
  bindFilters();
  bindTableActions();
  bindResizeAutoLimit();
  syncFiltersFromDom();
  loadAccounts();
}

document.addEventListener('DOMContentLoaded', init);