/* ╔══════════════════════════════════════════════════════════════════╗
   ║ prices.js — Cadastro de Tabelas de Preço | PRODNEX ERP         ║
   ║ Caminho sugerido: backend/app/prices/prices.js                 ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

const API_BASE = '/api/price-tables';

const state = {
  loading: false,
  page: 1,
  limit: 25,
  total: 0,
  totalPages: 1,
  q: '',
  status: 'all', // all | active | inactive
  sort: 'name',
  dir: 'asc',
  rows: [],
  editingId: null,
};

const dom = {};

document.addEventListener('DOMContentLoaded', init);

function init() {
  mapDom();
  bindEvents();
  resetForm();
  loadList();
}

function mapDom() {
  dom.searchInput = document.getElementById('searchInput');
  dom.filterStatus = document.getElementById('filterStatus');
  dom.sortField = document.getElementById('sortField');
  dom.sortDir = document.getElementById('sortDir');
  dom.pageSize = document.getElementById('pageSize');
  dom.btnPesquisar = document.getElementById('btnPesquisar');
  dom.btnLimpar = document.getElementById('btnLimpar');
  dom.btnNovo = document.getElementById('btnNovo');

  dom.priceForm = document.getElementById('priceForm');
  dom.priceId = document.getElementById('priceId');
  dom.priceName = document.getElementById('priceName');
  dom.priceDescription = document.getElementById('priceDescription');
  dom.priceActive = document.getElementById('priceActive');
  dom.createdAt = document.getElementById('createdAt');
  dom.updatedAt = document.getElementById('updatedAt');
  dom.btnSalvar = document.getElementById('btnSalvar');
  dom.btnCancelarEdicao = document.getElementById('btnCancelarEdicao');
  dom.formTitle = document.getElementById('formTitle');
  dom.formSubtitle = document.getElementById('formSubtitle');
  dom.formModeBadge = document.getElementById('formModeBadge');

  dom.tableBody = document.getElementById('tableBody');
  dom.listInfo = document.getElementById('listInfo');
  dom.paginationInfo = document.getElementById('paginationInfo');
  dom.btnFirstPage = document.getElementById('btnFirstPage');
  dom.btnPrevPage = document.getElementById('btnPrevPage');
  dom.btnNextPage = document.getElementById('btnNextPage');
  dom.btnLastPage = document.getElementById('btnLastPage');

  dom.toast = document.getElementById('toast');
}

function bindEvents() {
  dom.btnPesquisar.addEventListener('click', () => {
    syncFiltersFromDom();
    state.page = 1;
    loadList();
  });

  dom.btnLimpar.addEventListener('click', () => {
    clearFilters();
    loadList();
  });

  dom.btnNovo.addEventListener('click', () => {
    resetForm();
    scrollToForm();
  });

  dom.pageSize.addEventListener('change', () => {
    syncFiltersFromDom();
    state.page = 1;
    loadList();
  });

  dom.sortField.addEventListener('change', () => {
    syncFiltersFromDom();
    state.page = 1;
    loadList();
  });

  dom.sortDir.addEventListener('change', () => {
    syncFiltersFromDom();
    state.page = 1;
    loadList();
  });

  dom.filterStatus.addEventListener('change', () => {
    syncFiltersFromDom();
    state.page = 1;
    loadList();
  });

  dom.searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      syncFiltersFromDom();
      state.page = 1;
      loadList();
    }
  });

  dom.priceForm.addEventListener('submit', handleSubmit);
  dom.btnCancelarEdicao.addEventListener('click', resetForm);

  dom.btnFirstPage.addEventListener('click', () => goToPage(1));
  dom.btnPrevPage.addEventListener('click', () => goToPage(state.page - 1));
  dom.btnNextPage.addEventListener('click', () => goToPage(state.page + 1));
  dom.btnLastPage.addEventListener('click', () => goToPage(state.totalPages));

  dom.tableBody.addEventListener('click', handleTableClick);
}

function syncFiltersFromDom() {
  state.q = String(dom.searchInput.value || '').trim();
  state.status = dom.filterStatus.value || 'all';
  state.sort = dom.sortField.value || 'name';
  state.dir = dom.sortDir.value || 'asc';
  state.limit = Number(dom.pageSize.value || 25);
}

function clearFilters() {
  dom.searchInput.value = '';
  dom.filterStatus.value = 'all';
  dom.sortField.value = 'name';
  dom.sortDir.value = 'asc';
  dom.pageSize.value = '25';

  state.q = '';
  state.status = 'all';
  state.sort = 'name';
  state.dir = 'asc';
  state.limit = 25;
  state.page = 1;
}

function goToPage(page) {
  const safePage = Math.max(1, Math.min(Number(page) || 1, state.totalPages || 1));
  if (safePage === state.page) return;
  state.page = safePage;
  loadList();
}

async function loadList() {
  try {
    syncFiltersFromDom();
    setLoading(true);
    renderTableLoading();

    const params = new URLSearchParams();
    params.set('page', String(state.page));
    params.set('limit', String(state.limit));
    params.set('sort', state.sort);
    params.set('dir', state.dir);

    if (state.q) params.set('q', state.q);

    if (state.status === 'active') {
      params.set('active', 'true');
    } else if (state.status === 'inactive') {
      // A API atual não filtra inativos diretamente.
      // Então buscamos todos e filtramos no front após carregar.
    }

    const response = await fetchJson(`${API_BASE}?${params.toString()}`);

    const payload = response?.data || {};
    let rows = Array.isArray(payload.rows) ? payload.rows : [];
    let total = Number(payload.total || 0);

    if (state.status === 'inactive') {
      rows = rows.filter((row) => !row.active);
      total = rows.length;
    }

    state.rows = rows;
    state.total = total;
    state.totalPages = Math.max(1, Math.ceil((state.total || 0) / state.limit));

    if (state.page > state.totalPages) {
      state.page = state.totalPages;
      return loadList();
    }

    renderTable();
    renderPagination();
  } catch (err) {
    console.error('[prices.loadList] ERR:', err);
    renderTableError(err.message || 'Falha ao carregar registros.');
    updateListInfo('Falha ao carregar tabelas de preço.');
    showToast(err.message || 'Erro ao carregar tabelas de preço.', 'error');
  } finally {
    setLoading(false);
  }
}

function renderTableLoading() {
  dom.tableBody.innerHTML = `
    <tr>
      <td colspan="7" class="table-empty">Carregando tabelas de preço...</td>
    </tr>
  `;
}

function renderTableError(message) {
  dom.tableBody.innerHTML = `
    <tr>
      <td colspan="7" class="table-empty">${escapeHtml(message)}</td>
    </tr>
  `;
}

function renderTable() {
  if (!state.rows.length) {
    dom.tableBody.innerHTML = `
      <tr>
        <td colspan="7" class="table-empty">Nenhuma tabela de preço encontrada.</td>
      </tr>
    `;
    updateListInfo('Nenhum registro encontrado.');
    return;
  }

  dom.tableBody.innerHTML = state.rows.map((row) => {
    const isActive = !!row.active;

    return `
      <tr>
        <td>${escapeHtml(String(row.price_id ?? ''))}</td>
        <td><strong>${escapeHtml(row.name || '')}</strong></td>
        <td class="cell-description">${escapeHtml(row.description || '') || '<span class="muted">—</span>'}</td>
        <td>
          <span class="status-chip ${isActive ? 'active' : 'inactive'}">
            ${isActive ? 'ATIVA' : 'INATIVA'}
          </span>
        </td>
        <td>${formatDateTime(row.created_at)}</td>
        <td>${formatDateTime(row.updated_at)}</td>
        <td>
          <div class="row-actions">
            <button class="btn btn-light btn-sm" type="button" data-action="edit" data-id="${row.price_id}">
              Editar
            </button>
            ${
              isActive
                ? `<button class="btn btn-warning btn-sm" type="button" data-action="delete" data-id="${row.price_id}">
                     Inativar
                   </button>`
                : `<button class="btn btn-success btn-sm" type="button" data-action="restore" data-id="${row.price_id}">
                     Restaurar
                   </button>`
            }
          </div>
        </td>
      </tr>
    `;
  }).join('');

  const start = state.total === 0 ? 0 : ((state.page - 1) * state.limit) + 1;
  const end = Math.min(state.page * state.limit, state.total);
  updateListInfo(`Exibindo ${start} até ${end} de ${state.total} registro(s).`);
}

function renderPagination() {
  dom.paginationInfo.textContent = `Página ${state.page} de ${state.totalPages}`;

  dom.btnFirstPage.disabled = state.page <= 1 || state.loading;
  dom.btnPrevPage.disabled = state.page <= 1 || state.loading;
  dom.btnNextPage.disabled = state.page >= state.totalPages || state.loading;
  dom.btnLastPage.disabled = state.page >= state.totalPages || state.loading;
}

function updateListInfo(text) {
  dom.listInfo.textContent = text;
}

function setLoading(isLoading) {
  state.loading = !!isLoading;
  dom.btnPesquisar.disabled = state.loading;
  dom.btnLimpar.disabled = state.loading;
  dom.btnNovo.disabled = state.loading;
  dom.btnSalvar.disabled = state.loading;
  renderPagination();
}

async function handleSubmit(event) {
  event.preventDefault();

  try {
    const payload = getFormPayload();

    if (!payload.name) {
      showToast('Informe o nome da tabela de preço.', 'error');
      dom.priceName.focus();
      return;
    }

    setLoading(true);

    if (state.editingId) {
      await fetchJson(`${API_BASE}/${state.editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      showToast('Tabela de preço atualizada com sucesso.', 'success');
    } else {
      await fetchJson(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      showToast('Tabela de preço criada com sucesso.', 'success');
    }

    resetForm();
    await loadList();
  } catch (err) {
    console.error('[prices.handleSubmit] ERR:', err);
    showToast(err.message || 'Falha ao salvar tabela.', 'error');
  } finally {
    setLoading(false);
  }
}

function getFormPayload() {
  return {
    name: String(dom.priceName.value || '').trim(),
    description: normalizeNullableText(dom.priceDescription.value),
    active: !!dom.priceActive.checked,
  };
}

async function handleTableClick(event) {
  const button = event.target.closest('button[data-action][data-id]');
  if (!button) return;

  const action = button.dataset.action;
  const id = Number(button.dataset.id);

  if (!Number.isFinite(id) || id <= 0) return;

  if (action === 'edit') {
    await loadOne(id);
    return;
  }

  if (action === 'delete') {
    const ok = window.confirm('Deseja realmente inativar esta tabela de preço?');
    if (!ok) return;
    await softDeleteOne(id);
    return;
  }

  if (action === 'restore') {
    const ok = window.confirm('Deseja restaurar esta tabela de preço?');
    if (!ok) return;
    await restoreOne(id);
  }
}

async function loadOne(id) {
  try {
    setLoading(true);

    const response = await fetchJson(`${API_BASE}/${id}`);
    const row = response?.data;

    if (!row) {
      showToast('Tabela de preço não encontrada.', 'error');
      return;
    }

    state.editingId = Number(row.price_id);
    dom.priceId.value = String(row.price_id ?? '');
    dom.priceName.value = row.name || '';
    dom.priceDescription.value = row.description || '';
    dom.priceActive.checked = !!row.active;
    dom.createdAt.value = formatDateTime(row.created_at);
    dom.updatedAt.value = formatDateTime(row.updated_at);

    dom.formTitle.textContent = `Editando Tabela #${row.price_id}`;
    dom.formSubtitle.textContent = 'Revise os dados abaixo e salve as alterações.';
    dom.formModeBadge.textContent = 'EDIÇÃO';
    dom.formModeBadge.className = 'badge badge-neutral';

    scrollToForm();
  } catch (err) {
    console.error('[prices.loadOne] ERR:', err);
    showToast(err.message || 'Falha ao carregar tabela.', 'error');
  } finally {
    setLoading(false);
  }
}

async function softDeleteOne(id) {
  try {
    setLoading(true);

    await fetchJson(`${API_BASE}/${id}`, { method: 'DELETE' });

    if (state.editingId === id) {
      resetForm();
    }

    showToast('Tabela de preço inativada com sucesso.', 'success');
    await loadList();
  } catch (err) {
    console.error('[prices.softDeleteOne] ERR:', err);
    showToast(err.message || 'Falha ao inativar tabela.', 'error');
  } finally {
    setLoading(false);
  }
}

async function restoreOne(id) {
  try {
    setLoading(true);

    await fetchJson(`${API_BASE}/${id}/restore`, { method: 'POST' });

    showToast('Tabela de preço restaurada com sucesso.', 'success');
    await loadList();
  } catch (err) {
    console.error('[prices.restoreOne] ERR:', err);
    showToast(err.message || 'Falha ao restaurar tabela.', 'error');
  } finally {
    setLoading(false);
  }
}

function resetForm() {
  state.editingId = null;

  dom.priceForm.reset();
  dom.priceId.value = '';
  dom.priceActive.checked = true;
  dom.createdAt.value = '';
  dom.updatedAt.value = '';

  dom.formTitle.textContent = 'Nova Tabela de Preço';
  dom.formSubtitle.textContent = 'Preencha os campos abaixo para cadastrar uma nova tabela.';
  dom.formModeBadge.textContent = 'NOVO';
  dom.formModeBadge.className = 'badge badge-neutral';
}

function scrollToForm() {
  document.querySelector('.panel-form')?.scrollIntoView({
    behavior: 'smooth',
    block: 'start',
  });
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    credentials: 'same-origin',
    ...options,
  });

  let payload = null;

  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok || payload?.ok === false) {
    throw new Error(
      payload?.message ||
      payload?.detail ||
      `Erro HTTP ${response.status}`
    );
  }

  return payload;
}

function formatDateTime(value) {
  if (!value) return '—';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

function normalizeNullableText(value) {
  const txt = String(value || '').trim();
  return txt ? txt : null;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

let toastTimer = null;
function showToast(message, type = 'info') {
  if (!dom.toast) return;

  dom.toast.textContent = message || '';
  dom.toast.className = `toast ${type}`;
  dom.toast.hidden = false;

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    dom.toast.hidden = true;
  }, 3200);
}