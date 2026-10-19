// ╔══════════════════════════════════════════════════════════════════════╗
// ║ groupsAndSubgroupsBatch.js — Grupo/Subgrupo em Lote (ESM)             ║
// ║ - Busca produtos com paginação                                        ║
// ║ - Seleção múltipla (checkbox + selecionar todos)                      ║
// ║ - Filtro: todos / com grupo / sem grupo                               ║
// ║ - Seleção de Grupo (combo /api/products-groups)                       ║
// ║ - Subgrupo (best-effort /api/products-subgroups)                      ║
// ║ - POST em lote para /api/products-groups/batch/assign                 ║
// ║ - POST limpar para /api/products-groups/batch/clear                   ║
// ║ ✅ Padrão CONSART: API_BASE + ROUTES                                  ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { showCenterModal } from '/public/includes/js/centerAlertModal.js';

/* ──────────────────────────────────────────────────────────────
   API BASE (padrão CONSART) + ROUTES
───────────────────────────────────────────────────────────── */
function getApiBase() {
  try {
    if (typeof window !== 'undefined' && window.getApiBase) return window.getApiBase();
    if (typeof window !== 'undefined' && window.apiBase) return window.apiBase;
  } catch (e) { }
  try { return window.location.origin.replace(/\/$/, ''); } catch (e) { }
  return 'http://localhost:8080';
}

const API_BASE = getApiBase();

const ROUTES = Object.freeze({
  PRODUCTS_LIST: '/api/products',              // ✅ rota principal do seu ERP
  GROUPS_LIST: '/api/products-groups',
  SUBGROUPS_LIST: '/api/products-subgroups',

  BATCH_ASSIGN: '/api/products-groups/batch/assign',
  BATCH_CLEAR: '/api/products-groups/batch/clear',
});

const PRODUCTS_LIST_CANDIDATES = [
  '/api/products',
  '/api/produtos',
  '/api/products/list',
  '/api/products/search',
  '/api/products/paginated',
];

