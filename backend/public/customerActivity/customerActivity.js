/* ╔══════════════════════════════════════════════════════════════════════╗
   ║ FILE: customerActivity.js                                           ║
   ║ MODULE: Customer Activity                                           ║
   ║ DESCRIPTION: Frontend do módulo customerActivity                    ║
   ║ PRODNEX ERP · Frontend · ESM                                        ║
   ╚══════════════════════════════════════════════════════════════════════╝ */

'use strict';

const API_BASE = '/api/customer-activity';

const state = {
  page: 1,
  limit: 50,
  total: 0,
  status: '',
  search: '',
  onlyNeedsFollowup: false,
  loading: false,
  rows: [],
  selectedCustomerId: null,
};

const els = {
  sumTotal: document.getElementById('sumTotal'),
  sumActive: document.getElementById('sumActive'),
  sumAtRisk: document.getElementById('sumAtRisk'),
  sumInactive: document.getElementById('sumInactive'),
  sumLost: document.getElementById('sumLost'),

  searchInput: document.getElementById('searchInput'),
  statusFilter: document.getElementById('statusFilter'),
  limitFilter: document.getElementById('limitFilter'),
  needsFollowupOnly: document.getElementById('needsFollowupOnly'),

  btnReload: document.getElementById('btnReload'),
  btnRecalculate: document.getElementById('btnRecalculate'),

  tableInfo: document.getElementById('tableInfo'),
  statusMessage: document.getElementById('statusMessage'),
  activityTableBody: document.getElementById('activityTableBody'),

  btnPrevPage: document.getElementById('btnPrevPage'),
  btnNextPage: document.getElementById('btnNextPage'),
  paginationInfo: document.getElementById('paginationInfo'),

  detailsModal: document.getElementById('detailsModal'),
  btnCloseDetailsModal: document.getElementById('btnCloseDetailsModal'),

  detailsModalSubtitle: document.getElementById('detailsModalSubtitle'),
  detailCustomerId: document.getElementById('detailCustomerId'),
  detailTradeName: document.getElementById('detailTradeName'),
  detailLegalName: document.getElementById('detailLegalName'),
  detailTaxId: document.getElementById('detailTaxId'),
  detailStatus: document.getElementById('detailStatus'),
  detailDaysWithoutPurchase: document.getElementById('detailDaysWithoutPurchase'),
  detailLastPurchase: document.getElementById('detailLastPurchase'),
  detailLastContact: document.getElementById('detailLastContact'),
  detailLastFollowupType: document.getElementById('detailLastFollowupType'),
  detailLastFollowupAt: document.getElementById('detailLastFollowupAt'),
  detailFollowupCount: document.getElementById('detailFollowupCount'),
  detailSalesperson: document.getElementById('detailSalesperson'),
  detailEmail: document.getElementById('detailEmail'),
  detailPhone: document.getElementById('detailPhone'),
  detailMobile: document.getElementById('detailMobile'),
  detailCityState: document.getElementById('detailCityState'),

  followupForm: document.getElementById('followupForm'),
  followupCustomerId: document.getElementById('followupCustomerId'),
  followupType: document.getElementById('followupType'),
  followupStatus: document.getElementById('followupStatus'),
  followupReason: document.getElementById('followupReason'),

  activityUpdateForm: document.getElementById('activityUpdateForm'),
  updateCustomerId: document.getElementById('updateCustomerId'),
  updateLastPurchaseDate: document.getElementById('updateLastPurchaseDate'),
  updateStatus: document.getElementById('updateStatus'),
  updateDaysWithoutPurchase: document.getElementById('updateDaysWithoutPurchase'),
  updateInactivityReason: document.getElementById('updateInactivityReason'),
};

let searchDebounce = null;

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function setStatusMessage(message = '', isError = false) {
  els.statusMessage.textContent = message || '';
  els.statusMessage.style.color = isError ? '#b91c1c' : '#365fdb';
}

async function request(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json')
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const errorText =
      typeof payload === 'object' && payload?.error
        ? payload.error
        : `HTTP ${response.status}`;
    throw new Error(errorText);
  }

  return payload;
}

function formatDate(value) {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('pt-BR');
}

function formatDateTime(value) {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('pt-BR');
}

function formatStatus(status) {
  const map = {
    active: 'Active',
    at_risk: 'At Risk',
    inactive: 'Inactive',
    lost: 'Lost',
  };
  return map[status] || status || '-';
}

