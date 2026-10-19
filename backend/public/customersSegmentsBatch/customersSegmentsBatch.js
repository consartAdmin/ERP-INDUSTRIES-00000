// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║ customersSegmentsBatch.js — Segmentos de Clientes em Lote (ESM)              ║
// ║ - Busca clientes com paginação                                              ║
// ║ - Seleção múltipla (checkbox + selecionar todos)                            ║
// ║ - Filtro: todos / só com segmento / só sem segmento                          ║
// ║ - Carrega segmentos de /api/customerSegments                                 ║
// ║ - POST em lote para /api/customers/segments/batch-apply                      ║
// ║ - POST desvincular para /api/customers/segments/unlink                       ║
// ║ ✅ Schema real: customers.trade_name, legal_name, tax_id, phone_number       ║
// ║ ✅ Padrão CONSART: API_BASE + ROUTES                                         ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import { showCenterModal } from '/public/includes/js/centerAlertModal.js';

/* ──────────────────────────────────────────────────────────────
   API BASE (padrão CONSART) + ROUTES
───────────────────────────────────────────────────────────── */
function getApiBase() {
  try {
    if (typeof window !== 'undefined' && window.getApiBase) return window.getApiBase();
    if (typeof window !== 'undefined' && window.apiBase) return window.apiBase;
  } catch (e) {}
  return '';
}

const API_BASE = getApiBase();

const ROUTES = Object.freeze({
  BATCH_LIST: '/api/customers/segments/batch-list',
  BATCH_APPLY: '/api/customers/segments/batch-apply',
  UNLINK: '/api/customers/segments/unlink',
  SEGMENTS_LIST: '/api/customerSegments',
});

/* ──────────────────────────────────────────────────────────────
   Confirm modal (CONSART Standard)
───────────────────────────────────────────────────────────── */
function confirmCenterModal({
  title = 'Confirmar ação',
  message = 'Deseja continuar?',
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
} = {}) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'csb-confirm-overlay';
    overlay.innerHTML = `
      <div class="csb-confirm-card" role="dialog" aria-modal="true" aria-label="${title}">
        <div class="csb-confirm-head">
          <div class="csb-confirm-title">${title}</div>
        </div>
        <div class="csb-confirm-body">${message}</div>
        <div class="csb-confirm-foot">
          <button type="button" class="btn btn-toolbar btn-sm" data-act="cancel">${cancelText}</button>
          <button type="button" class="btn btn-toolbar btn-sm" data-act="ok">${confirmText}</button>
        </div>
      </div>
    `;

    const cleanup = (val) => {
      document.removeEventListener('keydown', onEsc);
      overlay.remove();
      resolve(val);
    };

    const onEsc = (e) => {
      if (e.key === 'Escape') cleanup(false);
    };

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) cleanup(false);
    });

    overlay.querySelector('[data-act="cancel"]').addEventListener('click', () => cleanup(false));
    overlay.querySelector('[data-act="ok"]').addEventListener('click', () => cleanup(true));

    document.addEventListener('keydown', onEsc);
    document.body.appendChild(overlay);
  });
}

/* ──────────────────────────────────────────────────────────────
   Estado
───────────────────────────────────────────────────────────── */
const state = {
  page: 1,
  limit: 20,
  q: '',
  loading: false,
  customers: [],
  selected: new Set(), // customer_id
  filter: 'all', // all | linked | unlinked
  segmentId: '',
  segmentLabel: '-',
};

/* ──────────────────────────────────────────────────────────────
   Helpers DOM
───────────────────────────────────────────────────────────── */
const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const els = {
  searchInput: $('#csb-search-input'),
  searchBtn: $('#csb-search-btn'),
  tbody: $('#csb-customers-body'),
  selectAll: $('#csb-select-all'),
  prevPage: $('#csb-prev-page'),
  nextPage: $('#csb-next-page'),
  pageInfo: $('#csb-page-info'),
  selectedCount: $('#csb-selected-count'),
  summarySelected: $('#csb-summary-selected'),
  summarySegment: $('#csb-summary-segment'),
  filterSelect: $('#csb-segment-filter'),
  segmentSelect: $('#csb-segment-select'),
  applyBtn: $('#csb-apply-batch'),
  clearBtn: $('#csb-clear-selection'),
};

function assertEls() {
  const required = [
    'searchInput','searchBtn','tbody','selectAll','prevPage','nextPage','pageInfo',
    'selectedCount','summarySelected','summarySegment','filterSelect','segmentSelect',
    'applyBtn','clearBtn'
  ];
  const missing = required.filter((k) => !els[k]);
  if (missing.length) {
    console.warn('[CSB] Elementos não encontrados no DOM:', missing);
  }
}

