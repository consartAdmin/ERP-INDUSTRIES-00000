// ╔══════════════════════════════════════════════════════════════════════╗
// ║ deliveryTrips.js — Entregas e Motoristas                            ║
// ║ PRODNEX ERP | Frontend (ESM)                                        ║
// ║ ✅ Rotas: listar / montar / iniciar / concluir / cancelar / imprimir ║
// ║ ✅ Paradas: de Pedidos, Orçamentos, NF-e ou avulsas; ordenar; baixa  ║
// ║ ✅ Motoristas (funcionários) e Veículos                              ║
// ║ API: /api/delivery-trips (JWT)                                       ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { getAuthToken } from '/public/includes/js/apiFetch.js';
import { openSuppliersModalSearch } from '/public/modalsSearch/suppliersModalSearch.js';
import { Modal } from '/public/includes/js/modal.js';

const API = '/api/delivery-trips';

Modal.setup();

// ==========================================================
// Textos
// ==========================================================
const TRIP_STATUS_LABEL = {
  PLANEJADA: 'Planejada', EM_ROTA: 'Em rota', CONCLUIDA: 'Concluída', CANCELADA: 'Cancelada',
};
const STOP_STATUS_LABEL = {
  PENDENTE: 'Pendente', CONCLUIDA: 'Concluída', FALHOU: 'Não realizada', CANCELADA: 'Cancelada',
};
const MOVEMENT_LABEL = { ENTREGA: '🚚 Entrega', COLETA: '📦 Coleta' };
const VEHICLE_TYPE_LABEL = {
  CARRO: 'Carro', UTILITARIO: 'Utilitário', VAN: 'Van', CAMINHAO: 'Caminhão', MOTO: 'Moto', OUTRO: 'Outro',
};

const ERROR_MESSAGES = {
  ALREADY_SCHEDULED: 'Documento já está agendado em outra rota',
  DRIVER_REQUIRED: 'Selecione o motorista antes de iniciar a rota.',
  VEHICLE_REQUIRED: 'Selecione o veículo antes de iniciar a rota.',
  TRIP_WITHOUT_STOPS: 'A rota não tem paradas.',
  PENDING_STOPS: 'Ainda existem paradas pendentes. Dê baixa em todas antes de concluir.',
  TRIP_CONCLUIDA: 'Rota concluída não pode ser alterada. Reabra a rota primeiro.',
  TRIP_CANCELADA: 'Rota cancelada não pode ser alterada.',
  TRIP_EM_ROTA: 'Rota em andamento não pode ser excluída.',
  FAILURE_REASON_REQUIRED: 'Informe o motivo.',
  EMPLOYEE_ALREADY_DRIVER: 'Este funcionário já está cadastrado como motorista.',
  PLATE_ALREADY_EXISTS: 'Já existe um veículo com esta placa.',
  IN_USE_BY_TRIPS: 'Registro usado em rotas. Inative em vez de excluir.',
  TRIP_DATE_REQUIRED: 'Informe a data da rota.',
  RECIPIENT_NAME_REQUIRED: 'Informe o nome do cliente/local.',
  PLATE_REQUIRED: 'Informe a placa.',
  DESCRIPTION_REQUIRED: 'Informe a descrição do veículo.',
  EMPLOYEE_ID_REQUIRED: 'Selecione o funcionário.',
};

// ==========================================================
// Helpers
// ==========================================================
const $ = (id) => document.getElementById(id);

function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function fmtDate(iso) {
  if (!iso) return '';
  const [y, m, d] = String(iso).slice(0, 10).split('-');
  return d ? `${d}/${m}/${y}` : String(iso);
}

function fmtDateTime(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function fmtMoney(v) {
  if (v === null || v === undefined || v === '') return '';
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtNum(v, digits = 0) {
  if (v === null || v === undefined || v === '') return '';
  return Number(v).toLocaleString('pt-BR', { maximumFractionDigits: digits });
}

function todayIso() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

function badge(value, label) {
  return `<span class="dt-badge dt-badge--${esc(value)}">${esc(label ?? value)}</span>`;
}

function sourceLabel(s) {
  if (s.source_type === 'NFE') return `🧾 NF-e ${s.nfe_number ?? ''}`.trim();
  if (s.source_type === 'PEDIDO' || s.order_id) return `📝 Pedido ${s.order_id}`;
  if (s.source_type === 'ORCAMENTO' || s.budget_id) return `📑 Orçamento ${s.budget_id}`;
  return '✍️ Avulsa';
}

/** Documento de origem da NF-e (Pedido/Orçamento), exibido como linha secundária */
function sourceOrigin(s) {
  if (s.source_type !== 'NFE') return '';
  if (s.order_id) return `Pedido ${s.order_id}`;
  if (s.budget_id) return `Orçamento ${s.budget_id}`;
  return '';
}

function addressLine(s) {
  const cityUf = [s.city, s.state].filter(Boolean).join('/');
  return [s.address, s.neighborhood, cityUf].filter(Boolean).join(' - ');
}

function notifyError(err) {
  const code = String(err?.message || '').replace(/^\d+:\s*/, '');
  let msg = ERROR_MESSAGES[code] || code || 'Falha na operação.';
  const det = err?.details;
  if (code === 'ALREADY_SCHEDULED' && det) {
    msg = `${det.document} já está agendado na rota nº ${det.trip_id} (${fmtDate(det.trip_date)}).`;
  }
  alert(msg);
}

/**
 * fetch com JWT (mesmo token do apiFetch). Não usa apiFetch porque ele descarta
 * o "details" do backend, necessário no 409 ALREADY_SCHEDULED.
 */
async function api(path, { method = 'GET', body } = {}) {
  const token = getAuthToken();
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  if (res.status === 401) throw new Error('Sessão expirada. Faça login novamente.');
  if (!res.ok || json?.ok === false) {
    const err = new Error(json?.error || json?.message || `HTTP ${res.status}`);
    err.details = json?.details;
    err.status = res.status;
    throw err;
  }
  return json?.data;
}

function qs(params) {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') p.set(k, v);
  });
  const s = p.toString();
  return s ? `?${s}` : '';
}