/* ──────────────────────────────────────────────────────────────
   Confirm modal (CONSART Standard) — substitui window.confirm
───────────────────────────────────────────────────────────── */
function confirmCenterModal({
  title = 'Confirmar ação',
  message = 'Deseja continuar?',
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
} = {}) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'gsb-confirm-overlay';
    overlay.innerHTML = `
      <div class="gsb-confirm-card" role="dialog" aria-modal="true" aria-label="${title}">
        <div class="btn btn-toolbar btn-sm">
          <div class="btn btn-toolbar btn-sm">${title}</div>
        </div>
        <div class="gsb-confirm-body">${message}</div>
        <div class="gsb-confirm-foot">
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
  limit: 50,
  q: '',
  loading: false,
  products: [],
  selected: new Set(), // product_id (string)
  linkedFilter: 'all', // all | linked | unlinked
  onlyActive: true,

  groupsMap: new Map(),     // id -> name
  subgroupsMap: new Map(),  // id -> name (do grupo selecionado)
  allSubgroupsMap: new Map(), // id -> name (todos, para a coluna Subgrupo da tabela)

  newGroupId: '',
  newSubgroupId: '',
};

// helpers DOM
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const els = {
  searchInput: $('#gsb-search-input'),
  searchBtn: $('#gsb-search-btn'),
  tbody: $('#gsb-products-body'),
  selectAll: $('#gsb-select-all'),
  // Rodapé da tabela (IDs do padrão table-footer do HTML)
  prevPage: $('#btnPrevious'),
  nextPage: $('#btnNext'),
  pageInfo: $('#pageInfo'),
  tableInfo: $('#apTableInfo'),
  pageSize: $('#pageSize'),
  selectedCount: $('#gsb-selected-count'),
  summarySelected: $('#gsb-summary-selected'),

  linkedFilter: $('#gsb-linked-filter'),
  onlyActive: $('#gsb-only-active'),

  groupSelect: $('#gsb-group-select'),
  subgroupSelect: $('#gsb-subgroup-select'),
  subgroupHelp: $('#gsb-subgroup-help'),

  summaryGroup: $('#gsb-summary-group'),
  summarySubgroup: $('#gsb-summary-subgroup'),

  applyBtn: $('#gsb-apply-batch'),
  clearBtn: $('#gsb-clear-batch'),
};

function extractList(payload) {
  // Retorna SEMPRE um array, independente do formato do backend
  if (!payload) return [];

  // já é array
  if (Array.isArray(payload)) return payload;

  // formatos comuns
  if (Array.isArray(payload.rows)) return payload.rows;
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.items)) return payload.items;
  if (Array.isArray(payload.results)) return payload.results;
  if (Array.isArray(payload.result)) return payload.result;

  // alguns backends retornam { ok:true, data:{ rows:[...] } }
  if (payload.data && typeof payload.data === 'object') {
    if (Array.isArray(payload.data.rows)) return payload.data.rows;
    if (Array.isArray(payload.data.items)) return payload.data.items;
  }

  // fallback: tenta achar a primeira propriedade array dentro do objeto
  for (const k of Object.keys(payload)) {
    if (Array.isArray(payload[k])) return payload[k];
  }

  return [];
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

function withTimeout(promise, ms = 7000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  return { ctrl, wrapped: promise(ctrl.signal).finally(() => clearTimeout(t)) };
}

async function probeEndpoint(path) {
  const url = `${API_BASE}${path}?limit=1&offset=0`;
  const { wrapped } = withTimeout(async (signal) => {
    const res = await fetch(url, { method: 'GET', headers: { Accept: 'application/json' }, signal });
    if (!res.ok) return null;
    // se não for JSON, também ignora
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('application/json')) return null;
    const data = await res.json().catch(() => null);
    return data ? true : null;
  }, 5000);

  try { return await wrapped; } catch { return null; }
}

async function resolveProductsListRoute() {
  // já resolvida
  if (state.productsListRoute) return state.productsListRoute;

  for (const candidate of PRODUCTS_LIST_CANDIDATES) {
    const ok = await probeEndpoint(candidate);
    if (ok) {
      state.productsListRoute = candidate;
      console.log('[GSB] PRODUCTS_LIST resolved:', candidate);
      return candidate;
    }
  }

  // fallback final
  state.productsListRoute = '/api/products';
  console.warn('[GSB] PRODUCTS_LIST fallback to /api/products');
  return state.productsListRoute;
}

async function safeJson(url, options = {}) {
  const res = await fetch(url, {
    cache: 'no-store', // ✅ evita 304
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache', // ✅ reforço
      Pragma: 'no-cache',
      ...(options.headers || {}),
    },
    ...options,
  });

  // ⚠️ se vier 304, força erro legível
  if (res.status === 304) {
    throw new Error(`${url} → 304 Not Modified (cache). Disable cache or use no-store.`);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${url} → ${res.status} ${res.statusText} :: ${text}`);
  }

  // 204/304 sem body
  if (res.status === 204) return null;

  return res.json();
}

function normalizeProduct(row) {
  // tenta mapear campos comuns do seu ERP
  const product_id = row.product_id ?? row.id ?? row.productId ?? row.productID;
  const sku = row.product_code ?? row.sku ?? row.code ?? row.productCode;
  const description = row.product_description ?? row.description ?? row.name ?? row.product_name;

  const product_group_id = row.product_group_id ?? row.group_id ?? row.products_group_id ?? row.groupId ?? null;
  const product_subgroup_id = row.product_subgroup_id ?? row.subgroup_id ?? row.group_sub_id ?? row.subgroupId ?? null;

  const is_active = row.is_active ?? row.active ?? true;

  return {
    product_id,
    sku,
    description,
    product_group_id,
    product_subgroup_id,
    is_active,
  };
}

function groupLabel(groupId) {
  if (!groupId) return '-';
  const name = state.groupsMap.get(Number(groupId));
  return name ? String(name) : String(groupId);
}

function subgroupLabel(subgroupId) {
  if (!subgroupId) return '-';
  const name = state.allSubgroupsMap.get(Number(subgroupId)) ?? state.subgroupsMap.get(Number(subgroupId));
  return name ? String(name) : String(subgroupId);
}

/** Carrega todos os subgrupos só para exibir o nome na tabela (falha não bloqueia a tela) */
async function loadAllSubgroupNames() {
  try {
    const data = await safeJson(`${API_BASE}${ROUTES.SUBGROUPS_LIST}?limit=5000`);
    state.allSubgroupsMap.clear();
    extractList(data).forEach((sg) => {
      const id = Number(sg.product_subgroup_id ?? sg.id);
      const name = sg.name ?? sg.subgroup_name ?? sg.description;
      if (Number.isInteger(id) && name) state.allSubgroupsMap.set(id, String(name));
    });
  } catch (err) {
    console.warn('[GSB] Nomes de subgrupos indisponíveis', err?.message || err);
  }
}

