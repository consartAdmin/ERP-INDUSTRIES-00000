/*╔══════════════════════════════════════════════════════════════════════╗
  ║ productsLogistics.js — Produtos • Logística (PRODNEX ERP)            ║
  ║ Path: backend/public/productsLogistics/productsLogistics.js          ║
  ║ ✅ CRUD productsLogistics                                             ║
  ║ ✅ Selecionar Pedido (orders) + importar itens                        ║
  ║ ✅ NOVO: Ao selecionar o pedido, abre modal com produtos do pedido    ║
  ║ ✅ NOVO: Suporta modal externo via CustomEvent "plx:orderPicked"      ║
  ╚══════════════════════════════════════════════════════════════════════╝*/

const API_BASE = window.apiBase || location.origin;
const API = `${API_BASE}/api/products-logistics`;

// ✅ Ajuste se sua rota de pedidos for diferente:
const API_ORDERS = `${API_BASE}/api/orders/search`;

// ✅ CORRETO: import-order está no products-logistics
const API_IMPORT = `${API_BASE}/api/products-logistics/import-order`;

/* ✅ CORRETO: seu backend retorna os itens dentro de GET /api/orders/:id
   (controller getOrderById -> { ok:true, header, items })
*/
const ORDER_ITEMS_ENDPOINTS = [
  (id) => `${API_BASE}/api/orders/${encodeURIComponent(id)}`, // ✅ principal
];

const qs = (s, el = document) => el.querySelector(s);

const els = {
  qSearch: qs('#qSearch'),
  qLimit: qs('#qLimit'),
  btnRefresh: qs('#btnRefresh'),
  btnClear: qs('#btnClear'),
  btnPrev: qs('#btnPrev'),
  btnNext: qs('#btnNext'),
  pageInfo: qs('#pageInfo'),
  metaInfo: qs('#metaInfo'),
  tbody: qs('#tbody'),

  btnNew: qs('#btnNew'),
  btnEnsure: qs('#btnEnsure'),

  modal: qs('#modal'),
  form: qs('#form'),
  modalTitle: qs('#modalTitle'),
  modalSub: qs('#modalSub'),
  formMeta: qs('#formMeta'),

  fProductCode: qs('#fProductCode'),
  fProductName: qs('#fProductName'),
  fPackageType: qs('#fPackageType'),
  fGross: qs('#fGross'),
  fNet: qs('#fNet'),
  fH: qs('#fH'),
  fW: qs('#fW'),
  fL: qs('#fL'),
  fM3: qs('#fM3'),
  btnToggleAuto: qs('#btnToggleAuto'),
  m3Hint: qs('#m3Hint'),
  fStack: qs('#fStack'),
  fFragile: qs('#fFragile'),

  orderId: qs('#orderId'),
  orderMeta: qs('#orderMeta'),
  btnPickOrder: qs('#btnPickOrder'),
  btnImportOrderItems: qs('#btnImportOrderItems'),
  btnClearOrder: qs('#btnClearOrder'),
  importMeta: qs('#importMeta'),

  orderModal: qs('#orderModal'),
  orderSearch: qs('#orderSearch'),
  orderTbody: qs('#orderTbody'),
  orderModalMeta: qs('#orderModalMeta'),

  // ✅ NOVO: modal de itens do pedido (se existir no HTML)
  orderItemsModal: qs('#orderItemsModal'),
  orderItemsTbody: qs('#orderItemsTbody'),
  orderItemsMeta: qs('#orderItemsMeta'),
  btnConfirmOrderItems: qs('#btnConfirmOrderItems'),
};

let state = {
  q: '',
  limit: 50,
  offset: 0,
  page: 1,
  loading: false,
  autoM3: true,
  editing: null,
  lastCount: 0,
  total: null,

  selectedOrder: null,
  orderSearchQ: '',
  orderSearchTimer: null,
  orderRows: [],

  // ✅ NOVO: itens do pedido e seleção no modal
  selectedOrderItems: [],
  selectedOrderItemsSelected: new Set(), // guarda índices
  lastOrderItemsFetchError: null,
};

/* =========================================================
   Helpers
   ========================================================= */
