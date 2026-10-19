// ╔══════════════════════════════════════════════════════════════════════╗
// ║ deliveryRoutes.js — Rotas de Entrega + Paradas da Rota              ║
// ║ PRODNEX ERP | Frontend (ESM)                                        ║
// ║ ✅ Rotas: listar / criar / editar / ativar / excluir                ║
// ║ ✅ Vínculo por modal: cliente / fornecedor                          ║
// ║ ✅ Paradas: listar / criar / editar / excluir / status / reorder    ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { openCustomersModalSearch } from '/public/modalsSearch/customersModalSearch.js';
import { openSuppliersModalSearch } from '/public/modalsSearch/suppliersModalSearch.js';

// ==========================================================
// API BASE
// ==========================================================
function guessBackendOrigin() {
  const { protocol, hostname, port } = window.location;
  const suspectPorts = new Set(['8080', '5173', '5500', '5501', '4173']);
  if (suspectPorts.has(String(port || ''))) return `${protocol}//${hostname}:8080`;
  return window.location.origin;
}

let API_BASE = (window.API_BASE || '').toString().trim() || guessBackendOrigin();

try {
  const mod = await import('/public/includes/js/apiBase.js');
  API_BASE = (mod?.apiBase || mod?.getApiBase?.() || API_BASE);
} catch (_) {}

const ROUTE_ENDPOINTS = [
  `${API_BASE}/api/delivery-routes`,
  `${API_BASE}/api/deliveryRoutes`,
];

const STOP_ENDPOINTS = [
  `${API_BASE}/api/deliveryRouteStops`,
];

// ==========================================================
// DOM
// ==========================================================
const els = {
  // lista rotas
  tableBody: document.getElementById('routesTableBody'),
  lblCount: document.getElementById('lblCount'),
  lblPage: document.getElementById('lblPage'),
  btnPrev: document.getElementById('btnPrev'),
  btnNext: document.getElementById('btnNext'),
  searchInput: document.getElementById('searchInput'),
  statusFilter: document.getElementById('statusFilter'),
  typeFilter: document.getElementById('typeFilter'),
  btnSearch: document.getElementById('btnSearch'),
  btnClear: document.getElementById('btnClear'),
  btnGoNew: document.getElementById('btnGoNew'),

  // form rota
  form: document.getElementById('formRoute'),
  formTitle: document.getElementById('formTitle'),
  route_id: document.getElementById('route_id'),
  name: document.getElementById('name'),
  route_type: document.getElementById('route_type'),
  route_code: document.getElementById('route_code'),
  city: document.getElementById('city'),
  region: document.getElementById('region'),
  driver_name: document.getElementById('driver_name'),
  vehicle_plate: document.getElementById('vehicle_plate'),
  is_active: document.getElementById('is_active'),
  notes: document.getElementById('notes'),
  btnCancelEdit: document.getElementById('btnCancelEdit'),
  btnGoStops: document.getElementById('btnGoStops'),

  // vínculo rota
  customer_id: document.getElementById('customer_id'),
  supplier_id: document.getElementById('supplier_id'),
  linked_name: document.getElementById('linked_name'),
  linked_tax_id: document.getElementById('linked_tax_id'),
  linked_display: document.getElementById('linked_display'),
  btnPickLinked: document.getElementById('btnPickLinked'),
  btnClearLinked: document.getElementById('btnClearLinked'),

  // tab paradas
  stopsRouteInfo: document.getElementById('stopsRouteInfo'),
  stopsEmptyState: document.getElementById('stopsEmptyState'),
  stopsContent: document.getElementById('stopsContent'),
  btnBackToRoute: document.getElementById('btnBackToRoute'),

  // form parada
  formStop: document.getElementById('formStop'),
  stop_id: document.getElementById('stop_id'),
  stop_order: document.getElementById('stop_order'),
  movement_type: document.getElementById('movement_type'),
  linked_type: document.getElementById('linked_type'),
  stop_status: document.getElementById('stop_status'),
  stop_customer_id: document.getElementById('stop_customer_id'),
  stop_supplier_id: document.getElementById('stop_supplier_id'),
  stop_linked_display: document.getElementById('stop_linked_display'),
  btnPickStopLinked: document.getElementById('btnPickStopLinked'),
  btnClearStopLinked: document.getElementById('btnClearStopLinked'),
  stop_name: document.getElementById('stop_name'),
  stop_tax_id: document.getElementById('stop_tax_id'),
  stop_contact_name: document.getElementById('stop_contact_name'),
  stop_phone: document.getElementById('stop_phone'),
  stop_address: document.getElementById('stop_address'),
  stop_city: document.getElementById('stop_city'),
  stop_region: document.getElementById('stop_region'),
  stop_expected_date: document.getElementById('stop_expected_date'),
  stop_expected_time: document.getElementById('stop_expected_time'),
  stop_notes: document.getElementById('stop_notes'),
  btnCancelStop: document.getElementById('btnCancelStop'),
  btnSaveStop: document.getElementById('btnSaveStop'),

  // tabela paradas
  stopsTableBody: document.getElementById('stopsTableBody'),
  lblStopsCount: document.getElementById('lblStopsCount'),
};