// ==========================================================
// Estado
// ==========================================================
const state = {
  tripsPage: 1,
  tripsLimit: 30,
  tripsTotal: 0,
  currentTrip: null,
  drivers: [],
  vehicles: [],
  sources: [],
  selectedSources: new Set(),
};

// ==========================================================
// Tabs
// ==========================================================
const TAB_KEYS = ['rotas', 'montar', 'motoristas', 'veiculos'];

function goTab(key) {
  document.querySelectorAll('.tabs .tab').forEach((btn) => {
    const active = btn.dataset.tab === key;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-selected', String(active));
    btn.tabIndex = active ? 0 : -1;
  });
  TAB_KEYS.forEach((k) => {
    const panel = $(`tab-${k}`);
    panel.toggleAttribute('hidden', k !== key);
    panel.classList.toggle('is-active', k === key);
  });
}

document.querySelectorAll('.tabs .tab').forEach((btn) => {
  btn.addEventListener('click', () => {
    goTab(btn.dataset.tab);
    if (btn.dataset.tab === 'rotas') loadTrips().catch(notifyError);
  });
});

// ==========================================================
// Motoristas / Veículos (listas para selects)
// ==========================================================
async function loadDrivers() {
  state.drivers = await api('/drivers');
  renderDrivers();
  fillTripSelects();
}

async function loadVehicles() {
  state.vehicles = await api('/vehicles');
  renderVehicles();
  fillTripSelects();
}

function fillTripSelects() {
  const trip = state.currentTrip;
  const selDriver = $('trip_driver_id');
  const selVehicle = $('trip_vehicle_id');
  const curDriver = selDriver.value || trip?.driver_id || '';
  const curVehicle = selVehicle.value || trip?.vehicle_id || '';

  selDriver.innerHTML = '<option value="">— selecione —</option>' + state.drivers
    .filter((d) => d.is_active || String(d.driver_id) === String(curDriver))
    .map((d) => `<option value="${d.driver_id}">${esc(d.full_name)}${d.cnh_expired ? ' ⚠️ CNH vencida' : ''}</option>`)
    .join('');
  selVehicle.innerHTML = '<option value="">— selecione —</option>' + state.vehicles
    .filter((v) => v.is_active || String(v.vehicle_id) === String(curVehicle))
    .map((v) => `<option value="${v.vehicle_id}">${esc(v.plate)} — ${esc(v.description)}</option>`)
    .join('');
  selDriver.value = String(curDriver || '');
  selVehicle.value = String(curVehicle || '');
}

// ==========================================================
// Lista de rotas
// ==========================================================
async function loadTrips() {
  const data = await api(`/${qs({
    q: $('tripSearch').value.trim(),
    status: $('tripStatusFilter').value,
    date_from: $('tripDateFrom').value,
    date_to: $('tripDateTo').value,
    page: state.tripsPage,
    limit: state.tripsLimit,
  })}`);
  state.tripsTotal = data.total;
  renderTrips(data.rows);
}

function renderTrips(rows) {
  const tbody = $('tripsTableBody');
  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="9" class="dt-empty">Nenhuma rota encontrada.</td></tr>';
  } else {
    tbody.innerHTML = rows.map((t) => {
      const finished = t.stops_done + t.stops_failed;
      const pct = t.stops_total ? Math.round((finished / t.stops_total) * 100) : 0;
      const canDelete = ['PLANEJADA', 'CANCELADA'].includes(t.status);
      return `
        <tr data-id="${t.trip_id}">
          <td><strong>${t.trip_id}</strong></td>
          <td>${fmtDate(t.trip_date)}</td>
          <td>${esc(t.name || '')}</td>
          <td>${esc(t.driver_name || '—')}</td>
          <td>${esc(t.vehicle_plate || '—')}<span class="dt-sub">${esc(t.vehicle_description || '')}</span></td>
          <td>🚚 ${t.deliveries_count} &nbsp; 📦 ${t.pickups_count}</td>
          <td>${finished}/${t.stops_total}${t.stops_failed ? ` <span class="dt-sub">${t.stops_failed} não realizada(s)</span>` : ''}
              <div class="dt-progress"><span style="width:${pct}%"></span></div></td>
          <td>${badge(t.status, TRIP_STATUS_LABEL[t.status])}</td>
          <td><div class="dt-actions">
            <button class="btn btn-edit btn-sm" type="button" data-act="open">✏️ Abrir</button>
            <button class="btn btn-toolbar btn-sm" type="button" data-act="print">🖨️ Romaneio</button>
            ${canDelete ? '<button class="btn btn-delete btn-sm" type="button" data-act="delete">🗑️ Excluir</button>' : ''}
          </div></td>
        </tr>`;
    }).join('');
  }

  const pages = Math.max(1, Math.ceil(state.tripsTotal / state.tripsLimit));
  $('lblTripPage').textContent = `Página ${state.tripsPage} de ${pages}`;
  $('lblTripCount').textContent = `${state.tripsTotal} rota(s)`;
  $('btnTripPrev').disabled = state.tripsPage <= 1;
  $('btnTripNext').disabled = state.tripsPage >= pages;
}

$('tripsTableBody').addEventListener('click', async (ev) => {
  const btn = ev.target.closest('button[data-act]');
  if (!btn) return;
  const id = btn.closest('tr').dataset.id;
  try {
    if (btn.dataset.act === 'open') {
      await openTrip(id);
      goTab('montar');
    } else if (btn.dataset.act === 'print') {
      printTrip(await api(`/${id}`));
    } else if (btn.dataset.act === 'delete') {
      if (!confirm(`Excluir a rota nº ${id}? As paradas também serão excluídas.`)) return;
      await api(`/${id}`, { method: 'DELETE' });
      if (String(state.currentTrip?.trip_id) === String(id)) resetTripForm();
      await loadTrips();
    }
  } catch (e) {
    notifyError(e);
  }
});