/* ──────────────────────────────────────────────────────────────
   Carregar Grupos / Subgrupos (combos à direita)
───────────────────────────────────────────────────────────── */
async function loadGroups() {
  try {
    const data = await safeJson(`${API_BASE}${ROUTES.GROUPS_LIST}?limit=1000&is_active=true`);
    const list = extractList(data);

    state.groupsMap.clear();
    els.groupSelect.innerHTML = '<option value="">Selecione um grupo...</option>';

    if (!Array.isArray(list) || !list.length) {
      els.groupSelect.innerHTML = '<option value="">(Nenhum grupo encontrado)</option>';
      return;
    }

    list.forEach((g) => {
      const id = g.product_group_id ?? g.id;
      const name = g.name ?? g.group_name ?? g.description ?? `Grupo #${id}`;

      if (Number.isInteger(Number(id))) {
        state.groupsMap.set(Number(id), String(name));
      }

      const opt = document.createElement('option');
      opt.value = String(id);
      opt.textContent = String(name);
      els.groupSelect.appendChild(opt);
    });
  } catch (err) {
    console.error('[GSB] Erro ao carregar grupos', err);
    els.groupSelect.innerHTML = '<option value="">(Erro ao carregar grupos)</option>';
    showCenterModal({
      variant: 'warning',
      title: 'Grupos',
      message: `Não foi possível carregar grupos. Verifique a API ${ROUTES.GROUPS_LIST}.`,
      timeoutMs: 7000,
    });
  }
}

async function loadSubgroupsByGroupId(groupId) {
  // best-effort: se endpoint não existir, não quebra
  els.subgroupSelect.disabled = true;
  els.subgroupSelect.innerHTML = '<option value="">Carregando subgrupos...</option>';
  state.subgroupsMap.clear();

  if (!groupId) {
    els.subgroupSelect.innerHTML = '<option value="">Selecione um grupo para carregar subgrupos...</option>';
    els.subgroupSelect.disabled = true;
    els.subgroupHelp.textContent = 'Selecione um grupo para carregar subgrupos (se existir).';
    state.newSubgroupId = '';
    els.summarySubgroup.textContent = '-';
    return;
  }

  try {
    const url = `${API_BASE}${ROUTES.SUBGROUPS_LIST}?group_id=${encodeURIComponent(groupId)}&limit=1000&is_active=true`;
    const data = await safeJson(url);
    const list = extractList(data);

    els.subgroupSelect.innerHTML = '<option value="">(Opcional) selecione um subgrupo...</option>';

    list.forEach((sg) => {
      const id = sg.product_subgroup_id ?? sg.id;
      const name = sg.name ?? sg.subgroup_name ?? sg.description ?? `Subgrupo #${id}`;
      if (Number.isInteger(Number(id))) state.subgroupsMap.set(Number(id), String(name));

      const opt = document.createElement('option');
      opt.value = String(id);
      opt.textContent = String(name);
      els.subgroupSelect.appendChild(opt);
    });

    els.subgroupSelect.disabled = false;
    els.subgroupHelp.textContent = 'Subgrupos carregados. (Opcional)';
  } catch (err) {
    console.warn('[GSB] Subgrupos indisponíveis', err.message);
    els.subgroupSelect.innerHTML = '<option value="">(Subgrupos indisponíveis)</option>';
    els.subgroupSelect.disabled = true;
    els.subgroupHelp.textContent = 'Subgrupos indisponíveis (endpoint não encontrado ou não implementado).';
  }
}

