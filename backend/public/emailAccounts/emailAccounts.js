// ╔══════════════════════════════════════════════════════════════════════╗
// ║ emailAccounts.js — Contas de E-mail | PRODNEX ERP                   ║
// ║ Tela principal da grade + integração com modal                      ║
// ║ ✔ Listagem com filtros                                              ║
// ║ ✔ Ordenação local                                                   ║
// ║ ✔ Seleção de linha                                                  ║
// ║ ✔ Duplo clique para editar                                          ║
// ║ ✔ Modal separado para CREATE / EDIT                                 ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { createEmailAccountsModal } from '/public/emailAccounts/emailAccountsModal.js';

/* ============================================================================
 * CONFIG
 * ========================================================================== */
const API_BASE = '/api/email/accounts';

/* ============================================================================
 * STATE
 * ========================================================================== */
const state = {
  rows: [],
  loading: false,
  filters: {
    search: '',
    status: 'active',
    limit: 50,
    offset: 0,
  },
  sort: {
    field: 'id',
    direction: 'asc',
  },
  selectedRowId: null,
};

/* ============================================================================
 * DOM
 * ========================================================================== */
const dom = {
  feedbackBox: document.getElementById('feedbackBox'),
  accountsTable: document.getElementById('accountsTable'),
  accountsTableBody: document.getElementById('accountsTableBody'),
  accountsCount: document.getElementById('accountsCount'),
  selectedRowInfo: document.getElementById('selectedRowInfo'),

  btnNovo: document.getElementById('btnNovo'),
  btnRecarregar: document.getElementById('btnRecarregar'),
  btnAplicarFiltros: document.getElementById('btnAplicarFiltros'),

  filtroBusca: document.getElementById('filtroBusca'),
  filtroAtivos: document.getElementById('filtroAtivos'),
  filtroLimite: document.getElementById('filtroLimite'),
};

let emailAccountsModal = null;

document.addEventListener('DOMContentLoaded', init);

/* ============================================================================
 * INIT
 * ========================================================================== */
async function init() {
  emailAccountsModal = createEmailAccountsModal({
    apiBase: API_BASE,
    onSaved: async () => {
      await loadAccounts();
      showFeedback('Lista atualizada com sucesso.', 'success');
    },
  });

  bindEvents();
  syncFiltersFromDom();
  await loadAccounts();
}

/* ============================================================================
 * EVENTS
 * ========================================================================== */
function bindEvents() {
  dom.btnNovo?.addEventListener('click', () => {
    clearFeedback();
    emailAccountsModal?.openCreate();
  });

  dom.btnRecarregar?.addEventListener('click', async () => {
    syncFiltersFromDom();
    await loadAccounts();
  });

  dom.btnAplicarFiltros?.addEventListener('click', async () => {
    state.filters.offset = 0;
    syncFiltersFromDom();
    await loadAccounts();
  });

  dom.filtroBusca?.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      state.filters.offset = 0;
      syncFiltersFromDom();
      await loadAccounts();
    }
  });

  dom.accountsTableBody?.addEventListener('click', async (e) => {
    const rowEl = e.target.closest('tr[data-id]');
    if (rowEl) {
      const rowId = Number(rowEl.dataset.id || 0);
      selectRow(rowId);
    }

    const btn = e.target.closest('button[data-action]');
    if (!btn) return;

    const action = btn.dataset.action;
    const id = Number(btn.dataset.id);
    if (!id) return;

    if (action === 'edit') {
      clearFeedback();
      await emailAccountsModal?.openEdit(id);
      return;
    }

    if (action === 'view') {
      await viewAccount(id);
      return;
    }

    if (action === 'deactivate') {
      await deactivateAccount(id);
    }
  });

  dom.accountsTableBody?.addEventListener('dblclick', async (e) => {
    const row = e.target.closest('tr[data-id]');
    if (!row) return;

    const id = Number(row.dataset.id || 0);
    if (!id) return;

    selectRow(id);
    clearFeedback();
    await emailAccountsModal?.openEdit(id);
  });

  dom.accountsTable?.querySelector('thead')?.addEventListener('click', (e) => {
    const th = e.target.closest('th.sortable[data-sort]');
    if (!th) return;

    const field = String(th.dataset.sort || '').trim();
    if (!field) return;

    toggleSort(field);
    renderTable(getSortedRows(state.rows));
  });
}

/* ============================================================================
 * API
 * ========================================================================== */