const state = {
  routeApi: null,
  stopApi: null,
  limit: 50,
  offset: 0,
  total: 0,
  currentRouteId: null,
  currentRoute: null,
  stops: [],
};

// ==========================================================
// AUTH
// ==========================================================
function getAuthToken() {
  return (
    localStorage.getItem('CONSART_TOKEN') ||
    localStorage.getItem('token') ||
    localStorage.getItem('access_token') ||
    localStorage.getItem('auth_token') ||
    localStorage.getItem('jwt') ||
    sessionStorage.getItem('CONSART_TOKEN') ||
    sessionStorage.getItem('token') ||
    sessionStorage.getItem('access_token') ||
    sessionStorage.getItem('auth_token') ||
    sessionStorage.getItem('jwt') ||
    null
  );
}

function authHeaders(extra = {}) {
  const token = getAuthToken();
  const h = { Accept: 'application/json', ...extra };
  if (token) {
    h.Authorization = `Bearer ${token}`;
    h['x-access-token'] = token;
  }
  return h;
}

// ==========================================================
// UTILS
// ==========================================================
function escapeHtml(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function toText(v) {
  return String(v ?? '').trim();
}

function toNullableText(v) {
  const s = String(v ?? '').trim();
  return s || null;
}

function toNullableInt(v) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function qsWeekdaysChecked() {
  return Array.from(document.querySelectorAll('.routes-weekdays__chips input[type="checkbox"]:checked'))
    .map((cb) => Number(cb.value))
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= 7);
}

function setWeekdaysChecked(arr) {
  const set = new Set((arr || []).map(Number));
  document.querySelectorAll('.routes-weekdays__chips input[type="checkbox"]').forEach((cb) => {
    cb.checked = set.has(Number(cb.value));
  });
}

function labelRouteType(v) {
  return v === 'suppliers' ? '📦 Fornecedores' : '🚚 Clientes';
}

function labelMovementType(v) {
  return v === 'pickup' ? '📦 Coleta' : '🚚 Entrega';
}

function labelLinkedType(v) {
  if (v === 'supplier') return 'Fornecedor';
  if (v === 'customer') return 'Cliente';
  return 'Avulso';
}

function labelStopStatus(v) {
  if (v === 'done') return 'Concluído';
  if (v === 'canceled') return 'Cancelado';
  return 'Pendente';
}

function badgeMovementClass(v) {
  return v === 'pickup' ? 'badge-movement-pickup' : 'badge-movement-delivery';
}

function badgeStatusClass(v) {
  if (v === 'done') return 'badge-status-done';
  if (v === 'canceled') return 'badge-status-canceled';
  return 'badge-status-pending';
}

function goTab(key) {
  if (window.__routesTabs?.go) window.__routesTabs.go(key);
}

function notifyError(err, fallback = 'Falha na operação.') {
  console.error(err);
  alert(err?.message || fallback);
}

// ==========================================================
// FETCH JSON
// ==========================================================
async function fetchJSON(url, options = {}) {
  const hasBody = Object.prototype.hasOwnProperty.call(options, 'body');

  const res = await fetch(url, {
    ...options,
    headers: {
      ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
      ...authHeaders(options.headers || {}),
    },
  });

  let body = null;
  const ct = (res.headers.get('content-type') || '').toLowerCase();

  if (ct.includes('application/json')) {
    body = await res.json().catch(() => null);
  } else {
    const txt = await res.text().catch(() => '');
    body = txt ? { raw: txt } : null;
  }

  if (!res.ok) {
    const msg =
      body?.error ||
      body?.message ||
      body?.raw ||
      (res.status === 404 ? 'Not Found' : `HTTP ${res.status}`);
    const err = new Error(msg);
    err.status = res.status;
    err.body = body;
    throw err;
  }

  return body;
}

async function detectApiBase(candidates, probePath = '?limit=1&offset=0') {
  for (const base of candidates) {
    try {
      await fetchJSON(`${base}${probePath}`);
      return base;
    } catch (e) {
      if (e?.status === 401) return base;
    }
  }
  return candidates[0];
}