function statusBadge(status) {
  const safe = String(status || '').toLowerCase();
  const clsMap = {
    active: 'ca-badge ca-badge--active',
    at_risk: 'ca-badge ca-badge--at-risk',
    inactive: 'ca-badge ca-badge--inactive',
    lost: 'ca-badge ca-badge--lost',
  };
  const cls = clsMap[safe] || 'ca-badge ca-badge--inactive';
  return `<span class="${cls}">${escapeHtml(formatStatus(safe))}</span>`;
}

function buildQueryString() {
  const params = new URLSearchParams();
  params.set('page', String(state.page));
  params.set('limit', String(state.limit));

  if (state.status) params.set('status', state.status);
  if (state.search) params.set('search', state.search);
  if (state.onlyNeedsFollowup) params.set('onlyNeedsFollowup', 'true');

  return params.toString();
}

function renderSummary(rows = []) {
  const map = {
    active: 0,
    at_risk: 0,
    inactive: 0,
    lost: 0,
  };

  for (const row of rows) {
    if (row?.status in map) {
      map[row.status] = Number(row.total || 0);
    }
  }

  const total =
    map.active +
    map.at_risk +
    map.inactive +
    map.lost;

  els.sumTotal.textContent = String(total);
  els.sumActive.textContent = String(map.active);
  els.sumAtRisk.textContent = String(map.at_risk);
  els.sumInactive.textContent = String(map.inactive);
  els.sumLost.textContent = String(map.lost);
}

