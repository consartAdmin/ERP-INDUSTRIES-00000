// ╔══════════════════════════════════════════════════════════════════════╗
// ║ googleAdsDashboard.js — Dashboard Tráfego Pago Manual               ║
// ║ PRODNEX ERP                                                         ║
// ║ - CRUD local                                                        ║
// ║ - Não depende da integração Google Ads                              ║
// ║ - KPIs + tabela + filtros + modal                                   ║
// ╚══════════════════════════════════════════════════════════════════════╝

const API_BASE = (window.apiBase || window.API_BASE || window.location.origin).replace(/\/$/, '');
const API_URL = `${API_BASE}/api/marketing/google-ads`;

let els = {};
let allRows = [];

const sortState = {
  by: 'cost',
  dir: 'desc',
};

function bindEls() {
  els = {
    filterMode: document.getElementById('gad-filter-mode'),
    campaignFilter: document.getElementById('gad-campaign-filter'),
    channelFilter: document.getElementById('gad-channel-filter'),
    statusFilter: document.getElementById('gad-status-filter'),
    sortBy: document.getElementById('gad-sort-by'),
    sortDirBtn: document.getElementById('gad-sort-dir'),

    dateInputsBox: document.getElementById('gad-date-inputs'),
    dateInputsLabel: document.getElementById('gad-date-inputs-label'),
    dateSingle: document.getElementById('gad-date-single'),
    dateFrom: document.getElementById('gad-date-from'),
    dateTo: document.getElementById('gad-date-to'),
    year: document.getElementById('gad-year'),
    monthSelect: document.getElementById('gad-month-select'),
    dateSeparator: document.getElementById('gad-date-separator'),

    refreshBtn: document.getElementById('gad-refresh-btn'),
    newBtn: document.getElementById('gad-new-btn'),
    debugBtn: document.getElementById('gad-debug-btn'),
    debugCard: document.getElementById('gad-debug-card'),
    debugCloseBtn: document.getElementById('gad-debug-close-btn'),
    debugPre: document.getElementById('gad-debug-pre'),

    tableBody: document.getElementById('gad-table-body'),
    tableMeta: document.getElementById('gad-table-meta'),

    kpiCost: document.getElementById('gad-kpi-cost'),
    kpiCostPerDay: document.getElementById('gad-kpi-cost-per-day'),
    kpiClicks: document.getElementById('gad-kpi-clicks'),
    kpiCpc: document.getElementById('gad-kpi-cpc'),
    kpiConversions: document.getElementById('gad-kpi-conversions'),
    kpiConvRate: document.getElementById('gad-kpi-conv-rate'),
    kpiRevenue: document.getElementById('gad-kpi-revenue'),
    kpiRoas: document.getElementById('gad-kpi-roas'),

    modal: document.getElementById('gad-modal'),
    modalBackdrop: document.getElementById('gad-modal-backdrop'),
    modalTitle: document.getElementById('gad-modal-title'),
    modalCloseBtn: document.getElementById('gad-modal-close-btn'),

    form: document.getElementById('gad-form'),
    formCancelBtn: document.getElementById('gad-form-cancel-btn'),
    formSaveBtn: document.getElementById('gad-form-save-btn'),

    formId: document.getElementById('gad-id'),
    formCampaignName: document.getElementById('gad-form-campaign-name'),
    formChannel: document.getElementById('gad-form-channel'),
    formStatus: document.getElementById('gad-form-status'),
    formDate: document.getElementById('gad-form-date'),
    formImpressions: document.getElementById('gad-form-impressions'),
    formClicks: document.getElementById('gad-form-clicks'),
    formCost: document.getElementById('gad-form-cost'),
    formConversions: document.getElementById('gad-form-conversions'),
    formConvValue: document.getElementById('gad-form-conv-value'),
    formNotes: document.getElementById('gad-form-notes'),
  };
}

function authHeaders(extra = {}) {
  const token =
    localStorage.getItem('CONSART_TOKEN') ||
    localStorage.getItem('token') ||
    sessionStorage.getItem('CONSART_TOKEN') ||
    sessionStorage.getItem('token') ||
    '';

  const headers = {
    'Content-Type': 'application/json',
    ...extra,
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
    headers['x-access-token'] = token;
  }

  return headers;
}

