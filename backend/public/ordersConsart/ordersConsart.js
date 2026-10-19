// ╔══════════════════════════════════════════════════════════════════════╗
// ║ ordersConsart.js — Front de Pedidos (lista + editor + NF-e) — PRODNEX ERP  ║
// ║ ✅ DEBUG IBGE: logs + snapshot do payload p/ descobrir o campo real  ║
// ║ ✅ NEW: "Return Order" (retornar pedido → orçamento)                ║
// ║    - Só habilita se NÃO houver NF-e gerada no pedido                ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { openProductsModalSearch } from '/public/modalsSearch/productsModalSearch.js';
import { openCustomersModalSearch } from '/public/modalsSearch/customersModalSearch.js';
import { showCenterModal } from '/public/includes/js/centerAlertModal.js';

// =====================================================================
// Helpers gerais
// =====================================================================

function parseISODateOnly(iso) {
  if (!iso) return null;
  const d = new Date(String(iso).slice(0, 10) + 'T00:00:00');
  return isNaN(d.getTime()) ? null : d;
}

function daysSince(dateIso) {
  const d = parseISODateOnly(dateIso);
  if (!d) return null;
  const today = new Date();
  const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diff = Math.floor((t0.getTime() - d.getTime()) / 86400000);
  return diff >= 0 ? diff : 0;
}

// Heurística: se tiver qualquer “sinal” de NF-e vinculada, consideramos que existe
function hasNfeLinked(o) {
  const cand = [
    o?.nfe_id, o?.nfeId,
    o?.nfe_key, o?.nfeKey, o?.chave_nfe, o?.chave,
    o?.nfe_number, o?.nfeNumber, o?.numero_nfe,
    o?.nfe_protocol, o?.nfeProtocol, o?.protocolo,
    o?.nfe_plugnotas_id, o?.nfePlugnotasId,
    o?.nfe_xml_url, o?.nfeXmlUrl,
    o?.nfe_danfe_url, o?.nfeDanfeUrl,
  ];
  if (cand.some(v => v !== undefined && v !== null && String(v).trim() !== '')) return true;

  const st = String(o?.nfe_status || o?.nfeStatus || '').toUpperCase().trim();
  if (st && !['SEM_NFE', 'SEM NF-E', 'SEM NFE', ''].includes(st)) return true;

  return false;
}

const $ = (s, r = document) => r.querySelector(s);

const toast = {
  info:    (title, message, ms = 3800) => showCenterModal({ variant: 'info',    title, message, timeoutMs: ms }),
  success: (title, message, ms = 4200) => showCenterModal({ variant: 'success', title, message, timeoutMs: ms }),
  warn:    (title, message)            => showCenterModal({ variant: 'warning', title, message }),
  error:   (title, message)            => showCenterModal({ variant: 'error',   title, message }),
};

const API_BASE = (window.apiBase || window.API_BASE || window.location.origin).replace(/\/$/, '');
const fmtMoney = (v) =>
  (Number(v || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const ROUTES = Object.freeze({
  orders:       `${API_BASE}/api/orders`,
  orderById:    (id) => `${API_BASE}/api/orders/${encodeURIComponent(id)}`,
  ordersSearch: (q, limit, offset, dateFrom, dateTo, status) => {
    const params = new URLSearchParams();
    params.set('q', q || '');
    params.set('limit', limit || 50);
    params.set('offset', offset || 0);
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    if (status && status !== 'TODOS') params.set('status', status);
    return `${API_BASE}/api/orders/search?${params.toString()}`;
  },

  // NF-e atrelada ao pedido
  nfeIssue:  (id) => `${API_BASE}/api/orders-nfe-attempts/orders/${encodeURIComponent(id)}/issue`,
  nfeStatus: (id) => `${API_BASE}/api/orders/${encodeURIComponent(id)}/nfe`,

  // 🔄 Return Order (pedido → orçamento)
  returnOrder: (id) => `${API_BASE}/api/orders/${encodeURIComponent(id)}/return-to-budget`,

  // Formas de pagamento
  paymentMethods: `${API_BASE}/api/paymentMethods`,

  // Relatório PDF
  ordersReportPdf: (q, dateFrom, dateTo, status) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    if (status && status !== 'TODOS') params.set('status', status);
    return `${API_BASE}/api/orders/report/pdf?${params.toString()}`;
  },
});

const state = {
  list: [],
  total: 0,
  page: 1,
  limit: 50,
  q: '',
  dateFrom: '',
  dateTo: '',
  status: 'TODOS',
  selectedId: null,
  editing: null,
  paymentMethods: [],
};

// Pequeno helper para setar valores com segurança
function setVal(id, value) {
  const el = $(`#${id}`);
  if (el) el.value = value ?? '';
}

function normalizeStatus(v) {
  const s = String(v || '').trim().toUpperCase();

  // CANCEL variations
  if (s === 'CANCELADO') return 'CANCELADO';
  if (s.startsWith('CANCEL')) return 'CANCELADO';

  // BILLED variations
  if (s === 'FATURADO') return 'FATURADO';
  if (s.startsWith('FATUR')) return 'FATURADO';

  return s;
}

// =====================================================================
// ✅ Return Order button control (LIST + EDITOR) — FINAL
// =====================================================================
function syncReturnOrderButtons({ listRow = null, header = null } = {}) {
  const btnEditor = $('#btnReturnOrder');
  if (!btnEditor) return;

  const hasNfe =
    hasNfeLinked(header) ||
    hasNfeLinked(listRow) ||
    hasNfeLinked(state.editing?.header) ||
    false;

  const hasOrderOpen = !!state.selectedId;

  // considera o status visível/alterado no editor (antes de salvar)
  const uiStatus = $('#statusPedido')?.value;

  const st = normalizeStatus(
    uiStatus ??
    header?.status ??
    listRow?.status ??
    state.editing?.header?.status ??
    ''
  );

  const isCanceled = st === 'CANCELADO';
  const isBilled   = st === 'FATURADO';

  btnEditor.disabled = !hasOrderOpen || hasNfe || isCanceled || isBilled;

  btnEditor.title = !hasOrderOpen
    ? 'Abra um pedido existente para usar Return Order.'
    : hasNfe
      ? 'NF-e já gerada para este pedido. Não é possível retornar para orçamento.'
      : isCanceled
        ? 'Pedido já está CANCELADO. Não é possível retornar novamente.'
        : isBilled
          ? 'Pedido FATURADO. Não é possível retornar para orçamento.'
          : 'Cancelar pedido e retornar para orçamento (sem NF-e).';

  btnEditor.classList.toggle('is-disabled', btnEditor.disabled);
}

// =====================================================================
// DEBUG (IBGE / payload tracing)  ✅ (escopo global)
// =====================================================================

const DEBUG_ORDERS = true; // deixe true enquanto investigar

function dlog(...args) {
  if (!DEBUG_ORDERS) return;
  console.log('%c[orders:debug]', 'color:#2563eb;font-weight:700', ...args);
}

function dsafeStringify(obj, maxLen = 8000) {
  try {
    const s = JSON.stringify(obj, (k, v) => {
      if (typeof v === 'string' && v.length > 600) return v.slice(0, 600) + '…';
      return v;
    }, 2);
    return s.length > maxLen ? s.slice(0, maxLen) + '\n…(truncado)' : s;
  } catch {
    return String(obj);
  }
}

function dget(obj, path) {
  try {
    return path.split('.').reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj);
  } catch {
    return undefined;
  }
}