// ==========================================================
// ROUTE LINK
// ==========================================================
function clearLinked() {
  els.customer_id.value = '';
  els.supplier_id.value = '';
  els.linked_name.value = '';
  els.linked_tax_id.value = '';
  els.linked_display.value = '';
}

function setLinkedDisplay() {
  const type = toText(els.route_type?.value || 'customers');
  const name = toText(els.linked_name.value);
  const tax = toText(els.linked_tax_id.value);
  const id = type === 'suppliers'
    ? toText(els.supplier_id.value)
    : toText(els.customer_id.value);

  if (!id && !name) {
    els.linked_display.value = '';
    return;
  }

  const prefix = type === 'suppliers' ? 'Fornecedor' : 'Cliente';
  els.linked_display.value = `${prefix}: ${name || '(sem nome)'}${tax ? ` • ${tax}` : ''}${id ? ` • #${id}` : ''}`;
}

async function pickLinkedByType() {
  const type = toText(els.route_type?.value || 'customers');

  if (type === 'customers') {
    openCustomersModalSearch({
      apiBase: API_BASE,
      onPick: (c) => {
        const id = c.customer_id ?? c.id ?? '';
        const nome = c.trade_name ?? c.legal_name ?? c.name ?? '';
        const doc = c.tax_id ?? c.cnpj_cpf ?? '';

        clearLinked();
        els.customer_id.value = String(id || '');
        els.linked_name.value = String(nome || '');
        els.linked_tax_id.value = String(doc || '');
        setLinkedDisplay();
      }
    });
    return;
  }

  const s = await openSuppliersModalSearch();
  if (!s) return;

  const id = s.supplier_id ?? s.id ?? '';
  const nome = s.name ?? '';
  const doc = s.tax_id ?? '';

  clearLinked();
  els.supplier_id.value = String(id || '');
  els.linked_name.value = String(nome || '');
  els.linked_tax_id.value = String(doc || '');
  setLinkedDisplay();
}

// ==========================================================
// STOP LINK
// ==========================================================
function clearStopLinked() {
  els.stop_customer_id.value = '';
  els.stop_supplier_id.value = '';
  els.stop_linked_display.value = '';
}

function setStopLinkedDisplay() {
  const type = toText(els.linked_type?.value || 'other');
  const name = toText(els.stop_name.value);
  const tax = toText(els.stop_tax_id.value);

  let id = '';
  let prefix = 'Avulso';

  if (type === 'customer') {
    id = toText(els.stop_customer_id.value);
    prefix = 'Cliente';
  } else if (type === 'supplier') {
    id = toText(els.stop_supplier_id.value);
    prefix = 'Fornecedor';
  }

  if (type === 'other') {
    els.stop_linked_display.value = name || '';
    return;
  }

  if (!id && !name) {
    els.stop_linked_display.value = '';
    return;
  }

  els.stop_linked_display.value = `${prefix}: ${name || '(sem nome)'}${tax ? ` • ${tax}` : ''}${id ? ` • #${id}` : ''}`;
}

async function pickStopLinkedByType() {
  const type = toText(els.linked_type.value || 'other');

  if (type === 'other') {
    alert('Para vínculo avulso, preencha manualmente o nome e os demais campos.');
    return;
  }

  if (type === 'customer') {
    openCustomersModalSearch({
      apiBase: API_BASE,
      onPick: (c) => {
        clearStopLinked();
        els.stop_customer_id.value = String(c.customer_id ?? c.id ?? '');
        els.stop_name.value = String(c.trade_name ?? c.legal_name ?? c.name ?? '');
        els.stop_tax_id.value = String(c.tax_id ?? c.cnpj_cpf ?? '');
        if (!toText(els.stop_city.value)) {
          els.stop_city.value = String(c.city ?? c.cidade ?? '');
        }
        if (!toText(els.stop_address.value)) {
          const address = [
            c.address ?? c.endereco ?? '',
            c.number ?? c.numero ?? '',
            c.complement ?? c.complemento ?? ''
          ].filter(Boolean).join(', ');
          els.stop_address.value = address;
        }
        if (!toText(els.stop_phone.value)) {
          els.stop_phone.value = String(c.phone ?? c.telefone ?? '');
        }
        setStopLinkedDisplay();
      }
    });
    return;
  }

  const s = await openSuppliersModalSearch();
  if (!s) return;

  clearStopLinked();
  els.stop_supplier_id.value = String(s.supplier_id ?? s.id ?? '');
  els.stop_name.value = String(s.name ?? '');
  els.stop_tax_id.value = String(s.tax_id ?? '');
  if (!toText(els.stop_city.value)) {
    els.stop_city.value = String(s.city ?? '');
  }
  if (!toText(els.stop_address.value)) {
    els.stop_address.value = String(s.address ?? '');
  }
  if (!toText(els.stop_phone.value)) {
    els.stop_phone.value = String(s.phone ?? '');
  }
  setStopLinkedDisplay();
}

