// ╔══════════════════════════════════════════════════════════════════════╗
// ║ customerSegments.js — UI Segmentos Cliente (PRODNEX ERP | ESM)      ║
// ║ Integra com /api/customer-segments (controller + service)           ║
// ║ ✅ segment_code gerado automaticamente pelo backend                  ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { showCenterModal } from '/public/includes/js/centerAlertModal.js';

// ---------------------------------------------------------------------
// API base
// ---------------------------------------------------------------------
const API_BASE =
  (typeof window !== 'undefined' && (window.apiBase || window.API_BASE)) ||
  (typeof window !== 'undefined' ? window.location.origin : '');

const ROUTES = Object.freeze({
  segments: `${API_BASE}/api/customer-segments`,
  segmentById: (id) =>
    `${API_BASE}/api/customer-segments/${encodeURIComponent(id)}`
});

// ---------------------------------------------------------------------
// Estado simples de paginação
// ---------------------------------------------------------------------
const STATE = {
  limit: 50,
  offset: 0,
  total: 0
};

// ---------------------------------------------------------------------
// Cache de elementos
// ---------------------------------------------------------------------
const els = {
  filterForm: document.getElementById('cs-filter-form'),
  search: document.getElementById('cs-search'),
  active: document.getElementById('cs-active'),
  btnClear: document.getElementById('cs-btn-clear'),

  tableBody: document.querySelector('[data-segments-table-body]'),
  emptyState: document.getElementById('cs-empty-state'),
  totalLabel: document.getElementById('apTableInfo'),

  btnPrev: document.getElementById('btnPreviousPage'),
  btnNext: document.getElementById('btnNextPage'),
  pageInfo: document.getElementById('apPageInfo'),

  btnNew: document.getElementById('cs-btn-new'),

  modalBackdrop: document.getElementById('cs-modal-backdrop'),
  modalTitle: document.getElementById('cs-modal-title'),
  modalClose: document.getElementById('cs-modal-close'),
  form: document.getElementById('cs-form'),
  fieldId: document.getElementById('cs-id'),
  fieldCode: document.getElementById('cs-segment-code'),
  fieldName: document.getElementById('cs-segment-name'),
  fieldDesc: document.getElementById('cs-description'),
  fieldActive: document.getElementById('cs-is-active'),
  btnCancel: document.getElementById('cs-btn-cancel')
};

// ---------------------------------------------------------------------
// Helpers UI
// ---------------------------------------------------------------------
function setupCodeField({ value = '', placeholder = 'Gerado automaticamente' } = {}) {
  if (!els.fieldCode) return;

  els.fieldCode.value = value;
  els.fieldCode.placeholder = placeholder;
  els.fieldCode.readOnly = true;
  els.fieldCode.required = false;
  els.fieldCode.removeAttribute('required');
}

function openModal(mode = 'create', segment = null) {
  if (!els.modalBackdrop) return;

  if (mode === 'create') {
    els.modalTitle.textContent = 'Novo Segmento';
    els.fieldId.value = '';
    setupCodeField({ value: '', placeholder: 'Gerado automaticamente' });
    els.fieldName.value = '';
    els.fieldDesc.value = '';
    els.fieldActive.checked = true;
  } else if (mode === 'edit' && segment) {
    els.modalTitle.textContent = 'Editar Segmento';
    els.fieldId.value = segment.segment_id ?? '';
    setupCodeField({
      value: segment.segment_code ?? '',
      placeholder: 'Gerado automaticamente'
    });
    els.fieldName.value = segment.segment_name ?? '';
    els.fieldDesc.value = segment.description ?? '';
    els.fieldActive.checked = !!segment.is_active;
  }

  els.modalBackdrop.classList.remove('cs-hidden');
}

function closeModal() {
  if (!els.modalBackdrop) return;
  els.modalBackdrop.classList.add('cs-hidden');
}

function updateTotalLabel() {
  const total = STATE.total || 0;
  if (!els.totalLabel) return;
  els.totalLabel.textContent = total === 1 ? '1 segmento' : `${total} segmentos`;
}

function updatePagination() {
  const { limit, offset, total } = STATE;
  const page = Math.floor(offset / limit) + 1;
  const totalPages = Math.max(1, Math.ceil((total || 0) / limit));

  if (els.pageInfo) els.pageInfo.textContent = `Página ${page} de ${totalPages}`;
  if (els.btnPrev) els.btnPrev.disabled = offset <= 0;
  if (els.btnNext) els.btnNext.disabled = offset + limit >= (total || 0);
}