function resolveIbgeCode(o) {
  const candidatesPaths = [
    // customer
    'customer.code_ibge',
    'customer.ibge_code',
    'customer.city_ibge',
    'customer.municipio_ibge',
    'customer.customer_codigo_ibge',
    'customer.codigo_ibge',
    'customer.ibge',

    // header
    'header.customer_codigo_ibge',
    'header.customer_ibge_code',
    'header.customer_city_ibge',
    'header.customer_ibge',
    'header.customer_codigo_municipio',
    'header.customer_city_code_ibge',
    'header.code_ibge',
    'header.ibge_code',
    'header.ibge',

    // top-level
    'customer_codigo_ibge',
    'customer_ibge_code',
    'customer_city_ibge',
    'code_ibge',
    'ibge_code',
    'ibge',
  ];

  const candidates = candidatesPaths.map((p) => ({ path: p, value: dget(o, p) }));
  const hit = candidates.find((c) => c.value !== undefined && c.value !== null && String(c.value).trim() !== '');

  return {
    value: hit ? String(hit.value).trim() : '',
    from: hit ? hit.path : '',
    candidates,
  };
}

window.__ORDERS_DEBUG__ = window.__ORDERS_DEBUG__ || { last: null, byId: {} };

// =====================================================================
// Tabs
// =====================================================================

function activateTab(which) {
  document.querySelectorAll('.tab').forEach((btn) => {
    const active = btn.dataset.tab === which;
    btn.classList.toggle('is-active', active);
  });

  document.querySelectorAll('.tab-panel').forEach((panel) => {
    const show = panel.dataset.panel === which;
    panel.classList.toggle('is-active', show);
  });
}

function bindTabs() {
  document.querySelectorAll('.tab').forEach((btn) => {
    btn.addEventListener('click', () => activateTab(btn.dataset.tab));
  });
}

// =====================================================================
// Lista de pedidos
// =====================================================================

function readFiltersFromUI() {
  state.q        = $('#qPedidos')?.value.trim() || '';
  state.dateFrom = $('#dtDePedidos')?.value || '';
  state.dateTo   = $('#dtAtePedidos')?.value || '';
  state.status   = $('#statusFiltroPedidos')?.value || 'TODOS';
}

function bindListUI() {
  $('#btnBuscarPedidos')?.addEventListener('click', () => {
    readFiltersFromUI();
    state.page = 1;
    fetchPedidos();
  });

  $('#qPedidos')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      readFiltersFromUI();
      state.page = 1;
      fetchPedidos();
    }
  });

  $('#limitPedidos')?.addEventListener('change', (e) => {
    state.limit = Number(e.target.value) || 50;
    state.page = 1;
    fetchPedidos();
  });

  $('#prevPedidos')?.addEventListener('click', () => {
    if (state.page > 1) {
      state.page--;
      fetchPedidos();
    }
  });

  $('#nextPedidos')?.addEventListener('click', () => {
    const max = Math.ceil(state.total / state.limit) || 1;
    if (state.page < max) {
      state.page++;
      fetchPedidos();
    }
  });

  $('#btnRecarregarPedidos')?.addEventListener('click', () => {
    fetchPedidos();
  });

  $('#btnNovoPedido')?.addEventListener('click', () => openEditorPedido());

  // 📄 Botão de relatório PDF
  $('#btnRelatorioPedidos')?.addEventListener('click', () => {
    readFiltersFromUI();
    const url = ROUTES.ordersReportPdf(state.q, state.dateFrom, state.dateTo, state.status);
    window.open(url, '_blank');
  });

  // Clicks na tabela (expandir, emitir NF-e, return order)
  const tbody = $('#tblPedidos tbody');
  if (tbody) tbody.addEventListener('click', handleListTableClick);
}

async function fetchPedidos() {
  const offset = (state.page - 1) * state.limit;
  const url = ROUTES.ordersSearch(state.q, state.limit, offset, state.dateFrom, state.dateTo, state.status);

  try {
    const r = await fetch(url, { headers: { Accept: 'application/json' }, cache: 'no-store' });
    const js = await r.json().catch(() => ({ rows: [], total: 0 }));
    state.list = js.rows || [];
    state.total = js.total || 0;
    renderListPedidos();

    // se editor estiver aberto, re-sincroniza botão (usando linha atual da lista)
    if (state.selectedId) {
      const row = state.list.find((x) => String(x.order_id ?? x.id ?? x.number) === String(state.selectedId)) || null;
      syncReturnOrderButtons({ listRow: row, header: state.editing?.header });
    }
  } catch (err) {
    console.error('[orders] erro ao buscar pedidos:', err);
    toast.error('Erro ao carregar pedidos', 'Não foi possível carregar os pedidos. Verifique a API /api/orders/search.');
  }
}

