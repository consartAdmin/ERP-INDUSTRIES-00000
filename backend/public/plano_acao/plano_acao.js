/* ╔══════════════════════════════════════════════════════════════════════╗
 * ║ plano_acao.js — Frontend Plano de Ação | PRODNEX ERP (ESM)            ║
 * ║ Path: backend/public/plano_acao/plano_acao.js                         ║
 * ║ - Lista + filtros + paginação + CRUD + bulk import                    ║
 * ╚══════════════════════════════════════════════════════════════════════╝ */

'use strict';

// ======================================================================
// Config
// ======================================================================
const API_BASE =
  (typeof window !== 'undefined' && (window.apiBase || window.API_BASE)) ||
  (typeof window !== 'undefined' ? window.location.origin : '');

const API = `${API_BASE}/api/plano-acao`;

// ======================================================================
// DOM
// ======================================================================
const $ = (sel) => document.querySelector(sel);

const tbody = $('#tbody');
const emptyState = $('#emptyState');

const metaTotal = $('#metaTotal');
const metaPage = $('#metaPage');
const metaReq = $('#metaReq');
const pagerLabel = $('#pagerLabel');

const f_q = $('#f_q');
const f_item = $('#f_item');
const f_empresa = $('#f_empresa');
const f_status = $('#f_status');
const f_responsavel = $('#f_responsavel');
const f_pageSize = $('#f_pageSize');
const f_orderBy = $('#f_orderBy');

const btnAplicar = $('#btnAplicar');
const btnLimpar = $('#btnLimpar');
const btnPrev = $('#btnPrev');
const btnNext = $('#btnNext');
const btnNovo = $('#btnNovo');
const btnNovo2 = $('#btnNovo2');
const btnRefresh = $('#btnRefresh');
const btnImportar = $('#btnImportar');

// Modal form
const modalForm = $('#modalForm');
const modalTitle = $('#modalTitle');
const modalClose = $('#modalClose');
const btnCancelar = $('#btnCancelar');
const form = $('#form');

const idEl = $('#id');
const itemEl = $('#item');
const empresaEl = $('#empresa');
const causaEl = $('#causa');
const acaoEl = $('#acao');
const responsavelEl = $('#responsavel');
const dataEl = $('#data');
const statusEl = $('#status');
const situacaoEl = $('#situacao_atual');
const observEl = $('#observ_evidencias');
const extraEl = $('#campo_extra_01');

// Modal bulk
const modalBulk = $('#modalBulk');
const bulkClose = $('#bulkClose');
const btnBulkCancelar = $('#btnBulkCancelar');
const btnBulkValidar = $('#btnBulkValidar');
const btnBulkEnviar = $('#btnBulkEnviar');
const bulkJson = $('#bulkJson');
const bulkResult = $('#bulkResult');

// ======================================================================
// State
// ======================================================================
const state = {
  page: 1,
  pageSize: Number(f_pageSize?.value || 50),
  total: 0,
  totalPages: 1,
  lastReqId: null,
  loading: false,
};

// ======================================================================
// Utils
// ======================================================================
function escHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (m) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  }[m]));
}

function toInt(v) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function fmtDateBR(isoOrNull) {
  if (!isoOrNull) return '';
  const s = String(isoOrNull);
  const iso = s.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return s;
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function statusClass(status) {
  const s = String(status ?? '').toLowerCase();
  if (s.includes('aberta') || s.includes('open')) return 'open';
  if (s.includes('executado') || s.includes('conclu')) return 'done';
  if (s.includes('running') || s.includes('execução') || s.includes('execucao')) return 'run';
  if (s.includes('atras') || s.includes('delay')) return 'delay';
  return 'neutral';
}

async function jfetch(url, opts = {}) {
  const res = await fetch(url, {
    method: opts.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });

  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; }
  catch { data = { ok: false, error: text }; }

  if (!res.ok) {
    const err = new Error(data?.error || `Erro HTTP ${res.status}`);
    err.status = res.status;
    err.payload = data;
    throw err;
  }
  return data;
}