// ---------------------------------------------------------------------
// Renderização da tabela
// ---------------------------------------------------------------------
function renderRows(rows = []) {
  if (!els.tableBody) return;

  els.tableBody.innerHTML = '';

  if (!rows.length) {
    if (els.emptyState) els.emptyState.hidden = false;
    return;
  }

  if (els.emptyState) els.emptyState.hidden = true;

  rows.forEach((row) => {
    const tr = document.createElement('tr');

    const tdCode = document.createElement('td');
    tdCode.textContent = row.segment_code ?? '';
    tr.appendChild(tdCode);

    const tdName = document.createElement('td');
    tdName.textContent = row.segment_name ?? '';
    tr.appendChild(tdName);

    const tdDesc = document.createElement('td');
    tdDesc.textContent = row.description ?? '';
    tr.appendChild(tdDesc);

    const tdActive = document.createElement('td');
    const pill = document.createElement('span');
    pill.classList.add('cs-pill');

    if (row.is_active) {
      pill.classList.add('cs-pill-active');
      pill.textContent = 'Ativo';
    } else {
      pill.classList.add('cs-pill-inactive');
      pill.textContent = 'Inativo';
    }

    tdActive.appendChild(pill);
    tr.appendChild(tdActive);

    const tdActions = document.createElement('td');
    tdActions.classList.add('cs-col-actions');

    const wrapper = document.createElement('div');
    wrapper.classList.add('cs-actions');

    const btnEdit = document.createElement('button');
    btnEdit.type = 'button';
    btnEdit.className = 'cs-action-btn';
    btnEdit.textContent = 'Editar';
    btnEdit.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      openModal('edit', row);
    });

    const btnDelete = document.createElement('button');
    btnDelete.type = 'button';
    btnDelete.className = 'cs-action-btn cs-action-btn-danger';
    btnDelete.textContent = row.is_active ? 'Desativar' : 'Excluir';
    btnDelete.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      handleDeleteSegment(row.segment_id, row.is_active);
    });

    wrapper.appendChild(btnEdit);
    wrapper.appendChild(btnDelete);
    tdActions.appendChild(wrapper);
    tr.appendChild(tdActions);

    els.tableBody.appendChild(tr);
  });
}

// ---------------------------------------------------------------------
// Fetch lista
// ---------------------------------------------------------------------
async function fetchSegments() {
  const q = els.search?.value?.trim() || '';
  const active = els.active?.value || '';
  const params = new URLSearchParams();

  if (q) params.set('q', q);
  if (active) params.set('active', active);

  params.set('limit', String(STATE.limit));
  params.set('offset', String(STATE.offset));

  const url = `${ROUTES.segments}?${params.toString()}`;

  try {
    const res = await fetch(url);

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const json = await res.json();

    const rows = json?.data || json?.rows || [];
    STATE.total = json?.pagination?.total ?? json?.total ?? rows.length ?? 0;
    STATE.limit = json?.pagination?.limit ?? json?.limit ?? STATE.limit;
    STATE.offset = json?.pagination?.offset ?? json?.offset ?? STATE.offset;

    renderRows(rows);
    updateTotalLabel();
    updatePagination();
  } catch (err) {
    console.error('fetchSegments error:', err);
    showCenterModal?.({
      title: 'Falha ao carregar segmentos',
      message:
        'Ocorreu um erro ao buscar os segmentos de cliente. Tente novamente em instantes.',
      type: 'error'
    });
  }
}

