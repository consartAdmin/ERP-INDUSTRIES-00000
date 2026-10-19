// ╔══════════════════════════════════════════════════════════════════════╗
// ║ expenses.js — Despesas (Expenses)                                   ║
// ║ Path: public/expenses/expenses.js                                   ║
// ║ PRODNEX ERP | Frontend (ESM)                                        ║
// ║ API: /api/expenses                                                  ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { createExpenseCreateModal } from './expenseCreateModal.js';
import { openSuppliersModalSearch } from '/public/modalsSearch/suppliersModalSearch.js';

/* ──────────────────────────────────────────────────────────────
   API BASE (compatível com seu padrão)
────────────────────────────────────────────────────────────── */
function getApiBaseSafe() {
  try { if (typeof window.getApiBase === 'function') return window.getApiBase(); } catch {}
  return window.API_BASE || window.apiBase || window.API || '';
}
const API_BASE = getApiBaseSafe();
const API = `${API_BASE}/api/expenses`;

/* ──────────────────────────────────────────────────────────────
   DOM
────────────────────────────────────────────────────────────── */
const el = {
  // Filters
  fQ:        document.getElementById('fQ'),
  fName:     document.getElementById('fName'),
  fStatus:   document.getElementById('fStatus'),
  fCategory: document.getElementById('fCategory'),

  // ✅ Fornecedor no HTML: #fornBusca + botão #btnFornBusca
  fVendor:   document.querySelector('.table-layout-integrated__filter #fornBusca'),
  btnVendor: document.querySelector('.table-layout-integrated__filter #btnFornBusca'),

  fFrom:     document.getElementById('fFrom'),
  fTo:       document.getElementById('fTo'),
  fOrderBy:  document.getElementById('fOrderBy'),
  fPageSize: document.getElementById('fPageSize'),

  btnFilter:  document.getElementById('btnFilter'),
  btnClear:   document.getElementById('btnClear'),
  btnPrev:    document.getElementById('btnPrevious'),
  btnNext:    document.getElementById('btnNext'),

  // PDF (ID no HTML está como btnPdfGenrate)
  btnPdf: document.getElementById('btnPdfGenrate'),

  // Table
  tbBody:     document.getElementById('tbBody'),
  countInfo:  document.getElementById('apTableInfo'),
  pageInfo:   document.getElementById('pageInfo'),
  pageSize:   document.getElementById('pageSize'),

  // Actions
  btnNew: document.getElementById('btnNew'),
};

/* ──────────────────────────────────────────────────────────────
   STATE
────────────────────────────────────────────────────────────── */
let limit = 50;
let offset = 0;
let total = 0;