function buildQuery() {
  const params = new URLSearchParams();

  const q = (f_q?.value || '').trim();
  const item = (f_item?.value || '').trim();
  const empresa = (f_empresa?.value || '').trim();
  const status = (f_status?.value || '').trim();
  const responsavel = (f_responsavel?.value || '').trim();
  const pageSize = Number(f_pageSize?.value || 50);
  const orderBy = (f_orderBy?.value || '').trim();

  if (q) params.set('q', q);
  if (item) params.set('item', item);
  if (empresa) params.set('empresa', empresa);
  if (status) params.set('status', status);
  if (responsavel) params.set('responsavel', responsavel);

  params.set('page', String(state.page));
  params.set('pageSize', String(pageSize));
  if (orderBy) params.set('orderBy', orderBy);

  state.pageSize = pageSize;

  return params.toString();
}

// ======================================================================
// Render
// ======================================================================
function setLoading(on) {
  state.loading = !!on;
  document.body.classList.toggle('is-loading', !!on);
}

function renderMeta() {
  metaTotal.textContent = `${state.total} registro(s)`;
  metaPage.textContent = `Página ${state.page}`;
  metaReq.textContent = `reqId: ${state.lastReqId || '-'}`;
  pagerLabel.textContent = `${state.page} / ${state.totalPages}`;
  btnPrev.disabled = state.page <= 1;
  btnNext.disabled = state.page >= state.totalPages;
}

function renderRows(rows) {
  tbody.innerHTML = '';

  if (!rows || !rows.length) {
    emptyState.hidden = false;
    return;
  }
  emptyState.hidden = true;

  const frag = document.createDocumentFragment();

  for (const r of rows) {
    const tr = document.createElement('tr');
    const badge = `<span class="badge ${statusClass(r.status)}">${escHtml(r.status || '—')}</span>`;

    tr.innerHTML = `
      <td class="col-id">${escHtml(r.id)}</td>
      <td class="col-item">${escHtml(r.item)}</td>
      <td class="col-empresa">${escHtml(r.empresa || '')}</td>
      <td class="col-acao">${escHtml(r.acao || '')}</td>
      <td class="col-resp">${escHtml(r.responsavel || '')}</td>
      <td class="col-data">${escHtml(fmtDateBR(r.data))}</td>
      <td class="col-status">${badge}</td>
      <td class="col-sit">${escHtml(r.situacao_atual || '')}</td>
      <td class="col-obs">${escHtml(r.observ_evidencias || '')}</td>
      <td class="col-extra">${escHtml(r.campo_extra_01 || '')}</td>
      <td class="col-actions">
        <div class="actions-cell">
          <button class="btn btn-mini btn-ghost" data-act="edit" data-id="${r.id}" type="button">Editar</button>
          <button class="btn btn-mini btn-danger" data-act="del" data-id="${r.id}" type="button">Excluir</button>
        </div>
      </td>
    `;
    frag.appendChild(tr);
  }

  tbody.appendChild(frag);
}

// ======================================================================
// Data
// ======================================================================
async function load() {
  setLoading(true);
  try {
    const qs = buildQuery();
    const data = await jfetch(`${API}?${qs}`);
    state.total = Number(data.total || 0);
    state.lastReqId = data.reqId || null;

    const pageSize = Number(data.pageSize || state.pageSize || 50);
    state.totalPages = Math.max(1, Math.ceil(state.total / pageSize));

    state.page = Math.min(state.page, state.totalPages);

    renderMeta();
    renderRows(data.rows || []);
  } catch (err) {
    console.error(err);
    state.lastReqId = err?.payload?.reqId || null;
    renderMeta();
    renderRows([]);
    alert(err.message || 'Erro ao carregar dados.');
  } finally {
    setLoading(false);
  }
}

