// ╔══════════════════════════════════════════════════════════════════════╗
// ║ productsStockLots.js — Lotes & Validade (PRODNEX ERP | ESM)          ║
// ║ Path: backend/public/productsStockLots/productsStockLots.js          ║
// ║ API: /api/productsStockLots                                          ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { createProductsStockLotsModal } from './createProductsStockLotsModal.js';

/* ──────────────────────────────────────────────────────────────
   API Base (compatível com seu padrão)
────────────────────────────────────────────────────────────── */
function getApiBaseSafe() {
  try { if (typeof window.getApiBase === 'function') return window.getApiBase(); } catch {}
  return window.API_BASE || window.apiBase || window.API || '';
}
const API_BASE = getApiBaseSafe();
const API = `${API_BASE}/api/productsStockLots`;

/* ──────────────────────────────────────────────────────────────
   DOM (somente página)
────────────────────────────────────────────────────────────── */
const el = {
  // Top buttons
  btnEnsure: document.getElementById('btnEnsure'),
  btnRefresh: document.getElementById('btnRefresh'),
  btnNew: document.getElementById('btnNew'),

  // Filters
  fProductStockId: document.getElementById('fProductStockId'),
  fQ: document.getElementById('fQ'),
  fOnlyAvailable: document.getElementById('fOnlyAvailable'),
  fOrderBy: document.getElementById('fOrderBy'),
  fDir: document.getElementById('fDir'),
  fLimit: document.getElementById('fLimit'),
  fPage: document.getElementById('fPage'),

  btnSearch: document.getElementById('btnSearch'),
  btnPrev: document.getElementById('btnPrev'),
  btnNext: document.getElementById('btnNext'),
  btnClear: document.getElementById('btnClear'),
  btnFefo: document.getElementById('btnFefo'),

  // Summary
  sumTotal: document.getElementById('sumTotal'),
  sumAvailable: document.getElementById('sumAvailable'),
  sumOnHand: document.getElementById('sumOnHand'),
  sumReserved: document.getElementById('sumReserved'),
  pagingInfo: document.getElementById('pagingInfo'),

  // Table
  tbody: document.getElementById('tbody'),

  // Toast
  toast: document.getElementById('toast'),
};

let state = {
  rows: [],
  total: 0,
  page: 1,
  limit: 20,
  lastMode: 'list', // list | fefo
};