async function apiFetch(path, options = {}) {
  const res = await fetch(path, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  const contentType = res.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');

  let data = null;
  try {
    data = isJson ? await res.json() : await res.text();
  } catch {
    data = null;
  }

  if (!res.ok) {
    const message =
      (data && typeof data === 'object' && (data.message || data.error)) ||
      (typeof data === 'string' && data) ||
      `Erro HTTP ${res.status}`;
    throw new Error(message);
  }

  return data;
}

/* ============================================================================
 * HELPERS
 * ========================================================================== */
function syncFiltersFromDom() {
  state.filters.search = String(dom.filtroBusca?.value || '').trim();
  state.filters.status = String(dom.filtroAtivos?.value || 'active');
  state.filters.limit = toInt(dom.filtroLimite?.value, 50);
}

function toInt(value, fallback = null) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toBool(value, fallback = false) {
  if (value === true || value === 'true' || value === 1 || value === '1') return true;
  if (value === false || value === 'false' || value === 0 || value === '0') return false;
  return fallback;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function showFeedback(message, type = 'info') {
  if (!dom.feedbackBox) return;
  dom.feedbackBox.hidden = false;
  dom.feedbackBox.className = `feedback ${type}`;
  dom.feedbackBox.textContent = message;
}

function clearFeedback() {
  if (!dom.feedbackBox) return;
  dom.feedbackBox.hidden = true;
  dom.feedbackBox.className = 'feedback';
  dom.feedbackBox.textContent = '';
}

function buildQueryString() {
  const params = new URLSearchParams();

  if (state.filters.search) params.set('search', state.filters.search);
  if (state.filters.limit) params.set('limit', String(state.filters.limit));
  if (state.filters.offset) params.set('offset', String(state.filters.offset));

  params.set('onlyActive', state.filters.status === 'active' ? 'true' : 'false');

  return params.toString();
}

function extractRows(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.rows)) return payload.rows;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.accounts)) return payload.accounts;
  return [];
}

function extractOne(payload) {
  if (!payload || typeof payload !== 'object') return payload ?? null;

  // formatos mais comuns
  if (payload.row && typeof payload.row === 'object' && !Array.isArray(payload.row)) {
    return payload.row;
  }

  if (payload.item && typeof payload.item === 'object' && !Array.isArray(payload.item)) {
    return payload.item;
  }

  // data pode vir como objeto final
  if (payload.data && typeof payload.data === 'object' && !Array.isArray(payload.data)) {
    // casos aninhados: { data: { row: {...} } }
    if (payload.data.row && typeof payload.data.row === 'object' && !Array.isArray(payload.data.row)) {
      return payload.data.row;
    }

    if (payload.data.item && typeof payload.data.item === 'object' && !Array.isArray(payload.data.item)) {
      return payload.data.item;
    }

    if (payload.data.account && typeof payload.data.account === 'object' && !Array.isArray(payload.data.account)) {
      return payload.data.account;
    }

    return payload.data;
  }

  // outros nomes possíveis
  if (payload.account && typeof payload.account === 'object' && !Array.isArray(payload.account)) {
    return payload.account;
  }

  return payload;
}

function getSafeValue(value, fallback = '—') {
  const v = value == null || value === '' ? fallback : String(value);
  return escapeHtml(v);
}