/* ──────────────────────────────────────────────────────────────
   Utils
────────────────────────────────────────────────────────────── */
const moneyBR = (v) =>
  (Number(v || 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function escapeHtml(s) {
  return String(s ?? '')
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'","&#039;");
}

function fmtDateBR(dateStr) {
  if (!dateStr) return '';
  const onlyDate = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (onlyDate) return `${onlyDate[3]}/${onlyDate[2]}/${onlyDate[1]}`;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return String(dateStr);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = d.getFullYear();
  return `${dd}/${mm}/${yy}`;
}

function fmtDateTimeBR(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return String(dateStr);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yy} ${hh}:${mi}`;
}

function setLoadingRow(msg = 'Carregando…') {
  el.tbBody.innerHTML = `<tr><td colspan="10" class="muted center">${escapeHtml(msg)}</td></tr>`;
}

function badgeStatus(status) {
  const s = String(status || '').toUpperCase();
  if (s === 'PAID') return `<span class="badge paid">✅ PAGO</span>`;
  if (s === 'CANCELLED') return `<span class="badge cancelled">⛔ CANCEL</span>`;
  return `<span class="badge pending">⏳ PEND</span>`;
}

function todayStamp() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}${mm}${dd}_${hh}${mi}`;
}

function setBtnBusy(btn, busy, labelWhenIdle = null) {
  if (!btn) return;
  btn.disabled = !!busy;
  btn.dataset.idleLabel ||= btn.textContent.trim();
  btn.textContent = busy
    ? 'Gerando…'
    : (labelWhenIdle || btn.dataset.idleLabel || 'PDF');
}

/* ──────────────────────────────────────────────────────────────
   HTTP (JSON)
────────────────────────────────────────────────────────────── */
async function apiFetch(path, opts = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });

  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }

  if (!res.ok) {
    const msg = data?.message || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

/* ──────────────────────────────────────────────────────────────
   Query builder
────────────────────────────────────────────────────────────── */
function buildQuery({ includePaging = true } = {}) {
  const q = new URLSearchParams();
  const v = (x) => (x === undefined || x === null ? '' : String(x).trim());

  if (v(el.fQ?.value))        q.set('q', v(el.fQ.value));
  if (v(el.fName?.value))     q.set('name', v(el.fName.value));
  if (v(el.fStatus?.value))   q.set('status', v(el.fStatus.value));
  if (v(el.fCategory?.value)) q.set('category', v(el.fCategory.value));
  if (v(el.fVendor?.value))   q.set('vendor', v(el.fVendor.value));
  if (v(el.fFrom?.value))     q.set('date_from', v(el.fFrom.value));
  if (v(el.fTo?.value))       q.set('date_to', v(el.fTo.value));

  q.set('order_by', v(el.fOrderBy?.value) || 'created_at_desc');

  limit = Number(el.pageSize?.value || el.fPageSize?.value || 50);

  if (includePaging) {
    q.set('limit', String(limit));
    q.set('offset', String(offset));
  }

  return q.toString();
}

/* ──────────────────────────────────────────────────────────────
   Load list
────────────────────────────────────────────────────────────── */
async function load() {
  try {
    setLoadingRow();
    const qs = buildQuery({ includePaging: true });
    const data = await apiFetch(`${API}?${qs}`);

    total = Number(data?.total || 0);
    const rows = Array.isArray(data?.rows) ? data.rows : [];

    const page = Math.floor(offset / limit) + 1;
    const pages = Math.max(1, Math.ceil(total / limit));
    const totalValue = Number(data?.total_value || 0);

    if (el.countInfo) {
      el.countInfo.textContent = `${total} ${total === 1 ? 'Registro' : 'Registros'} • ${moneyBR(totalValue)}`;
    }
    if (el.pageInfo) el.pageInfo.textContent = `Página ${page} de ${pages}`;
    if (el.btnPrev) el.btnPrev.disabled = page <= 1;
    if (el.btnNext) el.btnNext.disabled = page >= pages;

    if (!rows.length) {
      el.tbBody.innerHTML = `<tr><td colspan="10" class="muted center">Nenhum registro encontrado.</td></tr>`;
      return;
    }

    el.tbBody.innerHTML = rows.map(r => {
      const idShort = String(r.id ?? '').slice(0, 10);
      return `
        <tr>
          <td class="col-id" title="${escapeHtml(r.id)}">${escapeHtml(idShort)}${String(r.id).length > 10 ? '…' : ''}</td>
          <td>${escapeHtml(r.name || '')}</td>
          <td>${escapeHtml(r.category || '')}</td>
          <td>${escapeHtml(r.vendor || '')}</td>
          <td class="col-money">${moneyBR(r.value)}</td>
          <td class="col-date">${fmtDateBR(r.due_date)}</td>
          <td class="col-status">${badgeStatus(r.status)}</td>
          <td class="col-date">${fmtDateTimeBR(r.created_at)}</td>
          <td class="col-date">${fmtDateTimeBR(r.updated_at)}</td>
          <td class="col-actions">
            <button class="btn btn-ghost btnEdit" data-id="${escapeHtml(r.id)}" title="Editar">✏️</button>
            <button class="btn btn-ghost btnTrash" data-id="${escapeHtml(r.id)}" title="Excluir">🗑️</button>
          </td>
        </tr>
      `;
    }).join('');

  } catch (err) {
    console.error(err);
    setLoadingRow(`Erro: ${err.message || String(err)}`);
  }
}

/* ──────────────────────────────────────────────────────────────
   Read one
────────────────────────────────────────────────────────────── */
async function loadOne(id) {
  const data = await apiFetch(`${API}/${id}`);
  return data?.row || null;
}

/* ──────────────────────────────────────────────────────────────
   Modal (via module)
────────────────────────────────────────────────────────────── */
const expenseModal = createExpenseCreateModal({
  onCreate: async (payload) => {
    return await apiFetch(API, { method: 'POST', body: JSON.stringify(payload) });
  },
  onUpdate: async (id, payload) => {
    await apiFetch(`${API}/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
  },
  onDelete: async (id) => {
    await apiFetch(`${API}/${id}`, { method: 'DELETE' });
  },
  onAfterSave: async () => {
    offset = 0;
    await load();
  },
  onAfterDelete: async () => {
    await load();
  },
});

/* ──────────────────────────────────────────────────────────────
   PDF
   - tenta backend: GET /api/expenses/pdf?... => application/pdf
   - fallback: window.print()
────────────────────────────────────────────────────────────── */
async function downloadPdfFromBackend() {
  const qs = buildQuery({ includePaging: false });
  const url = `${API}/pdf?${qs}`;

  const res = await fetch(url, { method: 'GET' });

  if (res.status === 404 || res.status === 405) {
    throw new Error('NO_PDF_ENDPOINT');
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `Falha ao gerar PDF (HTTP ${res.status})`);
  }

  const ct = (res.headers.get('content-type') || '').toLowerCase();
  const blob = await res.blob();

  if (!ct.includes('application/pdf')) {
    throw new Error('Resposta não é PDF (Content-Type inválido).');
  }

  const fileName = `despesas_${todayStamp()}.pdf`;
  const a = document.createElement('a');
  const objUrl = URL.createObjectURL(blob);
  a.href = objUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objUrl);
}

function printFallback() {
  window.print();
}

async function onPdfClick() {
  if (!el.btnPdf) return;
  setBtnBusy(el.btnPdf, true, 'PDF');

  try {
    await downloadPdfFromBackend();
  } catch (err) {
    if (String(err?.message || '').includes('NO_PDF_ENDPOINT')) {
      printFallback();
    } else {
      console.error(err);
      alert(err.message || String(err));
    }
  } finally {
    setBtnBusy(el.btnPdf, false, 'PDF');
  }
}

/* ──────────────────────────────────────────────────────────────
   Actions
────────────────────────────────────────────────────────────── */
async function onEdit(id) {
  try {
    const row = await loadOne(id);
    if (!row) return alert('Registro não encontrado.');
    expenseModal.openEdit(row, { titleId: id });
  } catch (err) {
    alert(err.message || String(err));
  }
}

async function onDeleteQuick(id) {
  const ok = confirm('Confirma excluir esta despesa?');
  if (!ok) return;

  try {
    await apiFetch(`${API}/${id}`, { method: 'DELETE' });
    await load();
  } catch (err) {
    alert(err.message || String(err));
  }
}

/* ──────────────────────────────────────────────────────────────
   Suppliers modal → set vendor filter
────────────────────────────────────────────────────────────── */
async function pickSupplierToFilter() {
  const supplier = await openSuppliersModalSearch();
  if (!supplier) return;
  el.fVendor.value = supplier.name || supplier.nome || '';
  offset = 0;
  await load();
}

/* ──────────────────────────────────────────────────────────────
   Events
────────────────────────────────────────────────────────────── */
function bindEvents() {
  // ✅ Fornecedor: botão 🔎 / dblclick / Enter
  el.btnVendor?.addEventListener('click', (e) => {
    e.preventDefault();
    pickSupplierToFilter();
  });

  el.fVendor?.addEventListener('dblclick', (e) => {
    e.preventDefault();
    pickSupplierToFilter();
  });

  el.fVendor?.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    pickSupplierToFilter();
  });

  el.btnNew?.addEventListener('click', () => expenseModal.openCreate());

  el.btnFilter?.addEventListener('click', () => { offset = 0; load(); });

  el.btnClear?.addEventListener('click', () => {
    el.fQ.value = '';
    el.fName.value = '';
    el.fStatus.value = '';
    el.fCategory.value = '';
    el.fVendor.value = '';
    el.fFrom.value = '';
    el.fTo.value = '';
    el.fOrderBy.value = 'created_at_desc';
    el.fPageSize.value = '20';
    offset = 0;
    load();
  });

  el.btnPrev?.addEventListener('click', () => {
    offset = Math.max(0, offset - limit);
    load();
  });

  el.btnNext?.addEventListener('click', () => {
    const next = offset + limit;
    if (next >= total) return;
    offset = next;
    load();
  });

  el.fQ?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); offset = 0; load(); }
  });

  // PDF
  el.btnPdf?.addEventListener('click', onPdfClick);

  el.fPageSize?.addEventListener('change', () => {
    if (el.pageSize) el.pageSize.value = el.fPageSize.value;
    offset = 0;
    load();
  });

  el.pageSize?.addEventListener('change', () => {
    if (el.fPageSize) el.fPageSize.value = el.pageSize.value;
    offset = 0;
    load();
  });

  el.fOrderBy?.addEventListener('change', () => {
    offset = 0;
    load();
  });

  // Delegation: edit/trash buttons
  document.addEventListener('click', (e) => {
    const btnEdit = e.target.closest('.btnEdit');
    const btnTrash = e.target.closest('.btnTrash');
    if (btnEdit) {
      e.preventDefault();
      onEdit(btnEdit.dataset.id);
    }
    if (btnTrash) {
      e.preventDefault();
      onDeleteQuick(btnTrash.dataset.id);
    }
  });
}

/* ──────────────────────────────────────────────────────────────
   Boot
────────────────────────────────────────────────────────────── */
bindEvents();
load();