$('btnTripSearch').addEventListener('click', () => { state.tripsPage = 1; loadTrips().catch(notifyError); });
$('tripSearch').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('btnTripSearch').click(); });
$('btnTripClear').addEventListener('click', () => {
  ['tripSearch', 'tripStatusFilter', 'tripDateFrom', 'tripDateTo'].forEach((id) => { $(id).value = ''; });
  state.tripsPage = 1;
  loadTrips().catch(notifyError);
});
$('btnTripPrev').addEventListener('click', () => { state.tripsPage--; loadTrips().catch(notifyError); });
$('btnTripNext').addEventListener('click', () => { state.tripsPage++; loadTrips().catch(notifyError); });
$('tripPageSize').addEventListener('change', () => {
  state.tripsLimit = Number($('tripPageSize').value) || 30;
  state.tripsPage = 1;
  loadTrips().catch(notifyError);
});
$('btnNewTrip').addEventListener('click', () => { resetTripForm(); goTab('montar'); });
$('btnReload').addEventListener('click', () => {
  Promise.all([loadDrivers(), loadVehicles(), loadTrips()]).catch(notifyError);
});

// ==========================================================
// Montar rota — cabeçalho
// ==========================================================
function resetTripForm() {
  state.currentTrip = null;
  $('trip_id').value = '';
  $('trip_date').value = todayIso();
  ['trip_name', 'trip_driver_id', 'trip_vehicle_id', 'trip_start_km', 'trip_end_km', 'trip_notes']
    .forEach((id) => { $(id).value = ''; });
  renderCurrentTrip();
}

async function openTrip(id) {
  state.currentTrip = await api(`/${id}`);
  const t = state.currentTrip;
  $('trip_id').value = t.trip_id;
  $('trip_date').value = t.trip_date || '';
  $('trip_name').value = t.name || '';
  $('trip_start_km').value = t.start_km ?? '';
  $('trip_end_km').value = t.end_km ?? '';
  $('trip_notes').value = t.notes || '';
  fillTripSelects();
  $('trip_driver_id').value = t.driver_id ?? '';
  $('trip_vehicle_id').value = t.vehicle_id ?? '';
  renderCurrentTrip();
}

function setTrip(trip) {
  state.currentTrip = trip;
  $('trip_id').value = trip.trip_id;
  renderCurrentTrip();
}

function tripHeaderPayload() {
  return {
    trip_date: $('trip_date').value,
    name: $('trip_name').value,
    driver_id: $('trip_driver_id').value || null,
    vehicle_id: $('trip_vehicle_id').value || null,
    start_km: $('trip_start_km').value,
    end_km: $('trip_end_km').value,
    notes: $('trip_notes').value,
  };
}

$('formTrip').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  try {
    const id = $('trip_id').value;
    const trip = id
      ? await api(`/${id}`, { method: 'PUT', body: tripHeaderPayload() })
      : await api('/', { method: 'POST', body: tripHeaderPayload() });
    setTrip(trip);
  } catch (e) {
    notifyError(e);
  }
});

function renderCurrentTrip() {
  const t = state.currentTrip;
  const locked = t && ['CONCLUIDA', 'CANCELADA'].includes(t.status);

  $('tripFormTitle').textContent = t ? `🗺️ Rota nº ${t.trip_id} — ${fmtDate(t.trip_date)}` : '🗺️ Nova Rota';
  $('tripFormInfo').innerHTML = t
    ? `Status: ${badge(t.status, TRIP_STATUS_LABEL[t.status])}
       ${t.departed_at ? ` · Saída: ${fmtDateTime(t.departed_at)}` : ''}
       ${t.finished_at ? ` · Chegada: ${fmtDateTime(t.finished_at)}` : ''}`
    : 'Preencha os dados e adicione Pedidos, Orçamentos ou Notas Fiscais como paradas.';

  $('formTrip').querySelectorAll('input, select, button').forEach((el) => {
    el.disabled = t?.status === 'CANCELADA';
  });
  $('addStopsPanel').hidden = !!locked;

  renderTripActions();
  renderSummary();
  renderStops();
}

function renderTripActions() {
  const t = state.currentTrip;
  const box = $('tripActions');
  if (!t) { box.innerHTML = ''; return; }

  const btns = [];
  if (t.status === 'PLANEJADA') btns.push(['EM_ROTA', '▶️ Iniciar rota', 'btn-new']);
  if (t.status === 'EM_ROTA') {
    btns.push(['CONCLUIDA', '🏁 Concluir rota', 'btn-new']);
    btns.push(['PLANEJADA', '↩️ Voltar p/ planejada', 'btn-toolbar']);
  }
  if (t.status === 'CONCLUIDA') btns.push(['EM_ROTA', '🔓 Reabrir rota', 'btn-toolbar']);
  if (t.status === 'CANCELADA') btns.push(['PLANEJADA', '♻️ Reativar rota', 'btn-toolbar']);
  if (['PLANEJADA', 'EM_ROTA'].includes(t.status)) btns.push(['CANCELADA', '⛔ Cancelar rota', 'btn-toolbar']);

  box.innerHTML = btns.map(([st, label, cls]) =>
    `<button type="button" class="btn ${cls} btn-sm" data-status="${st}">${label}</button>`
  ).join('') + '<button type="button" class="btn btn-toolbar btn-sm" data-print="1">🖨️ Romaneio</button>';
}

$('tripActions').addEventListener('click', async (ev) => {
  const btn = ev.target.closest('button');
  if (!btn || !state.currentTrip) return;
  const t = state.currentTrip;

  if (btn.dataset.print) { printTrip(t); return; }

  const next = btn.dataset.status;
  const body = { status: next };
  if (next === 'EM_ROTA' && t.status === 'PLANEJADA') {
    const km = prompt('KM de saída do veículo (opcional):', t.start_km ?? '');
    if (km === null) return;
    if (km !== '') body.start_km = km;
  }
  if (next === 'CONCLUIDA') {
    const km = prompt('KM de chegada do veículo (opcional):', t.end_km ?? '');
    if (km === null) return;
    if (km !== '') body.end_km = km;
  }
  if (next === 'CANCELADA' && !confirm('Cancelar esta rota? Os documentos voltam a ficar disponíveis para outras rotas.')) return;

  try {
    // Salva o cabeçalho antes de iniciar, para não perder motorista/veículo recém-selecionados
    if (t.status === 'PLANEJADA') {
      setTrip(await api(`/${t.trip_id}`, { method: 'PUT', body: tripHeaderPayload() }));
    }
    const trip = await api(`/${t.trip_id}/status`, { method: 'PATCH', body });
    setTrip(trip);
    $('trip_start_km').value = trip.start_km ?? '';
    $('trip_end_km').value = trip.end_km ?? '';
  } catch (e) {
    notifyError(e);
  }
});