/* ──────────────────────────────────────────────────────────────
   Buscar produtos (LEFT)
───────────────────────────────────────────────────────────── */
async function fetchProducts() {
  if (state.loading) return;
  state.loading = true;

  const q = (state.q || '').trim();
  const hasQ = q.length >= 3;

  const params = new URLSearchParams();
  params.set('page', String(state.page));
  params.set('limit', String(state.limit));

  if (hasQ) params.set('q', q);

  // /api/products filtra por "active"; sem o parâmetro lista ativos e inativos
  if (state.onlyActive === true) {
    params.set('active', 'true');
  }

  // Filtro de vínculo aplicado no backend (afeta total e paginação)
  if (state.linkedFilter === 'linked') {
    params.set('linked', 'true');
  } else if (state.linkedFilter === 'unlinked') {
    params.set('linked', 'false');
  }

  try {
    // /search força somente ativos; com "incluir inativos" usa a listagem (que também aceita q)
    const endpoint = hasQ && state.onlyActive
      ? `${ROUTES.PRODUCTS_LIST}/search`
      : `${ROUTES.PRODUCTS_LIST}`;

    const url = `${API_BASE}${endpoint}?${params.toString()}`;

    const data = await safeJson(url);

    const rows =
      Array.isArray(data?.rows) ? data.rows :
        Array.isArray(data?.data) ? data.data :
          Array.isArray(data) ? data :
            [];

    // ✅ normalização aplicada
    state.products = rows.map(normalizeProduct);

    renderProductsTable();

    const total = Number(data?.total);
    const totalPages = Number.isFinite(total) ? Math.max(1, Math.ceil(total / state.limit)) : null;

    if (els.tableInfo) {
      els.tableInfo.textContent = Number.isFinite(total)
        ? `${total.toLocaleString('pt-BR')} Registros`
        : `${state.products.length} Registros`;
    }
    if (els.pageInfo) {
      els.pageInfo.textContent = totalPages ? `Página ${state.page} de ${totalPages}` : `Página ${state.page}`;
    }
    if (els.prevPage) els.prevPage.disabled = state.page <= 1;
    if (els.nextPage) {
      els.nextPage.disabled = totalPages ? state.page >= totalPages : state.products.length < state.limit;
    }

  } catch (err) {
    console.error('[GSB] Erro ao buscar produtos', err);
    showCenterModal({
      variant: 'error',
      title: 'Erro ao buscar produtos',
      message: `Falha ao buscar produtos. ${String(err?.message || err).slice(0, 300)}`,
      timeoutMs: 7000,
    });
  } finally {
    state.loading = false;
  }
}

/* ──────────────────────────────────────────────────────────────
   Render tabela de produtos (COM LIMPAR individual)
───────────────────────────────────────────────────────────── */
async function clearOneProduct(productId, sku) {
  const ok = await confirmCenterModal({
    title: 'Limpar Grupo/Subgrupo',
    message: `
      <div>
        Deseja realmente <strong>LIMPAR</strong> Grupo/Subgrupo deste produto?
        <br><br>
        <strong>Produto ID:</strong> ${productId}<br>
        <strong>SKU:</strong> ${sku || '-'}
      </div>
    `,
    confirmText: 'Limpar',
    cancelText: 'Cancelar',
  });
  if (!ok) return;

  try {
    await safeJson(`${API_BASE}${ROUTES.BATCH_CLEAR}`, {
      method: 'POST',
      body: JSON.stringify({ product_ids: [String(productId)] }),
    });

    showCenterModal({
      variant: 'success',
      title: 'Limpo',
      message: `Grupo/Subgrupo removido do produto ${sku || ''}`.trim(),
      timeoutMs: 4000,
    });

    state.selected.delete(String(productId));
    updateSelectionInfo();
    await fetchProducts();
  } catch (err) {
    console.error('[GSB] Erro ao limpar item', err);
    showCenterModal({
      variant: 'error',
      title: 'Erro ao limpar',
      message: `Não foi possível limpar o Grupo/Subgrupo. Verifique a rota ${ROUTES.BATCH_CLEAR}.`,
      timeoutMs: 7000,
    });
  }
}