// ---------------------------------------------------------------------
// Criação / atualização
// ---------------------------------------------------------------------
async function handleSubmitForm(evt) {
  evt.preventDefault();

  const id = els.fieldId?.value?.trim() || '';
  const segment_name = els.fieldName?.value?.trim() || '';
  const description = els.fieldDesc?.value?.trim() || '';
  const is_active = !!els.fieldActive?.checked;

  console.log('[INFO] Salvando segmento:', {
    id,
    segment_name,
    description,
    is_active
  });

  if (!segment_name) {
    showCenterModal?.({
      title: 'Campos obrigatórios',
      message: 'Preencha o Nome do segmento.',
      type: 'warning'
    });
    return;
  }

  const payload = {
    segment_name,
    description,
    is_active
  };

  try {
    const url = id
      ? ROUTES.segmentById(id)
      : ROUTES.segments;

    const method = id ? 'PUT' : 'POST';

    console.log('[INFO] Request:', method, url);
    console.log('[INFO] Payload:', payload);

    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const responseText = await res.text();

    console.log('[INFO] HTTP status:', res.status);
    console.log('[INFO] Response:', responseText);

    let json = {};

    try {
      json = responseText ? JSON.parse(responseText) : {};
    } catch (parseError) {
      console.warn('[WARN] Resposta não é JSON:', responseText);
    }

    if (!res.ok || json?.ok === false) {
      const backendMessage =
        json?.message ||
        json?.error ||
        json?.detail ||
        responseText ||
        `HTTP ${res.status}`;

      throw new Error(backendMessage);
    }

    showCenterModal?.({
      title: 'Sucesso',
      message: id
        ? 'Segmento de cliente atualizado com sucesso.'
        : 'Segmento de cliente criado com sucesso.',
      type: 'success'
    });

    closeModal();

    STATE.offset = 0;

    await fetchSegments();

  } catch (err) {
    console.error('[ERR] handleSubmitForm:', err);

    showCenterModal?.({
      title: 'Erro ao salvar',
      message:
        err?.message ||
        'Não foi possível salvar o segmento de cliente.',
      type: 'error'
    });
  }
}


// ---------------------------------------------------------------------
// Remoção / desativação
// ---------------------------------------------------------------------
async function handleDeleteSegment(id, isActive) {
  if (!id) return;

  const isHard = !isActive;
  const confirmMsg = isHard
    ? 'Remover DEFINITIVAMENTE este segmento? Esta ação não poderá ser desfeita.'
    : 'Desativar este segmento? Você poderá reativar editando depois.';

  const confirmed = window.confirm(confirmMsg);
  if (!confirmed) return;

  const url = `${ROUTES.segmentById(id)}?hard=${isHard ? 'true' : 'false'}`;

  try {
    const res = await fetch(url, { method: 'DELETE' });
    const json = await res.json().catch(() => ({}));

    if (!res.ok || json?.ok === false) {
      throw new Error(json?.error || json?.detail || `HTTP ${res.status}`);
    }

    showCenterModal?.({
      title: isHard ? 'Segmento removido' : 'Segmento desativado',
      message: json?.message || 'Operação concluída com sucesso.',
      type: 'success'
    });

    if (STATE.offset > 0 && STATE.offset >= STATE.total - 1) {
      STATE.offset = Math.max(0, STATE.offset - STATE.limit);
    }

    await fetchSegments();
  } catch (err) {
    console.error('handleDeleteSegment error:', err);
    showCenterModal?.({
      title: 'Erro ao remover',
      message:
        'Não foi possível remover/desativar o segmento. Tente novamente em instantes.',
      type: 'error'
    });
  }
}

// ---------------------------------------------------------------------
// Eventos
// ---------------------------------------------------------------------
function bindEvents() {
  els.filterForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    STATE.offset = 0;
    fetchSegments();
  });

  els.btnClear?.addEventListener('click', (e) => {
    e.preventDefault();

    if (els.search) els.search.value = '';
    if (els.active) els.active.value = '';

    STATE.offset = 0;
    fetchSegments();
  });

  els.btnPrev?.addEventListener('click', (e) => {
    e.preventDefault();

    if (STATE.offset <= 0) return;

    STATE.offset = Math.max(0, STATE.offset - STATE.limit);
    fetchSegments();
  });

  els.btnNext?.addEventListener('click', (e) => {
    e.preventDefault();

    if (STATE.offset + STATE.limit >= (STATE.total || 0)) return;

    STATE.offset += STATE.limit;
    fetchSegments();
  });

  els.btnNew?.addEventListener('click', (e) => {
    e.preventDefault();
    openModal('create');
  });

  els.modalClose?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    closeModal();
  });

  els.btnCancel?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    closeModal();
  });

  els.modalBackdrop?.addEventListener('click', (e) => {
    if (e.target === els.modalBackdrop) {
      e.preventDefault();
      closeModal();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !els.modalBackdrop?.classList.contains('cs-hidden')) {
      closeModal();
    }
  });

  document.addEventListener('click', (e) => {
    const target = e.target;

    if (target?.id === 'cs-modal-close' || target?.id === 'cs-btn-cancel') {
      e.preventDefault();
      closeModal();
    }
  });

  els.form?.addEventListener('submit', handleSubmitForm);
}

// ---------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------
function init() {
  setupCodeField({ value: '', placeholder: 'Gerado automaticamente' });
  bindEvents();
  fetchSegments();
}

document.addEventListener('DOMContentLoaded', init);