/* ──────────────────────────────────────────────────────────────
   Utils
───────────────────────────────────────────────────────────── */
function debounce(fn, delay = 400) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), delay);
  };
}

async function safeJson(url, options = {}) {
  const res = await fetch(url, {
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${url} → ${res.status} ${res.statusText} :: ${text}`);
  }
  return res.json();
}

function fmtDoc(v) {
  const s = String(v ?? '').trim();
  if (!s) return '-';
  return s;
}

function fmtName(trade, legal) {
  const t = String(trade ?? '').trim();
  if (t) return t;
  const l = String(legal ?? '').trim();
  if (l) return l;
  return '-';
}

function fmtPhone(mobile, phone) {
  const m = String(mobile ?? '').trim();
  if (m) return m;
  const p = String(phone ?? '').trim();
  if (p) return p;
  return '-';
}

/* ──────────────────────────────────────────────────────────────
   Carregar Segmentos (combo à direita)
───────────────────────────────────────────────────────────── */
async function loadSegments() {
  try {
    const data = await safeJson(`${API_BASE}${ROUTES.SEGMENTS_LIST}?limit=500&active=true`);
    const list = data.rows || data || [];

    els.segmentSelect.innerHTML = '<option value="">Selecione um segmento...</option>';

    list.forEach((s) => {
      const id   = s.segment_id ?? s.id;
      const code = s.segment_code;
      const name = s.segment_name ?? s.name;

      if (id == null) return;

      const opt = document.createElement('option');
      opt.value = String(id);
      opt.textContent = [code, name].filter(Boolean).join(' — ') || `Segmento #${id}`;
      els.segmentSelect.appendChild(opt);
    });
  } catch (err) {
    console.error('[CSB] Erro ao carregar segmentos', err);
    showCenterModal({
      variant: 'warning',
      title: 'Segmentos',
      message: `Não foi possível carregar os segmentos. Verifique a API ${ROUTES.SEGMENTS_LIST}.`,
      timeoutMs: 6500,
    });
  }
}

/* ──────────────────────────────────────────────────────────────
   Buscar clientes (USANDO /api/customers/segments/batch-list)
───────────────────────────────────────────────────────────── */
async function fetchCustomers() {
  if (state.loading) return;
  state.loading = true;

  const params = new URLSearchParams();
  if (state.q && state.q.length >= 3) params.set('q', state.q);
  params.set('limit', String(state.limit));
  params.set('offset', String((state.page - 1) * state.limit));

  if (state.filter === 'linked') params.set('hasSegment', 'true');
  if (state.filter === 'unlinked') params.set('hasSegment', 'false');

  try {
    const url = `${API_BASE}${ROUTES.BATCH_LIST}?${params.toString()}`;
    const data = await safeJson(url);

    state.customers = data.rows || [];
    renderCustomersTable();

    const page = state.page;
    els.pageInfo.textContent = `Página ${page}`;
    els.prevPage.disabled = page <= 1;
    els.nextPage.disabled = state.customers.length < state.limit;
  } catch (err) {
    console.error('[CSB] Erro ao buscar clientes', err);
    showCenterModal({
      variant: 'error',
      title: 'Erro ao buscar clientes',
      message: `Ocorreu um erro ao buscar os clientes. Verifique a rota ${ROUTES.BATCH_LIST}.`,
      timeoutMs: 7000,
    });
  } finally {
    state.loading = false;
  }
}