function renderListPedidos() {
  const tbody = $('#tblPedidos tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  for (const o of state.list) {
    const id     = o.order_id ?? o.id ?? o.number;
    const number = o.number || id || '';
    const data   = (o.issue_date || '').slice(0, 10);
    const cli    = o.customer_name || '';
    const doc    = o.customer_tax_id || '';
    const total  = Number(o.total_amount || 0);
    const status = normalizeStatus(o.status || 'ABERTO');

    const nfeLinked  = hasNfeLinked(o);
    const isConvert  = (status === 'CONVERTIDO');
    const nfePending = isConvert && !nfeLinked;

    const ageDays = daysSince(o.issue_date);

    let badgeClass = 'badge--open';
    if (status === 'FATURADO') badgeClass = 'badge--approved';
    if (status === 'CANCELADO') badgeClass = 'badge--canceled';

    // status “emocional” quando precisa de ação
    let statusLabel = status.charAt(0) + status.slice(1).toLowerCase();
    if (nfePending) {
      badgeClass = 'badge--nfe-pending';
      statusLabel = `⚠ NF-e${ageDays != null ? ` · ${ageDays}d` : ''}`;
    }

    const clienteDisplay = cli.length > 45 ? `${cli.slice(0, 45)}…` : cli;

    const trMain = document.createElement('tr');
    trMain.classList.add('order-row-main');
    trMain.dataset.id = id;

    if (nfePending) {
      trMain.classList.add('is-nfe-pending');
      trMain.dataset.nfePending = '1';
    }

    const isCanceled = status === 'CANCELADO';
    const isBilled   = status === 'FATURADO';

    const returnDisabled = nfeLinked || isCanceled || isBilled;

    const returnTitle = nfeLinked
      ? 'NF-e já gerada para este pedido. Não é possível retornar para orçamento.'
      : isCanceled
        ? 'Pedido já está CANCELADO. Não é possível retornar novamente.'
        : isBilled
          ? 'Pedido FATURADO. Não é possível retornar para orçamento.'
          : 'Cancelar pedido e retornar para orçamento (sem NF-e).';

    trMain.innerHTML = `
      <td class="col-expand">
        <button type="button" class="btn-expand" data-act="expand" data-id="${id}" aria-label="Expandir detalhes do pedido ${number}">
          ▶
        </button>
      </td>
      <td class="num">${number}</td>
      <td>${data}</td>
      <td class="col-cliente" title="${cli}">${clienteDisplay}</td>
      <td class="num">${doc}</td>
      <td class="money ta-right">${fmtMoney(total)}</td>
      <td class="ta-center">
        <span class="badge ${badgeClass}">
          ${statusLabel}
        </span>
      </td>
      <td class="col-acoes ta-center">
        <button class="btn btn-secondary btn-sm ${nfePending ? 'btn-nfe-urgent' : ''}" data-act="emit-nfe" data-id="${id}">
          ${nfePending ? '⚡ Emitir NF-e' : '🧾 Emitir NF-e'}
        </button>

        <!-- 🔄 Return Order -->
        <button
          class="btn btn-warning btn-sm"
          data-act="return-order"
          data-id="${id}"
          ${returnDisabled ? 'disabled' : ''}
          title="${returnTitle}">
          🔄 Return Order
        </button>
      </td>
    `;

    const trDetails = document.createElement('tr');
    trDetails.classList.add('order-details-row');
    trDetails.dataset.id = id;
    trDetails.style.display = 'none';
    trDetails.innerHTML = `
      <td colspan="8">
        <div class="order-details-card">
          <div class="order-details-loading">Carregando detalhes do pedido...</div>
        </div>
      </td>
    `;

    tbody.appendChild(trMain);
    tbody.appendChild(trDetails);
  }

  const max = Math.ceil(state.total / state.limit) || 1;
  $('#totalInfoPedidos').textContent = `${state.total} pedido(s)`;
  $('#pageInfoPedidos').textContent  = `Página ${state.page} de ${max}`;
  $('#prevPedidos').disabled = state.page <= 1;
  $('#nextPedidos').disabled = state.page >= max;
}

function handleListTableClick(e) {
  const btn = e.target.closest('button[data-act]');
  if (!btn) return;

  const id  = btn.dataset.id;
  const act = btn.dataset.act;
  if (!id || !act) return;

  if (act === 'emit-nfe')      return void emitirNFe(id);
  if (act === 'return-order')  return void returnOrder(id);
  if (act === 'expand')        return void toggleOrderDetailsRow(id, btn);
}

// =====================================================================
// 🔄 Return Order (pedido → orçamento) — only if NO NF-e
// =====================================================================