// ==========================================================
// RESET ROUTE FORM
// ==========================================================
function resetForm() {
  els.route_id.value = '';
  els.name.value = '';
  els.route_type.value = 'customers';
  els.route_code.value = '';
  els.city.value = '';
  els.region.value = '';
  els.driver_name.value = '';
  els.vehicle_plate.value = '';
  els.is_active.value = 'true';
  els.notes.value = '';
  setWeekdaysChecked([]);
  clearLinked();
  els.formTitle.textContent = '➕ Nova Rota';
  els.btnGoStops.hidden = true;
  state.currentRouteId = null;
  state.currentRoute = null;
  refreshStopsPanelState();
}

function buildListUrl() {
  const url = new URL(state.routeApi, window.location.origin);

  const q = toText(els.searchInput.value);
  const is_active = toText(els.statusFilter.value);
  const route_type = toText(els.typeFilter.value);

  if (q) url.searchParams.set('q', q);
  if (is_active) url.searchParams.set('is_active', is_active);
  if (route_type) url.searchParams.set('route_type', route_type);

  url.searchParams.set('limit', String(state.limit));
  url.searchParams.set('offset', String(state.offset));
  url.searchParams.set('order', 'name');
  url.searchParams.set('dir', 'asc');

  return url.toString();
}

// ==========================================================
// RENDER ROUTES
// ==========================================================
function renderRows(rows) {
  els.tableBody.innerHTML = '';

  if (!rows?.length) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="8" style="text-align:center; opacity:.75; padding:18px;">Nenhuma rota encontrada.</td>`;
    els.tableBody.appendChild(tr);
    return;
  }

  for (const r of rows) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${r.route_id ?? ''}</td>
      <td title="${escapeHtml(r.name)}">${escapeHtml(r.name)}</td>
      <td title="${escapeHtml(r.route_type)}">${labelRouteType(r.route_type)}</td>
      <td title="${escapeHtml(r.city)}">${escapeHtml(r.city)}</td>
      <td title="${escapeHtml(r.driver_name)}">${escapeHtml(r.driver_name)}</td>
      <td>${escapeHtml(r.vehicle_plate)}</td>
      <td>${r.is_active ? 'Sim' : 'Não'}</td>
      <td>
        <div class="routes-actions">
          <button class="btn btn-flat btn-sm" data-act="edit" data-id="${r.route_id}">Editar</button>
          <button class="btn btn-flat btn-sm" data-act="stops" data-id="${r.route_id}">Paradas</button>
          <button class="btn btn-secondary btn-sm" data-act="toggle" data-id="${r.route_id}" data-active="${r.is_active ? 'true' : 'false'}">
            ${r.is_active ? 'Desativar' : 'Ativar'}
          </button>
          <button class="btn btn-secondary btn-sm" data-act="del" data-id="${r.route_id}">Excluir</button>
        </div>
      </td>
    `;
    els.tableBody.appendChild(tr);
  }
}

function updatePager() {
  const page = Math.floor(state.offset / state.limit) + 1;
  const pages = Math.max(1, Math.ceil(state.total / state.limit));

  els.lblPage.textContent = `Página ${page} de ${pages}`;
  els.lblCount.textContent = `${state.total} rota(s)`;

  els.btnPrev.disabled = state.offset <= 0;
  els.btnNext.disabled = state.offset + state.limit >= state.total;
}

// ==========================================================
// LOAD ROUTES
// ==========================================================
async function loadRoutes() {
  const payload = await fetchJSON(buildListUrl());
  const data = payload?.data || payload;

  state.total = Number(data?.total || 0);

  renderRows(data?.rows || []);
  updatePager();
}

function fillRouteForm(r) {
  resetForm();

  els.formTitle.textContent = `✏️ Editar Rota #${r.route_id}`;
  els.route_id.value = r.route_id ?? '';
  els.name.value = r.name ?? '';
  els.route_type.value = r.route_type || 'customers';
  els.route_code.value = r.route_code ?? '';
  els.city.value = r.city ?? '';
  els.region.value = r.region ?? '';
  els.driver_name.value = r.driver_name ?? '';
  els.vehicle_plate.value = r.vehicle_plate ?? '';
  els.is_active.value = String(!!r.is_active);
  els.notes.value = r.notes ?? '';
  setWeekdaysChecked(r.weekdays || []);

  els.customer_id.value = r.customer_id ?? '';
  els.supplier_id.value = r.supplier_id ?? '';
  els.linked_name.value = r.linked_name ?? '';
  els.linked_tax_id.value = r.linked_tax_id ?? '';
  setLinkedDisplay();

  state.currentRouteId = r.route_id ?? null;
  state.currentRoute = r || null;
  els.btnGoStops.hidden = !state.currentRouteId;
  refreshStopsPanelState();
}