async function fetchJson(url, opts = {}) {
  const res = await fetch(url, {
    ...opts,
    headers: {
      ...authHeaders(),
      ...(opts.headers || {}),
    },
  });

  const ct = res.headers.get('content-type') || '';
  const isJson = ct.includes('application/json');
  const payload = isJson ? await res.json() : await res.text();

  if (!res.ok) {
    const message =
      payload?.message ||
      payload?.error ||
      payload?.details ||
      `HTTP ${res.status} ${res.statusText}`;
    throw new Error(message);
  }

  return payload;
}

function fmtMoney(v) {
  return Number(v || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  });
}

function fmtNumber(v) {
  return Number(v || 0).toLocaleString('pt-BR');
}

function fmtPercent(v) {
  const n = Number(v || 0);
  return `${n.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function toNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeStatus(status) {
  const s = String(status || '').trim().toUpperCase();
  if (['ENABLED', 'ATIVA', 'ACTIVE'].includes(s)) return 'ENABLED';
  if (['PAUSED', 'PAUSADA'].includes(s)) return 'PAUSED';
  if (['REMOVED', 'REMOVIDA', 'REMOVIDO'].includes(s)) return 'REMOVED';
  return 'ENABLED';
}

function normalizeChannel(channel) {
  return String(channel || 'OTHER').trim().toUpperCase();
}

function normalizeRow(row) {
  const impressions = toNumber(row.impressions);
  const clicks = toNumber(row.clicks);
  const cost = toNumber(row.cost);
  const conversions = toNumber(row.conversions);
  const convValue = toNumber(row.convValue ?? row.conversionValue);

  const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
  const roas = cost > 0 ? convValue / cost : 0;

  return {
    id: row.id,
    campaignName: row.campaignName || row.campaign_name || '',
    channel: normalizeChannel(row.channel),
    status: normalizeStatus(row.status),
    date: row.date || '',
    impressions,
    clicks,
    ctr,
    cost,
    conversions,
    convValue,
    roas,
    notes: row.notes || '',
    source: row.source || 'manual',
    createdAt: row.createdAt || row.created_at || null,
    updatedAt: row.updatedAt || row.updated_at || null,
  };
}

function pad(n) {
  return String(n).padStart(2, '0');
}

function toIso(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function resolveDateRange(mode, custom = {}) {
  const today = new Date();
  const clone = (d) => new Date(d.getTime());

  if (mode === 'ALL') {
    return { start: null, end: null, days: 0 };
  }

  let startDate;
  let endDate;

  switch (mode) {
    case 'LAST_7_DAYS': {
      const s = clone(today);
      s.setDate(s.getDate() - 7);
      startDate = s;
      endDate = today;
      break;
    }
    case 'LAST_14_DAYS': {
      const s = clone(today);
      s.setDate(s.getDate() - 14);
      startDate = s;
      endDate = today;
      break;
    }
    case 'LAST_90_DAYS': {
      const s = clone(today);
      s.setDate(s.getDate() - 90);
      startDate = s;
      endDate = today;
      break;
    }
    case 'TODAY': {
      startDate = today;
      endDate = today;
      break;
    }
    case 'YESTERDAY': {
      const y = clone(today);
      y.setDate(y.getDate() - 1);
      startDate = y;
      endDate = y;
      break;
    }
    case 'SPECIFIC_DAY': {
      const raw = custom.single;
      const d = raw ? new Date(`${raw}T00:00:00`) : today;
      startDate = d;
      endDate = d;
      break;
    }
    case 'MONTH': {
      const year = Number(custom.year || today.getFullYear());
      const month = Number(custom.month || (today.getMonth() + 1));
      startDate = new Date(year, month - 1, 1);
      endDate = new Date(year, month, 0);
      break;
    }
    case 'CUSTOM_RANGE': {
      const rawFrom = custom.from;
      const rawTo = custom.to;

      if (rawFrom && rawTo) {
        let s = new Date(`${rawFrom}T00:00:00`);
        let e = new Date(`${rawTo}T00:00:00`);
        if (s > e) [s, e] = [e, s];
        startDate = s;
        endDate = e;
      } else if (rawFrom) {
        const d = new Date(`${rawFrom}T00:00:00`);
        startDate = d;
        endDate = d;
      } else if (rawTo) {
        const d = new Date(`${rawTo}T00:00:00`);
        startDate = d;
        endDate = d;
      } else {
        startDate = today;
        endDate = today;
      }
      break;
    }
    case 'LAST_30_DAYS':
    default: {
      const s = clone(today);
      s.setDate(s.getDate() - 30);
      startDate = s;
      endDate = today;
      break;
    }
  }

  const start = toIso(startDate);
  const end = toIso(endDate);
  const diffMs = endDate - startDate;
  const days = Math.max(1, Math.round(diffMs / 86400000) + 1);

  return { start, end, days };
}

function getCurrentRange() {
  return resolveDateRange(els.filterMode.value, {
    single: els.dateSingle.value,
    from: els.dateFrom.value,
    to: els.dateTo.value,
    year: els.year.value,
    month: els.monthSelect.value,
  });
}

function updateDateInputsVisibility() {
  const mode = els.filterMode.value;

  els.dateInputsBox.hidden = true;
  els.dateSingle.style.display = 'none';
  els.dateFrom.style.display = 'none';
  els.dateTo.style.display = 'none';
  els.year.style.display = 'none';
  els.monthSelect.style.display = 'none';
  els.dateSeparator.style.display = 'none';

  if (mode === 'SPECIFIC_DAY') {
    els.dateInputsBox.hidden = false;
    els.dateInputsLabel.textContent = 'Data específica';
    els.dateSingle.style.display = 'inline-block';
  } else if (mode === 'MONTH') {
    els.dateInputsBox.hidden = false;
    els.dateInputsLabel.textContent = 'Mês específico';
    els.year.style.display = 'inline-block';
    els.monthSelect.style.display = 'inline-block';
  } else if (mode === 'CUSTOM_RANGE') {
    els.dateInputsBox.hidden = false;
    els.dateInputsLabel.textContent = 'Intervalo';
    els.dateFrom.style.display = 'inline-block';
    els.dateTo.style.display = 'inline-block';
    els.dateSeparator.style.display = 'inline-block';
  }
}

function initYearMonthSelects() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  els.year.innerHTML = '';
  for (let year = currentYear - 5; year <= currentYear + 2; year++) {
    const option = document.createElement('option');
    option.value = String(year);
    option.textContent = String(year);
    if (year === currentYear) option.selected = true;
    els.year.appendChild(option);
  }

  els.monthSelect.value = String(currentMonth);
}

function setSortDirUi() {
  els.sortDirBtn.textContent =
    sortState.dir === 'desc'
      ? '⬇️ Maior → Menor'
      : '⬆️ Menor → Maior';
}

function getSortableValue(row, by) {
  switch (by) {
    case 'campaignName':
      return row.campaignName || '';
    case 'clicks':
      return row.clicks;
    case 'impressions':
      return row.impressions;
    case 'ctr':
      return row.ctr;
    case 'conversions':
      return row.conversions;
    case 'convValue':
      return row.convValue;
    case 'roas':
      return row.roas;
    case 'date':
      return row.date || '';
    case 'cost':
    default:
      return row.cost;
  }
}

function sortRows(rows) {
  const factor = sortState.dir === 'asc' ? 1 : -1;

  return [...rows].sort((a, b) => {
    const va = getSortableValue(a, sortState.by);
    const vb = getSortableValue(b, sortState.by);

    if (typeof va === 'string' || typeof vb === 'string') {
      return String(va).localeCompare(String(vb), 'pt-BR') * factor;
    }

    if (va === vb) return 0;
    return (va > vb ? 1 : -1) * factor;
  });
}

function rowMatchesFilters(row) {
  const campaignIdFilter = els.campaignFilter.value;
  const channelFilter = els.channelFilter.value;
  const statusFilter = els.statusFilter.value;
  const { start, end } = getCurrentRange();

  if (campaignIdFilter && String(row.id) !== String(campaignIdFilter)) return false;
  if (channelFilter && row.channel !== channelFilter) return false;
  if (statusFilter && row.status !== statusFilter) return false;

  if (start && row.date && row.date < start) return false;
  if (end && row.date && row.date > end) return false;

  return true;
}

function getFilteredRows() {
  return sortRows(allRows.filter(rowMatchesFilters));
}

function mapStatusPill(status) {
  if (status === 'ENABLED') return 'enabled';
  if (status === 'PAUSED') return 'paused';
  if (status === 'REMOVED') return 'removed';
  return 'enabled';
}

function statusLabel(status) {
  if (status === 'ENABLED') return 'Ativa';
  if (status === 'PAUSED') return 'Pausada';
  if (status === 'REMOVED') return 'Removida';
  return status || '-';
}

function channelLabel(channel) {
  const map = {
    SEARCH: 'Pesquisa',
    DISPLAY: 'Display',
    VIDEO: 'Vídeo',
    SHOPPING: 'Shopping',
    PERFORMANCE_MAX: 'Performance Max',
    DISCOVERY: 'Discovery',
    OTHER: 'Outro',
  };
  return map[channel] || channel || '-';
}

function renderCampaignOptions(rows = []) {
  const currentValue = els.campaignFilter.value;
  const unique = new Map();

  for (const row of rows) {
    if (!row.id) continue;
    unique.set(String(row.id), row.campaignName || `Campanha ${row.id}`);
  }

  els.campaignFilter.innerHTML = '<option value="">Todas as campanhas</option>';

  [...unique.entries()]
    .sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'))
    .forEach(([id, name]) => {
      const opt = document.createElement('option');
      opt.value = id;
      opt.textContent = name;
      els.campaignFilter.appendChild(opt);
    });

  if ([...els.campaignFilter.options].some((o) => o.value === currentValue)) {
    els.campaignFilter.value = currentValue;
  }
}

function renderTable(rows) {
  els.tableBody.innerHTML = '';

  if (!rows.length) {
    const tr = document.createElement('tr');
    tr.className = 'gad-table-empty';
    tr.innerHTML = '<td colspan="12">Nenhum lançamento encontrado para os filtros selecionados.</td>';
    els.tableBody.appendChild(tr);
    els.tableMeta.textContent = '0 registros';
    return;
  }

  const campaignsCount = new Set(rows.map((row) => row.campaignName)).size;
  els.tableMeta.textContent = `${rows.length} registro(s) · ${campaignsCount} campanha(s)`;

  for (const row of rows) {
    const pillVariant = mapStatusPill(row.status);
    const tr = document.createElement('tr');

    tr.innerHTML = `
      <td>${escapeHtml(row.campaignName)}</td>
      <td>${escapeHtml(channelLabel(row.channel))}</td>
      <td><span class="gad-status-pill-inline gad-status-pill--${pillVariant}">${escapeHtml(statusLabel(row.status))}</span></td>
      <td>${escapeHtml(row.date || '-')}</td>
      <td>${fmtNumber(row.impressions)}</td>
      <td>${fmtNumber(row.clicks)}</td>
      <td>${fmtPercent(row.ctr)}</td>
      <td>${fmtMoney(row.cost)}</td>
      <td>${fmtNumber(row.conversions)}</td>
      <td>${fmtMoney(row.convValue)}</td>
      <td>${row.cost > 0 ? `${row.roas.toFixed(2)}x` : '—'}</td>
      <td>
        <div class="gad-row-actions">
          <button class="btn-soft btn-soft--small" data-action="edit" data-id="${row.id}">Editar</button>
          <button class="btn-soft btn-soft--small gad-btn-danger" data-action="delete" data-id="${row.id}">Excluir</button>
        </div>
      </td>
    `;

    els.tableBody.appendChild(tr);
  }
}

function renderKpis(rows, days) {
  let totalImpressions = 0;
  let totalClicks = 0;
  let totalCost = 0;
  let totalConversions = 0;
  let totalConvValue = 0;

  for (const row of rows) {
    totalImpressions += row.impressions;
    totalClicks += row.clicks;
    totalCost += row.cost;
    totalConversions += row.conversions;
    totalConvValue += row.convValue;
  }

  const cpc = totalClicks > 0 ? totalCost / totalClicks : 0;
  const convRate = totalClicks > 0 ? (totalConversions / totalClicks) * 100 : 0;
  const roas = totalCost > 0 ? totalConvValue / totalCost : 0;
  const effectiveDays = days || Math.max(1, new Set(rows.map((row) => row.date)).size);
  const costPerDay = effectiveDays > 0 ? totalCost / effectiveDays : 0;

  els.kpiCost.textContent = fmtMoney(totalCost);
  els.kpiCostPerDay.textContent = `${fmtMoney(costPerDay)} / dia`;

  els.kpiClicks.textContent = fmtNumber(totalClicks);
  els.kpiCpc.textContent = totalClicks ? `CPC médio ${fmtMoney(cpc)}` : 'CPC médio —';

  els.kpiConversions.textContent = fmtNumber(totalConversions);
  els.kpiConvRate.textContent = totalClicks ? `Taxa conv. ${fmtPercent(convRate)}` : 'Taxa conv. —';

  els.kpiRevenue.textContent = fmtMoney(totalConvValue);
  els.kpiRoas.textContent = totalCost ? `ROAS ${roas.toFixed(2)}x` : 'ROAS —';
}

function renderDebug(rows) {
  els.debugPre.textContent = JSON.stringify(rows, null, 2);
}

function render() {
  const filteredRows = getFilteredRows();
  const range = getCurrentRange();

  renderTable(filteredRows);
  renderKpis(filteredRows, range.days);
  renderDebug(filteredRows);
}

function toggleDebug(show) {
  els.debugCard.hidden = !show;
}

function openModal(mode = 'create', row = null) {
  els.modal.hidden = false;

  if (mode === 'edit' && row) {
    els.modalTitle.textContent = 'Editar lançamento';
    els.formSaveBtn.textContent = 'Salvar alterações';

    els.formId.value = row.id || '';
    els.formCampaignName.value = row.campaignName || '';
    els.formChannel.value = row.channel || 'SEARCH';
    els.formStatus.value = row.status || 'ENABLED';
    els.formDate.value = row.date || '';
    els.formImpressions.value = String(row.impressions || 0);
    els.formClicks.value = String(row.clicks || 0);
    els.formCost.value = String(row.cost || 0);
    els.formConversions.value = String(row.conversions || 0);
    els.formConvValue.value = String(row.convValue || 0);
    els.formNotes.value = row.notes || '';
  } else {
    els.modalTitle.textContent = 'Novo lançamento';
    els.formSaveBtn.textContent = 'Salvar lançamento';
    els.form.reset();
    els.formId.value = '';
    els.formDate.value = new Date().toISOString().slice(0, 10);
    els.formStatus.value = 'ENABLED';
    els.formChannel.value = 'SEARCH';
    els.formImpressions.value = '0';
    els.formClicks.value = '0';
    els.formCost.value = '0';
    els.formConversions.value = '0';
    els.formConvValue.value = '0';
  }

  setTimeout(() => els.formCampaignName.focus(), 50);
}

function closeModal() {
  els.modal.hidden = true;
}

function getFormPayload() {
  const impressions = toNumber(els.formImpressions.value);
  const clicks = toNumber(els.formClicks.value);
  const cost = toNumber(els.formCost.value);
  const conversions = toNumber(els.formConversions.value);
  const convValue = toNumber(els.formConvValue.value);

  return {
    campaignName: els.formCampaignName.value.trim(),
    channel: normalizeChannel(els.formChannel.value),
    status: normalizeStatus(els.formStatus.value),
    date: els.formDate.value,
    impressions,
    clicks,
    cost,
    conversions,
    convValue,
    notes: els.formNotes.value.trim(),
    source: 'manual',
  };
}

function validatePayload(payload) {
  if (!payload.campaignName) {
    throw new Error('Informe o nome da campanha.');
  }
  if (!payload.date) {
    throw new Error('Informe a data.');
  }
  if (payload.impressions < 0 || payload.clicks < 0 || payload.cost < 0 || payload.conversions < 0 || payload.convValue < 0) {
    throw new Error('Os valores numéricos não podem ser negativos.');
  }
}

async function loadRows() {
  els.refreshBtn.disabled = true;
  els.refreshBtn.textContent = 'Carregando...';

  try {
    const res = await fetchJson(API_URL, { method: 'GET' });
    const rows = res?.data?.rows || res?.rows || res?.data || res || [];
    allRows = Array.isArray(rows) ? rows.map(normalizeRow) : [];
    renderCampaignOptions(allRows);
    render();
  } catch (err) {
    console.error('[googleAdsDashboard] loadRows error:', err);
    alert(`Erro ao carregar os registros.\n\n${err.message}`);
  } finally {
    els.refreshBtn.disabled = false;
    els.refreshBtn.textContent = '🔄 Atualizar';
  }
}

async function saveForm(event) {
  event.preventDefault();

  try {
    const payload = getFormPayload();
    validatePayload(payload);

    const id = els.formId.value.trim();
    const url = id ? `${API_URL}/${encodeURIComponent(id)}` : API_URL;
    const method = id ? 'PUT' : 'POST';

    els.formSaveBtn.disabled = true;
    els.formSaveBtn.textContent = 'Salvando...';

    await fetchJson(url, {
      method,
      body: JSON.stringify(payload),
    });

    closeModal();
    await loadRows();
  } catch (err) {
    console.error('[googleAdsDashboard] saveForm error:', err);
    alert(`Erro ao salvar.\n\n${err.message}`);
  } finally {
    els.formSaveBtn.disabled = false;
    els.formSaveBtn.textContent = els.formId.value ? 'Salvar alterações' : 'Salvar lançamento';
  }
}

async function deleteRow(id) {
  if (!id) return;

  const ok = confirm('Deseja realmente excluir este lançamento?');
  if (!ok) return;

  try {
    await fetchJson(`${API_URL}/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    await loadRows();
  } catch (err) {
    console.error('[googleAdsDashboard] deleteRow error:', err);
    alert(`Erro ao excluir.\n\n${err.message}`);
  }
}