async function returnOrder(orderId) {
  const id = orderId || state.selectedId;
  if (!id) {
    toast.warn('Nenhum pedido selecionado', 'Selecione um pedido da lista para retornar ao orçamento.');
    return;
  }

  // Safety: se a lista indicar NF-e, bloqueia
  const row = state.list.find((x) => String(x.order_id ?? x.id ?? x.number) === String(id)) || null;
  if (row && hasNfeLinked(row)) {
    toast.warn('Ação bloqueada', 'Este pedido já possui NF-e gerada. Não é possível retornar para orçamento.');
    syncReturnOrderButtons({ listRow: row, header: state.editing?.header });
    return;
  }

  // Safety extra: se o editor estiver carregado e apontar NF-e, bloqueia também
  if (state.editing?.header && hasNfeLinked(state.editing.header)) {
    toast.warn('Ação bloqueada', 'Este pedido já possui NF-e gerada. Não é possível retornar para orçamento.');
    syncReturnOrderButtons({ listRow: row, header: state.editing.header });
    return;
  }

  const rowStatus = normalizeStatus(row?.status || state.editing?.header?.status || '');
  if (rowStatus === 'CANCELADO') {
    toast.warn('Ação bloqueada', 'Este pedido já está CANCELADO. Não é possível retornar novamente.');
    syncReturnOrderButtons({ listRow: row, header: state.editing?.header });
    return;
  }

  if (rowStatus === 'FATURADO') {
    toast.warn('Ação bloqueada', 'Este pedido está FATURADO. Não é possível retornar para orçamento.');
    syncReturnOrderButtons({ listRow: row, header: state.editing?.header });
    return;
  }

  const ok = window.confirm(
    `Retornar o pedido #${id} para Orçamento?\n\n` +
    `Isso irá:\n` +
    `- Cancelar o pedido\n` +
    `- Reabrir o orçamento vinculado\n` +
    `- Restaurar o estoque (grades)\n\n` +
    `Continuar?`
  );
  if (!ok) return;

  const url = ROUTES.returnOrder(id);
  console.log('[orders] Return Order:', id, 'URL:', url);

  // UI feedback (se existir botão no editor)
  const btnEditor = $('#btnReturnOrder');
  const prevTxt = btnEditor?.textContent;
  if (btnEditor) {
    btnEditor.disabled = true;
    btnEditor.textContent = '⏳ Returning...';
  }

  try {
    const r = await fetch(url, { method: 'POST', headers: { Accept: 'application/json' }, cache: 'no-store' });
    const js = await r.json().catch(() => ({}));

    if (!r.ok || js?.ok === false) {
      const message = js?.error || js?.message || `Falha ao retornar pedido (HTTP ${r.status})`;
      toast.error('Erro ao retornar pedido', String(message).replace(/\n/g, '<br/>'));
      return;
    }

    toast.success(
      'Pedido retornado ao orçamento',
      `Pedido cancelado e orçamento #${js?.budget_id ?? '—'} reaberto.`
    );

    // ✅ FIX: limpa estado antes de recarregar (evita resync com selectedId antigo)
    state.selectedId = null;
    state.editing = null;

    // ✅ FIX: fecha editor de vez (evita UI “fantasma”)
    closeEditorPedido();

    // refresh list + voltar para list
    await fetchPedidos();
    activateTab('list');

    // re-sync editor button (vai ficar neutro)
    syncReturnOrderButtons({});
  } catch (err) {
    console.error('[orders] exceção no Return Order:', err);
    toast.error('Erro ao retornar pedido', String(err.message || err));
  } finally {
    if (btnEditor) {
      btnEditor.textContent = prevTxt || '↩ Return Order';
    }
    syncReturnOrderButtons({ header: state.editing?.header || null });
  }
}

// =====================================================================
// Linha de detalhes (expand/collapse)
// =====================================================================

function toggleOrderDetailsRow(id, btn) {
  const tr = document.querySelector(`tr.order-details-row[data-id="${id}"]`);
  if (!tr) return;

  const isHidden = tr.style.display === 'none' || !tr.style.display;
  const nowOpen  = isHidden;

  tr.style.display = nowOpen ? 'table-row' : 'none';

  if (btn) {
    btn.classList.toggle('is-open', nowOpen);
    btn.textContent = nowOpen ? '▼' : '▶';
  }

  if (nowOpen) {
    const card = tr.querySelector('.order-details-card');
    if (card && !card.dataset.loaded) loadOrderDetails(id, card);
  }
}

async function loadOrderDetails(id, container) {
  container.innerHTML = '<div class="order-details-loading">Carregando detalhes do pedido...</div>';

  try {
    const url = ROUTES.orderById(id);
    dlog('GET details:', url);

    const r = await fetch(url, { headers: { Accept: 'application/json' }, cache: 'no-store' });
    const rawText = await r.text();

    let o = null;
    try { o = rawText ? JSON.parse(rawText) : null; }
    catch { o = { __parseError: true, rawText }; }

    dlog('details HTTP:', r.status, 'ok:', r.ok);
    dlog('details body keys:', o && typeof o === 'object' ? Object.keys(o) : typeof o);

    window.__ORDERS_DEBUG__.last = {
      id,
      url,
      status: r.status,
      ok: r.ok,
      body: o,
      bodyPreview: dsafeStringify(o),
      ts: new Date().toISOString(),
    };
    window.__ORDERS_DEBUG__.byId[id] = window.__ORDERS_DEBUG__.last;

    const resolved = resolveIbgeCode({
      header: o?.header || o || {},
      customer: o?.customer || null,
      ...o,
    });

    dlog('IBGE resolved:', resolved.value || '(vazio)', 'from:', resolved.from || '(nenhum)');
    dlog('IBGE candidates:', resolved.candidates);

    if (!r.ok) throw new Error(`HTTP ${r.status}`);

    container.innerHTML = buildOrderDetailsHtml(o);
    container.dataset.loaded = 'true';
  } catch (err) {
    console.error('[orders] erro ao carregar detalhes do pedido:', err);
    container.innerHTML = `<div class="order-details-error">
      Não foi possível carregar os detalhes do pedido. Verifique a API /api/orders/${id}.
      <div style="margin-top:8px;font-size:12px;opacity:.85">
        Dica: console → <code>window.__ORDERS_DEBUG__.byId["${id}"]</code>
      </div>
    </div>`;
  }
}