function renderSummary() {
  const t = state.currentTrip;
  const box = $('tripSummary');
  if (!t) { box.hidden = true; return; }
  const cap = Number(t.vehicle_capacity_kg || 0);
  const weight = Number(t.total_weight || 0);
  const over = cap && weight > cap;
  const totalAmount = tripAmount(t);
  box.hidden = false;
  box.innerHTML = `
    <span>Paradas: <strong>${t.stops_total}</strong></span>
    <span>🚚 Entregas: <strong>${t.deliveries_count}</strong></span>
    <span>📦 Coletas: <strong>${t.pickups_count}</strong></span>
    <span>✅ Concluídas: <strong>${t.stops_done}</strong></span>
    <span>❌ Não realizadas: <strong>${t.stops_failed}</strong></span>
    <span>Volumes: <strong>${fmtNum(t.total_volumes)}</strong></span>
    <span class="${over ? 'is-over' : ''}">Peso: <strong>${fmtNum(weight, 2)} kg</strong>${cap ? ` / ${fmtNum(cap, 2)} kg${over ? ' ⚠️ acima da capacidade' : ''}` : ''}</span>
    <span>💰 Valor das entregas: <strong>${fmtMoney(totalAmount)}</strong></span>`;
}

/** Soma do valor dos documentos de ENTREGA (paradas canceladas não contam) */
function tripAmount(t) {
  return (t.stops || [])
    .filter((s) => s.movement_type === 'ENTREGA' && s.status !== 'CANCELADA')
    .reduce((sum, s) => sum + Number(s.document_amount || 0), 0);
}

// ==========================================================
// Paradas da rota
// ==========================================================
function renderStops() {
  const tbody = $('stopsTableBody');
  const t = state.currentTrip;
  const stops = t?.stops || [];
  if (!stops.length) {
    tbody.innerHTML = `<tr><td colspan="9" class="dt-empty">${t ? 'Nenhuma parada. Adicione abaixo.' : 'Salve a rota ou adicione documentos abaixo para criar a rota.'}</td></tr>`;
    return;
  }
  const locked = ['CONCLUIDA', 'CANCELADA'].includes(t.status);
  const canBaixa = ['PLANEJADA', 'EM_ROTA'].includes(t.status);

  tbody.innerHTML = stops.map((s, i) => {
    const doneLabel = s.movement_type === 'COLETA' ? '✅ Coletado' : '✅ Entregue';
    const statusInfo = s.status === 'CONCLUIDA'
      ? `${s.received_by ? `Recebido por: ${esc(s.received_by)}<br>` : ''}${fmtDateTime(s.completed_at)}`
      : s.status === 'FALHOU' ? `${esc(s.failure_reason || '')}<br>${fmtDateTime(s.completed_at)}` : '';
    const actions = [];
    if (!locked) {
      actions.push(`<button class="btn btn-toolbar btn-sm" type="button" data-act="up" ${i === 0 ? 'disabled' : ''} title="Subir">▲</button>`);
      actions.push(`<button class="btn btn-toolbar btn-sm" type="button" data-act="down" ${i === stops.length - 1 ? 'disabled' : ''} title="Descer">▼</button>`);
    }
    if (canBaixa && s.status === 'PENDENTE') {
      actions.push(`<button class="btn btn-confirm btn-sm" type="button" data-act="done">${doneLabel}</button>`);
      actions.push('<button class="btn btn-cancel btn-sm" type="button" data-act="fail">❌ Não realizada</button>');
    }
    if (canBaixa && s.status !== 'PENDENTE') actions.push('<button class="btn btn-toolbar btn-sm" type="button" data-act="reopen">↩️ Reabrir</button>');
    if (!locked) actions.push('<button class="btn btn-edit btn-sm" type="button" data-act="edit" title="Editar cliente, endereço, volumes e peso">✏️</button>');
    if (!locked && s.status === 'PENDENTE') actions.push('<button class="btn btn-toolbar btn-sm" type="button" data-act="cancel" title="Cancelar parada">⛔</button>');
    if (!locked) actions.push('<button class="btn btn-delete btn-sm" type="button" data-act="remove" title="Remover da rota">🗑️</button>');

    return `
      <tr data-id="${s.stop_id}" class="${s.status === 'CANCELADA' ? 'is-muted' : ''}">
        <td><strong>${s.stop_order}</strong></td>
        <td>${badge(s.movement_type, MOVEMENT_LABEL[s.movement_type])}</td>
        <td>${esc(sourceLabel(s))}${sourceOrigin(s) ? `<span class="dt-sub">${esc(sourceOrigin(s))}</span>` : ''}</td>
        <td>${esc(s.recipient_name)}<span class="dt-sub">${esc(s.contact_phone || '')}</span></td>
        <td>${esc(addressLine(s)) || '<span class="dt-badge dt-badge--warn">sem endereço</span>'}
            ${s.notes ? `<span class="dt-sub">📝 ${esc(s.notes)}</span>` : ''}</td>
        <td>${s.volumes != null ? `${fmtNum(s.volumes)} vol` : '—'}<span class="dt-sub">${s.gross_weight ? `${fmtNum(s.gross_weight, 2)} kg` : ''}</span></td>
        <td class="dt-num">${s.document_amount != null ? fmtMoney(s.document_amount) : '—'}</td>
        <td>${badge(s.status, STOP_STATUS_LABEL[s.status])}<span class="dt-sub">${statusInfo}</span></td>
        <td><div class="dt-actions">${actions.join('')}</div></td>
      </tr>`;
  }).join('');
}