function openNew() {
  resetForm();
  goTab('cadastro');
  setTimeout(() => els.name?.focus?.(), 0);
}

async function fetchRouteById(id) {
  const payload = await fetchJSON(`${state.routeApi}/${id}`);
  return payload?.data || payload;
}

async function openEdit(id) {
  const route = await fetchRouteById(id);
  fillRouteForm(route);
  goTab('cadastro');
  setTimeout(() => els.name?.focus?.(), 0);
}

async function saveRoute(ev) {
  ev?.preventDefault?.();

  const id = toText(els.route_id.value);
  const type = toText(els.route_type.value || 'customers');

  const body = {
    name: toNullableText(els.name.value),
    route_type: type,
    route_code: toNullableText(els.route_code.value),
    city: toNullableText(els.city.value),
    region: toNullableText(els.region.value),
    driver_name: toNullableText(els.driver_name.value),
    vehicle_plate: toNullableText(els.vehicle_plate.value),
    weekdays: qsWeekdaysChecked(),
    is_active: String(els.is_active.value || 'true') === 'true',
    notes: toNullableText(els.notes.value),

    customer_id: type === 'customers' ? (toText(els.customer_id.value) || null) : null,
    supplier_id: type === 'suppliers' ? (toText(els.supplier_id.value) || null) : null,
    linked_name: toNullableText(els.linked_name.value),
    linked_tax_id: toNullableText(els.linked_tax_id.value),
  };

  if (!body.name) {
    alert('Informe o nome da rota.');
    els.name.focus();
    return null;
  }

  let saved;
  if (id) {
    const payload = await fetchJSON(`${state.routeApi}/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
    saved = payload?.data || payload;
  } else {
    const payload = await fetchJSON(`${state.routeApi}`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    saved = payload?.data || payload;
  }

  if (saved?.route_id) {
    state.currentRouteId = saved.route_id;
    state.currentRoute = saved;
    els.route_id.value = saved.route_id;
    els.btnGoStops.hidden = false;
    refreshStopsPanelState();
  }

  await loadRoutes();
  return saved;
}

async function deleteRoute(id) {
  if (!confirm('Excluir rota?')) return;

  await fetchJSON(`${state.routeApi}/${id}`, { method: 'DELETE' });

  if (state.offset > 0 && state.offset >= (state.total - 1)) {
    state.offset = Math.max(0, state.offset - state.limit);
  }

  if (Number(state.currentRouteId) === Number(id)) {
    resetForm();
    resetStopForm();
  }

  await loadRoutes();
}

async function toggleRoute(id, currentActive) {
  const next = !currentActive;
  const msg = next ? 'Ativar rota?' : 'Desativar rota?';
  if (!confirm(msg)) return;

  await fetchJSON(`${state.routeApi}/${id}/active`, {
    method: 'PATCH',
    body: JSON.stringify({ is_active: next }),
  });

  await loadRoutes();
}

// ==========================================================
// STOPS PANEL
// ==========================================================
function refreshStopsPanelState() {
  const routeId = Number(state.currentRouteId || toNullableInt(els.route_id.value));
  const hasRoute = Number.isFinite(routeId) && routeId > 0;

  els.stopsEmptyState.hidden = hasRoute;
  els.stopsContent.hidden = !hasRoute;

  if (!hasRoute) {
    els.stopsRouteInfo.textContent = 'Selecione ou salve uma rota para gerenciar as paradas.';
    els.lblStopsCount.textContent = '0 parada(s)';
    els.stopsTableBody.innerHTML = '';
    return;
  }

  const routeName = toText(els.name.value) || toText(state.currentRoute?.name) || `Rota #${routeId}`;
  const routeType = toText(els.route_type.value || state.currentRoute?.route_type || '');
  const city = toText(els.city.value || state.currentRoute?.city || '');

  els.stopsRouteInfo.textContent =
    `Rota #${routeId} • ${routeName}${routeType ? ` • ${labelRouteType(routeType)}` : ''}${city ? ` • ${city}` : ''}`;
}

function resetStopForm() {
  els.stop_id.value = '';
  els.stop_order.value = '';
  els.movement_type.value = 'delivery';
  els.linked_type.value = 'customer';
  els.stop_status.value = 'pending';

  clearStopLinked();

  els.stop_name.value = '';
  els.stop_tax_id.value = '';
  els.stop_contact_name.value = '';
  els.stop_phone.value = '';
  els.stop_address.value = '';
  els.stop_city.value = '';
  els.stop_region.value = '';
  els.stop_expected_date.value = '';
  els.stop_expected_time.value = '';
  els.stop_notes.value = '';

  setStopLinkedDisplay();
}

function buildStopBody() {
  const linkedType = toText(els.linked_type.value || 'other');

  return {
    route_id: Number(state.currentRouteId),
    stop_order: toNullableInt(els.stop_order.value),
    movement_type: toText(els.movement_type.value || 'delivery'),
    linked_type: linkedType,
    customer_id: linkedType === 'customer' ? (toNullableInt(els.stop_customer_id.value) ?? null) : null,
    supplier_id: linkedType === 'supplier' ? (toNullableInt(els.stop_supplier_id.value) ?? null) : null,
    name: toNullableText(els.stop_name.value),
    tax_id: toNullableText(els.stop_tax_id.value),
    address: toNullableText(els.stop_address.value),
    city: toNullableText(els.stop_city.value),
    region: toNullableText(els.stop_region.value),
    contact_name: toNullableText(els.stop_contact_name.value),
    phone: toNullableText(els.stop_phone.value),
    notes: toNullableText(els.stop_notes.value),
    expected_date: toNullableText(els.stop_expected_date.value),
    expected_time: toNullableText(els.stop_expected_time.value),
    status: toText(els.stop_status.value || 'pending'),
  };
}

function fillStopForm(s) {
  els.stop_id.value = s.stop_id ?? '';
  els.stop_order.value = s.stop_order ?? '';
  els.movement_type.value = s.movement_type || 'delivery';
  els.linked_type.value = s.linked_type || 'other';
  els.stop_status.value = s.status || 'pending';

  els.stop_customer_id.value = s.customer_id ?? '';
  els.stop_supplier_id.value = s.supplier_id ?? '';

  els.stop_name.value = s.name ?? '';
  els.stop_tax_id.value = s.tax_id ?? '';
  els.stop_contact_name.value = s.contact_name ?? '';
  els.stop_phone.value = s.phone ?? '';
  els.stop_address.value = s.address ?? '';
  els.stop_city.value = s.city ?? '';
  els.stop_region.value = s.region ?? '';
  els.stop_expected_date.value = s.expected_date ? String(s.expected_date).slice(0, 10) : '';
  els.stop_expected_time.value = s.expected_time ? String(s.expected_time).slice(0, 5) : '';
  els.stop_notes.value = s.notes ?? '';

  setStopLinkedDisplay();
}

function renderStops(rows) {
  state.stops = Array.isArray(rows) ? rows : [];
  els.stopsTableBody.innerHTML = '';
  els.lblStopsCount.textContent = `${state.stops.length} parada(s)`;

  if (!state.stops.length) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="7" style="text-align:center; opacity:.75; padding:18px;">Nenhuma parada cadastrada para esta rota.</td>`;
    els.stopsTableBody.appendChild(tr);
    return;
  }

  for (const s of state.stops) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${s.stop_order ?? ''}</td>
      <td><span class="badge-inline ${badgeMovementClass(s.movement_type)}">${labelMovementType(s.movement_type)}</span></td>
      <td><span class="badge-inline badge-linked">${labelLinkedType(s.linked_type)}</span></td>
      <td title="${escapeHtml(s.name)}">${escapeHtml(s.name || '')}</td>
      <td title="${escapeHtml(s.city)}">${escapeHtml(s.city || '')}</td>
      <td><span class="badge-inline ${badgeStatusClass(s.status)}">${labelStopStatus(s.status)}</span></td>
      <td>
        <div class="routes-actions">
          <button type="button" class="btn btn-flat btn-sm" data-stop-act="edit" data-id="${s.stop_id}">Editar</button>
          <button type="button" class="btn btn-flat btn-sm" data-stop-act="up" data-id="${s.stop_id}">↑</button>
          <button type="button" class="btn btn-flat btn-sm" data-stop-act="down" data-id="${s.stop_id}">↓</button>
          <button type="button" class="btn btn-secondary btn-sm" data-stop-act="status" data-id="${s.stop_id}" data-status="pending">Pendente</button>
          <button type="button" class="btn btn-secondary btn-sm" data-stop-act="status" data-id="${s.stop_id}" data-status="done">Concluir</button>
          <button type="button" class="btn btn-secondary btn-sm" data-stop-act="status" data-id="${s.stop_id}" data-status="canceled">Cancelar</button>
          <button type="button" class="btn btn-secondary btn-sm" data-stop-act="del" data-id="${s.stop_id}">Excluir</button>
        </div>
      </td>
    `;
    els.stopsTableBody.appendChild(tr);
  }
}

async function loadStops() {
  refreshStopsPanelState();

  if (!state.currentRouteId) {
    renderStops([]);
    return;
  }

  const payload = await fetchJSON(`${state.stopApi}/route/${state.currentRouteId}`);
  const rows = payload?.data || payload || [];
  renderStops(rows);
}

async function openStopsByRouteId(routeId) {
  const route = await fetchRouteById(routeId);
  state.currentRouteId = route.route_id;
  state.currentRoute = route;
  fillRouteForm(route);
  resetStopForm();
  refreshStopsPanelState();
  await loadStops();
  goTab('paradas');
}

async function saveStop(ev) {
  ev?.preventDefault?.();

  if (!state.currentRouteId) {
    alert('Salve ou selecione uma rota antes de cadastrar paradas.');
    return;
  }

  const body = buildStopBody();
  const stopId = toText(els.stop_id.value);

  if (!body.route_id) {
    alert('Rota inválida.');
    return;
  }

  if (!body.movement_type) {
    alert('Selecione o movimento.');
    return;
  }

  if (!body.linked_type) {
    alert('Selecione o vínculo.');
    return;
  }

  if (!body.name && body.linked_type === 'other') {
    alert('Informe o nome da parada avulsa.');
    els.stop_name.focus();
    return;
  }

  if (body.linked_type === 'customer' && !body.customer_id) {
    alert('Selecione um cliente para esta parada.');
    return;
  }

  if (body.linked_type === 'supplier' && !body.supplier_id) {
    alert('Selecione um fornecedor para esta parada.');
    return;
  }

  if (stopId) {
    await fetchJSON(`${state.stopApi}/${stopId}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  } else {
    await fetchJSON(`${state.stopApi}`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  resetStopForm();
  await loadStops();
}

async function editStop(stopId) {
  const payload = await fetchJSON(`${state.stopApi}/${stopId}`);
  const stop = payload?.data || payload;
  fillStopForm(stop);
  els.stop_order.focus();
}

async function deleteStop(stopId) {
  if (!confirm('Excluir parada?')) return;
  await fetchJSON(`${state.stopApi}/${stopId}`, { method: 'DELETE' });
  if (Number(els.stop_id.value) === Number(stopId)) {
    resetStopForm();
  }
  await loadStops();
}

async function updateStopStatus(stopId, status) {
  await fetchJSON(`${state.stopApi}/${stopId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });

  if (Number(els.stop_id.value) === Number(stopId)) {
    els.stop_status.value = status;
  }

  await loadStops();
}

function buildReorderPayloadByMove(stopId, direction) {
  const rows = [...state.stops]
    .sort((a, b) => (Number(a.stop_order) - Number(b.stop_order)) || (Number(a.stop_id) - Number(b.stop_id)));

  const idx = rows.findIndex((s) => Number(s.stop_id) === Number(stopId));
  if (idx < 0) return null;

  if (direction === 'up' && idx === 0) return null;
  if (direction === 'down' && idx === rows.length - 1) return null;

  const swapIdx = direction === 'up' ? idx - 1 : idx + 1;

  const tmp = rows[idx].stop_order;
  rows[idx].stop_order = rows[swapIdx].stop_order;
  rows[swapIdx].stop_order = tmp;

  const items = rows.map((s, i) => ({
    stop_id: Number(s.stop_id),
    stop_order: Number(s.stop_order ?? (i + 1)),
  }));

  return {
    route_id: Number(state.currentRouteId),
    items,
  };
}

async function reorderStop(stopId, direction) {
  const payload = buildReorderPayloadByMove(stopId, direction);
  if (!payload) return;

  await fetchJSON(`${state.stopApi}/reorder/items`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });

  await loadStops();
}

// ==========================================================
// BINDS
// ==========================================================

// routes list
els.btnSearch.addEventListener('click', async () => {
  try {
    state.offset = 0;
    await loadRoutes();
  } catch (e) {
    notifyError(e, 'Falha ao listar rotas.');
  }
});

els.btnClear.addEventListener('click', async () => {
  try {
    els.searchInput.value = '';
    els.statusFilter.value = '';
    els.typeFilter.value = '';
    state.offset = 0;
    await loadRoutes();
  } catch (e) {
    notifyError(e, 'Falha ao limpar filtros.');
  }
});

els.btnGoNew.addEventListener('click', openNew);

els.btnPrev.addEventListener('click', async () => {
  try {
    state.offset = Math.max(0, state.offset - state.limit);
    await loadRoutes();
  } catch (e) {
    notifyError(e);
  }
});

els.btnNext.addEventListener('click', async () => {
  try {
    state.offset = state.offset + state.limit;
    await loadRoutes();
  } catch (e) {
    notifyError(e);
  }
});

els.searchInput.addEventListener('keydown', async (ev) => {
  if (ev.key === 'Enter') {
    try {
      state.offset = 0;
      await loadRoutes();
    } catch (e) {
      notifyError(e);
    }
  }
});

els.tableBody.addEventListener('click', async (ev) => {
  const btn = ev.target?.closest?.('button[data-act]');
  if (!btn) return;

  const act = btn.getAttribute('data-act');
  const id = btn.getAttribute('data-id');
  if (!id) return;

  try {
    if (act === 'edit') await openEdit(id);
    if (act === 'stops') await openStopsByRouteId(id);
    if (act === 'del') await deleteRoute(id);
    if (act === 'toggle') {
      const cur = btn.getAttribute('data-active') === 'true';
      await toggleRoute(id, cur);
    }
  } catch (e) {
    notifyError(e, 'Falha na ação.');
  }
});

// route form
els.route_type.addEventListener('change', () => {
  clearLinked();
  setLinkedDisplay();
});

els.btnPickLinked.addEventListener('click', async () => {
  try {
    await pickLinkedByType();
  } catch (e) {
    notifyError(e, 'Falha ao abrir busca.');
  }
});

els.btnClearLinked.addEventListener('click', () => {
  clearLinked();
  setLinkedDisplay();
});

els.form.addEventListener('submit', async (ev) => {
  try {
    const saved = await saveRoute(ev);
    if (saved?.route_id) {
      fillRouteForm(saved);
      goTab('lista');
    }
  } catch (e) {
    notifyError(e, 'Falha ao salvar rota.');
  }
});

els.btnCancelEdit.addEventListener('click', () => {
  resetForm();
  goTab('lista');
});

els.btnGoStops.addEventListener('click', async () => {
  try {
    const routeId = Number(els.route_id.value || state.currentRouteId);
    if (!routeId) {
      alert('Salve a rota antes de acessar as paradas.');
      return;
    }
    await openStopsByRouteId(routeId);
  } catch (e) {
    notifyError(e, 'Falha ao abrir paradas.');
  }
});

// stops tab
els.btnBackToRoute.addEventListener('click', () => {
  goTab('cadastro');
});

els.linked_type.addEventListener('change', () => {
  clearStopLinked();
  setStopLinkedDisplay();
});

els.btnPickStopLinked.addEventListener('click', async () => {
  try {
    await pickStopLinkedByType();
  } catch (e) {
    notifyError(e, 'Falha ao abrir busca da parada.');
  }
});

els.btnClearStopLinked.addEventListener('click', () => {
  clearStopLinked();
  setStopLinkedDisplay();
});

els.stop_name.addEventListener('input', () => {
  if (toText(els.linked_type.value) === 'other') {
    setStopLinkedDisplay();
  }
});

els.stop_tax_id.addEventListener('input', () => {
  if (toText(els.linked_type.value) !== 'other') {
    setStopLinkedDisplay();
  }
});

els.formStop.addEventListener('submit', async (ev) => {
  try {
    await saveStop(ev);
  } catch (e) {
    notifyError(e, 'Falha ao salvar parada.');
  }
});

els.btnCancelStop.addEventListener('click', () => {
  resetStopForm();
});

els.stopsTableBody.addEventListener('click', async (ev) => {
  const btn = ev.target?.closest?.('button[data-stop-act]');
  if (!btn) return;

  const act = btn.getAttribute('data-stop-act');
  const stopId = btn.getAttribute('data-id');
  const status = btn.getAttribute('data-status');

  if (!stopId) return;

  try {
    if (act === 'edit') await editStop(stopId);
    if (act === 'del') await deleteStop(stopId);
    if (act === 'status' && status) await updateStopStatus(stopId, status);
    if (act === 'up') await reorderStop(stopId, 'up');
    if (act === 'down') await reorderStop(stopId, 'down');
  } catch (e) {
    notifyError(e, 'Falha ao processar parada.');
  }
});

// ==========================================================
// INIT
// ==========================================================
resetForm();
resetStopForm();

state.routeApi = await detectApiBase(ROUTE_ENDPOINTS, '?limit=1&offset=0');
state.stopApi = await detectApiBase(STOP_ENDPOINTS, '/route/1');

refreshStopsPanelState();

loadRoutes().catch((e) => {
  console.error('[deliveryRoutes] init failed:', e);
  alert(
    (e?.message || 'Falha ao carregar rotas.') +
    `\n\nAPI_BASE usado: ${API_BASE}\nEndpoint de rotas: ${state.routeApi}\nEndpoint de paradas: ${state.stopApi}`
  );
});