function buildOrderDetailsHtml(o) {
  const h        = o.header || o || {};
  const items    = o.items || [];
  const customer = o.customer || null;
  const budget   = o.budget || o.orcamento || null;

  const complementaryInfo =
    h.notes ||
    h.complementary_info ||
    h.complementaryInfo ||
    h.complementary ||
    budget?.notes ||
    budget?.observations ||
    '';

  const nomeCliente =
    customer?.trade_name ||
    customer?.legal_name ||
    h.customer_name ||
    '';

  const docCliente =
    customer?.tax_id ||
    h.customer_tax_id ||
    '';

  const ie =
    customer?.state_registration ||
    h.customer_ie ||
    h.customer_state_registration ||
    h.customer_ie_rg ||
    '';

  const street =
    customer
      ? [customer.street_type, customer.street_name].filter(Boolean).join(' ')
      : (h.customer_address || h.customer_street || h.customer_logradouro || '');

  const number =
    customer?.street_number ||
    h.customer_number ||
    h.customer_address_number ||
    '';

  const bairro =
    customer?.neighborhood ||
    h.customer_neighborhood ||
    h.customer_district ||
    h.customer_bairro ||
    '';

  const cep =
    customer?.postal_code ||
    h.customer_zip ||
    h.customer_cep ||
    h.customer_postal_code ||
    '';

  const city =
    customer?.city ||
    h.customer_city ||
    h.customer_municipio ||
    '';

  const uf =
    customer?.state ||
    h.customer_state ||
    h.customer_uf ||
    '';

  const resolvedIbge = resolveIbgeCode({ header: h, customer, ...o });
  const ibgeCode = resolvedIbge.value;

  if (DEBUG_ORDERS) {
    dlog('buildOrderDetailsHtml IBGE:', { ibgeCode: ibgeCode || '(vazio)', from: resolvedIbge.from || '(nenhum)' });
  }

  const phone =
    customer?.phone_number ||
    customer?.mobile_number ||
    h.phone ||
    h.customer_phone ||
    h.customer_telephone ||
    h.customer_tel ||
    '';

  const email =
    customer?.email ||
    h.email ||
    h.customer_email ||
    h.customer_mail ||
    '';

  const paymentFormId =
    h.payment_form_id ??
    h.payment_method_id ??
    budget?.payment_form_id ??
    budget?.payment_method_id ??
    null;

  const paymentTermId =
    h.payment_term_id ??
    budget?.payment_term_id ??
    null;

  let paymentForm =
    h.payment_form_name ||
    h.payment_form ||
    h.payment_method_name ||
    h.payment_method ||
    h.payment_description ||
    h.condicao_forma_pagamento ||
    '';

  if (!paymentForm && paymentFormId != null && Array.isArray(state.paymentMethods)) {
    const pm = state.paymentMethods.find((p) =>
      String(p.paymentMethods_id || p.payment_form_id || p.id) === String(paymentFormId),
    );
    if (pm) paymentForm = pm.name || pm.description || '';
    if (!paymentForm && paymentFormId != null) paymentForm = `ID ${paymentFormId}`;
  }

  let paymentTerms =
    h.payment_term_name ||
    h.payment_terms ||
    h.payment_conditions ||
    h.condicao_pagamento ||
    budget?.payment_term_name ||
    budget?.payment_terms ||
    budget?.payment_conditions ||
    budget?.condicao_pagamento ||
    '';

  if (!paymentTerms && paymentTermId != null) paymentTerms = `ID ${paymentTermId}`;

  const hasDoc   = !!docCliente;
  const hasIE    = !!ie;
  const hasAddr  = !!street && !!number && !!bairro;
  const hasCity  = !!city && !!uf;
  const hasCEP   = !!cep;
  const hasEmail = !!email;

  const itensHtml = items.map((it) => {
    const totalItem = Math.max(
      0,
      Number(it.quantity || 0) * Number(it.unit_price || 0) - Number(it.discount_value || 0),
    );
    return `
      <tr>
        <td>${it.sku || ''}</td>
        <td>${it.description || ''}</td>
        <td>${it.ncm || it.ncm_code || ''}</td>
        <td>${it.cest || it.cest_code || ''}</td>
        <td>${it.unit || ''}</td>
        <td class="ta-right">${Number(it.quantity || 0)}</td>
        <td class="ta-right">${fmtMoney(it.unit_price)}</td>
        <td class="ta-right">${fmtMoney(it.discount_value)}</td>
        <td class="ta-right">${fmtMoney(totalItem)}</td>
        <td>${it.fiscal_profile || it.fiscalProfile || ''}</td>
      </tr>
    `;
  }).join('') || `
    <tr>
      <td colspan="10" class="ta-center">Nenhum item encontrado para este pedido.</td>
    </tr>
  `;

  const subtotal = items.reduce((s, it) => s + Number(it.quantity || 0) * Number(it.unit_price || 0), 0);
  const descontos = items.reduce((s, it) => s + Number(it.discount_value || 0), 0);
  const frete = Number(h.freight_value || 0);
  const total = Math.max(0, subtotal - descontos + frete);

  return `
    <div class="order-details-grid">
      <div class="order-details-block">
        <div class="order-details-title">Cliente</div>
        <div class="order-details-info-line"><strong>Nome:</strong> ${nomeCliente || '—'}</div>
        <div class="order-details-info-line"><strong>CNPJ/CPF:</strong> ${docCliente || '—'}</div>
        <div class="order-details-info-line"><strong>IE:</strong> ${ie || '—'}</div>
        <div class="order-details-info-line"><strong>Endereço:</strong> ${street || '—'}, ${number || 's/n'} - ${bairro || '—'}</div>
        <div class="order-details-info-line"><strong>Cidade/UF:</strong> ${city || '—'} / ${uf || '—'}</div>
        <div class="order-details-info-line"><strong>Código IBGE:</strong> ${ibgeCode || '—'}</div>
        <div class="order-details-info-line"><strong>CEP:</strong> ${cep || '—'}</div>
        <div class="order-details-info-line"><strong>Contato:</strong> ${phone || '—'} | ${email || '—'}</div>
      </div>

      ${complementaryInfo ? `
        <div class="order-details-block">
          <div class="order-details-title">Informações Complementares</div>
          <div class="order-details-complementary">
            ${String(complementaryInfo).replace(/\n/g, '<br/>')}
          </div>
        </div>
      ` : ''}

      <div class="order-details-block">
        <div class="order-details-title">Checklist para NF-e</div>

        <ul class="order-details-nfe-check-list">
          <li class="${hasDoc   ? 'ok' : 'missing'}">Documento (CNPJ/CPF)</li>
          <li class="${hasIE    ? 'ok' : 'missing'}">Inscrição Estadual (quando aplicável)</li>
          <li class="${hasAddr  ? 'ok' : 'missing'}">Endereço completo (logradouro, número, bairro)</li>
          <li class="${hasCity  ? 'ok' : 'missing'}">Município e UF</li>
          <li class="${hasCEP   ? 'ok' : 'missing'}">CEP</li>
          <li class="${hasEmail ? 'ok' : 'missing'}">E-mail para envio da NF-e</li>
        </ul>

        <div class="order-details-hint">
          Revise estes campos antes de emitir a NF-e. Campos marcados com ⚠ podem causar rejeição.
        </div>

        <div class="order-details-payment">
          <div class="order-details-title order-details-payment-title">Forma de pagamento</div>
          <div class="order-details-info-line"><strong>Forma:</strong> ${paymentForm || '—'}</div>
          <div class="order-details-info-line"><strong>Condição:</strong> ${paymentTerms || '—'}</div>
        </div>
      </div>

      <div class="order-details-items-table">
        <div class="order-details-section-title">Itens do pedido</div>
        <table>
          <thead>
            <tr>
              <th>SKU</th>
              <th>Descrição</th>
              <th>NCM</th>
              <th>CEST</th>
              <th>U.M</th>
              <th class="ta-right">Qtd</th>
              <th class="ta-right">Unitário</th>
              <th class="ta-right">Desc (R$)</th>
              <th class="ta-right">Total</th>
              <th>Perfil fiscal</th>
            </tr>
          </thead>
          <tbody>${itensHtml}</tbody>
        </table>

        <div class="order-details-totals">
          <div class="totais-group"><span class="totais-label">Subtotal</span><strong>${fmtMoney(subtotal)}</strong></div>
          <div class="totais-group"><span class="totais-label">Descontos</span><strong>${fmtMoney(descontos)}</strong></div>
          <div class="totais-group"><span class="totais-label">Frete</span><strong>${fmtMoney(frete)}</strong></div>
          <div class="totais-group totais-group--total"><span class="totais-label">Total geral</span><span>${fmtMoney(total)}</span></div>
        </div>
      </div>
    </div>
  `;
}

