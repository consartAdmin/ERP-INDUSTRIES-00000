// ╔══════════════════════════════════════════════════════════════════════╗
// ║ licitations.js — Frontend Gestão de Licitações                     ║
// ║ PRODNEX ERP                                                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

const API_BASE = '/api/licitations';

const state = {
  page: 1,
  limit: 50,
  totalPages: 1,
  total: 0,
  loading: false,
};

const STATUS_LABELS = {
  FOUND: 'Encontrada',
  UNDER_ANALYSIS: 'Em análise',
  APPROVED: 'Aprovada',
  PROPOSAL_SENT: 'Proposta enviada',
  WON: 'Ganha',
  LOST: 'Perdida',
  CANCELLED: 'Cancelada',
};

const STATUS_CLASSES = {
  FOUND: 'status-found',
  UNDER_ANALYSIS: 'status-analysis',
  APPROVED: 'status-approved',
  PROPOSAL_SENT: 'status-proposal',
  WON: 'status-won',
  LOST: 'status-lost',
  CANCELLED: 'status-cancelled',
};

const dom = {
  tableBody: document.getElementById('licitationsTableBody'),
  tableInfo: document.getElementById('tableInfo'),
  pageInfo: document.getElementById('pageInfo'),

  btnPreviousPage: document.getElementById('btnPreviousPage'),
  btnNextPage: document.getElementById('btnNextPage'),
  btnApplyFilters: document.getElementById('btnApplyFilters'),
  btnClearFilters: document.getElementById('btnClearFilters'),
  btnRefresh: document.getElementById('btnRefresh'),
  btnNewLicitation: document.getElementById('btnNewLicitation'),

  filterSearch: document.getElementById('filterSearch'),
  filterStatus: document.getElementById('filterStatus'),
  filterModality: document.getElementById('filterModality'),
  filterState: document.getElementById('filterState'),
  filterSessionFrom: document.getElementById('filterSessionFrom'),
  filterSessionTo: document.getElementById('filterSessionTo'),
  filterLimit: document.getElementById('filterLimit'),

  modal: document.getElementById('licitationModal'),
  modalTitle: document.getElementById('licitationModalTitle'),
  btnCloseModal: document.getElementById('btnCloseModal'),
  btnCancelModal: document.getElementById('btnCancelModal'),
  btnSaveLicitation: document.getElementById('btnSaveLicitation'),
  form: document.getElementById('licitationForm'),
  id: document.getElementById('licitationId'),

  summaryTotalItems: document.getElementById('summaryTotalItems'),
  summaryAnalysisItems: document.getElementById('summaryAnalysisItems'),
  summaryProposalItems: document.getElementById('summaryProposalItems'),
  summaryWonItems: document.getElementById('summaryWonItems'),
  summaryEstimatedTotal: document.getElementById('summaryEstimatedTotal'),
  summaryProposedTotal: document.getElementById('summaryProposedTotal'),

  toastContainer: document.getElementById('toastContainer'),
};

const FORM_FIELDS = [
  'process_number',
  'licitation_number',
  'portal',
  'portal_url',
  'agency_name',
  'agency_document',
  'modality',
  'state',
  'city',
  'session_date',
  'proposal_deadline',
  'lot_number',
  'item_number',
  'product_description',
  'catmat_code',
  'catser_code',
  'quantity',
  'unit',
  'estimated_unit_price',
  'estimated_total_price',
  'product_id',
  'sku',
  'brand',
  'manufacturer',
  'cost_price',
  'freight_cost',
  'tax_cost',
  'minimum_sale_price',
  'proposed_price',
  'estimated_margin',
  'participation',
  'status',
  'responsible',
  'observations',
];

const NUMBER_FIELDS = new Set([
  'quantity',
  'estimated_unit_price',
  'estimated_total_price',
  'product_id',
  'cost_price',
  'freight_cost',
  'tax_cost',
  'minimum_sale_price',
  'proposed_price',
  'estimated_margin',
]);

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatCurrency(value) {
  const number = Number(value || 0);

  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(number);
}

function formatNumber(value, maximumFractionDigits = 4) {
  if (value === null || value === undefined || value === '') return '—';

  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  }).format(Number(value));
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

function toDateTimeLocal(value) {
  if (!value) return '';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '';

  const pad = (number) => String(number).padStart(2, '0');

  return [
    date.getFullYear(),
    '-',
    pad(date.getMonth() + 1),
    '-',
    pad(date.getDate()),
    'T',
    pad(date.getHours()),
    ':',
    pad(date.getMinutes()),
  ].join('');
}

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.textContent = message;

  dom.toastContainer.appendChild(toast);

  window.setTimeout(() => {
    toast.remove();
  }, 3500);
}