/* ──────────────────────────────────────────────────────────────
   Render tabela de clientes (COM DESVINCULAR)
───────────────────────────────────────────────────────────── */
function renderCustomersTable() {
  els.tbody.innerHTML = '';

  if (!state.customers.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 9;
    td.textContent =
      state.q && state.q.length >= 3
        ? 'Nenhum cliente encontrado para a busca.'
        : 'Nenhum cliente listado. Digite ao menos 3 caracteres e clique em Buscar.';
    td.style.textAlign = 'center';
    td.style.padding = '16px';
    tr.appendChild(td);
    els.tbody.appendChild(tr);
    updateSelectionInfo();
    return;
  }

  state.customers.forEach((c) => {
    const tr = document.createElement('tr');

    // ✅ schema real
    const customerId   = c.customer_id; // obrigatório no SELECT do backend
    const name         = fmtName(c.trade_name, c.legal_name);
    const doc          = fmtDoc(c.tax_id);
    const email        = String(c.email ?? '').trim() || '-';
    const phone        = fmtPhone(c.mobile_number, c.phone_number);

    const segmentName  = String(c.segment_name ?? '').trim() || '-';
    const segmentCode  = String(c.segment_code ?? '').trim();
    const segmentLabel = [segmentCode, segmentName].filter(Boolean).join(' — ') || '-';

    const isLinked = !!c.has_segment;

    // ☑️ checkbox
    const tdCheck = document.createElement('td');
    const chk = document.createElement('input');
    chk.type = 'checkbox';
    chk.dataset.customerId = String(customerId ?? '');
    chk.checked = state.selected.has(String(customerId));
    chk.addEventListener('change', onToggleCustomerSelection);
    tdCheck.appendChild(chk);

    // cols
    const tdId    = document.createElement('td'); tdId.textContent = customerId ?? '-';
    const tdName  = document.createElement('td'); tdName.textContent = name;
    const tdDoc   = document.createElement('td'); tdDoc.textContent = doc;
    const tdEmail = document.createElement('td'); tdEmail.textContent = email;
    const tdPhone = document.createElement('td'); tdPhone.textContent = phone;
    const tdSeg   = document.createElement('td'); tdSeg.textContent = segmentLabel;

    // status
    const tdStatus = document.createElement('td');
    const badge = document.createElement('span');
    badge.className = 'csb-status-badge ' + (isLinked ? 'ok' : 'no');
    badge.innerHTML = isLinked
      ? '✔️ <span>Vinculado</span>'
      : '❌ <span>Não vinculado</span>';
    tdStatus.appendChild(badge);

    // unlink
    const tdUnlink = document.createElement('td');
    tdUnlink.className = 'csb-unlink-cell';

    const btnUnlink = document.createElement('button');
    btnUnlink.type = 'button';
    btnUnlink.className = 'btn btn-toolbar btn-sm';
    btnUnlink.textContent = 'Desvincular';
    btnUnlink.disabled = !isLinked;

    btnUnlink.addEventListener('click', () => unlinkCustomerSegment(customerId, name, doc));
    tdUnlink.appendChild(btnUnlink);

    tr.append(tdCheck, tdId, tdName, tdDoc, tdEmail, tdPhone, tdSeg, tdStatus, tdUnlink);
    els.tbody.appendChild(tr);
  });

  // Selecionar todos (visíveis)
  const allVisibleIds = $$('#csb-customers-body input[type="checkbox"]').map(
    (x) => x.dataset.customerId
  );

  const allSelectedOnPage =
    allVisibleIds.length &&
    allVisibleIds.every((id) => state.selected.has(String(id)));

  els.selectAll.checked = !!allSelectedOnPage;

  updateSelectionInfo();
}

/* ──────────────────────────────────────────────────────────────
   Seleção
───────────────────────────────────────────────────────────── */
function onToggleCustomerSelection(ev) {
  const chk = ev.target;
  const id = chk.dataset.customerId;
  if (!id) return;

  if (chk.checked) state.selected.add(String(id));
  else {
    state.selected.delete(String(id));
    els.selectAll.checked = false;
  }

  updateSelectionInfo();
}

function onToggleSelectAll(ev) {
  const checked = ev.target.checked;
  $$('#csb-customers-body input[type="checkbox"]').forEach((chk) => {
    const id = chk.dataset.customerId;
    if (!id) return;
    chk.checked = checked;
    if (checked) state.selected.add(String(id));
    else state.selected.delete(String(id));
  });
  updateSelectionInfo();
}

function clearSelection() {
  state.selected.clear();
  els.selectAll.checked = false;
  renderCustomersTable();
}

function updateSelectionInfo() {
  const count = state.selected.size;
  els.selectedCount.textContent = String(count);
  els.summarySelected.textContent = String(count);
}

/* ──────────────────────────────────────────────────────────────
   Segment select (resumo)
───────────────────────────────────────────────────────────── */
function onSegmentChange() {
  state.segmentId = els.segmentSelect.value || '';
  state.segmentLabel =
    els.segmentSelect.selectedOptions?.[0]?.textContent?.trim() || '-';
  els.summarySegment.textContent = state.segmentLabel || '-';
}