// =====================================================================
// Formas de pagamento
// =====================================================================

function populatePaymentMethodsSelect() {
  const sel = $('#paymentMethodPedido');
  if (!sel) return;

  sel.innerHTML = '<option value="">Selecione...</option>';

  for (const pm of state.paymentMethods) {
    const opt = document.createElement('option');
    opt.value = String(pm.paymentMethods_id || pm.payment_form_id || pm.id);
    opt.textContent = pm.name || pm.description || `ID ${opt.value}`;
    sel.appendChild(opt);
  }
}

async function loadPaymentMethods() {
  const url = `${ROUTES.paymentMethods}?active=true&limit=100`;
  try {
    const r = await fetch(url, { headers: { Accept: 'application/json' }, cache: 'no-store' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json().catch(() => ({}));
    const rows = data.rows || data || [];
    state.paymentMethods = Array.isArray(rows) ? rows : [];
    populatePaymentMethodsSelect();
  } catch (err) {
    console.error('[orders] erro ao carregar formas de pagamento:', err);
    toast.error('Erro ao carregar formas de pagamento', 'Não foi possível carregar as formas de pagamento. Verifique a API /api/paymentMethods.');
  }
}

// =====================================================================
// Editor de pedido
// =====================================================================

function bindEditorUI() {
  $('#btnFecharPedido')?.addEventListener('click', () => closeEditorPedido());
  $('#btnSalvarPedido')?.addEventListener('click', () => savePedido());
  $('#btnEmitirNFe')?.addEventListener('click', () => emitirNFe());

  // botão do editor: Return Order
  $('#btnReturnOrder')?.addEventListener('click', () => returnOrder(state.selectedId));

  // re-sincroniza botão quando o status muda no editor
  $('#statusPedido')?.addEventListener('change', () => {
    const row =
      state.list.find((x) => String(x.order_id ?? x.id ?? x.number) === String(state.selectedId)) || null;

    syncReturnOrderButtons({ listRow: row, header: state.editing?.header || null });
  });
}

async function openEditorPedido(id) {
  activateTab('editor');
  state.selectedId = id || null;
  $('#editorPedidoTitle').textContent = id ? `Pedido #${id}` : 'Novo pedido';

  if (id) {
    try {
      const r = await fetch(ROUTES.orderById(id), { headers: { Accept: 'application/json' }, cache: 'no-store' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const o = await r.json();

      hydrateEditorPedido(o);

      const row = state.list.find((x) => String(x.order_id ?? x.id ?? x.number) === String(id)) || null;
      syncReturnOrderButtons({ listRow: row, header: (o?.header || o || {}) });
    } catch (err) {
      console.error('[orders] erro ao carregar pedido:', err);
      toast.error('Erro ao carregar pedido', 'Não foi possível carregar o pedido selecionado.');
      activateTab('list');
      state.selectedId = null;
    }
  } else {
    state.editing = { header: {}, items: [], customer: null };
    setVal('numeroPedido', '');
    setVal('dtPedido', '');
    setVal('statusPedido', 'ABERTO');
    setVal('obsPedido', '');
    setVal('cliPedido', '');
    setVal('docPedido', '');
    setVal('nfeStatusPedido', '—');

    setVal('complementaryInfoPedido', '');

    setVal('cliIePedido', '');
    setVal('cliEnderecoPedido', '');
    setVal('cliNumeroPedido', '');
    setVal('cliBairroPedido', '');
    setVal('cliCepPedido', '');
    setVal('cliMunicipioPedido', '');
    setVal('cliUfPedido', '');
    setVal('cliFonePedido', '');
    setVal('cliEmailPedido', '');

    setVal('cliIbgeCidadePedido', '');
    setVal('cliIbgeCidadeLabelPedido', '');

    const selPm = $('#paymentMethodPedido');
    if (selPm) selPm.value = '';
    setVal('paymentTermsPedido', '');

    renderItensPedido();
    recalcTotaisPedido();

    syncReturnOrderButtons({ listRow: null, header: null });
    const btnEditor = $('#btnReturnOrder');
    if (btnEditor) {
      btnEditor.disabled = true;
      btnEditor.title = 'Salve/abra um pedido existente para usar Return Order.';
    }
  }
}

function closeEditorPedido() {
  activateTab('list');
  state.selectedId = null;
  state.editing = null;
}

function hydrateEditorPedido(o) {
  const h        = o.header || o || {};
  const items    = o.items || [];
  const customer = o.customer || null;
  const budget   = o.budget || o.orcamento || null;

  state.editing = { header: h, items, customer };

  const nomeCliente =
    customer?.trade_name ||
    customer?.legal_name ||
    h.customer_name ||
    '';

  const docCliente =
    customer?.tax_id ||
    h.customer_tax_id ||
    '';

  setVal('numeroPedido', h.number || h.order_id || '');
  setVal('dtPedido', (h.issue_date || '').slice(0, 10));
  setVal('statusPedido', h.status || 'ABERTO');
  setVal('obsPedido', h.notes || '');
  setVal('cliPedido', nomeCliente);
  setVal('docPedido', docCliente);

  const nfeStatus = h.nfe_status || '—';
  setVal('nfeStatusPedido', nfeStatus);

  const complementaryInfo =
    h.complementary_info ||
    h.complementaryInfo ||
    h.complementary ||
    '';
  setVal('complementaryInfoPedido', complementaryInfo || '');

  const ie =
    customer?.state_registration ||
    h.customer_ie ||
    h.customer_state_registration ||
    h.customer_ie_rg ||
    '';

  const street =
    customer
      ? [customer.street_type, customer.street_name].filter(Boolean).join(' ')
      : (h.customer_address || h.customer_street || h.customer_logradouro || '');

  const number =
    customer?.street_number ||
    h.customer_number ||
    h.customer_address_number ||
    '';

  const bairro =
    customer?.neighborhood ||
    h.customer_neighborhood ||
    h.customer_district ||
    h.customer_bairro ||
    '';

  const cep =
    customer?.postal_code ||
    h.customer_zip ||
    h.customer_cep ||
    h.customer_postal_code ||
    '';

  const city =
    customer?.city ||
    h.customer_city ||
    h.customer_municipio ||
    '';

  const uf =
    customer?.state ||
    h.customer_state ||
    h.customer_uf ||
    '';

  const phone =
    customer?.phone_number ||
    customer?.mobile_number ||
    h.phone ||
    h.customer_phone ||
    h.customer_telephone ||
    h.customer_tel ||
    '';

  const email =
    customer?.email ||
    h.email ||
    h.customer_email ||
    h.customer_mail ||
    '';

  setVal('cliIePedido', ie);
  setVal('cliEnderecoPedido', street);
  setVal('cliNumeroPedido', number);
  setVal('cliBairroPedido', bairro);
  setVal('cliCepPedido', cep);
  setVal('cliMunicipioPedido', city);
  setVal('cliUfPedido', uf);
  setVal('cliFonePedido', phone);
  setVal('cliEmailPedido', email);

  const resolved = resolveIbgeCode({ header: h, customer, ...o });
  const ibgeCode = resolved.value;

  dlog('hydrateEditorPedido:', {
    orderId: h?.order_id || h?.id || h?.number,
    ibge: ibgeCode || '(vazio)',
    from: resolved.from || '(nenhum)',
    candidates: resolved.candidates,
  });

  setVal('cliIbgeCidadePedido', ibgeCode || '');
  setVal('cliIbgeCidadeLabelPedido', ibgeCode || '—');

  if (DEBUG_ORDERS && !ibgeCode) {
    toast.warn(
      'IBGE não veio no payload',
      `O código IBGE não foi encontrado no retorno da API. Console: window.__ORDERS_DEBUG__.byId["${state.selectedId}"]`
    );
  }

  const paymentMethodId =
    h.payment_form_id ??
    h.payment_method_id ??
    budget?.payment_form_id ??
    budget?.payment_method_id ??
    null;

  const paymentTerms =
    h.payment_term_name ??
    h.payment_terms ??
    h.payment_conditions ??
    budget?.payment_term_name ??
    budget?.payment_terms ??
    budget?.payment_conditions ??
    budget?.condicao_pagamento ??
    null;

  const selPm = $('#paymentMethodPedido');
  if (selPm) selPm.value = paymentMethodId != null ? String(paymentMethodId) : '';
  setVal('paymentTermsPedido', paymentTerms || '');

  renderItensPedido();
  recalcTotaisPedido();

  const row = state.list.find((x) => String(x.order_id ?? x.id ?? x.number) === String(state.selectedId)) || null;
  syncReturnOrderButtons({ listRow: row, header: h });
}

function renderItensPedido() {
  const tbody = $('#tblItensPedido tbody');
  if (!tbody || !state.editing) return;
  tbody.innerHTML = '';

  let count = 0;

  for (const it of state.editing.items) {
    count++;

    const total = Math.max(
      0,
      Number(it.quantity || 0) * Number(it.unit_price || 0) - Number(it.discount_value || 0),
    );

    const ncm  = it.ncm || it.ncm_code || '';
    const cest = it.cest || it.cest_code || '';

    const fiscalProfileName = it.fiscal_profile || it.profile_name || '';
    const fiscalClassName   = it.fiscal_classification || it.classification_name || '';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${it.sku || ''}</td>
      <td>${it.description || ''}</td>
      <td>${ncm}</td>
      <td>${cest}</td>
      <td>${it.grade || ''}</td>
      <td>${it.unit || ''}</td>
      <td class="ta-right">${Number(it.quantity || 0)}</td>
      <td class="ta-right">${fmtMoney(it.unit_price)}</td>
      <td class="ta-right">${fmtMoney(it.discount_value)}</td>
      <td class="ta-right">${fmtMoney(total)}</td>
      <td>${fiscalProfileName}</td>
      <td>${fiscalClassName}</td>
    `;
    tbody.appendChild(tr);
  }

  const qtdSpan = $('#qtdItensPedido');
  if (qtdSpan) qtdSpan.textContent = String(count);
}

function recalcTotaisPedido() {
  if (!state.editing) return;
  const subtotal = state.editing.items.reduce((s, it) => s + Number(it.quantity || 0) * Number(it.unit_price || 0), 0);
  const descontos = state.editing.items.reduce((s, it) => s + Number(it.discount_value || 0), 0);
  const frete = Number(state.editing.header?.freight_value || 0);
  const total = Math.max(0, subtotal - descontos + frete);

  $('#subtotalPedido').textContent   = fmtMoney(subtotal);
  $('#totdescPedido').textContent    = fmtMoney(descontos);
  $('#fretePedido').textContent      = fmtMoney(frete);
  $('#totalGeralPedido').textContent = fmtMoney(total);
}

// =====================================================================
// Salvar / Emitir NF-e
// =====================================================================

async function savePedido() {
  if (!state.selectedId) {
    toast.warn('Nenhum pedido selecionado', 'Selecione um pedido para salvar as alterações.');
    return;
  }

  const paymentMethodId = $('#paymentMethodPedido')?.value || null;
  const paymentTerms    = $('#paymentTermsPedido')?.value?.trim() || null;

  let paymentFormName = null;
  if (paymentMethodId && state.paymentMethods?.length) {
    const pm = state.paymentMethods.find((p) =>
      String(p.paymentMethods_id || p.payment_form_id || p.id) === String(paymentMethodId),
    );
    if (pm) paymentFormName = pm.name || pm.description || null;
  }

  const payload = {
    status: $('#statusPedido')?.value || 'ABERTO',
    notes:  $('#obsPedido')?.value || '',
    payment_form_id:   paymentMethodId ? Number(paymentMethodId) : null,
    payment_form_name: paymentFormName,
    payment_term_name: paymentTerms || null,
  };

  const url = ROUTES.orderById(state.selectedId);

  try {
    const r = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      cache: 'no-store',
      body: JSON.stringify(payload),
    });

    if (!r.ok) {
      const js = await r.json().catch(() => ({}));
      console.error('[orders] erro ao salvar pedido:', r.status, js);
      toast.error('Erro ao salvar pedido', js?.error || 'Falha ao salvar o pedido. Verifique os dados e tente novamente.');
      return;
    }

    toast.success('Pedido salvo', 'Pedido salvo com sucesso.');
    fetchPedidos();
  } catch (err) {
    console.error('[orders] exceção ao salvar pedido:', err);
    toast.error('Erro ao salvar pedido', String(err.message || err));
  }
}

function extractNfeErrorDetails(js) {
  const detalhes = [];

  if (Array.isArray(js?.detalhes) && js.detalhes.length) {
    for (const d of js.detalhes) if (d) detalhes.push(String(d));
  }

  if (js?.error?.data && Array.isArray(js.error.data)) {
    for (const item of js.error.data) {
      if (!item) continue;
      const msg   = item.message || item.mensagem || item.error || '';
      const path  = item.path || item.campo || '';
      const value = item.value != null ? `Valor: ${item.value}` : '';
      const parts = [msg, path && `Campo: ${path}`, value].filter(Boolean);
      if (parts.length) detalhes.push(parts.join(' — '));
    }
  }

  return detalhes;
}

async function emitirNFe(orderId) {
  const id = orderId || state.selectedId;
  if (!id) {
    toast.warn('Nenhum pedido selecionado', 'Selecione um pedido da lista para emitir a NF-e.');
    return;
  }

  state.selectedId = id;

  const btnEditor = $('#btnEmitirNFe');
  const prevTxt = btnEditor?.textContent;
  if (btnEditor) {
    btnEditor.disabled = true;
    btnEditor.textContent = '⏳ Emitindo NF-e...';
  }

  const url = ROUTES.nfeIssue(id);
  console.log('[orders] Emitindo NF-e para pedido:', id, 'URL:', url);

  try {
    const r = await fetch(url, { method: 'POST', headers: { Accept: 'application/json' }, cache: 'no-store' });
    const js = await r.json().catch(() => ({}));
    console.log('[orders] Resposta emissão NF-e:', { status: r.status, body: js });

    const okFlag = js?.ok !== false && r.ok;

    if (!okFlag) {
      const message =
        js?.message ||
        js?.error ||
        js?.detail?.message ||
        js?.detail ||
        'Falha desconhecida ao emitir NF-e.';

      const detalhes = extractNfeErrorDetails(js);

      if (detalhes.length) {
        showCenterModal({ variant: 'error', title: 'Erro ao emitir NF-e', message, details: detalhes });
      } else {
        toast.error('Erro ao emitir NF-e', message.replace(/\n/g, '<br/>'));
      }
      return;
    }

    const status = js.nfe?.status || 'PROCESSANDO';
    const proto  = js.nfe?.protocol || '';

    let extra = `Status: ${status}`;
    if (proto) extra += `\nProtocolo: ${proto}`;

    toast.success('NF-e enviada com sucesso', extra.replace(/\n/g, '<br/>'));

    if (state.selectedId) {
      await openEditorPedido(state.selectedId);
      await fetchPedidos();
    }

    setTimeout(() => {
      window.location.href = '/public/invoicesIssued/invoicesIssued.html';
    }, 800);
  } catch (err) {
    console.error('[orders] exceção ao emitir NF-e:', err);
    toast.error('Erro ao emitir NF-e', String(err.message || err));
  } finally {
    if (btnEditor) {
      btnEditor.disabled = false;
      btnEditor.textContent = prevTxt || '🧾 Emitir NF-e';
    }
  }
}

// =====================================================================
// Boot
// =====================================================================

document.addEventListener('DOMContentLoaded', () => {
  bindTabs();
  bindListUI();
  bindEditorUI();
  activateTab('list');
  fetchPedidos();
  loadPaymentMethods();

  // inicial: botão do editor desabilitado (até abrir pedido)
  syncReturnOrderButtons({});
  const btnEditor = $('#btnReturnOrder');
  if (btnEditor) {
    btnEditor.disabled = true;
    btnEditor.title = 'Abra um pedido para usar Return Order.';
  }
});

// =====================================================================
// ⚠️ STUBS (para evitar erro caso ainda não existam no seu arquivo)
// Se você já tem essas funções em outras partes do orders.js, REMOVA este bloco.
// =====================================================================

function openEditorPedidoSafe(id) {
  try { return openEditorPedido(id); } catch { /* noop */ }
}

async function emitirNFeSafe(id) {
  try { return await emitirNFe(id); } catch { /* noop */ }
}

// Se no seu projeto já existir openEditorPedido / savePedido / closeEditorPedido,
// ignore estes stubs. Caso não exista, o arquivo vai quebrar no runtime.
async function savePedidoStub() {}
function closeEditorPedidoStub() {}