function renderTable(rows = []) {
  if (!rows.length) {
    els.activityTableBody.innerHTML = `
      <tr>
        <td colspan="12" class="ca-empty">Nenhum registro encontrado.</td>
      </tr>
    `;
    return;
  }

  els.activityTableBody.innerHTML = rows.map((row) => {
    const cityState = [row.city, row.state].filter(Boolean).join(' / ') || '-';
    const followupType = row.last_followup_type || '-';

    return `
      <tr>
        <td>${escapeHtml(row.customer_id)}</td>
        <td>${escapeHtml(row.trade_name || '-')}</td>
        <td>${escapeHtml(row.legal_name || '-')}</td>
        <td>${escapeHtml(row.tax_id || '-')}</td>
        <td>${statusBadge(row.status)}</td>
        <td>${escapeHtml(row.days_without_purchase ?? '-')}</td>
        <td>${escapeHtml(formatDate(row.last_purchase_date))}</td>
        <td>${escapeHtml(formatDateTime(row.last_followup_at))}</td>
        <td>${escapeHtml(followupType)}</td>
        <td>${escapeHtml(cityState)}</td>
        <td>${escapeHtml(row.salesperson || '-')}</td>
        <td>
          <div class="ca-actions">
            <button
              class="ca-btn ca-btn--small ca-btn--info"
              type="button"
              data-action="details"
              data-customer-id="${escapeHtml(row.customer_id)}"
            >
              Detalhes
            </button>

            <button
              class="ca-btn ca-btn--small ca-btn--success"
              type="button"
              data-action="quick-followup"
              data-customer-id="${escapeHtml(row.customer_id)}"
            >
              Follow-up
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function renderPagination() {
  const totalPages = Math.max(Math.ceil(state.total / state.limit), 1);
  els.paginationInfo.textContent = `Página ${state.page} de ${totalPages}`;
  els.btnPrevPage.disabled = state.page <= 1;
  els.btnNextPage.disabled = state.page >= totalPages;
}

function renderTableInfo() {
  if (!state.total) {
    els.tableInfo.textContent = 'Nenhum registro encontrado.';
    return;
  }

  const start = (state.page - 1) * state.limit + 1;
  const end = Math.min(start + state.rows.length - 1, state.total);

  els.tableInfo.textContent = `Exibindo ${start} até ${end} de ${state.total} registros`;
}

async function loadSummary() {
  const rows = await request(`${API_BASE}/summary`);
  renderSummary(Array.isArray(rows) ? rows : []);
}

async function loadActivities() {
  state.loading = true;
  setStatusMessage('Carregando registros...');

  try {
    const qs = buildQueryString();
    const data = await request(`${API_BASE}?${qs}`);

    state.rows = Array.isArray(data.rows) ? data.rows : [];
    state.total = Number(data.total || 0);

    renderTable(state.rows);
    renderPagination();
    renderTableInfo();

    setStatusMessage(`Registros carregados com sucesso.`);
  } catch (error) {
    console.error('[customerActivity][loadActivities]', error);
    els.activityTableBody.innerHTML = `
      <tr>
        <td colspan="12" class="ca-empty">Erro ao carregar os registros.</td>
      </tr>
    `;
    state.rows = [];
    state.total = 0;
    renderPagination();
    renderTableInfo();
    setStatusMessage(error.message || 'Erro ao carregar.', true);
  } finally {
    state.loading = false;
  }
}

async function loadAll() {
  try {
    await Promise.all([
      loadSummary(),
      loadActivities(),
    ]);
  } catch (error) {
    console.error('[customerActivity][loadAll]', error);
  }
}

function openDetailsModal() {
  els.detailsModal.classList.add('is-open');
  els.detailsModal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

function closeDetailsModal() {
  els.detailsModal.classList.remove('is-open');
  els.detailsModal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

function fillDetails(data) {
  els.detailsModalSubtitle.textContent =
    `${data.trade_name || data.legal_name || 'Cliente'} · Customer ID ${data.customer_id}`;

  els.detailCustomerId.textContent = data.customer_id ?? '-';
  els.detailTradeName.textContent = data.trade_name || '-';
  els.detailLegalName.textContent = data.legal_name || '-';
  els.detailTaxId.textContent = data.tax_id || '-';
  els.detailStatus.textContent = formatStatus(data.status);
  els.detailDaysWithoutPurchase.textContent = data.days_without_purchase ?? '-';
  els.detailLastPurchase.textContent = formatDate(data.last_purchase_date);
  els.detailLastContact.textContent = formatDateTime(data.last_contact_date);
  els.detailLastFollowupType.textContent = data.last_followup_type || '-';
  els.detailLastFollowupAt.textContent = formatDateTime(data.last_followup_at);
  els.detailFollowupCount.textContent = data.followup_count ?? 0;
  els.detailSalesperson.textContent = data.salesperson || '-';
  els.detailEmail.textContent = data.email || '-';
  els.detailPhone.textContent = data.phone_number || '-';
  els.detailMobile.textContent = data.mobile_number || '-';
  els.detailCityState.textContent = [data.city, data.state].filter(Boolean).join(' / ') || '-';

  els.followupCustomerId.value = data.customer_id ?? '';
  els.updateCustomerId.value = data.customer_id ?? '';

  els.followupType.value = '';
  els.followupStatus.value = '';
  els.followupReason.value = '';

  els.updateLastPurchaseDate.value = data.last_purchase_date
    ? String(data.last_purchase_date).slice(0, 10)
    : '';
  els.updateStatus.value = data.status || '';
  els.updateDaysWithoutPurchase.value = data.days_without_purchase ?? '';
  els.updateInactivityReason.value = data.inactivity_reason || '';
}

async function openCustomerDetails(customerId) {
  try {
    setStatusMessage('Carregando detalhes...');
    const data = await request(`${API_BASE}/customer/${customerId}`);
    state.selectedCustomerId = Number(customerId);
    fillDetails(data);
    openDetailsModal();
    setStatusMessage('Detalhes carregados com sucesso.');
  } catch (error) {
    console.error('[customerActivity][details]', error);
    setStatusMessage(error.message || 'Erro ao carregar detalhes.', true);
  }
}

async function registerQuickFollowup(customerId) {
  try {
    const confirmed = window.confirm(
      `Registrar follow-up rápido do tipo "call" para o customer_id ${customerId}?`
    );

    if (!confirmed) return;

    await request(`${API_BASE}/customer/${customerId}/followup`, {
      method: 'POST',
      body: JSON.stringify({
        followup_type: 'call',
      }),
    });

    setStatusMessage(`Follow-up rápido registrado para o cliente ${customerId}.`);
    await loadAll();
  } catch (error) {
    console.error('[customerActivity][quickFollowup]', error);
    setStatusMessage(error.message || 'Erro ao registrar follow-up.', true);
  }
}

async function handleRecalculate() {
  try {
    const confirmed = window.confirm(
      'Deseja recalcular os status de customerActivity agora?'
    );
    if (!confirmed) return;

    setStatusMessage('Recalculando status...');
    await request(`${API_BASE}/recalculate`, {
      method: 'POST',
      body: JSON.stringify({}),
    });

    setStatusMessage('Status recalculados com sucesso.');
    await loadAll();
  } catch (error) {
    console.error('[customerActivity][recalculate]', error);
    setStatusMessage(error.message || 'Erro ao recalcular.', true);
  }
}

async function handleFollowupSubmit(event) {
  event.preventDefault();

  const customerId = Number(els.followupCustomerId.value);
  const followupType = els.followupType.value;
  const status = els.followupStatus.value || null;
  const inactivityReason = els.followupReason.value.trim() || null;

  if (!customerId) {
    setStatusMessage('Customer ID inválido.', true);
    return;
  }

  if (!followupType) {
    setStatusMessage('Selecione o tipo de follow-up.', true);
    return;
  }

  try {
    setStatusMessage('Salvando follow-up...');

    await request(`${API_BASE}/customer/${customerId}/followup`, {
      method: 'POST',
      body: JSON.stringify({
        followup_type: followupType,
        status,
        inactivity_reason: inactivityReason,
      }),
    });

    setStatusMessage('Follow-up salvo com sucesso.');

    await Promise.all([
      loadSummary(),
      loadActivities(),
      openCustomerDetails(customerId),
    ]);
  } catch (error) {
    console.error('[customerActivity][saveFollowup]', error);
    setStatusMessage(error.message || 'Erro ao salvar follow-up.', true);
  }
}

async function handleUpdateSubmit(event) {
  event.preventDefault();

  const customerId = Number(els.updateCustomerId.value);
  if (!customerId) {
    setStatusMessage('Customer ID inválido.', true);
    return;
  }

  const payload = {};

  if (els.updateLastPurchaseDate.value) {
    payload.last_purchase_date = els.updateLastPurchaseDate.value;
  }

  if (els.updateStatus.value) {
    payload.status = els.updateStatus.value;
  }

  if (els.updateDaysWithoutPurchase.value !== '') {
    payload.days_without_purchase = Number(els.updateDaysWithoutPurchase.value);
  }

  payload.inactivity_reason = els.updateInactivityReason.value.trim() || null;

  try {
    setStatusMessage('Atualizando registro...');

    await request(`${API_BASE}/customer/${customerId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });

    setStatusMessage('Registro atualizado com sucesso.');

    await Promise.all([
      loadSummary(),
      loadActivities(),
      openCustomerDetails(customerId),
    ]);
  } catch (error) {
    console.error('[customerActivity][update]', error);
    setStatusMessage(error.message || 'Erro ao atualizar registro.', true);
  }
}