$('stopsTableBody').addEventListener('click', async (ev) => {
  const btn = ev.target.closest('button[data-act]');
  if (!btn || !state.currentTrip) return;
  const stopId = btn.closest('tr').dataset.id;
  const t = state.currentTrip;
  const act = btn.dataset.act;

  try {
    if (act === 'up' || act === 'down') {
      const ids = t.stops.map((s) => String(s.stop_id));
      const i = ids.indexOf(stopId);
      const j = act === 'up' ? i - 1 : i + 1;
      [ids[i], ids[j]] = [ids[j], ids[i]];
      setTrip(await api(`/${t.trip_id}/stops/reorder`, { method: 'PATCH', body: { stop_ids: ids } }));
    } else if (act === 'edit') {
      openEditStop(t.stops.find((s) => String(s.stop_id) === stopId));
      return;
    } else if (act === 'done') {
      const who = prompt('Recebido por / responsável (opcional):', '');
      if (who === null) return;
      setTrip(await api(`/stops/${stopId}/status`, { method: 'PATCH', body: { status: 'CONCLUIDA', received_by: who } }));
    } else if (act === 'fail') {
      const reason = prompt('Motivo (ex: cliente ausente, endereço não encontrado):', '');
      if (reason === null) return;
      setTrip(await api(`/stops/${stopId}/status`, { method: 'PATCH', body: { status: 'FALHOU', failure_reason: reason } }));
    } else if (act === 'reopen') {
      setTrip(await api(`/stops/${stopId}/status`, { method: 'PATCH', body: { status: 'PENDENTE' } }));
    } else if (act === 'cancel') {
      if (!confirm('Cancelar esta parada? O documento fica livre para outra rota.')) return;
      setTrip(await api(`/stops/${stopId}/status`, { method: 'PATCH', body: { status: 'CANCELADA' } }));
    } else if (act === 'remove') {
      if (!confirm('Remover esta parada da rota?')) return;
      setTrip(await api(`/stops/${stopId}`, { method: 'DELETE' }));
    }
    if (['cancel', 'remove', 'reopen', 'fail'].includes(act) && state.sources.length) await searchSources();
  } catch (e) {
    notifyError(e);
  }
});

// ==========================================================
// Editar parada (cliente / endereço / volumes / peso)
// ==========================================================
const EDIT_STOP_FIELDS = {
  es_name: 'recipient_name',
  es_phone: 'contact_phone',
  es_address: 'address',
  es_neighborhood: 'neighborhood',
  es_city: 'city',
  es_state: 'state',
  es_postal_code: 'postal_code',
  es_volumes: 'volumes',
  es_gross_weight: 'gross_weight',
  es_notes: 'notes',
};

function openEditStop(s) {
  if (!s) return;
  $('es_stop_id').value = s.stop_id;
  Object.entries(EDIT_STOP_FIELDS).forEach(([el, f]) => { $(el).value = s[f] ?? ''; });
  $('editStopModalTitle').textContent = `✏️ Editar parada ${s.stop_order} — ${sourceLabel(s)}`;
  Modal.open('editStopModal', { focusSelector: '#es_name' });
}

$('btnEsCancel').addEventListener('click', () => Modal.close('editStopModal'));

$('formEditStop').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const body = Object.fromEntries(Object.entries(EDIT_STOP_FIELDS).map(([el, f]) => [f, $(el).value]));
  try {
    setTrip(await api(`/stops/${$('es_stop_id').value}`, { method: 'PUT', body }));
    Modal.close('editStopModal');
  } catch (e) {
    notifyError(e);
  }
});

// ==========================================================
// Adicionar paradas — Pedidos / Orçamentos
// ==========================================================
async function searchSources() {
  state.sources = await api(`/sources${qs({
    source_type: $('srcType').value,
    movement_type: $('srcMovement').value,
    q: $('srcSearch').value.trim(),
    date_from: $('srcDateFrom').value,
    date_to: $('srcDateTo').value,
    only_unscheduled: $('srcOnlyFree').checked ? 'true' : 'false',
    limit: 200,
  })}`);
  state.selectedSources.clear();
  renderSources();
}

function renderSources() {
  const tbody = $('srcTableBody');
  const movement = $('srcMovement').value;
  if (!state.sources.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="dt-empty">Nenhum documento encontrado.</td></tr>';
  } else {
    tbody.innerHTML = state.sources.map((d) => {
      const busy = (d.scheduled || []).filter((x) => x.movement_type === movement);
      const sched = (d.scheduled || []).map((x) =>
        `${x.movement_type === 'COLETA' ? '📦' : '🚚'} Rota ${x.trip_id} (${fmtDate(x.trip_date)})`
      ).join('<br>');
      const checked = state.selectedSources.has(String(d.source_id));
      return `
        <tr data-id="${d.source_id}" class="${checked ? 'is-selected' : ''}">
          <td><input type="checkbox" ${checked ? 'checked' : ''} ${busy.length ? 'disabled title="Já agendado para este movimento"' : ''} /></td>
          <td><strong>${esc(d.doc_number ?? d.source_id)}</strong>${sourceOrigin(d) ? `<span class="dt-sub">${esc(sourceOrigin(d))}</span>` : ''}</td>
          <td>${fmtDate(d.issue_date)}</td>
          <td>${esc(d.recipient_name || '')}<span class="dt-sub">${esc(d.tax_id || '')}</span></td>
          <td>${esc(addressLine(d)) || '<span class="dt-badge dt-badge--warn">sem endereço</span>'}</td>
          <td>${fmtMoney(d.document_amount)}</td>
          <td>${esc(d.status || '')}</td>
          <td><span class="dt-sub">${sched || '—'}</span></td>
        </tr>`;
    }).join('');
  }
  $('srcCheckAll').checked = false;
  updateSelectedLabel();
}

function updateSelectedLabel() {
  $('lblSrcSelected').textContent = `${state.selectedSources.size} selecionado(s)`;
}

$('srcTableBody').addEventListener('change', (ev) => {
  if (ev.target.type !== 'checkbox') return;
  const tr = ev.target.closest('tr');
  const id = tr.dataset.id;
  if (ev.target.checked) state.selectedSources.add(id); else state.selectedSources.delete(id);
  tr.classList.toggle('is-selected', ev.target.checked);
  updateSelectedLabel();
});

$('srcTableBody').addEventListener('click', (ev) => {
  if (ev.target.closest('input')) return;
  const cb = ev.target.closest('tr')?.querySelector('input[type="checkbox"]');
  if (cb && !cb.disabled) { cb.checked = !cb.checked; cb.dispatchEvent(new Event('change', { bubbles: true })); }
});