function handleTableClick(event) {
  const btn = event.target.closest('button[data-action]');
  if (!btn) return;

  const action = btn.dataset.action;
  const id = btn.dataset.id;
  const row = allRows.find((item) => String(item.id) === String(id));

  if (action === 'edit' && row) {
    openModal('edit', row);
  } else if (action === 'delete' && id) {
    deleteRow(id);
  }
}

function bindEvents() {
  els.refreshBtn.addEventListener('click', loadRows);
  els.newBtn.addEventListener('click', () => openModal('create'));
  els.debugBtn.addEventListener('click', () => toggleDebug(true));
  els.debugCloseBtn.addEventListener('click', () => toggleDebug(false));

  els.filterMode.addEventListener('change', () => {
    updateDateInputsVisibility();
    render();
  });

  els.campaignFilter.addEventListener('change', render);
  els.channelFilter.addEventListener('change', render);
  els.statusFilter.addEventListener('change', render);

  els.dateSingle.addEventListener('change', render);
  els.dateFrom.addEventListener('change', render);
  els.dateTo.addEventListener('change', render);
  els.year.addEventListener('change', render);
  els.monthSelect.addEventListener('change', render);

  els.sortBy.addEventListener('change', () => {
    sortState.by = els.sortBy.value;
    render();
  });

  els.sortDirBtn.addEventListener('click', () => {
    sortState.dir = sortState.dir === 'desc' ? 'asc' : 'desc';
    setSortDirUi();
    render();
  });

  els.modalCloseBtn.addEventListener('click', closeModal);
  els.modalBackdrop.addEventListener('click', closeModal);
  els.formCancelBtn.addEventListener('click', closeModal);
  els.form.addEventListener('submit', saveForm);

  els.tableBody.addEventListener('click', handleTableClick);

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !els.modal.hidden) {
      closeModal();
    }
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  bindEls();
  initYearMonthSelects();
  updateDateInputsVisibility();

  if (els.sortBy.value) {
    sortState.by = els.sortBy.value;
  }
  setSortDirUi();

  bindEvents();
  await loadRows();
});