/* ──────────────────────────────────────────────────────────────
   Desvincular segmento (linha)
───────────────────────────────────────────────────────────── */
async function unlinkCustomerSegment(customerId, name, doc) {
  const ok = await confirmCenterModal({
    title: 'Desvincular segmento',
    message: `
      <div>
        Deseja realmente <strong>DESVINCULAR</strong> o segmento deste cliente?
        <br><br>
        <strong>Cliente ID:</strong> ${customerId}<br>
        <strong>Nome:</strong> ${name}<br>
        <strong>Documento:</strong> ${doc}
      </div>
    `,
    confirmText: 'Desvincular',
    cancelText: 'Cancelar',
  });
  if (!ok) return;

  try {
    await safeJson(`${API_BASE}${ROUTES.UNLINK}`, {
      method: 'POST',
      body: JSON.stringify({ customer_id: Number(customerId) }),
    });

    state.selected.delete(String(customerId));
    updateSelectionInfo();

    showCenterModal({
      variant: 'success',
      title: 'Desvinculado',
      message: `Segmento removido do cliente ${name !== '-' ? name : ''}`.trim(),
      timeoutMs: 4000,
    });

    await fetchCustomers();
  } catch (err) {
    console.error('[CSB] Erro ao desvincular', err);
    showCenterModal({
      variant: 'error',
      title: 'Erro ao desvincular',
      message: `Não foi possível remover o segmento. Verifique a rota ${ROUTES.UNLINK}.`,
      timeoutMs: 7000,
    });
  }
}

/* ──────────────────────────────────────────────────────────────
   Aplicar segmento em lote
───────────────────────────────────────────────────────────── */
async function applyBatch() {
  if (!state.selected.size) {
    showCenterModal({
      variant: 'warning',
      title: 'Nenhum cliente selecionado',
      message: 'Selecione ao menos um cliente na lista para aplicar o segmento.',
      timeoutMs: 5200,
    });
    return;
  }

  if (!state.segmentId) {
    showCenterModal({
      variant: 'warning',
      title: 'Segmento obrigatório',
      message: 'Selecione um segmento para aplicar aos clientes selecionados.',
      timeoutMs: 6000,
    });
    return;
  }

  const proceed = await confirmCenterModal({
    title: 'Aplicar segmento em lote',
    message: `
      <div>
        Você está prestes a aplicar:
        <br><br>
        <strong>Segmento:</strong> ${state.segmentLabel || '-'}
        <br><br>
        Para <strong>${state.selected.size}</strong> cliente(s).
        <br><br>
        Deseja continuar?
      </div>
    `,
    confirmText: 'Aplicar segmento',
    cancelText: 'Cancelar',
  });
  if (!proceed) return;

  try {
    const payload = {
      customerIds: Array.from(state.selected).map((x) => Number(x)),
      segment_id: Number(state.segmentId),
    };

    await safeJson(`${API_BASE}${ROUTES.BATCH_APPLY}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    showCenterModal({
      variant: 'success',
      title: 'Segmento aplicado com sucesso',
      message: `O segmento foi aplicado para ${state.selected.size} cliente(s).`,
      timeoutMs: 5000,
    });

    await fetchCustomers();
  } catch (err) {
    console.error('[CSB] Erro ao aplicar em lote', err);
    showCenterModal({
      variant: 'error',
      title: 'Erro ao aplicar segmento',
      message: `Ocorreu um erro ao aplicar o segmento em lote. Verifique o backend ${ROUTES.BATCH_APPLY}.`,
      timeoutMs: 7000,
    });
  }
}

/* ──────────────────────────────────────────────────────────────
   Eventos e bootstrap
───────────────────────────────────────────────────────────── */
function initEvents() {
  const debouncedSearch = debounce(() => {
    state.page = 1;
    state.q = (els.searchInput.value || '').trim();
    fetchCustomers();
  }, 500);

  els.searchBtn.addEventListener('click', () => {
    state.page = 1;
    state.q = (els.searchInput.value || '').trim();
    fetchCustomers();
  });

  els.searchInput.addEventListener('keyup', (ev) => {
    if (ev.key === 'Enter') {
      state.page = 1;
      state.q = (els.searchInput.value || '').trim();
      fetchCustomers();
    } else {
      debouncedSearch();
    }
  });

  els.selectAll.addEventListener('change', onToggleSelectAll);

  els.prevPage.addEventListener('click', () => {
    if (state.page > 1) {
      state.page -= 1;
      fetchCustomers();
    }
  });

  els.nextPage.addEventListener('click', () => {
    if (!els.nextPage.disabled) {
      state.page += 1;
      fetchCustomers();
    }
  });

  els.filterSelect.addEventListener('change', () => {
    state.filter = els.filterSelect.value || 'all';
    state.page = 1;
    fetchCustomers();
  });

  els.segmentSelect.addEventListener('change', onSegmentChange);
  els.applyBtn.addEventListener('click', applyBatch);
  els.clearBtn.addEventListener('click', clearSelection);
}

async function bootstrap() {
  assertEls();
  initEvents();
  await loadSegments();
  await fetchCustomers();
}

document.addEventListener('DOMContentLoaded', bootstrap);