function normalizeStringForSort(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function getUnreadValue(row) {
  const unread = row?.unread_count ?? row?.unread ?? row?.imap_unread ?? row?.unseen ?? 0;
  const n = Number(unread);
  return Number.isFinite(n) ? n : 0;
}

function getSortedRows(rows = []) {
  const cloned = [...rows];
  const { field, direction } = state.sort;
  const factor = direction === 'desc' ? -1 : 1;

  return cloned.sort((a, b) => {
    let va;
    let vb;

    if (field === 'unread') {
      va = getUnreadValue(a);
      vb = getUnreadValue(b);
    } else if (field === 'is_active') {
      va = toBool(a?.is_active, false) ? 1 : 0;
      vb = toBool(b?.is_active, false) ? 1 : 0;
    } else if (field === 'id') {
      va = toInt(a?.id, 0) || 0;
      vb = toInt(b?.id, 0) || 0;
    } else {
      va = normalizeStringForSort(a?.[field]);
      vb = normalizeStringForSort(b?.[field]);
    }

    if (typeof va === 'number' && typeof vb === 'number') {
      return (va - vb) * factor;
    }

    if (va < vb) return -1 * factor;
    if (va > vb) return 1 * factor;
    return 0;
  });
}

function toggleSort(field) {
  if (state.sort.field === field) {
    state.sort.direction = state.sort.direction === 'asc' ? 'desc' : 'asc';
  } else {
    state.sort.field = field;
    state.sort.direction = 'asc';
  }

  updateSortIndicators();
}

function updateSortIndicators() {
  document.querySelectorAll('th.sortable[data-sort]').forEach((th) => {
    th.classList.remove('sort-asc', 'sort-desc');
    const field = String(th.dataset.sort || '');
    if (field === state.sort.field) {
      th.classList.add(state.sort.direction === 'asc' ? 'sort-asc' : 'sort-desc');
    }
  });
}

function getStatusCell(isActive) {
  const active = !!isActive;
  return `
    <span class="status-cell">
      <span class="status-dot ${active ? 'active' : 'inactive'}"></span>
      <span>${active ? 'ATIVA' : 'INATIVA'}</span>
    </span>
  `;
}

function getUnreadCell(value) {
  const n = Number(value);
  const numeric = Number.isFinite(n) ? n : 0;
  return `<span class="unread-badge ${numeric <= 0 ? 'zero' : ''}">${numeric}</span>`;
}

function updateSelectedRowInfo() {
  if (!dom.selectedRowInfo) return;

  const id = Number(state.selectedRowId || 0);
  if (!id) {
    dom.selectedRowInfo.textContent = 'Nenhuma linha selecionada';
    return;
  }

  const row = state.rows.find((item) => Number(item?.id || 0) === id);
  if (!row) {
    dom.selectedRowInfo.textContent = 'Nenhuma linha selecionada';
    return;
  }

  const label = row.label || 'Sem rótulo';
  dom.selectedRowInfo.textContent = `Linha selecionada: #${id} • ${label}`;
}

function selectRow(id) {
  state.selectedRowId = Number(id || 0) || null;

  document.querySelectorAll('#accountsTableBody tr[data-id]').forEach((tr) => {
    tr.classList.toggle('is-selected', Number(tr.dataset.id || 0) === Number(state.selectedRowId || 0));
  });

  updateSelectedRowInfo();
}

function renderTable(rows = []) {
  if (!dom.accountsTableBody) return;

  updateSortIndicators();

  if (!rows.length) {
    dom.accountsTableBody.innerHTML = `
      <tr>
        <td colspan="9" class="empty-state">Nenhuma conta encontrada.</td>
      </tr>
    `;
    if (dom.accountsCount) dom.accountsCount.textContent = '0 registros';
    updateSelectedRowInfo();
    return;
  }

  dom.accountsTableBody.innerHTML = rows.map((row) => {
    const id = Number(row.id || 0);
    const label = getSafeValue(row.label);
    const email = getSafeValue(row.email_address);
    const provider = getSafeValue(row.provider || 'custom');

    const smtpHost = getSafeValue(row.smtp_host);
    const smtpPort = getSafeValue(row.smtp_port);
    const smtpInfo = `${smtpHost}:${smtpPort}`;

    const imapConfigured = !!row.imap_host;
    const imapInfo = imapConfigured
      ? `${getSafeValue(row.imap_host)}:${getSafeValue(row.imap_port || '')}`
      : 'Não configurado';

    const unreadValue = getUnreadValue(row);
    const isActive = toBool(row.is_active, false);

    return `
      <tr data-id="${id}">
        <td class="nowrap sticky-col">${id || '—'}</td>

        <td title="${escapeHtml(row.label || '')}">
          <div class="cell-stack">
            <span class="cell-main text-ellipsis">${label}</span>
            <span class="cell-sub">Conta / rótulo interno</span>
          </div>
        </td>

        <td title="${escapeHtml(row.email_address || '')}">
          <div class="cell-stack">
            <span class="cell-main text-ellipsis">${email}</span>
            <span class="cell-sub">Endereço principal</span>
          </div>
        </td>

        <td>
          <span class="text-ellipsis">${provider}</span>
        </td>

        <td class="nowrap" title="${escapeHtml(smtpInfo)}">
          <div class="cell-stack">
            <span class="cell-main text-ellipsis">${smtpInfo}</span>
            <span class="cell-sub">Host e porta SMTP</span>
          </div>
        </td>

        <td class="nowrap" title="${escapeHtml(imapInfo)}">
          <div class="cell-stack">
            <span class="cell-main text-ellipsis">${escapeHtml(imapInfo)}</span>
            <span class="cell-sub">${imapConfigured ? 'Host e porta IMAP' : 'Sem IMAP'}</span>
          </div>
        </td>

        <td class="nowrap">
          ${getUnreadCell(unreadValue)}
        </td>

        <td>
          ${getStatusCell(isActive)}
        </td>

        <td>
          <div class="actions">
            <button class="btn btn-new btn-sm" type="button" data-action="edit" data-id="${id}">Editar</button>
            <button class="btn btn-new btn-sm" type="button" data-action="view" data-id="${id}">Ver</button>
            ${isActive
        ? `<button class="btn btn-new btn-sm" type="button" data-action="deactivate" data-id="${id}">Desativar</button>`
        : ''
      }
          </div>
        </td>
      </tr>
    `;
  }).join('');

  if (dom.accountsCount) {
    dom.accountsCount.textContent = `${rows.length} registro${rows.length === 1 ? '' : 's'}`;
  }

  if (state.selectedRowId) {
    selectRow(state.selectedRowId);
  } else {
    updateSelectedRowInfo();
  }
}

/* ============================================================================
 * LOAD / LIST
 * ========================================================================== */
async function loadAccounts() {
  try {
    clearFeedback();
    state.loading = true;

    if (dom.accountsTableBody) {
      dom.accountsTableBody.innerHTML = `
        <tr>
          <td colspan="9" class="empty-state">Carregando contas...</td>
        </tr>
      `;
    }

    const qs = buildQueryString();
    const url = qs ? `${API_BASE}?${qs}` : API_BASE;

    const payload = await apiFetch(url, { method: 'GET' });
    const rows = extractRows(payload);

    state.rows = Array.isArray(rows) ? rows : [];
    renderTable(getSortedRows(state.rows));
  } catch (err) {
    console.error('[emailAccounts] loadAccounts error:', err);
    state.rows = [];
    renderTable([]);
    showFeedback(`Erro ao carregar contas: ${err.message}`, 'error');
  } finally {
    state.loading = false;
  }
}

/* ============================================================================
 * VIEW / DEACTIVATE
 * ========================================================================== */
async function fetchAccountById(id, includeSecrets = false) {
  const url = includeSecrets
    ? `${API_BASE}/${id}?includeSecrets=true`
    : `${API_BASE}/${id}`;

  const payload = await apiFetch(url, { method: 'GET' });
  return extractOne(payload);
}

async function viewAccount(id) {
  try {
    clearFeedback();

    const account = await fetchAccountById(id, false);
    if (!account) {
      throw new Error('Conta não encontrada.');
    }

    const lines = [
      `ID: ${account.id ?? '—'}`,
      `Label: ${account.label ?? '—'}`,
      `E-mail: ${account.email_address ?? '—'}`,
      `Provider: ${account.provider ?? '—'}`,
      `SMTP: ${account.smtp_host ?? '—'}:${account.smtp_port ?? '—'} | secure=${toBool(account.smtp_secure, false)}`,
      `SMTP user: ${account.smtp_user ?? '—'}`,
      `IMAP: ${account.imap_host ?? '—'}:${account.imap_port ?? '—'} | secure=${toBool(account.imap_secure, true)}`,
      `IMAP user: ${account.imap_user ?? '—'}`,
      `Ativa: ${toBool(account.is_active, false) ? 'Sim' : 'Não'}`,
      `Unread: ${account.unread_count ?? account.unread ?? '—'}`,
    ];

    window.alert(lines.join('\n'));
  } catch (err) {
    console.error('[emailAccounts] viewAccount error:', err);
    showFeedback(`Erro ao visualizar conta: ${err.message}`, 'error');
  }
}

async function deactivateAccount(id) {
  const confirmed = window.confirm(`Deseja desativar a conta #${id}?`);
  if (!confirmed) return;

  try {
    clearFeedback();
    showFeedback('Desativando conta...', 'info');

    await apiFetch(`${API_BASE}/${id}`, {
      method: 'DELETE',
    });

    if (Number(state.selectedRowId || 0) === Number(id)) {
      state.selectedRowId = null;
    }

    await loadAccounts();
    showFeedback('Conta desativada com sucesso.', 'success');
  } catch (err) {
    console.error('[emailAccounts] deactivateAccount error:', err);
    showFeedback(`Erro ao desativar conta: ${err.message}`, 'error');
  }
}