async function apiRequest(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  let payload = null;

  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw new Error(
      payload?.error ||
      payload?.message ||
      `Erro HTTP ${response.status}`,
    );
  }

  return payload;
}

function buildQueryParams(includePagination = true) {
  const params = new URLSearchParams();

  const search = dom.filterSearch.value.trim();
  const status = dom.filterStatus.value;
  const modality = dom.filterModality.value;
  const stateFilter = dom.filterState.value.trim().toUpperCase();
  const sessionFrom = dom.filterSessionFrom.value;
  const sessionTo = dom.filterSessionTo.value;

  if (search) params.set('search', search);
  if (status) params.set('status', status);
  if (modality) params.set('modality', modality);
  if (stateFilter) params.set('state', stateFilter);
  if (sessionFrom) params.set('session_date_from', `${sessionFrom}T00:00:00`);
  if (sessionTo) params.set('session_date_to', `${sessionTo}T23:59:59`);

  if (includePagination) {
    params.set('page', String(state.page));
    params.set('limit', String(state.limit));
    params.set('sort_by', 'session_date');
    params.set('sort_order', 'asc');
  }

  return params;
}

function renderLoading() {
  dom.tableBody.innerHTML = `
    <tr>
      <td colspan="13" class="table-message">Carregando licitações...</td>
    </tr>
  `;
}

function renderEmpty() {
  dom.tableBody.innerHTML = `
    <tr>
      <td colspan="13" class="table-message">
        Nenhum item de licitação encontrado.
      </td>
    </tr>
  `;
}

function renderError(message) {
  dom.tableBody.innerHTML = `
    <tr>
      <td colspan="13" class="table-message">
        ${escapeHtml(message)}
      </td>
    </tr>
  `;
}

function statusBadge(status) {
  const normalized = String(status || 'FOUND').toUpperCase();
  const label = STATUS_LABELS[normalized] || normalized;
  const cssClass = STATUS_CLASSES[normalized] || 'status-found';

  return `<span class="status-badge ${cssClass}">${escapeHtml(label)}</span>`;
}