function bindEvents() {
  els.btnReload?.addEventListener('click', () => {
    loadAll();
  });

  els.btnRecalculate?.addEventListener('click', handleRecalculate);

  els.searchInput?.addEventListener('input', () => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => {
      state.search = els.searchInput.value.trim();
      state.page = 1;
      loadActivities();
    }, 350);
  });

  els.statusFilter?.addEventListener('change', () => {
    state.status = els.statusFilter.value;
    state.page = 1;
    loadActivities();
  });

  els.limitFilter?.addEventListener('change', () => {
    state.limit = Number(els.limitFilter.value) || 50;
    state.page = 1;
    loadActivities();
  });

  els.needsFollowupOnly?.addEventListener('change', () => {
    state.onlyNeedsFollowup = els.needsFollowupOnly.checked;
    state.page = 1;
    loadActivities();
  });

  els.btnPrevPage?.addEventListener('click', () => {
    if (state.page <= 1) return;
    state.page -= 1;
    loadActivities();
  });

  els.btnNextPage?.addEventListener('click', () => {
    const totalPages = Math.max(Math.ceil(state.total / state.limit), 1);
    if (state.page >= totalPages) return;
    state.page += 1;
    loadActivities();
  });

  els.activityTableBody?.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;

    const action = button.dataset.action;
    const customerId = button.dataset.customerId;

    if (!customerId) return;

    if (action === 'details') {
      openCustomerDetails(customerId);
      return;
    }

    if (action === 'quick-followup') {
      registerQuickFollowup(customerId);
    }
  });

  els.btnCloseDetailsModal?.addEventListener('click', closeDetailsModal);

  els.detailsModal?.addEventListener('click', (event) => {
    if (event.target.matches('[data-close-details]')) {
      closeDetailsModal();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && els.detailsModal.classList.contains('is-open')) {
      closeDetailsModal();
    }
  });

  els.followupForm?.addEventListener('submit', handleFollowupSubmit);
  els.activityUpdateForm?.addEventListener('submit', handleUpdateSubmit);
}

async function init() {
  bindEvents();
  await loadAll();
}

init();