$('srcCheckAll').addEventListener('change', (ev) => {
  $('srcTableBody').querySelectorAll('input[type="checkbox"]:not(:disabled)').forEach((cb) => {
    cb.checked = ev.target.checked;
    cb.dispatchEvent(new Event('change', { bubbles: true }));
  });
});

$('btnSrcSearch').addEventListener('click', () => searchSources().catch(notifyError));
$('srcSearch').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); $('btnSrcSearch').click(); } });
['srcType', 'srcMovement', 'srcOnlyFree'].forEach((id) => {
  $(id).addEventListener('change', () => searchSources().catch(notifyError));
});

/** Adiciona paradas; se a rota ainda não existe, cria com o cabeçalho do formulário */
async function addStopsToTrip(stops) {
  const t = state.currentTrip;
  const run = (force) => (t
    ? api(`/${t.trip_id}/stops`, { method: 'POST', body: { stops, force } })
    : api('/', { method: 'POST', body: { ...tripHeaderPayload(), stops, force } }));
  try {
    return await run(false);
  } catch (e) {
    if (e.message === 'ALREADY_SCHEDULED' && e.details) {
      const ok = confirm(`${e.details.document} já está agendado na rota nº ${e.details.trip_id} (${fmtDate(e.details.trip_date)}).\n\nAdicionar mesmo assim?`);
      if (ok) return run(true);
      return null;
    }
    throw e;
  }
}

$('btnAddSelected').addEventListener('click', async () => {
  if (!state.selectedSources.size) { alert('Selecione ao menos um documento.'); return; }
  if (!$('trip_date').value) { alert(ERROR_MESSAGES.TRIP_DATE_REQUIRED); return; }
  const source_type = $('srcType').value;
  const movement_type = $('srcMovement').value;
  const stops = state.sources
    .filter((d) => state.selectedSources.has(String(d.source_id)))
    .map((d) => ({ source_type, source_id: d.source_id, movement_type }));
  try {
    const trip = await addStopsToTrip(stops);
    if (!trip) return;
    setTrip(trip);
    Modal.close('addStopsModal');
    await searchSources();
  } catch (e) {
    notifyError(e);
  }
});

/** Alterna o modal entre seleção de documentos e parada manual */
function setAddMode(mode) {
  const manual = mode === 'manual';
  document.querySelectorAll('#addStopsModal [data-add-mode]').forEach((btn) => {
    const active = btn.dataset.addMode === mode;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-selected', String(active));
  });
  $('addModeDocs').hidden = manual;
  $('formManualStop').hidden = !manual;
  $('addDocsInfo').hidden = manual;
  $('btnAddSelected').hidden = manual;
  $('btnMsSubmit').hidden = !manual;
  $(manual ? 'ms_name' : 'srcSearch').focus({ preventScroll: true });
}

function openAddStops(mode = 'docs') {
  if (mode === 'manual') resetManualForm();
  Modal.open('addStopsModal', { focusSelector: mode === 'manual' ? '#ms_name' : '#srcSearch' });
  setAddMode(mode);
  if (mode === 'docs' && !state.sources?.length) searchSources().catch(notifyError);
}

document.querySelectorAll('#addStopsModal [data-add-mode]').forEach((btn) => {
  btn.addEventListener('click', () => {
    setAddMode(btn.dataset.addMode);
    if (btn.dataset.addMode === 'docs' && !state.sources?.length) searchSources().catch(notifyError);
  });
});

$('btnOpenAddStops').addEventListener('click', () => openAddStops('docs'));

// ==========================================================
// Parada avulsa (modo manual do modal "Adicionar paradas")
// ==========================================================
function resetManualForm() {
  $('formManualStop').reset();
  $('ms_customer_id').value = '';
}

$('btnManualStop').addEventListener('click', () => openAddStops('manual'));

/** Monta "Logradouro, nº - complemento" */
function joinAddress(street, number, complement) {
  return [street, number].filter(Boolean).join(', ') + (complement ? ` - ${complement}` : '');
}

/** Cliente ou fornecedor → campos da parada manual */
$('btnMsPickCustomer').addEventListener('click', async () => {
  const movement = $('ms_movement').value;
  const p = await openSuppliersModalSearch({
    allowCustomers: true,
    defaultType: movement === 'COLETA' ? 'suppliers' : 'customers',
  });
  if (!p) return;

  if (p.entity_type === 'customer') {
    $('ms_customer_id').value = p.customer_id ?? '';
    $('ms_name').value = p.legal_name ?? p.trade_name ?? p.name ?? '';
    $('ms_phone').value = p.mobile_number ?? p.phone_number ?? '';
    $('ms_address').value = joinAddress(
      [p.street_type, p.street_name].filter(Boolean).join(' '), p.street_number, p.address_complement);
    $('ms_neighborhood').value = p.neighborhood ?? '';
  } else {
    // Fornecedor: não há vínculo de cadastro na parada, só os dados de contato/endereço
    $('ms_customer_id').value = '';
    $('ms_name').value = p.name ?? '';
    $('ms_phone').value = p.phone ?? '';
    $('ms_address').value = joinAddress(
      [p.address_street_type, p.address_street || p.address].filter(Boolean).join(' '),
      p.address_number, p.address_complement);
    $('ms_neighborhood').value = p.address_district ?? '';
  }
  $('ms_city').value = p.city ?? '';
  $('ms_state').value = p.state ?? '';
});

$('formManualStop').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  if (!$('trip_date').value) { alert(ERROR_MESSAGES.TRIP_DATE_REQUIRED); return; }
  const stop = {
    source_type: 'AVULSO',
    movement_type: $('ms_movement').value,
    recipient_name: $('ms_name').value,
    contact_phone: $('ms_phone').value,
    address: $('ms_address').value,
    neighborhood: $('ms_neighborhood').value,
    city: $('ms_city').value,
    state: $('ms_state').value,
    notes: $('ms_notes').value,
  };
  if ($('ms_customer_id').value) stop.customer_id = $('ms_customer_id').value;
  try {
    const trip = await addStopsToTrip([stop]);
    if (!trip) return;
    setTrip(trip);
    resetManualForm();
    Modal.close('addStopsModal');
  } catch (e) {
    notifyError(e);
  }
});