// ======================================================================
// Modal helpers (SAFE)
// ======================================================================
function openModal(backdropEl) {
  backdropEl.hidden = false;
  backdropEl.classList.add('is-open');
}

function closeModal(backdropEl) {
  backdropEl.classList.remove('is-open');
  backdropEl.hidden = true;
}

function ensureClosed(backdropEl) {
  backdropEl.classList.remove('is-open');
  backdropEl.hidden = true;
}

// ======================================================================
// Modal Form
// ======================================================================
function openFormModal(mode = 'create', row = null) {
  const isEdit = mode === 'edit';
  modalTitle.textContent = isEdit ? `Editar Plano de Ação #${row?.id}` : 'Novo Plano de Ação';

  idEl.value = isEdit ? String(row.id) : '';

  itemEl.value = row?.item ?? '';
  empresaEl.value = row?.empresa ?? '';
  causaEl.value = row?.causa ?? '';
  acaoEl.value = row?.acao ?? '';
  responsavelEl.value = row?.responsavel ?? '';
  statusEl.value = row?.status ?? '';
  situacaoEl.value = row?.situacao_atual ?? '';
  observEl.value = row?.observ_evidencias ?? '';
  extraEl.value = row?.campo_extra_01 ?? '';

  if (row?.data) {
    const d = String(row.data).slice(0, 10);
    dataEl.value = /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : '';
  } else {
    dataEl.value = '';
  }

  openModal(modalForm);
  setTimeout(() => itemEl?.focus(), 50);
}

function closeFormModal() {
  closeModal(modalForm);
}

function getFormPayload() {
  const payload = {
    item: toInt(itemEl.value),
    empresa: (empresaEl.value || '').trim(),
    causa: (causaEl.value || '').trim() || null,
    acao: (acaoEl.value || '').trim() || null,
    responsavel: (responsavelEl.value || '').trim() || null,
    data: (dataEl.value || '').trim() || null,
    status: (statusEl.value || '').trim() || null,
    situacao_atual: (situacaoEl.value || '').trim() || null,
    observ_evidencias: (observEl.value || '').trim() || null,
    campo_extra_01: (extraEl.value || '').trim() || null,
  };

  if (!payload.item || !payload.empresa) {
    throw new Error('Campos obrigatórios: Item e Empresa.');
  }
  return payload;
}

async function saveForm(e) {
  e.preventDefault();
  try {
    const payload = getFormPayload();
    const id = toInt(idEl.value);

    if (id) await jfetch(`${API}/${id}`, { method: 'PUT', body: payload });
    else await jfetch(`${API}`, { method: 'POST', body: payload });

    closeFormModal();
    await load();
  } catch (err) {
    console.error(err);
    alert(err.message || 'Erro ao salvar.');
  }
}

async function openEditById(id) {
  const data = await jfetch(`${API}/${id}`);
  openFormModal('edit', data.row);
}

async function removeById(id) {
  const ok = confirm(`Excluir registro #${id}?`);
  if (!ok) return;
  await jfetch(`${API}/${id}`, { method: 'DELETE' });
  await load();
}

// ======================================================================
// Bulk
// ======================================================================
function openBulkModal() {
  bulkResult.hidden = true;
  bulkResult.textContent = '';
  openModal(modalBulk);
  setTimeout(() => bulkJson?.focus(), 50);
}

function closeBulkModal() {
  closeModal(modalBulk);
}

function parseBulk() {
  const text = (bulkJson.value || '').trim();
  if (!text) throw new Error('Cole um JSON (array) para importar.');
  const data = JSON.parse(text);
  if (!Array.isArray(data)) throw new Error('O JSON deve ser um ARRAY de objetos.');
  return data;
}

