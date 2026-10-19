// ╔══════════════════════════════════════════════════════════════════════╗
// ║ cashDocumentTypesModal.js — Cadastro de Tipos de Documento do Caixa║
// ║ PRODNEX ERP | Frontend ESM                                          ║
// ║ Endpoint: /api/cash-document-types                                  ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

const API_URL = '/api/cash-document-types';
const MODAL_ID = 'cash-document-types-modal';
const STYLE_ID = 'cash-document-types-modal-style';

const qs = (selector, root = document) => root.querySelector(selector);

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function normalizeId(value) {
  const id = Number.parseInt(value, 10);
  return Number.isInteger(id) && id > 0 ? id : null;
}

async function apiRequest(path = '', options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
    ...options,
  });

  const data = await response.json().catch(() => null);

  if (!response.ok || data?.ok === false) {
    throw new Error(
      data?.error ||
      data?.message ||
      `Erro HTTP ${response.status}.`
    );
  }

  return data;
}

function ensureLocalStyles() {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    #${MODAL_ID} .cdtm-toolbar {
      display: flex;
      align-items: end;
      gap: 10px;
      flex-wrap: wrap;
    }

    #${MODAL_ID} .cdtm-toolbar__search {
      flex: 1 1 260px;
      min-width: 220px;
    }

    #${MODAL_ID} .cdtm-form-actions {
      display: flex;
      align-items: end;
      gap: 8px;
      flex-wrap: wrap;
    }

    #${MODAL_ID} .cdtm-table-scroll {
      max-height: 330px;
      overflow: auto;
      border: 1px solid #d1d5db;
      border-radius: 8px;
    }

    #${MODAL_ID} .cdtm-table {
      width: 100%;
      border-collapse: collapse;
    }

    #${MODAL_ID} .cdtm-table th,
    #${MODAL_ID} .cdtm-table td {
      padding: 8px 10px;
      border-bottom: 1px solid #e5e7eb;
      vertical-align: middle;
    }

    #${MODAL_ID} .cdtm-table th {
      position: sticky;
      top: 0;
      z-index: 1;
      background: #f8fafc;
      text-align: left;
    }

    #${MODAL_ID} .cdtm-table tbody tr:nth-child(even) {
      background: #f8fafc;
    }

    #${MODAL_ID} .cdtm-table tbody tr:hover {
      background: #eef6ff;
    }

    #${MODAL_ID} .cdtm-col-id {
      width: 70px;
      text-align: center !important;
    }

    #${MODAL_ID} .cdtm-col-status {
      width: 110px;
      text-align: center !important;
    }

    #${MODAL_ID} .cdtm-col-actions {
      width: 190px;
      text-align: center !important;
    }

    #${MODAL_ID} .cdtm-actions {
      display: flex;
      justify-content: center;
      gap: 6px;
    }

    #${MODAL_ID} .cdtm-status {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 66px;
      padding: 3px 8px;
      border: 1px solid;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 700;
    }

    #${MODAL_ID} .cdtm-status--active {
      color: #166534;
      background: #dcfce7;
      border-color: #86efac;
    }

    #${MODAL_ID} .cdtm-status--inactive {
      color: #991b1b;
      background: #fee2e2;
      border-color: #fca5a5;
    }

    #${MODAL_ID} .cdtm-feedback {
      display: none;
      padding: 9px 12px;
      border: 1px solid;
      border-radius: 8px;
      font-size: 13px;
    }

    #${MODAL_ID} .cdtm-feedback.is-visible {
      display: block;
    }

    #${MODAL_ID} .cdtm-feedback--success {
      color: #166534;
      background: #f0fdf4;
      border-color: #86efac;
    }

    #${MODAL_ID} .cdtm-feedback--error {
      color: #991b1b;
      background: #fef2f2;
      border-color: #fca5a5;
    }

    #${MODAL_ID} .cdtm-empty,
    #${MODAL_ID} .cdtm-loading {
      padding: 24px !important;
      text-align: center !important;
      color: #64748b;
    }

    @media (max-width: 768px) {
      #${MODAL_ID} .cdtm-col-actions {
        width: auto;
      }

      #${MODAL_ID} .cdtm-actions {
        flex-direction: column;
      }
    }
  `;

  document.head.appendChild(style);
}

function buildModalHtml() {
  return `
    <div class="modal__backdrop" data-action="close"></div>

    <div class="modal__dialog">
      <section class="modal__panel modal__panel--lg" role="document">
        <header class="modal__header">
          <h2 class="modal__title" id="cashDocumentTypesModalTitle">
            Tipos de Documento do Caixa
          </h2>

          <button
            type="button"
            class="modal__close"
            data-action="close"
            aria-label="Fechar"
            title="Fechar"
          >&times;</button>
        </header>

        <div class="modal__body modal-section">
          <div class="cdtm-toolbar">
            <div class="fields fields-h-5 cdtm-toolbar__search">
              <label for="cdtmSearch">Buscar</label>
              <input
                type="search"
                id="cdtmSearch"
                placeholder="Buscar pelo nome..."
                autocomplete="off"
              />
            </div>

            <div class="fields fields-h-5">
              <label for="cdtmStatusFilter">Situação</label>
              <select id="cdtmStatusFilter">
                <option value="all">Todos</option>
                <option value="active">Ativos</option>
                <option value="inactive">Inativos</option>
              </select>
            </div>

            <button type="button" class="btn btn-filter btn-sm" data-action="refresh">
              Atualizar
            </button>
          </div>

          <div class="modal-divider"></div>

          <form id="cdtmForm" autocomplete="off">
            <input type="hidden" id="cdtmId" name="id" />

            <div class="modal-form-grid modal-form-grid--2">
              <div class="fields fields-h-5">
                <label for="cdtmName">Nome *</label>
                <input
                  type="text"
                  id="cdtmName"
                  name="name"
                  maxlength="100"
                  placeholder="Ex.: NF-e"
                  required
                />
              </div>

              <div class="cdtm-form-actions">
                <button type="submit" class="btn btn-save btn-sm" id="cdtmSaveButton">
                  Salvar
                </button>

                <button type="button" class="btn btn-clean btn-sm" data-action="clear-form">
                  Limpar
                </button>
              </div>
            </div>
          </form>

          <div class="cdtm-feedback" id="cdtmFeedback" role="status"></div>

          <div class="cdtm-table-scroll">
            <table class="cdtm-table table table-zebra table-zebra-hover">
              <thead>
                <tr>
                  <th class="cdtm-col-id">ID</th>
                  <th>Nome</th>
                  <th class="cdtm-col-status">Situação</th>
                  <th class="cdtm-col-actions">Ações</th>
                </tr>
              </thead>
              <tbody id="cdtmTableBody">
                <tr>
                  <td colspan="4" class="cdtm-loading">Carregando...</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <footer class="modal__footer">
          <button type="button" class="btn btn-cancel btn-sm" data-action="close">
            Fechar
          </button>
        </footer>
      </section>
    </div>
  `;
}

export function openCashDocumentTypesModal(options = {}) {
  const { onChange = null, onClose = null } = options;

  document.getElementById(MODAL_ID)?.remove();
  ensureLocalStyles();

  const previouslyFocused = document.activeElement;
  const previousBodyOverflow = document.body.style.overflow;

  const root = document.createElement('div');
  root.id = MODAL_ID;
  root.className = 'modal is-open';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-labelledby', 'cashDocumentTypesModalTitle');
  root.setAttribute('aria-hidden', 'false');
  root.innerHTML = buildModalHtml();

  document.body.appendChild(root);
  document.body.style.overflow = 'hidden';

  const form = qs('#cdtmForm', root);
  const idInput = qs('#cdtmId', root);
  const nameInput = qs('#cdtmName', root);
  const searchInput = qs('#cdtmSearch', root);
  const statusFilter = qs('#cdtmStatusFilter', root);
  const tableBody = qs('#cdtmTableBody', root);
  const feedback = qs('#cdtmFeedback', root);
  const saveButton = qs('#cdtmSaveButton', root);

  let items = [];
  let closed = false;
  let feedbackTimer = null;

  function showFeedback(message, type = 'success') {
    if (!feedback) return;

    if (feedbackTimer) window.clearTimeout(feedbackTimer);

    feedback.textContent = message;
    feedback.className = `cdtm-feedback cdtm-feedback--${type} is-visible`;

    feedbackTimer = window.setTimeout(() => {
      feedback.className = 'cdtm-feedback';
      feedback.textContent = '';
    }, 4000);
  }

  function setSaving(saving) {
    if (!saveButton) return;

    saveButton.disabled = saving;
    saveButton.textContent = saving
      ? 'Salvando...'
      : (normalizeId(idInput?.value) ? 'Salvar Alterações' : 'Salvar');
  }

  function clearForm({ focus = true } = {}) {
    if (form) form.reset();
    if (idInput) idInput.value = '';
    if (saveButton) saveButton.textContent = 'Salvar';
    if (focus) nameInput?.focus();
  }

  function getFilteredItems() {
    const search = String(searchInput?.value || '').trim().toLocaleLowerCase('pt-BR');
    const status = statusFilter?.value || 'all';

    return items.filter((item) => {
      const matchesSearch = !search ||
        String(item.name || '').toLocaleLowerCase('pt-BR').includes(search);

      const matchesStatus =
        status === 'all' ||
        (status === 'active' && item.is_active === true) ||
        (status === 'inactive' && item.is_active === false);

      return matchesSearch && matchesStatus;
    });
  }

  function renderTable() {
    if (!tableBody) return;

    const rows = getFilteredItems();

    if (!rows.length) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="4" class="cdtm-empty">Nenhum tipo de documento encontrado.</td>
        </tr>
      `;
      return;
    }

    tableBody.innerHTML = rows.map((item) => {
      const id = normalizeId(item.id);
      const isActive = item.is_active === true;

      return `
        <tr data-id="${id}">
          <td class="cdtm-col-id">${id}</td>
          <td>${escapeHtml(item.name)}</td>
          <td class="cdtm-col-status">
            <span class="cdtm-status ${isActive ? 'cdtm-status--active' : 'cdtm-status--inactive'}">
              ${isActive ? 'Ativo' : 'Inativo'}
            </span>
          </td>
          <td class="cdtm-col-actions">
            <div class="cdtm-actions">
              <button type="button" class="btn btn-edit btn-sm" data-action="edit" title="Editar">
                ✏️
              </button>

              <button
                type="button"
                class="btn ${isActive ? 'btn-cancel' : 'btn-save'} btn-sm"
                data-action="toggle-active"
                title="${isActive ? 'Desativar' : 'Ativar'}"
              >
                ${isActive ? 'Desativar' : 'Ativar'}
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  async function loadItems({ silent = false } = {}) {
    if (!silent && tableBody) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="4" class="cdtm-loading">Carregando...</td>
        </tr>
      `;
    }

    try {
      const response = await apiRequest('?includeInactive=true');
      const rows = response?.data || response?.rows || response?.items || [];
      items = Array.isArray(rows) ? rows : [];
      renderTable();
    } catch (error) {
      console.error('[cashDocumentTypesModal] loadItems:', error);

      if (tableBody) {
        tableBody.innerHTML = `
          <tr>
            <td colspan="4" class="cdtm-empty">Erro ao carregar os tipos de documento.</td>
          </tr>
        `;
      }

      showFeedback(error.message, 'error');
    }
  }

  function editItem(idValue) {
    const id = normalizeId(idValue);
    const item = items.find((row) => normalizeId(row.id) === id);
    if (!item) return;

    idInput.value = String(item.id);
    nameInput.value = item.name || '';
    saveButton.textContent = 'Salvar Alterações';
    nameInput.focus();
    nameInput.select();
  }

  async function toggleItem(idValue) {
    const id = normalizeId(idValue);
    const item = items.find((row) => normalizeId(row.id) === id);
    if (!item) return;

    const action = item.is_active ? 'desativar' : 'ativar';
    const confirmed = window.confirm(`Deseja ${action} "${item.name}"?`);
    if (!confirmed) return;

    try {
      await apiRequest(`/${id}/active`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: !item.is_active }),
      });

      clearForm({ focus: false });
      await loadItems({ silent: true });
      showFeedback(`Tipo de documento ${item.is_active ? 'desativado' : 'ativado'} com sucesso.`);

      if (typeof onChange === 'function') {
        onChange({ action: 'toggle-active', id });
      }
    } catch (error) {
      console.error('[cashDocumentTypesModal] toggleItem:', error);
      showFeedback(error.message, 'error');
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const id = normalizeId(idInput?.value);
    const name = String(nameInput?.value || '').trim().replace(/\s+/g, ' ');

    if (!name) {
      showFeedback('Informe o nome do tipo de documento.', 'error');
      nameInput?.focus();
      return;
    }

    setSaving(true);

    try {
      const path = id ? `/${id}` : '';
      const method = id ? 'PUT' : 'POST';

      await apiRequest(path, {
        method,
        body: JSON.stringify({ name }),
      });

      clearForm({ focus: false });
      await loadItems({ silent: true });
      showFeedback(id
        ? 'Tipo de documento atualizado com sucesso.'
        : 'Tipo de documento criado com sucesso.');

      if (typeof onChange === 'function') {
        onChange({ action: id ? 'update' : 'create', id });
      }

      nameInput?.focus();
    } catch (error) {
      console.error('[cashDocumentTypesModal] handleSubmit:', error);
      showFeedback(error.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  function close(reason = 'close') {
    if (closed) return;
    closed = true;

    if (feedbackTimer) window.clearTimeout(feedbackTimer);
    document.removeEventListener('keydown', handleKeydown);
    document.body.style.overflow = previousBodyOverflow;

    root.classList.remove('is-open');
    root.setAttribute('aria-hidden', 'true');
    root.remove();

    if (previouslyFocused instanceof HTMLElement) {
      previouslyFocused.focus();
    }

    if (typeof onClose === 'function') {
      onClose({ reason });
    }
  }

  function handleKeydown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      close('escape');
    }
  }

  root.addEventListener('click', (event) => {
    const actionButton = event.target.closest('[data-action]');
    if (!actionButton) return;

    const action = actionButton.dataset.action;

    if (action === 'close') {
      close(actionButton.classList.contains('modal__backdrop') ? 'backdrop' : 'button');
      return;
    }

    if (action === 'clear-form') {
      clearForm();
      return;
    }

    if (action === 'refresh') {
      loadItems();
      return;
    }

    const row = actionButton.closest('tr[data-id]');
    const id = normalizeId(row?.dataset.id);
    if (!id) return;

    if (action === 'edit') editItem(id);
    if (action === 'toggle-active') toggleItem(id);
  });

  form?.addEventListener('submit', handleSubmit);
  searchInput?.addEventListener('input', renderTable);
  statusFilter?.addEventListener('change', renderTable);
  document.addEventListener('keydown', handleKeydown);

  loadItems();
  window.setTimeout(() => nameInput?.focus(), 30);

  return {
    root,
    close,
    refresh: loadItems,
    clearForm,
  };
}

export default openCashDocumentTypesModal;