function renderTable(rows = []) {
  if (!rows.length) {
    renderEmpty();
    return;
  }

  dom.tableBody.innerHTML = rows.map((item) => {
    const estimatedTotal =
      Number(item.estimated_total_price || 0) ||
      Number(item.estimated_unit_price || 0) * Number(item.quantity || 0);

    const proposedTotal =
      Number(item.proposed_price || 0) * Number(item.quantity || 0);

    const itemReference = [
      item.lot_number ? `Lote ${item.lot_number}` : '',
      item.item_number ? `Item ${item.item_number}` : '',
    ].filter(Boolean).join(' / ') || '—';

    return `
      <tr>
        <td>${escapeHtml(item.id)}</td>

        <td class="cell-ellipsis" title="${escapeHtml(item.process_number || '')}">
          ${escapeHtml(item.process_number || '—')}
        </td>

        <td class="cell-ellipsis" title="${escapeHtml(item.licitation_number || '')}">
          ${escapeHtml(item.licitation_number || '—')}
        </td>

        <td class="cell-ellipsis" title="${escapeHtml(item.agency_name || '')}">
          ${escapeHtml(item.agency_name || '—')}
        </td>

        <td>${escapeHtml(itemReference)}</td>

        <td class="cell-ellipsis" title="${escapeHtml(item.product_description || '')}">
          ${escapeHtml(item.product_description || '—')}
        </td>

        <td>
          ${formatNumber(item.quantity)}
          ${item.unit ? escapeHtml(item.unit) : ''}
        </td>

        <td>${formatCurrency(estimatedTotal)}</td>
        <td>${formatCurrency(proposedTotal)}</td>

        <td>
          ${item.estimated_margin !== null && item.estimated_margin !== undefined
            ? `${formatNumber(item.estimated_margin, 2)}%`
            : '—'}
        </td>

        <td>${formatDateTime(item.session_date)}</td>
        <td>${statusBadge(item.status)}</td>

        <td>
          <div class="table-actions">
            <button
              class="action-button"
              type="button"
              data-action="edit"
              data-id="${item.id}"
            >
              Editar
            </button>

            <button
              class="action-button action-button--danger"
              type="button"
              data-action="delete"
              data-id="${item.id}"
            >
              Excluir
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function renderPagination() {
  const start = state.total === 0
    ? 0
    : ((state.page - 1) * state.limit) + 1;

  const end = Math.min(state.page * state.limit, state.total);

  dom.tableInfo.textContent =
    `${start}–${end} de ${state.total} registro(s)`;

  dom.pageInfo.textContent =
    `Página ${state.page} de ${state.totalPages}`;

  dom.btnPreviousPage.disabled = state.page <= 1 || state.loading;
  dom.btnNextPage.disabled =
    state.page >= state.totalPages || state.loading;
}

async function loadLicitations() {
  if (state.loading) return;

  state.loading = true;
  renderLoading();
  renderPagination();

  try {
    const params = buildQueryParams(true);
    const response = await apiRequest(`${API_BASE}?${params.toString()}`);

    const rows = response?.data || [];
    const pagination = response?.pagination || {};

    state.page = Number(pagination.page || 1);
    state.limit = Number(pagination.limit || state.limit);
    state.total = Number(pagination.total || 0);
    state.totalPages = Number(pagination.total_pages || 1);

    renderTable(rows);
  } catch (error) {
    console.error('[LICITATIONS][LIST]', error);
    renderError(error.message);
    showToast(error.message, 'error');
  } finally {
    state.loading = false;
    renderPagination();
  }
}

async function loadSummary() {
  try {
    const params = buildQueryParams(false);
    const response = await apiRequest(
      `${API_BASE}/summary?${params.toString()}`,
    );

    const data = response?.data || {};

    dom.summaryTotalItems.textContent =
      formatNumber(data.total_items || 0, 0);

    dom.summaryAnalysisItems.textContent =
      formatNumber(data.analysis_items || 0, 0);

    dom.summaryProposalItems.textContent =
      formatNumber(data.proposal_sent_items || 0, 0);

    dom.summaryWonItems.textContent =
      formatNumber(data.won_items || 0, 0);

    dom.summaryEstimatedTotal.textContent =
      formatCurrency(data.estimated_total || 0);

    dom.summaryProposedTotal.textContent =
      formatCurrency(data.proposed_total || 0);
  } catch (error) {
    console.error('[LICITATIONS][SUMMARY]', error);
  }
}

async function refreshAll() {
  await Promise.all([
    loadLicitations(),
    loadSummary(),
  ]);
}

function resetForm() {
  dom.form.reset();
  dom.id.value = '';
  document.getElementById('status').value = 'FOUND';
  document.getElementById('estimated_margin').value = '';
}

function openModal(item = null) {
  resetForm();

  if (item) {
    dom.modalTitle.textContent = `Editar licitação #${item.id}`;
    dom.id.value = item.id;

    for (const field of FORM_FIELDS) {
      const element = document.getElementById(field);
      if (!element) continue;

      if (element.type === 'checkbox') {
        element.checked = Boolean(item[field]);
        continue;
      }

      if (element.type === 'datetime-local') {
        element.value = toDateTimeLocal(item[field]);
        continue;
      }

      element.value = item[field] ?? '';
    }
  } else {
    dom.modalTitle.textContent = 'Nova licitação';
  }

  dom.modal.hidden = false;
  document.body.classList.add('modal-open');

  window.setTimeout(() => {
    document.getElementById('process_number')?.focus();
  }, 30);
}

function closeModal() {
  dom.modal.hidden = true;
  document.body.classList.remove('modal-open');
  resetForm();
}

async function openEditModal(id) {
  try {
    const response = await apiRequest(`${API_BASE}/${id}`);
    openModal(response?.data || null);
  } catch (error) {
    console.error('[LICITATIONS][GET]', error);
    showToast(error.message, 'error');
  }
}

function collectFormData() {
  const payload = {};

  for (const field of FORM_FIELDS) {
    const element = document.getElementById(field);
    if (!element) continue;

    if (element.type === 'checkbox') {
      payload[field] = element.checked;
      continue;
    }

    const rawValue = element.value.trim();

    if (NUMBER_FIELDS.has(field)) {
      payload[field] = rawValue === '' ? null : Number(rawValue);
      continue;
    }

    payload[field] = rawValue === '' ? null : rawValue;
  }

  if (payload.state) {
    payload.state = payload.state.toUpperCase();
  }

  return payload;
}

function calculateMargin() {
  const cost = Number(document.getElementById('cost_price').value || 0);
  const freight = Number(document.getElementById('freight_cost').value || 0);
  const taxes = Number(document.getElementById('tax_cost').value || 0);
  const proposed = Number(document.getElementById('proposed_price').value || 0);

  const totalCost = cost + freight + taxes;
  const marginField = document.getElementById('estimated_margin');

  if (proposed <= 0) {
    marginField.value = '';
    return;
  }

  const margin = ((proposed - totalCost) / proposed) * 100;
  marginField.value = margin.toFixed(2);
}

function calculateEstimatedTotal() {
  const quantity = Number(document.getElementById('quantity').value || 0);
  const unitPrice = Number(
    document.getElementById('estimated_unit_price').value || 0,
  );

  const totalField = document.getElementById('estimated_total_price');

  if (quantity > 0 && unitPrice > 0) {
    totalField.value = (quantity * unitPrice).toFixed(2);
  }
}

async function saveLicitation(event) {
  event.preventDefault();

  if (!dom.form.reportValidity()) return;

  const id = dom.id.value;
  const payload = collectFormData();

  dom.btnSaveLicitation.disabled = true;
  dom.btnSaveLicitation.textContent = 'Salvando...';

  try {
    if (id) {
      await apiRequest(`${API_BASE}/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });

      showToast('Item de licitação atualizado com sucesso.', 'success');
    } else {
      await apiRequest(API_BASE, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      showToast('Item de licitação criado com sucesso.', 'success');
    }

    closeModal();
    await refreshAll();
  } catch (error) {
    console.error('[LICITATIONS][SAVE]', error);
    showToast(error.message, 'error');
  } finally {
    dom.btnSaveLicitation.disabled = false;
    dom.btnSaveLicitation.textContent = 'Salvar';
  }
}

async function deleteLicitation(id) {
  const confirmed = window.confirm(
    'Deseja realmente excluir este item de licitação?',
  );

  if (!confirmed) return;

  try {
    await apiRequest(`${API_BASE}/${id}`, {
      method: 'DELETE',
    });

    showToast('Item de licitação excluído com sucesso.', 'success');

    if (state.page > 1 && state.total - 1 <= (state.page - 1) * state.limit) {
      state.page -= 1;
    }

    await refreshAll();
  } catch (error) {
    console.error('[LICITATIONS][DELETE]', error);
    showToast(error.message, 'error');
  }
}

function clearFilters() {
  dom.filterSearch.value = '';
  dom.filterStatus.value = '';
  dom.filterModality.value = '';
  dom.filterState.value = '';
  dom.filterSessionFrom.value = '';
  dom.filterSessionTo.value = '';
  dom.filterLimit.value = '20';

  state.page = 1;
  state.limit = 50;

  refreshAll();
}

function bindEvents() {
  dom.btnApplyFilters.addEventListener('click', () => {
    state.page = 1;
    state.limit = Number(dom.filterLimit.value || 50);
    refreshAll();
  });

  dom.btnClearFilters.addEventListener('click', clearFilters);

  dom.btnRefresh.addEventListener('click', refreshAll);

  dom.btnNewLicitation.addEventListener('click', () => openModal());

  dom.btnPreviousPage.addEventListener('click', () => {
    if (state.page <= 1) return;
    state.page -= 1;
    loadLicitations();
  });

  dom.btnNextPage.addEventListener('click', () => {
    if (state.page >= state.totalPages) return;
    state.page += 1;
    loadLicitations();
  });

  dom.filterLimit.addEventListener('change', () => {
    state.limit = Number(dom.filterLimit.value || 50);
    state.page = 1;
    loadLicitations();
  });

  dom.filterSearch.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;

    event.preventDefault();
    state.page = 1;
    refreshAll();
  });

  dom.filterState.addEventListener('input', () => {
    dom.filterState.value =
      dom.filterState.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2);
  });

  document.getElementById('state').addEventListener('input', (event) => {
    event.target.value =
      event.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2);
  });

  dom.tableBody.addEventListener('click', (event) => {
    const button = event.target.closest('[data-action]');
    if (!button) return;

    const id = Number(button.dataset.id);
    const action = button.dataset.action;

    if (!Number.isInteger(id) || id <= 0) return;

    if (action === 'edit') {
      openEditModal(id);
    }

    if (action === 'delete') {
      deleteLicitation(id);
    }
  });

  dom.form.addEventListener('submit', saveLicitation);

  dom.btnCloseModal.addEventListener('click', closeModal);
  dom.btnCancelModal.addEventListener('click', closeModal);

  dom.modal.addEventListener('click', (event) => {
    if (event.target === dom.modal) {
      closeModal();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !dom.modal.hidden) {
      closeModal();
    }
  });

  for (const id of [
    'cost_price',
    'freight_cost',
    'tax_cost',
    'proposed_price',
  ]) {
    document.getElementById(id).addEventListener('input', calculateMargin);
  }

  for (const id of ['quantity', 'estimated_unit_price']) {
    document.getElementById(id).addEventListener(
      'input',
      calculateEstimatedTotal,
    );
  }
}

async function init() {
  bindEvents();
  await refreshAll();
}

init();