// ==========================================================
// Romaneio (impressão)
// ==========================================================
function printTrip(t) {
  const stops = (t.stops || []).filter((s) => s.status !== 'CANCELADA');
  const rows = stops.map((s) => `
    <tr>
      <td class="c">${s.stop_order}</td>
      <td>${s.movement_type === 'COLETA' ? 'COLETA' : 'ENTREGA'}</td>
      <td>${esc(sourceLabel(s).replace(/^\S+\s/, ''))}</td>
      <td><strong>${esc(s.recipient_name)}</strong><br>${esc(s.contact_phone || '')}</td>
      <td>${esc(addressLine(s))}${s.postal_code ? `<br>CEP ${esc(s.postal_code)}` : ''}${s.notes ? `<br><em>${esc(s.notes)}</em>` : ''}</td>
      <td class="c">${fmtNum(s.volumes)}</td>
      <td class="r">${s.document_amount != null ? fmtMoney(s.document_amount) : ""}</td>
      <td class="sig"></td>
    </tr>`).join('');

  const w = window.open('', '_blank');
  if (!w) { alert('Permita pop-ups para imprimir o romaneio.'); return; }
  w.document.write(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
    <title>Romaneio Rota ${t.trip_id}</title>
    <style>
      body{font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#111;margin:18px}
      h1{font-size:18px;margin:0 0 6px}
      .info{display:flex;flex-wrap:wrap;gap:6px 24px;margin-bottom:12px}
      table{width:100%;border-collapse:collapse}
      th,td{border:1px solid #444;padding:5px;vertical-align:top}
      th{background:#eee;font-size:11px}
      .c{text-align:center}
      .r{text-align:right;white-space:nowrap}
      .sig{width:170px}
      .foot{margin-top:40px;display:flex;justify-content:space-between;gap:40px}
      .foot div{flex:1;border-top:1px solid #111;text-align:center;padding-top:4px}
      @media print{ .noprint{display:none} body{margin:8mm} }
    </style></head><body>
    <button class="noprint" onclick="window.print()">🖨️ Imprimir</button>
    <h1>ROMANEIO DE ENTREGAS / COLETAS — ROTA Nº ${t.trip_id}</h1>
    <div class="info">
      <span><strong>Data:</strong> ${fmtDate(t.trip_date)}</span>
      ${t.name ? `<span><strong>Rota:</strong> ${esc(t.name)}</span>` : ''}
      <span><strong>Motorista:</strong> ${esc(t.driver_name || '—')}${t.driver_cnh ? ` (CNH ${esc(t.driver_cnh)})` : ''}</span>
      <span><strong>Veículo:</strong> ${esc(t.vehicle_plate || '—')} ${esc(t.vehicle_description || '')}</span>
      <span><strong>Paradas:</strong> ${stops.length} (🚚 ${t.deliveries_count} / 📦 ${t.pickups_count})</span>
      <span><strong>Volumes:</strong> ${fmtNum(t.total_volumes)}</span>
      <span><strong>Peso:</strong> ${fmtNum(t.total_weight, 2)} kg</span>
      <span><strong>Valor das entregas:</strong> ${fmtMoney(tripAmount(t))}</span>
      <span><strong>KM saída:</strong> ${t.start_km ?? '________'}</span>
      <span><strong>KM chegada:</strong> ${t.end_km ?? '________'}</span>
    </div>
    ${t.notes ? `<p><strong>Obs.:</strong> ${esc(t.notes)}</p>` : ''}
    <table>
      <thead><tr><th>#</th><th>Tipo</th><th>Documento</th><th>Cliente / Local</th><th>Endereço</th><th>Vol.</th><th>Valor</th><th>Recebido por / Assinatura</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="8" class="c">Sem paradas</td></tr>'}</tbody>
    </table>
    <div class="foot"><div>Motorista</div><div>Expedição / Conferência</div></div>
    </body></html>`);
  w.document.close();
}

// ==========================================================
// Motoristas
// ==========================================================
async function loadEligibleEmployees(includeEmployee = null) {
  const list = await api('/drivers/eligible-employees');
  const sel = $('driver_employee_id');
  const opts = list.map((e) => `<option value="${e.employee_id}" data-phone="${esc(e.phone || '')}">${esc(e.full_name)}${e.position ? ` — ${esc(e.position)}` : ''}</option>`);
  if (includeEmployee) {
    opts.unshift(`<option value="${includeEmployee.employee_id}">${esc(includeEmployee.full_name)}</option>`);
  }
  sel.innerHTML = '<option value="">— selecione —</option>' + opts.join('');
}

function renderDrivers() {
  const tbody = $('driversTableBody');
  $('lblDriverCount').textContent = `${state.drivers.length} motorista(s)`;
  if (!state.drivers.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="dt-empty">Nenhum motorista cadastrado.</td></tr>';
    return;
  }
  tbody.innerHTML = state.drivers.map((d) => `
    <tr data-id="${d.driver_id}">
      <td>${esc(d.full_name)}<span class="dt-sub">${esc(d.position || '')}</span></td>
      <td>${esc(d.cpf || '')}</td>
      <td>${esc(d.cnh_number || '')}</td>
      <td>${esc(d.cnh_category || '')}</td>
      <td>${fmtDate(d.cnh_expiration)} ${d.cnh_expired ? '<span class="dt-badge dt-badge--warn">vencida</span>' : ''}</td>
      <td>${esc(d.phone || '')}</td>
      <td>${d.is_active ? badge('CONCLUIDA', 'Ativo') : badge('CANCELADA', 'Inativo')}</td>
      <td><div class="dt-actions">
        <button class="btn btn-edit btn-sm" type="button" data-act="edit">✏️ Editar</button>
        <button class="btn btn-delete btn-sm" type="button" data-act="delete">🗑️</button>
      </div></td>
    </tr>`).join('');
}

async function resetDriverForm() {
  $('formDriver').reset();
  $('driver_id').value = '';
  $('driver_employee_id').disabled = false;
  $('driverFormTitle').textContent = '👤 Novo Motorista';
  await loadEligibleEmployees();
}

$('btnNewDriver').addEventListener('click', async () => {
  try {
    await resetDriverForm();
    Modal.open('driverModal', { focusSelector: '#driver_employee_id' });
  } catch (e) {
    notifyError(e);
  }
});

$('driversTableBody').addEventListener('click', async (ev) => {
  const btn = ev.target.closest('button[data-act]');
  if (!btn) return;
  const id = btn.closest('tr').dataset.id;
  const d = state.drivers.find((x) => String(x.driver_id) === id);
  try {
    if (btn.dataset.act === 'edit') {
      await loadEligibleEmployees(d);
      $('driver_id').value = d.driver_id;
      $('driver_employee_id').value = d.employee_id;
      $('driver_employee_id').disabled = true;
      $('driver_cnh_number').value = d.cnh_number || '';
      $('driver_cnh_category').value = d.cnh_category || '';
      $('driver_cnh_expiration').value = d.cnh_expiration || '';
      $('driver_phone').value = d.driver_phone || '';
      $('driver_is_active').value = String(d.is_active);
      $('driver_notes').value = d.notes || '';
      $('driverFormTitle').textContent = `👤 Editando: ${d.full_name}`;
      Modal.open('driverModal', { focusSelector: '#driver_cnh_number' });
    } else if (btn.dataset.act === 'delete') {
      if (!confirm(`Excluir o motorista ${d.full_name}? (o funcionário não é excluído)`)) return;
      await api(`/drivers/${id}`, { method: 'DELETE' });
      await Promise.all([loadDrivers(), resetDriverForm()]);
    }
  } catch (e) {
    notifyError(e);
  }
});

$('formDriver').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const id = $('driver_id').value;
  const body = {
    cnh_number: $('driver_cnh_number').value,
    cnh_category: $('driver_cnh_category').value,
    cnh_expiration: $('driver_cnh_expiration').value,
    phone: $('driver_phone').value,
    is_active: $('driver_is_active').value,
    notes: $('driver_notes').value,
  };
  if (!id) body.employee_id = $('driver_employee_id').value;
  try {
    await api(id ? `/drivers/${id}` : '/drivers', { method: id ? 'PUT' : 'POST', body });
    Modal.close('driverModal');
    await Promise.all([loadDrivers(), resetDriverForm()]);
  } catch (e) {
    notifyError(e);
  }
});

$('btnDriverCancel').addEventListener('click', () => Modal.close('driverModal'));

// ==========================================================
// Veículos
// ==========================================================
const VEHICLE_FIELDS = ['plate', 'description', 'brand', 'vehicle_type', 'model_year', 'renavam', 'capacity_kg', 'capacity_m3', 'notes'];

function renderVehicles() {
  const tbody = $('vehiclesTableBody');
  $('lblVehicleCount').textContent = `${state.vehicles.length} veículo(s)`;
  if (!state.vehicles.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="dt-empty">Nenhum veículo cadastrado.</td></tr>';
    return;
  }
  tbody.innerHTML = state.vehicles.map((v) => `
    <tr data-id="${v.vehicle_id}">
      <td><strong>${esc(v.plate)}</strong></td>
      <td>${esc(v.description)}</td>
      <td>${esc(v.brand || '')}</td>
      <td>${esc(VEHICLE_TYPE_LABEL[v.vehicle_type] || v.vehicle_type)}</td>
      <td>${esc(v.model_year ?? '')}</td>
      <td>${v.capacity_kg ? `${fmtNum(v.capacity_kg, 2)} kg` : ''}${v.capacity_m3 ? `<span class="dt-sub">${fmtNum(v.capacity_m3, 3)} m³</span>` : ''}</td>
      <td>${v.is_active ? badge('CONCLUIDA', 'Ativo') : badge('CANCELADA', 'Inativo')}</td>
      <td><div class="dt-actions">
        <button class="btn btn-edit btn-sm" type="button" data-act="edit">✏️ Editar</button>
        <button class="btn btn-delete btn-sm" type="button" data-act="delete">🗑️</button>
      </div></td>
    </tr>`).join('');
}

function resetVehicleForm() {
  $('formVehicle').reset();
  $('vehicle_id').value = '';
  $('vehicleFormTitle').textContent = '🚐 Novo Veículo';
}

$('btnNewVehicle').addEventListener('click', () => {
  resetVehicleForm();
  Modal.open('vehicleModal', { focusSelector: '#vehicle_plate' });
});

$('vehiclesTableBody').addEventListener('click', async (ev) => {
  const btn = ev.target.closest('button[data-act]');
  if (!btn) return;
  const id = btn.closest('tr').dataset.id;
  const v = state.vehicles.find((x) => String(x.vehicle_id) === id);
  try {
    if (btn.dataset.act === 'edit') {
      $('vehicle_id').value = v.vehicle_id;
      VEHICLE_FIELDS.forEach((f) => { $(`vehicle_${f}`).value = v[f] ?? ''; });
      $('vehicle_is_active').value = String(v.is_active);
      $('vehicleFormTitle').textContent = `🚐 Editando: ${v.plate}`;
      Modal.open('vehicleModal', { focusSelector: '#vehicle_description' });
    } else if (btn.dataset.act === 'delete') {
      if (!confirm(`Excluir o veículo ${v.plate}?`)) return;
      await api(`/vehicles/${id}`, { method: 'DELETE' });
      resetVehicleForm();
      await loadVehicles();
    }
  } catch (e) {
    notifyError(e);
  }
});

$('formVehicle').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const id = $('vehicle_id').value;
  const body = Object.fromEntries(VEHICLE_FIELDS.map((f) => [f, $(`vehicle_${f}`).value]));
  body.is_active = $('vehicle_is_active').value;
  try {
    await api(id ? `/vehicles/${id}` : '/vehicles', { method: id ? 'PUT' : 'POST', body });
    Modal.close('vehicleModal');
    resetVehicleForm();
    await loadVehicles();
  } catch (e) {
    notifyError(e);
  }
});

$('btnVehicleCancel').addEventListener('click', () => Modal.close('vehicleModal'));

// ==========================================================
// Init
// ==========================================================
(async function init() {
  resetTripForm();
  try {
    await Promise.all([loadDrivers(), loadVehicles(), loadEligibleEmployees(), loadTrips()]);
  } catch (e) {
    notifyError(e);
  }
})();