/* ──────────────────────────────────────────────────────────────
   Helpers
────────────────────────────────────────────────────────────── */
function fmtNum(v) {
  const n = Number(v || 0);
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}
function fmtDate(isoOrNull) {
  if (!isoOrNull) return '—';
  const d = new Date(String(isoOrNull).slice(0, 10) + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return String(isoOrNull);
  return d.toLocaleDateString('pt-BR');
}
function fmtDT(dt) {
  if (!dt) return '—';
  const d = new Date(dt);
  if (Number.isNaN(d.getTime())) return String(dt);
  return d.toLocaleString('pt-BR');
}

function toast(msg, ms = 2600) {
  el.toast.textContent = msg;
  el.toast.classList.remove('hidden');
  window.clearTimeout(toast._t);
  toast._t = window.setTimeout(() => el.toast.classList.add('hidden'), ms);
}

async function apiJson(url, opts = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!res.ok || data?.ok === false) {
    const msg = data?.error || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

function escapeHtml(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function readFilters() {
  const product_stock_id = (el.fProductStockId.value || '').trim();
  return {
    product_stock_id: product_stock_id ? Number(product_stock_id) : null,
    q: (el.fQ.value || '').trim(),
    onlyAvailable: el.fOnlyAvailable.value,
    orderBy: el.fOrderBy.value,
    dir: el.fDir.value,
    limit: Number(el.fLimit.value || 20),
    page: Math.max(1, Number(el.fPage.value || 1)),
  };
}

function setPagingInfo() {
  const page = state.page || 1;
  const limit = state.limit || 20;
  const total = state.total || 0;
  const pages = Math.max(1, Math.ceil(total / limit));
  el.pagingInfo.textContent = `Página ${page} de ${pages} • ${total} registro(s)`;
  el.btnPrev.disabled = page <= 1;
  el.btnNext.disabled = page >= pages;
}

function renderSummary(rows, total = 0) {
  let onHand = 0, reserved = 0, available = 0;
  for (const r of rows) {
    onHand += Number(r.qty_on_hand || 0);
    reserved += Number(r.qty_reserved || 0);
    const av = (r.qty_available != null)
      ? Number(r.qty_available || 0)
      : Number(r.qty_on_hand || 0) - Number(r.qty_reserved || 0);
    available += av;
  }
  el.sumTotal.textContent = String(total ?? rows.length ?? 0);
  el.sumOnHand.textContent = fmtNum(onHand);
  el.sumReserved.textContent = fmtNum(reserved);
  el.sumAvailable.textContent = fmtNum(available);
}

function rowActionsHtml(r) {
  return `
    <div class="actions">
      <button class="small-btn primary" data-act="edit" data-id="${r.lot_id}">Editar</button>
      <button class="small-btn" data-act="reserve" data-id="${r.lot_id}">Reservar</button>
      <button class="small-btn" data-act="unreserve" data-id="${r.lot_id}">Desreservar</button>
      <button class="small-btn danger" data-act="consume" data-id="${r.lot_id}">Baixar</button>
    </div>
  `;
}

function renderTable(rows) {
  if (!rows?.length) {
    el.tbody.innerHTML = `<tr><td colspan="9" class="empty">Nenhum lote encontrado.</td></tr>`;
    return;
  }

  el.tbody.innerHTML = rows.map(r => {
    const qtyAvail = (r.qty_available != null)
      ? Number(r.qty_available || 0)
      : (Number(r.qty_on_hand || 0) - Number(r.qty_reserved || 0));

    return `
      <tr>
        <td class="w-id num">${r.lot_id}</td>
        <td class="w-ps num">${r.product_stock_id}</td>
        <td class="w-lot"><span class="mono">${escapeHtml(r.lot_code || '')}</span></td>
        <td class="w-date">${fmtDate(r.expires_at)}</td>
        <td class="w-num">${fmtNum(r.qty_on_hand)}</td>
        <td class="w-num">${fmtNum(r.qty_reserved)}</td>
        <td class="w-num">${fmtNum(qtyAvail)}</td>
        <td class="w-date">${fmtDT(r.updated_at)}</td>
        <td class="w-actions">${rowActionsHtml(r)}</td>
      </tr>
    `;
  }).join('');
}

/* ──────────────────────────────────────────────────────────────
   Loads
────────────────────────────────────────────────────────────── */
async function loadList() {
  const f = readFilters();
  state.lastMode = 'list';
  state.page = f.page;
  state.limit = f.limit;

  const qs = new URLSearchParams();
  if (f.product_stock_id) qs.set('product_stock_id', String(f.product_stock_id));
  if (f.q) qs.set('q', f.q);
  qs.set('onlyAvailable', f.onlyAvailable);
  qs.set('orderBy', f.orderBy);
  qs.set('dir', f.dir);
  qs.set('page', String(f.page));
  qs.set('limit', String(f.limit));

  el.tbody.innerHTML = `<tr><td colspan="9" class="empty">Carregando…</td></tr>`;
  const data = await apiJson(`${API}?${qs.toString()}`);
  state.rows = data.rows || [];
  state.total = Number(data.total || 0);
  el.fPage.value = String(data.page || f.page);

  renderTable(state.rows);
  renderSummary(state.rows, state.total);
  setPagingInfo();
}

async function loadFefo() {
  const f = readFilters();
  if (!f.product_stock_id) {
    toast('Informe o Product Stock ID para usar FEFO.');
    el.fProductStockId.focus();
    return;
  }

  state.lastMode = 'fefo';
  state.page = 1;
  state.limit = f.limit;
  el.fPage.value = '1';

  el.tbody.innerHTML = `<tr><td colspan="9" class="empty">Carregando FEFO…</td></tr>`;
  const data = await apiJson(`${API}/fefo/${f.product_stock_id}`);
  const rows = data.rows || [];
  state.rows = rows;
  state.total = rows.length;

  renderTable(rows);
  renderSummary(rows, rows.length);
  el.pagingInfo.textContent = `FEFO • ${rows.length} lote(s) disponíveis`;
  el.btnPrev.disabled = true;
  el.btnNext.disabled = true;
}

async function ensureDb() {
  await apiJson(`${API}/ensure`, { method: 'POST', body: '{}' });
  toast('Ensure DB executado com sucesso.');
}

function pickQty(defaultQty = 1) {
  const raw = prompt('Quantidade:', String(defaultQty));
  if (raw === null) return null;
  const q = Number(String(raw).replace(',', '.'));
  if (!(q > 0)) { toast('Quantidade inválida.'); return null; }
  return q;
}

async function reloadCurrentMode() {
  if (state.lastMode === 'fefo') return loadFefo();
  return loadList();
}

/* ──────────────────────────────────────────────────────────────
   Modal (separado)
────────────────────────────────────────────────────────────── */
const modal = createProductsStockLotsModal({
  API,
  apiJson,
  toast,
  reload: reloadCurrentMode,
});

/* ──────────────────────────────────────────────────────────────
   Table ops (sem abrir modal)
────────────────────────────────────────────────────────────── */
async function opReserve(id, qty) {
  const data = await apiJson(`${API}/${id}/reserve`, { method: 'POST', body: JSON.stringify({ qty }) });
  return data.row;
}
async function opUnreserve(id, qty) {
  const data = await apiJson(`${API}/${id}/unreserve`, { method: 'POST', body: JSON.stringify({ qty }) });
  return data.row;
}
async function opConsume(id, qty) {
  const data = await apiJson(`${API}/${id}/consume`, { method: 'POST', body: JSON.stringify({ qty }) });
  return data.row;
}

/* ──────────────────────────────────────────────────────────────
   Events
────────────────────────────────────────────────────────────── */
el.btnEnsure.addEventListener('click', async () => {
  try { await ensureDb(); } catch (e) { toast(e.message); }
});

el.btnRefresh.addEventListener('click', async () => {
  try { await reloadCurrentMode(); } catch (e) { toast(e.message); }
});

el.btnNew.addEventListener('click', () => {
  modal.openNew({ defaultProductStockId: (el.fProductStockId.value || '').trim() });
});

el.btnSearch.addEventListener('click', async () => {
  try {
    el.fPage.value = '1';
    await loadList();
  } catch (e) { toast(e.message); }
});

el.btnFefo.addEventListener('click', async () => {
  try { await loadFefo(); } catch (e) { toast(e.message); }
});

el.btnClear.addEventListener('click', async () => {
  el.fProductStockId.value = '';
  el.fQ.value = '';
  el.fOnlyAvailable.value = 'false';
  el.fOrderBy.value = 'expires_at';
  el.fDir.value = 'asc';
  el.fLimit.value = '20';
  el.fPage.value = '1';
  try { await loadList(); } catch (e) { toast(e.message); }
});

el.btnPrev.addEventListener('click', async () => {
  const p = Math.max(1, Number(el.fPage.value || 1) - 1);
  el.fPage.value = String(p);
  try { await loadList(); } catch (e) { toast(e.message); }
});

el.btnNext.addEventListener('click', async () => {
  const p = Math.max(1, Number(el.fPage.value || 1) + 1);
  el.fPage.value = String(p);
  try { await loadList(); } catch (e) { toast(e.message); }
});

// Table actions
el.tbody.addEventListener('click', async (ev) => {
  const btn = ev.target.closest('button[data-act]');
  if (!btn) return;

  const act = btn.getAttribute('data-act');
  const id = Number(btn.getAttribute('data-id'));
  const lot = state.rows.find(r => Number(r.lot_id) === id);

  try {
    if (act === 'edit') {
      const data = await apiJson(`${API}/${id}`);
      modal.openEdit(data.row);
      return;
    }

    if (act === 'reserve') {
      const q = pickQty(1);
      if (!q) return;
      await opReserve(id, q);
      toast('Reservado com sucesso.');
      await reloadCurrentMode();
      return;
    }

    if (act === 'unreserve') {
      const q = pickQty(1);
      if (!q) return;
      await opUnreserve(id, q);
      toast('Desreservado com sucesso.');
      await reloadCurrentMode();
      return;
    }

    if (act === 'consume') {
      const q = pickQty(1);
      if (!q) return;
      if (!confirm(`Confirmar baixa de ${q} no lote ${lot?.lot_code || id}?`)) return;
      await opConsume(id, q);
      toast('Baixa realizada.');
      await reloadCurrentMode();
    }
  } catch (e) {
    toast(e.message);
  }
});

/* ──────────────────────────────────────────────────────────────
   Boot
────────────────────────────────────────────────────────────── */
(function bindQuickEnterToSearch(){
  // Enter in any filter triggers search
  const inputs = [
    el.fProductStockId, el.fQ, el.fOnlyAvailable, el.fOrderBy, el.fDir, el.fLimit, el.fPage
  ].filter(Boolean);

  for (const i of inputs) {
    i.addEventListener('keydown', (ev) => {
      if (ev.key !== 'Enter') return;
      ev.preventDefault();
      el.btnSearch.click();
    });
  }
})();

(async function boot() {
  try {
    await loadList();
  } catch (e) {
    toast(e.message || 'Falha ao carregar.');
  }
})();