function toNum(v) {
  const n = Number(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}
function clampNonNeg(v) {
  const n = toNum(v);
  return n < 0 ? 0 : n;
}
function fmt(n, digits = 3) {
  const x = Number(n);
  if (!Number.isFinite(x)) {
    return (0).toLocaleString('pt-BR', {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
  }
  return x.toLocaleString('pt-BR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}
function calcM3FromCm(h, w, l) {
  return (clampNonNeg(h) * clampNonNeg(w) * clampNonNeg(l)) / 1_000_000;
}
function escapeHtml(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
function moneyBRL(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/**
 * Normaliza linha vinda da API para evitar quebrar UI
 */
function normalizeRow(r) {
  const row = r || {};
  return {
    id: row.id ?? row.products_logistics_id ?? null,
    product_code: row.product_code ?? row.sku ?? row.productCode ?? '',
    product_name: row.product_name ?? row.name ?? row.description ?? row.productName ?? null,

    weight_gross_kg: row.weight_gross_kg ?? row.gross_weight ?? row.gross ?? 0,
    weight_net_kg: row.weight_net_kg ?? row.net_weight ?? row.net ?? 0,

    height_cm: row.height_cm ?? row.h_cm ?? row.h ?? 0,
    width_cm: row.width_cm ?? row.w_cm ?? row.w ?? 0,
    length_cm: row.length_cm ?? row.l_cm ?? row.l ?? 0,

    volume_m3: row.volume_m3 ?? row.m3 ?? row.volume ?? 0,

    package_type: row.package_type ?? row.package ?? 'UN',
    stackable: !!row.stackable,
    fragile: !!row.fragile,

    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
  };
}

/** ✅ Normaliza itens do pedido (para o modal) */
function normalizeOrderItem(it) {
  const x = it || {};
  return {
    product_code:
      x.product_code ??
      x.sku ??
      x.productCode ??
      x.codigo ??
      x.codigo_produto ??
      x.cod_produto ??
      '',
    product_name:
      x.product_name ??
      x.description ??
      x.descricao ??
      x.nome ??
      x.productName ??
      '',
    quantity:
      x.quantity ??
      x.qty ??
      x.qtd ??
      x.quantidade ??
      0,
    unit:
      x.unit ??
      x.unidade ??
      x.uom ??
      x.um ??
      '',
  };
}

async function apiFetch(baseUrl, path = '', opts = {}) {
  const method = String(opts.method || 'GET').toUpperCase();

  const headers = new Headers(opts.headers || {});
  if (opts.body != null && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  headers.set('Accept', 'application/json');

  const res = await fetch(`${baseUrl}${path}`, { ...opts, method, headers });
  const text = await res.text();

  let json = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { ok: false, error: text || `HTTP ${res.status}` };
  }

  if (!res.ok || json.ok === false) {
    const msg = json.error || json.message || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return json;
}

async function fetchJsonAbsolute(url, opts = {}) {
  const method = String(opts.method || 'GET').toUpperCase();
  const headers = new Headers(opts.headers || {});
  if (opts.body != null && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  headers.set('Accept', 'application/json');

  const res = await fetch(url, { ...opts, method, headers });
  const text = await res.text();

  let json = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { ok: false, error: text || `HTTP ${res.status}` };
  }

  if (!res.ok || json.ok === false) {
    const msg = json.error || json.message || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return json;
}

function setLoading(on) {
  state.loading = on;
  if (els.btnRefresh) els.btnRefresh.disabled = on;
  if (els.btnNew) els.btnNew.disabled = on;
  if (els.btnEnsure) els.btnEnsure.disabled = on;

  if (els.btnPrev) els.btnPrev.disabled = on || state.offset <= 0;
  if (els.btnNext) els.btnNext.disabled = on;
}

function renderRows(rows) {
  const list = Array.isArray(rows) ? rows.map(normalizeRow) : [];

  if (!list.length) {
    els.tbody.innerHTML = `<tr><td colspan="12" class="plx-empty">Nenhum registro encontrado.</td></tr>`;
    return;
  }

  els.tbody.innerHTML = list
    .map((r) => {
      const stack = r.stackable ? '✅' : '—';
      const frag = r.fragile ? '⚠️' : '—';
      const pkg = r.package_type || 'UN';

      return `
      <tr>
        <td><span class="plx-chip"><b>${escapeHtml(r.product_code)}</b></span></td>
        <td>${escapeHtml(r.product_name || '—')}</td>
        <td class="t-right">${fmt(r.weight_gross_kg, 3)}</td>
        <td class="t-right">${fmt(r.weight_net_kg, 3)}</td>
        <td class="t-right">${fmt(r.height_cm, 3)}</td>
        <td class="t-right">${fmt(r.width_cm, 3)}</td>
        <td class="t-right">${fmt(r.length_cm, 3)}</td>
        <td class="t-right">${fmt(r.volume_m3, 6)}</td>
        <td>${escapeHtml(pkg)}</td>
        <td class="t-center">${stack}</td>
        <td class="t-center">${frag}</td>
        <td class="t-center">
          <button class="btn btn-pastel-primary" data-act="edit" data-code="${escapeHtml(
            r.product_code,
          )}" type="button">Editar</button>
          <button class="btn btn-pastel-primary" data-act="del" data-code="${escapeHtml(
            r.product_code,
          )}" type="button">Excluir</button>
        </td>
      </tr>
    `;
    })
    .join('');
}

function updatePagerUi() {
  state.page = Math.floor(state.offset / state.limit) + 1;
  els.pageInfo.textContent = `Página ${state.page}`;

  els.btnPrev.disabled = state.loading || state.offset <= 0;

  let canNext = true;
  if (Number.isFinite(Number(state.total))) {
    canNext = state.offset + state.limit < Number(state.total);
  } else {
    canNext = state.lastCount >= state.limit;
  }
  els.btnNext.disabled = state.loading || !canNext;
}

async function load() {
  setLoading(true);
  try {
    const params = new URLSearchParams();
    if (state.q) params.set('q', state.q);
    params.set('limit', String(state.limit));
    params.set('offset', String(state.offset));
    params.set('orderBy', 'updated_at');
    params.set('order', 'DESC');

    const data = await apiFetch(API, `?${params.toString()}`);

    const rows = data.data || data.rows || [];
    const total = data.total ?? data.count ?? null;

    state.lastCount = Array.isArray(rows) ? rows.length : 0;
    state.total =
      total != null && Number.isFinite(Number(total)) ? Number(total) : null;

    renderRows(rows);

    const totalTxt = state.total != null ? ` • total ${state.total}` : '';
    els.metaInfo.textContent = `Mostrando ${state.lastCount} item(s) • offset ${state.offset}${totalTxt}`;

    updatePagerUi();
  } catch (err) {
    els.tbody.innerHTML = `<tr><td colspan="12" class="plx-empty">Erro: ${escapeHtml(
      err.message,
    )}</td></tr>`;
    els.metaInfo.textContent = `❌ ${err.message}`;
    state.lastCount = 0;
    state.total = null;
    updatePagerUi();
  } finally {
    setLoading(false);
    updatePagerUi();
  }
}

/* =========================================================
   Modal (CRUD)
   ========================================================= */
function openModal(mode, row) {
  const r = row ? normalizeRow(row) : null;

  state.editing = mode === 'edit' ? r?.product_code || null : null;

  els.modal.classList.add('is-open');
  els.modal.setAttribute('aria-hidden', 'false');

  els.modalTitle.textContent = mode === 'edit' ? 'Editar Registro' : 'Novo Registro';

  const name = r?.product_name ? ` — ${r.product_name}` : '';
  els.modalSub.textContent =
    mode === 'edit'
      ? `Alterando logística do produto ${r?.product_code || ''}${name}`
      : 'Preencha as informações de logística do produto.';

  els.form.reset();
  els.formMeta.textContent = '—';

  state.autoM3 = true;
  els.btnToggleAuto.textContent = 'Auto';
  els.m3Hint.textContent = 'Auto ON: calculando por H×W×L';
  els.fM3.readOnly = true;

  const hasNameField = !!els.fProductName;

  if (mode === 'edit' && r) {
    els.fProductCode.value = r.product_code || '';
    els.fProductCode.readOnly = true;

    if (hasNameField) els.fProductName.value = r.product_name || '';

    els.fPackageType.value = r.package_type ?? 'UN';
    els.fGross.value = r.weight_gross_kg ?? 0;
    els.fNet.value = r.weight_net_kg ?? 0;
    els.fH.value = r.height_cm ?? 0;
    els.fW.value = r.width_cm ?? 0;
    els.fL.value = r.length_cm ?? 0;
    els.fM3.value = r.volume_m3 ?? 0;
    els.fStack.checked = !!r.stackable;
    els.fFragile.checked = !!r.fragile;

    updateM3Preview();
  } else {
    els.fProductCode.readOnly = false;
    els.fPackageType.value = 'UN';
    els.fStack.checked = true;
    els.fFragile.checked = false;
    els.fGross.value = 0;
    els.fNet.value = 0;
    els.fH.value = 0;
    els.fW.value = 0;
    els.fL.value = 0;
    els.fM3.value = 0;
    if (hasNameField) els.fProductName.value = '';
    updateM3Preview();
  }

  setTimeout(() => els.fProductCode.focus(), 50);
}

function closeModal() {
  els.modal.classList.remove('is-open');
  els.modal.setAttribute('aria-hidden', 'true');
}

function updateM3Preview() {
  if (!state.autoM3) return;
  const m3 = calcM3FromCm(els.fH.value, els.fW.value, els.fL.value);
  els.fM3.value = Number(m3).toFixed(6);
}

function validateForm() {
  const code = String(els.fProductCode.value || '').trim();
  if (!code) throw new Error('Product Code é obrigatório.');

  const gross = clampNonNeg(els.fGross.value);
  const net = clampNonNeg(els.fNet.value);
  if (gross < net) throw new Error('Gross Weight deve ser >= Net Weight.');

  return {
    product_code: code,
    product_name: els.fProductName ? String(els.fProductName.value || '').trim() || null : null,
    package_type: String(els.fPackageType.value || 'UN').trim() || 'UN',
    weight_gross_kg: gross,
    weight_net_kg: net,
    height_cm: clampNonNeg(els.fH.value),
    width_cm: clampNonNeg(els.fW.value),
    length_cm: clampNonNeg(els.fL.value),
    volume_m3: clampNonNeg(els.fM3.value),
    stackable: !!els.fStack.checked,
    fragile: !!els.fFragile.checked,
  };
}

async function save() {
  const payload = validateForm();
  const isEdit = !!state.editing;

  els.formMeta.textContent = 'Salvando...';

  if (isEdit) {
    await apiFetch(API, `/${encodeURIComponent(payload.product_code)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  } else {
    await apiFetch(API, '', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  els.formMeta.textContent = '✅ Salvo com sucesso.';
  await load();
  closeModal();
}

async function editByCode(code) {
  const data = await apiFetch(API, `/${encodeURIComponent(code)}`);
  const row = data.data || data.row || data;
  if (!row) throw new Error('Registro não encontrado.');
  openModal('edit', row);
}

async function delByCode(code) {
  const ok = confirm(`Excluir logística do produto ${code}?`);
  if (!ok) return;
  await apiFetch(API, `/${encodeURIComponent(code)}`, { method: 'DELETE' });
  await load();
}

/* =========================================================
   ORDER ITEMS MODAL (Produtos do Pedido) — NOVO
   ========================================================= */
function hasOrderItemsModal() {
  return !!(els.orderItemsModal && els.orderItemsTbody && els.orderItemsMeta && els.btnConfirmOrderItems);
}

function openOrderItemsModal() {
  if (!hasOrderItemsModal()) return; // HTML não tem modal -> não quebra

  els.orderItemsModal.classList.add('is-open');
  els.orderItemsModal.setAttribute('aria-hidden', 'false');
}

function closeOrderItemsModal() {
  if (!hasOrderItemsModal()) return;
  els.orderItemsModal.classList.remove('is-open');
  els.orderItemsModal.setAttribute('aria-hidden', 'true');
}

function renderOrderItems(items) {
  if (!hasOrderItemsModal()) return;

  const list = Array.isArray(items) ? items.map(normalizeOrderItem) : [];
  state.selectedOrderItems = list;
  state.selectedOrderItemsSelected = new Set(); // limpa seleção ao re-render

  const orderId = String(state.selectedOrder?.order_id ?? state.selectedOrder?.id ?? '');
  els.orderItemsMeta.textContent = orderId
    ? `Pedido #${orderId} • Itens: ${list.length}`
    : `Itens: ${list.length}`;

  if (!list.length) {
    els.orderItemsTbody.innerHTML = `<tr><td colspan="5" class="plx-empty">Nenhum item encontrado neste pedido.</td></tr>`;
    els.btnConfirmOrderItems.disabled = true;
    return;
  }

  els.orderItemsTbody.innerHTML = list
    .map((it, idx) => {
      const code = it.product_code || '—';
      const name = it.product_name || '—';
      const qty = Number(it.quantity);
      const qtyTxt = Number.isFinite(qty) ? qty.toLocaleString('pt-BR') : '—';
      const unit = it.unit || '—';

      return `
        <tr>
          <td class="t-center">
            <input type="checkbox" data-oi-check="1" data-idx="${idx}">
          </td>
          <td><span class="plx-chip"><b>${escapeHtml(code)}</b></span></td>
          <td>${escapeHtml(name)}</td>
          <td class="t-right">${escapeHtml(qtyTxt)}</td>
          <td>${escapeHtml(unit)}</td>
        </tr>
      `;
    })
    .join('');

  els.btnConfirmOrderItems.disabled = true;
}

function updateOrderItemsConfirmState() {
  if (!hasOrderItemsModal()) return;
  els.btnConfirmOrderItems.disabled = state.selectedOrderItemsSelected.size === 0;
}

async function fetchOrderItemsForOrder(orderId) {
  state.lastOrderItemsFetchError = null;

  // Se veio do modal externo com itens já prontos, não precisa fetch.
  if (Array.isArray(state.selectedOrderItems) && state.selectedOrderItems.length) {
    return state.selectedOrderItems;
  }

  let lastErr = null;

  for (const mk of ORDER_ITEMS_ENDPOINTS) {
    try {
      const url = mk(orderId);
      const data = await fetchJsonAbsolute(url);

      // ✅ GET /api/orders/:id -> { ok:true, header, items }
      const items =
        data.items ||
        data.data?.items ||
        data.order?.items ||
        data.rows || // fallback se algum controller devolver rows
        data.data ||
        [];

      return Array.isArray(items) ? items : [];
    } catch (e) {
      lastErr = e;
    }
  }

  state.lastOrderItemsFetchError = lastErr?.message || 'Falha ao buscar itens do pedido.';
  return [];
}


async function showOrderItemsAfterPick() {
  if (!state.selectedOrder) return;

  const orderId = String(state.selectedOrder.order_id ?? state.selectedOrder.id ?? '').trim();
  if (!orderId) return;

  if (!hasOrderItemsModal()) {
    // Se não tem modal no HTML, só atualiza meta e libera import.
    if (els.importMeta) els.importMeta.textContent = `✅ Pedido #${orderId} selecionado.`;
    return;
  }

  // Abre modal e mostra carregando
  openOrderItemsModal();
  els.orderItemsMeta.textContent = `Pedido #${orderId} • Carregando itens...`;
  els.orderItemsTbody.innerHTML = `<tr><td colspan="5" class="plx-empty">Carregando...</td></tr>`;
  els.btnConfirmOrderItems.disabled = true;

  const items = await fetchOrderItemsForOrder(orderId);
  renderOrderItems(items);

  if (!items.length && state.lastOrderItemsFetchError) {
    els.orderItemsMeta.textContent = `Pedido #${orderId} • ⚠️ ${state.lastOrderItemsFetchError}`;
  }
}

/* =========================================================
   ORDER FLOW
   ========================================================= */
function setSelectedOrder(order) {
  state.selectedOrder = order || null;

  // limpa itens selecionados ao trocar pedido
  state.selectedOrderItems = [];
  state.selectedOrderItemsSelected = new Set();

  if (!state.selectedOrder) {
    if (els.orderId) els.orderId.value = '';
    if (els.orderMeta) els.orderMeta.textContent = 'Nenhum pedido selecionado.';
    if (els.btnImportOrderItems) els.btnImportOrderItems.disabled = true;
    if (els.btnClearOrder) els.btnClearOrder.disabled = true;
    if (els.importMeta) els.importMeta.textContent = '—';
    return;
  }

  const o = state.selectedOrder;
  if (els.orderId) els.orderId.value = String(o.order_id ?? o.id ?? '');

  const customer =
    o.customer_name ||
    o.nome_razao_social ||
    o.nome_fantasia ||
    o.cliente_nome ||
    o.customer ||
    o.nome_cliente ||
    '—';

  const doc = o.customer_tax_id || o.cnpj_cpf || o.documento || '';

  if (els.orderMeta) {
    els.orderMeta.textContent = `Cliente: ${customer}${doc ? ` • Doc: ${doc}` : ''}`;
  }

  if (els.btnImportOrderItems) els.btnImportOrderItems.disabled = false;
  if (els.btnClearOrder) els.btnClearOrder.disabled = false;
}

function openOrderModal() {
  els.orderModal.classList.add('is-open');
  els.orderModal.setAttribute('aria-hidden', 'false');
  els.orderModalMeta.textContent = 'Digite para buscar...';
  els.orderSearch.value = '';
  els.orderTbody.innerHTML = `<tr><td colspan="5" class="plx-empty">Digite para buscar...</td></tr>`;
  setTimeout(() => els.orderSearch.focus(), 50);
}

function closeOrderModal() {
  els.orderModal.classList.remove('is-open');
  els.orderModal.setAttribute('aria-hidden', 'true');
}

function renderOrders(rows) {
  if (!rows || !rows.length) {
    els.orderTbody.innerHTML = `<tr><td colspan="5" class="plx-empty">Nenhum pedido encontrado.</td></tr>`;
    return;
  }

  els.orderTbody.innerHTML = rows
    .map((o) => {
      const orderId = o.order_id ?? o.id ?? '';
      const customer =
        o.customer_name ||
        o.nome_razao_social ||
        o.nome_fantasia ||
        o.cliente_nome ||
        o.customer ||
        o.nome_cliente ||
        '—';

      const status = o.status || o.order_status || '—';
      const total = o.total_value ?? o.total ?? o.valor_total ?? null;

      return `
      <tr>
        <td class="t-center">
          <button class="btn btn-pastel-primary" type="button" data-act="pickOrder" data-order-id="${escapeHtml(
            orderId,
          )}">
            Selecionar
          </button>
        </td>
        <td><b>${escapeHtml(orderId)}</b></td>
        <td>${escapeHtml(customer)}</td>
        <td>${escapeHtml(status)}</td>
        <td class="t-right">${total == null ? '—' : escapeHtml(moneyBRL(total))}</td>
      </tr>
    `;
    })
    .join('');
}

function findOrderById(id) {
  const key = String(id ?? '');
  return (
    state.orderRows.find((o) => String(o.order_id ?? o.id ?? '') === key) || null
  );
}

async function searchOrders(q) {
  const term = String(q || '').trim();
  state.orderSearchQ = term;

  if (!term) {
    els.orderTbody.innerHTML = `<tr><td colspan="5" class="plx-empty">Digite para buscar...</td></tr>`;
    els.orderModalMeta.textContent = 'Digite para buscar...';
    state.orderRows = [];
    return;
  }

  els.orderModalMeta.textContent = 'Buscando...';

  try {
    const params = new URLSearchParams();
    params.set('q', term);
    params.set('limit', '20');
    params.set('offset', '0');
    params.set('orderBy', 'created_at');
    params.set('order', 'DESC');

    const data = await apiFetch(API_ORDERS, `?${params.toString()}`);
    const rows = data.data || data.rows || [];

    state.orderRows = Array.isArray(rows) ? rows : [];
    renderOrders(state.orderRows);

    els.orderModalMeta.textContent = `Encontrado(s): ${state.orderRows.length}`;
  } catch (err) {
    els.orderModalMeta.textContent = `❌ ${err.message}`;
    els.orderTbody.innerHTML = `<tr><td colspan="5" class="plx-empty">Erro: ${escapeHtml(
      err.message,
    )}</td></tr>`;
    state.orderRows = [];
  }
}

async function importOrderItems() {
  if (!state.selectedOrder) throw new Error('Selecione um pedido primeiro.');

  const orderId = String(state.selectedOrder.order_id ?? state.selectedOrder.id ?? '').trim();
  if (!orderId) throw new Error('order_id inválido.');

  els.importMeta.textContent = 'Importando itens...';

  // ✅ NOVO: se você selecionou itens no modal, tentamos enviar também (sem quebrar)
  const selectedIdx = [...state.selectedOrderItemsSelected.values()];
  const selectedItems =
    selectedIdx.length && state.selectedOrderItems.length
      ? selectedIdx.map((i) => state.selectedOrderItems[i]).filter(Boolean)
      : [];

  const payloadBase = { order_id: Number(orderId) };

  // 1) tenta com itens (se houver)
  if (selectedItems.length) {
    try {
      const payload = {
        ...payloadBase,
        items: selectedItems.map(normalizeOrderItem),
      };

      const data = await apiFetch(API_IMPORT, '', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      const ensured = data.products_ensured ?? data.items_imported ?? data.imported ?? null;
      const msg =
        data.message ||
        (ensured != null ? `✅ Produtos garantidos: ${ensured}` : '✅ Importação concluída.');

      els.importMeta.textContent = `${msg} • Itens selecionados: ${selectedItems.length}`;
      await load();
      return;
    } catch (err) {
      // fallback automático sem itens
      els.importMeta.textContent = `⚠️ Import com seleção falhou (${err.message}). Tentando importar pelo pedido...`;
    }
  }

  // 2) fallback: importação normal (tudo do pedido)
  const data = await apiFetch(API_IMPORT, '', {
    method: 'POST',
    body: JSON.stringify(payloadBase),
  });

  const ensured = data.products_ensured ?? data.items_imported ?? data.imported ?? null;
  const msg =
    data.message ||
    (ensured != null ? `✅ Produtos garantidos: ${ensured}` : '✅ Importação concluída.');

  els.importMeta.textContent = msg;
  await load();
}

/* Debounce */
let tDebounce = null;
function debounceLoad() {
  clearTimeout(tDebounce);
  tDebounce = setTimeout(() => {
    state.offset = 0;
    load();
  }, 250);
}
function debounceOrderSearch() {
  clearTimeout(state.orderSearchTimer);
  state.orderSearchTimer = setTimeout(() => {
    searchOrders(els.orderSearch.value);
  }, 300);
}

/* =========================================================
   Events — CRUD
   ========================================================= */
els.btnRefresh.addEventListener('click', () => load());

els.btnClear.addEventListener('click', () => {
  els.qSearch.value = '';
  state.q = '';
  state.offset = 0;
  load();
});

els.qSearch.addEventListener('input', () => {
  state.q = String(els.qSearch.value || '').trim();
  debounceLoad();
});

els.qLimit.addEventListener('change', () => {
  state.limit = Number(els.qLimit.value) || 50;
  state.offset = 0;
  load();
});

els.btnPrev.addEventListener('click', () => {
  state.offset = Math.max(0, state.offset - state.limit);
  load();
});

els.btnNext.addEventListener('click', () => {
  if (Number.isFinite(Number(state.total))) {
    if (state.offset + state.limit >= Number(state.total)) return;
  } else {
    if (state.lastCount < state.limit) return;
  }
  state.offset = state.offset + state.limit;
  load();
});

els.btnNew.addEventListener('click', () => openModal('new', null));

els.btnEnsure.addEventListener('click', async () => {
  try {
    els.metaInfo.textContent = 'Executando ensure...';
    await apiFetch(API, '/ensure', { method: 'POST' });
    els.metaInfo.textContent = '✅ ensure ok';
  } catch (err) {
    els.metaInfo.textContent = `Erro ensure: ${err.message}`;
  }
});

els.tbody.addEventListener('click', async (ev) => {
  const btn = ev.target?.closest('button[data-act]');
  if (!btn) return;
  const act = btn.dataset.act;
  const code = btn.dataset.code;

  try {
    if (act === 'edit') await editByCode(code);
    if (act === 'del') await delByCode(code);
  } catch (err) {
    alert(err.message);
  }
});

els.modal.addEventListener('click', (ev) => {
  const close = ev.target?.getAttribute('data-close');
  if (close) closeModal();
});

document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape') {
    if (els.modal?.classList.contains('is-open')) closeModal();
    if (els.orderModal?.classList.contains('is-open')) closeOrderModal();
    if (els.orderItemsModal?.classList.contains('is-open')) closeOrderItemsModal();
  }
});

els.btnToggleAuto.addEventListener('click', () => {
  state.autoM3 = !state.autoM3;
  els.btnToggleAuto.textContent = state.autoM3 ? 'Auto' : 'Manual';
  els.fM3.readOnly = state.autoM3;
  els.m3Hint.textContent = state.autoM3
    ? 'Auto ON: calculando por H×W×L'
    : 'Auto OFF: você controla o volume_m3 manualmente';
  if (state.autoM3) updateM3Preview();
});

['input', 'change'].forEach((evt) => {
  els.fH.addEventListener(evt, updateM3Preview);
  els.fW.addEventListener(evt, updateM3Preview);
  els.fL.addEventListener(evt, updateM3Preview);
});

els.form.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  try {
    await save();
  } catch (err) {
    els.formMeta.textContent = `❌ ${err.message}`;
  }
});

/* =========================================================
   Events — Order Picker / Import
   ========================================================= */
setSelectedOrder(null);

// ✅ mantém seu modal interno (se você clicar no botão normal)
els.btnPickOrder.addEventListener('click', () => openOrderModal());

els.btnClearOrder.addEventListener('click', () => {
  setSelectedOrder(null);
  state.selectedOrderItems = [];
  state.selectedOrderItemsSelected = new Set();
  if (els.importMeta) els.importMeta.textContent = '—';
  if (hasOrderItemsModal()) {
    els.orderItemsTbody.innerHTML = `<tr><td colspan="5" class="plx-empty">—</td></tr>`;
    els.orderItemsMeta.textContent = '—';
    els.btnConfirmOrderItems.disabled = true;
  }
});

els.btnImportOrderItems.addEventListener('click', async () => {
  try {
    await importOrderItems();
  } catch (err) {
    els.importMeta.textContent = `❌ ${err.message}`;
    alert(err.message);
  }
});

els.orderModal.addEventListener('click', (ev) => {
  const close = ev.target?.getAttribute('data-close-order');
  if (close) closeOrderModal();
});

els.orderSearch.addEventListener('input', () => debounceOrderSearch());

els.orderTbody.addEventListener('click', async (ev) => {
  const btn = ev.target?.closest('button[data-act="pickOrder"]');
  if (!btn) return;

  const orderId = btn.dataset.orderId;
  const found = findOrderById(orderId);

  if (!found) {
    alert('Pedido não encontrado na lista.');
    return;
  }

  setSelectedOrder(found);
  closeOrderModal();

  // ✅ NOVO: ao selecionar pedido, abre modal com produtos do pedido
  try {
    await showOrderItemsAfterPick();
  } catch (e) {
    if (els.importMeta) els.importMeta.textContent = `⚠️ ${e.message || e}`;
  }
});

/* =========================================================
   Events — Order Items Modal (Produtos do Pedido) — NOVO
   ========================================================= */
if (hasOrderItemsModal()) {
  // fechar clicando backdrop/x
  els.orderItemsModal.addEventListener('click', (ev) => {
    const close = ev.target?.getAttribute('data-close-order-items');
    if (close) closeOrderItemsModal();
  });

  // selecionar checkboxes
  els.orderItemsTbody.addEventListener('change', (ev) => {
    const chk = ev.target?.closest('input[type="checkbox"][data-oi-check="1"]');
    if (!chk) return;

    const idx = Number(chk.dataset.idx);
    if (!Number.isFinite(idx)) return;

    if (chk.checked) state.selectedOrderItemsSelected.add(idx);
    else state.selectedOrderItemsSelected.delete(idx);

    updateOrderItemsConfirmState();
  });

  // confirmar seleção (não importa ainda; só habilita e fecha modal)
  els.btnConfirmOrderItems.addEventListener('click', async () => {
  try {
    const count = state.selectedOrderItemsSelected.size;
    if (!count) throw new Error('Selecione pelo menos 1 item.');

    // ✅ salva (importa) no productsLogistics
    await importOrderItems();

    // ✅ fecha modal
    closeOrderItemsModal();

    // ✅ garante que a lista "Registros" atualize (load já é chamado no import, mas repetimos por segurança)
    await load();

    // ✅ opcional: abrir automaticamente o primeiro item importado para editar
    // (somente se sua API permitir GET /api/products-logistics/:product_code)
    const firstIdx = [...state.selectedOrderItemsSelected.values()][0];
    const first = state.selectedOrderItems[firstIdx];
    const firstCode = first?.product_code;
    if (firstCode) {
      // abre modal de edição do registro recém-criado
      await editByCode(firstCode);
    }

  } catch (err) {
    alert(err.message);
  }
});
}

/* =========================================================
   ✅ Integração com Modal Externo
   - Se você usar /public/modalsSearch/productsLogisticsModal.js
   - Ele pode disparar: window.dispatchEvent(new CustomEvent('plx:orderPicked', {detail:{order,items}}))
   ========================================================= */
window.addEventListener('plx:orderPicked', async (ev) => {
  const { order, items } = ev.detail || {};
  if (!order) return;

  setSelectedOrder(order);

  // se já veio com itens, usamos direto
  state.selectedOrderItems = Array.isArray(items) ? items.map(normalizeOrderItem) : [];
  state.selectedOrderItemsSelected = new Set();

  // abre modal de produtos (ou tenta fetch se não veio itens)
  try {
    await showOrderItemsAfterPick();
  } catch (e) {
    if (els.importMeta) els.importMeta.textContent = `⚠️ ${e.message || e}`;
  }
});

/* =========================================================
   Boot
   ========================================================= */
load();