function renderProductsTable() {
  els.tbody.innerHTML = '';

  if (!state.products.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 8;
    td.textContent =
      state.q && state.q.length >= 3
        ? 'Nenhum produto encontrado para a busca.'
        : 'Nenhum produto listado. Digite ao menos 3 caracteres e clique em Buscar.';
    td.style.textAlign = 'center';
    td.style.padding = '16px';
    tr.appendChild(td);
    els.tbody.appendChild(tr);
    updateSelectionInfo();
    return;
  }

  state.products.forEach((p) => {
    const tr = document.createElement('tr');

    const productId = p.product_id;
    const sku = p.sku;
    const description = p.description;
    const groupId = p.product_group_id;
    const subgroupId = p.product_subgroup_id;
    const isLinked = !!groupId;

    // ☑️ checkbox
    const tdCheck = document.createElement('td');
    const chk = document.createElement('input');
    chk.type = 'checkbox';
    chk.dataset.productId = productId;
    chk.checked = state.selected.has(String(productId));
    chk.addEventListener('change', onToggleProductSelection);
    tdCheck.appendChild(chk);

    // Produto ID
    const tdProductId = document.createElement('td');
    tdProductId.textContent = productId ?? '-';

    // SKU
    const tdSku = document.createElement('td');
    tdSku.textContent = sku || '-';

    // Descrição
    const tdDesc = document.createElement('td');
    tdDesc.textContent = description || '-';

    // Grupo
    const tdGroup = document.createElement('td');
    tdGroup.textContent = groupLabel(groupId);

    // Subgrupo
    const tdSub = document.createElement('td');
    tdSub.textContent = subgroupLabel(subgroupId);

    // Vinculado?
    const tdStatus = document.createElement('td');
    const badge = document.createElement('span');
    badge.className = 'gsb-status-badge ' + (isLinked ? 'ok' : 'no');
    badge.innerHTML = isLinked
      ? '✔️ <span>Vinculado</span>'
      : '❌ <span>Não vinculado</span>';
    tdStatus.appendChild(badge);

    // Limpar
    const tdClear = document.createElement('td');
    const btnClear = document.createElement('button');
    btnClear.type = 'button';
    btnClear.className = 'btn btn-toolbar btn-sm';
    btnClear.textContent = 'Limpar';
    btnClear.disabled = !isLinked;

    btnClear.addEventListener('click', () => clearOneProduct(productId, sku));
    tdClear.appendChild(btnClear);

    tr.append(tdCheck, tdProductId, tdSku, tdDesc, tdGroup, tdSub, tdStatus, tdClear);
    els.tbody.appendChild(tr);
  });

  // Atualiza checkbox "selecionar todos"
  const allVisibleIds = $$('#gsb-products-body input[type="checkbox"]').map((c) => c.dataset.productId);
  const allSelectedOnPage =
    allVisibleIds.length && allVisibleIds.every((id) => state.selected.has(String(id)));

  els.selectAll.checked = !!allSelectedOnPage;
  updateSelectionInfo();
}

/* ──────────────────────────────────────────────────────────────
   Seleção de produtos
───────────────────────────────────────────────────────────── */
function onToggleProductSelection(ev) {
  const chk = ev.target;
  const id = chk.dataset.productId;
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
  $$('#gsb-products-body input[type="checkbox"]').forEach((chk) => {
    const id = chk.dataset.productId;
    if (!id) return;
    chk.checked = checked;
    if (checked) state.selected.add(String(id));
    else state.selected.delete(String(id));
  });
  updateSelectionInfo();
}

function updateSelectionInfo() {
  const count = state.selected.size;
  if (els.selectedCount) els.selectedCount.textContent = String(count);
  if (els.summarySelected) els.summarySelected.textContent = String(count);
}

/* ──────────────────────────────────────────────────────────────
   Resumo (direita)
───────────────────────────────────────────────────────────── */
function updateSummary() {
  const gid = els.groupSelect.value;
  const sgid = els.subgroupSelect.value;

  state.newGroupId = gid || '';
  state.newSubgroupId = sgid || '';

  els.summaryGroup.textContent = gid ? (state.groupsMap.get(Number(gid)) || `#${gid}`) : '-';
  els.summarySubgroup.textContent = sgid ? (state.subgroupsMap.get(Number(sgid)) || `#${sgid}`) : '-';
}