function validateBulkRows(rows) {
  const errors = [];
  rows.forEach((r, i) => {
    if (!r || typeof r !== 'object') errors.push(`Linha ${i + 1}: objeto inválido.`);
    if (!r.item) errors.push(`Linha ${i + 1}: item obrigatório.`);
    if (!r.empresa) errors.push(`Linha ${i + 1}: empresa obrigatória.`);
  });
  return errors;
}

function showBulkResult(msg, isError = false) {
  bulkResult.hidden = false;
  bulkResult.style.borderColor = isError ? 'rgba(220,38,38,.35)' : 'rgba(22,163,74,.30)';
  bulkResult.textContent = msg;
}

async function bulkValidate() {
  try {
    const rows = parseBulk();
    const errors = validateBulkRows(rows);
    if (errors.length) showBulkResult(errors.join('\n'), true);
    else showBulkResult(`OK ✅ ${rows.length} registro(s) pronto(s) para importar.`);
  } catch (err) {
    showBulkResult(err.message, true);
  }
}

async function bulkSend() {
  try {
    const rows = parseBulk();
    const errors = validateBulkRows(rows);
    if (errors.length) {
      showBulkResult(errors.join('\n'), true);
      return;
    }

    const resp = await jfetch(`${API}/bulk`, { method: 'POST', body: rows });
    showBulkResult(`Importação concluída ✅\nRegistros: ${resp.count}\nreqId: ${resp.reqId || '-'}`, false);

    await load();
  } catch (err) {
    console.error(err);
    showBulkResult(err.message || 'Erro ao importar.', true);
  }
}

// ======================================================================
// Events
// ======================================================================
btnAplicar?.addEventListener('click', () => { state.page = 1; load(); });

btnLimpar?.addEventListener('click', () => {
  f_q.value = '';
  f_item.value = '';
  f_empresa.value = '';
  f_status.value = '';
  f_responsavel.value = '';
  f_orderBy.value = 'item asc';
  f_pageSize.value = '20';
  state.page = 1;
  load();
});

btnPrev?.addEventListener('click', () => { if (state.page > 1) { state.page--; load(); } });
btnNext?.addEventListener('click', () => { if (state.page < state.totalPages) { state.page++; load(); } });

btnNovo?.addEventListener('click', () => openFormModal('create', null));
btnNovo2?.addEventListener('click', () => openFormModal('create', null));
btnRefresh?.addEventListener('click', () => load());

btnImportar?.addEventListener('click', () => openBulkModal());

// Form modal
modalClose?.addEventListener('click', closeFormModal);
btnCancelar?.addEventListener('click', closeFormModal);
modalForm?.addEventListener('click', (e) => { if (e.target === modalForm) closeFormModal(); });
form?.addEventListener('submit', saveForm);

// Bulk modal
bulkClose?.addEventListener('click', closeBulkModal);
btnBulkCancelar?.addEventListener('click', closeBulkModal);
modalBulk?.addEventListener('click', (e) => { if (e.target === modalBulk) closeBulkModal(); });
btnBulkValidar?.addEventListener('click', bulkValidate);
btnBulkEnviar?.addEventListener('click', bulkSend);

// Table actions
tbody?.addEventListener('click', async (e) => {
  const btn = e.target?.closest?.('button[data-act]');
  if (!btn) return;
  const act = btn.getAttribute('data-act');
  const id = toInt(btn.getAttribute('data-id'));
  if (!id) return;

  try {
    if (act === 'edit') await openEditById(id);
    if (act === 'del') await removeById(id);
  } catch (err) {
    console.error(err);
    alert(err.message || 'Erro na ação.');
  }
});

// UX: Enter no campo busca aplica
[f_q, f_item, f_empresa, f_responsavel].forEach((el) => {
  el?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); state.page = 1; load(); }
  });
});

// ESC fecha modais
window.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (!modalBulk.hidden) closeBulkModal();
  else if (!modalForm.hidden) closeFormModal();
});

// ======================================================================
// Init
// ======================================================================
ensureClosed(modalBulk);
ensureClosed(modalForm);
load();