/* ──────────────────────────────────────────────────────────────
   Aplicar em lote / Limpar em lote
───────────────────────────────────────────────────────────── */
async function applyBatchAssign() {
  if (!state.selected.size) {
    showCenterModal({
      variant: 'warning',
      title: 'Nenhum produto selecionado',
      message: 'Selecione ao menos um produto para aplicar Grupo/Subgrupo.',
      timeoutMs: 5000,
    });
    return;
  }

  const groupId = els.groupSelect.value;
  if (!groupId) {
    showCenterModal({
      variant: 'warning',
      title: 'Grupo obrigatório',
      message: 'Selecione um Grupo para aplicar aos produtos selecionados.',
      timeoutMs: 6000,
    });
    return;
  }

  const subgroupId = els.subgroupSelect.disabled ? '' : (els.subgroupSelect.value || '');

  const proceed = await confirmCenterModal({
    title: 'Aplicar Grupo/Subgrupo em lote',
    message: `
      <div>
        Você está prestes a aplicar:
        <br><br>
        <strong>Grupo:</strong> ${els.summaryGroup.textContent || '-'}<br>
        <strong>Subgrupo:</strong> ${els.summarySubgroup.textContent || '-'}
        <br><br>
        Para <strong>${state.selected.size}</strong> produto(s).
        <br><br>
        Deseja continuar?
      </div>
    `,
    confirmText: 'Aplicar',
    cancelText: 'Cancelar',
  });
  if (!proceed) return;

  try {
    const payload = {
      product_group_id: Number(groupId),
      product_subgroup_id: subgroupId ? Number(subgroupId) : undefined,
      product_ids: Array.from(state.selected),
      only_active_products: state.onlyActive,
    };
    if (payload.product_subgroup_id === undefined) delete payload.product_subgroup_id;

    await safeJson(`${API_BASE}${ROUTES.BATCH_ASSIGN}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    showCenterModal({
      variant: 'success',
      title: 'Aplicado com sucesso',
      message: `Grupo/Subgrupo aplicado para ${state.selected.size} produto(s).`,
      timeoutMs: 5000,
    });

    await fetchProducts();
  } catch (err) {
    console.error('[GSB] Erro ao aplicar em lote', err);
    showCenterModal({
      variant: 'error',
      title: 'Erro ao aplicar',
      message: `Ocorreu um erro ao aplicar em lote. Verifique o backend ${ROUTES.BATCH_ASSIGN}.`,
      timeoutMs: 8000,
    });
  }
}

async function clearBatchSelected() {
  if (!state.selected.size) {
    showCenterModal({
      variant: 'warning',
      title: 'Nenhum produto selecionado',
      message: 'Selecione ao menos um produto para limpar Grupo/Subgrupo.',
      timeoutMs: 5000,
    });
    return;
  }

  const proceed = await confirmCenterModal({
    title: 'Limpar Grupo/Subgrupo em lote',
    message: `
      <div>
        Você está prestes a <strong>LIMPAR</strong> Grupo/Subgrupo de
        <strong>${state.selected.size}</strong> produto(s).
        <br><br>
        Deseja continuar?
      </div>
    `,
    confirmText: 'Limpar',
    cancelText: 'Cancelar',
  });
  if (!proceed) return;

  try {
    const payload = {
      product_ids: Array.from(state.selected),
      only_active_products: state.onlyActive,
    };

    await safeJson(`${API_BASE}${ROUTES.BATCH_CLEAR}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    showCenterModal({
      variant: 'success',
      title: 'Limpeza concluída',
      message: `Grupo/Subgrupo removido de ${state.selected.size} produto(s).`,
      timeoutMs: 5000,
    });

    await fetchProducts();
  } catch (err) {
    console.error('[GSB] Erro ao limpar em lote', err);
    showCenterModal({
      variant: 'error',
      title: 'Erro ao limpar',
      message: `Ocorreu um erro ao limpar em lote. Verifique o backend ${ROUTES.BATCH_CLEAR}.`,
      timeoutMs: 8000,
    });
  }
}

/* ──────────────────────────────────────────────────────────────
   Eventos e inicialização (GSB — completo e robusto)
   - Busca: Enter / debounce / botão
   - Paginação: prev/next
   - Seleção: select-all
   - Filtros: linkedFilter / onlyActive
   - Grupo/Subgrupo: carrega subgrupos ao trocar grupo
   - Ações: aplicar / limpar
   - Guards: checa elementos antes de bindar (não quebra se faltar id)
───────────────────────────────────────────────────────────── */
function initEvents() {
  // ── Guards básicos
  if (!els.searchInput || !els.searchBtn || !els.tbody) {
    console.error('[GSB] Missing required DOM elements:', {
      searchInput: !!els.searchInput,
      searchBtn: !!els.searchBtn,
      tbody: !!els.tbody,
    });
    return;
  }

  // ── Debounced search (mesmo padrão do productsFiscalBatch)
  const debouncedSearch = debounce(() => {
    state.page = 1;
    state.q = (els.searchInput.value || '').trim();
    fetchProducts();
  }, 500);

  // ── Botão buscar
  els.searchBtn.addEventListener('click', () => {
    state.page = 1;
    state.q = (els.searchInput.value || '').trim();
    fetchProducts();
  });

  // ── Enter no input busca (e debounce para digitação)
  els.searchInput.addEventListener('keyup', (ev) => {
    if (ev.key === 'Enter') {
      state.page = 1;
      state.q = (els.searchInput.value || '').trim();
      fetchProducts();
    } else {
      debouncedSearch();
    }
  });

  // ── Select all (checkbox do header)
  if (els.selectAll) {
    els.selectAll.addEventListener('change', onToggleSelectAll);
  }

  // ── Paginação
  if (els.prevPage) {
    els.prevPage.addEventListener('click', () => {
      if (state.page > 1) {
        state.page -= 1;
        fetchProducts();
      }
    });
  }

  if (els.nextPage) {
    els.nextPage.addEventListener('click', () => {
      // se estiver disabled, não faz nada
      if (!els.nextPage.disabled) {
        state.page += 1;
        fetchProducts();
      }
    });
  }

  // ── Quantidade por página
  if (els.pageSize) {
    els.pageSize.value = String(state.limit);
    els.pageSize.addEventListener('change', () => {
      state.limit = Number(els.pageSize.value) || 50;
      state.page = 1;
      fetchProducts();
    });
  }

  // ── Filtro linked (all|linked|unlinked) — se existir no HTML
  if (els.linkedFilter) {
    els.linkedFilter.addEventListener('change', () => {
      const val = (els.linkedFilter.value || 'all').trim();
      state.linkedFilter = val; // all | linked | unlinked
      state.page = 1;
      fetchProducts();
    });
  }

  // ── Apenas ativos (checkbox) — se existir no HTML
  if (els.onlyActive) {
    els.onlyActive.addEventListener('change', () => {
      state.onlyActive = !!els.onlyActive.checked;
      state.page = 1;
      fetchProducts();
    });
  }

  // ── Grupo/Subgrupo
  if (els.groupSelect) {
    els.groupSelect.addEventListener('change', async () => {
      try {
        updateSummary();

        const groupId = (els.groupSelect.value || '').trim();

        // reseta subgrupo ao trocar grupo
        if (els.subgroupSelect) {
          els.subgroupSelect.value = '';
          els.subgroupSelect.innerHTML = '<option value="">Selecione um subgrupo...</option>';
        }

        // se não tiver grupo selecionado, não carrega subgrupos
        if (!groupId) {
          updateSummary();
          return;
        }

        await loadSubgroupsByGroupId(groupId);
        updateSummary();
      } catch (err) {
        console.error('[GSB] error on group change:', err);
        showCenterModal({
          variant: 'error',
          title: 'Subgrupos',
          message: 'Não foi possível carregar os subgrupos do grupo selecionado.',
          timeoutMs: 6000,
        });
      }
    });
  }

  if (els.subgroupSelect) {
    els.subgroupSelect.addEventListener('change', () => updateSummary());
  }

  // ── Ações principais (aplicar / limpar)
  if (els.applyBtn) {
    els.applyBtn.addEventListener('click', applyBatchAssign);
  }
  if (els.clearBtn) {
    els.clearBtn.addEventListener('click', clearBatchSelected);
  }

  // ── Extra: Ctrl+F foca o search (melhora UX)
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
      e.preventDefault();
      els.searchInput.focus();
      els.searchInput.select?.();
    }
  });
}

async function bootstrap() {
  try {
    initEvents();

    // carrega grupos (+ nomes de todos os subgrupos para a tabela)
    await Promise.all([loadGroups(), loadAllSubgroupNames()]);
    updateSummary();

    // abre a lista inicial
    await fetchProducts();
  } catch (err) {
    console.error('[GSB] bootstrap error:', err);
    showCenterModal({
      variant: 'error',
      title: 'Inicialização',
      message: 'Falha ao inicializar a tela. Verifique o console do navegador.',
      timeoutMs: 7000,
    });
  }
}

document.addEventListener('DOMContentLoaded', bootstrap);
