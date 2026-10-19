// ╔══════════════════════════════════════════════════════════════════════╗
// ║ productsActiveBatch.js — Ativar/Desativar Produtos em Lote (ESM)      ║
// ║ - Lista produtos com paginação                                        ║
// ║ - Busca (q>=3)                                                        ║
// ║ - Filtro status: all|active|inactive                                  ║
// ║ - Seleção múltipla + selecionar todos                                 ║
// ║ - Ação em lote: ativar / desativar                                    ║
// ║ - Ação individual por linha                                           ║
// ║ ✅ Padrão CONSART: API_BASE + showCenterModal + confirmCenterModal     ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { showCenterModal } from '/public/includes/js/centerAlertModal.js';

function getApiBase() {
  try {
    if (typeof window !== 'undefined' && window.getApiBase) return window.getApiBase();
    if (typeof window !== 'undefined' && window.apiBase) return window.apiBase;
  } catch (e) {}
  try { return window.location.origin.replace(/\/$/, ''); } catch(e) {}
  return 'http://localhost:8080';
}

const API_BASE = getApiBase();

const ROUTES = Object.freeze({
  LIST: '/api/products-active/batch/list',
  ACTIVATE: '/api/products-active/batch/activate',
  DEACTIVATE: '/api/products-active/batch/deactivate',
  SET: '/api/products-active/batch/set',
});

const state = {
  page: 1,
  limit: 20,
  q: '',
  status: 'all',     // all|active|inactive
  loading: false,
  products: [],
  selected: new Set(), // product_id string
  selectedMode: false, // se true, opera só selected ids
  lastOp: '-',
};

const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const els = {
  searchInput: $('#pab-search-input'),
  searchBtn: $('#pab-search-btn'),
  tbody: $('#pab-products-body'),
  selectAll: $('#pab-select-all'),
  prevPage: $('#pab-prev-page'),
  nextPage: $('#pab-next-page'),
  pageInfo: $('#pab-page-info'),
  selectedCount: $('#pab-selected-count'),

  statusFilter: $('#pab-status-filter'),
  selectedMode: $('#pab-only-selected-mode'),

  summarySelected: $('#pab-summary-selected'),
  summarySelected2: $('#pab-summary-selected-2'),
  summaryStatus: $('#pab-summary-status'),
  summaryStatus2: $('#pab-summary-status-2'),
  summaryQ: $('#pab-summary-q'),
  summaryOp: $('#pab-summary-op'),

  activateBtn: $('#pab-activate-batch'),
  deactivateBtn: $('#pab-deactivate-batch'),
};

function debounce(fn, delay = 400) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), delay);
  };
}

async function safeJson(url, options = {}) {
  const res = await fetch(url, {
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache',
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${url} → ${res.status} ${res.statusText} :: ${text}`);
  }

  if (res.status === 204) return null;
  return res.json();
}

function confirmCenterModal({
  title = 'Confirmar ação',
  message = 'Deseja continuar?',
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
} = {}) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'pab-confirm-overlay';
    overlay.innerHTML = `
      <div class="pab-confirm-card" role="dialog" aria-modal="true" aria-label="${title}">
        <div class="btn btn-toolbar btn-sm">
          <div class="btn btn-toolbar btn-sm">${title}</div>
        </div>
        <div class="pab-confirm-body">${message}</div>
        <div class="pab-confirm-foot">
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

    const onEsc = (e) => { if (e.key === 'Escape') cleanup(false); };

    overlay.addEventListener('click', (e) => { if (e.target === overlay) cleanup(false); });
    overlay.querySelector('[data-act="cancel"]').addEventListener('click', () => cleanup(false));
    overlay.querySelector('[data-act="ok"]').addEventListener('click', () => cleanup(true));

    document.addEventListener('keydown', onEsc);
    document.body.appendChild(overlay);
  });
}

function normalizeProduct(row) {
  const product_id = row.product_id ?? row.id ?? row.productId ?? row.productID;
  const sku =
    row.product_code ??
    row.sku ??
    row.code ??
    row.productCode ??
    '-';

  const description =
    row.product_description ??
    row.description ??
    row.name ??
    row.product_name ??
    '-';

  const is_active =
    row.is_active === true ? true :
    row.is_active === false ? false :
    true;

  return { product_id, sku, description, is_active };
}

function updateSummary() {
  const count = state.selected.size;
  const q = (state.q || '').trim();

  els.selectedCount.textContent = String(count);
  els.summarySelected.textContent = String(count);
  els.summarySelected2.textContent = String(count);

  els.summaryStatus.textContent = state.status || '-';
  els.summaryStatus2.textContent = state.status || '-';

  els.summaryQ.textContent = q ? q : '-';
  els.summaryOp.textContent = state.lastOp || '-';
}

function onToggleProductSelection(ev) {
  const chk = ev.target;
  const id = chk.dataset.productId;
  if (!id) return;

  if (chk.checked) state.selected.add(String(id));
  else {
    state.selected.delete(String(id));
    els.selectAll.checked = false;
  }
  updateSummary();
}

function onToggleSelectAll(ev) {
  const checked = ev.target.checked;
  $$('#pab-products-body input[type="checkbox"]').forEach((chk) => {
    const id = chk.dataset.productId;
    if (!id) return;
    chk.checked = checked;
    if (checked) state.selected.add(String(id));
    else state.selected.delete(String(id));
  });
  updateSummary();
}

async function fetchProducts() {
  if (state.loading) return;
  state.loading = true;

  const q = (state.q || '').trim();
  const hasQ = q.length >= 3;

  const params = new URLSearchParams();
  params.set('page', String(state.page));
  params.set('limit', String(state.limit));
  params.set('status', String(state.status || 'all'));

  if (hasQ) params.set('q', q);

  try {
    const url = `${API_BASE}${ROUTES.LIST}?${params.toString()}`;
    const data = await safeJson(url);

    const rows = Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : []);
    state.products = rows.map(normalizeProduct);

    renderProductsTable();

    els.pageInfo.textContent = `Página ${state.page}`;
    if (els.prevPage) els.prevPage.disabled = state.page <= 1;
    if (els.nextPage) els.nextPage.disabled = state.products.length < state.limit;

  } catch (err) {
    console.error('[PAB] Erro ao buscar produtos', err);
    showCenterModal({
      variant: 'error',
      title: 'Erro ao buscar produtos',
      message: 'Falha ao buscar produtos. Verifique a rota /api/products-active/batch/list.',
      timeoutMs: 8000,
    });
  } finally {
    state.loading = false;
    updateSummary();
  }
}

function renderProductsTable() {
  els.tbody.innerHTML = '';

  if (!state.products.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 6;
    td.textContent =
      state.q && state.q.length >= 3
        ? 'Nenhum produto encontrado para a busca.'
        : 'Nenhum produto listado. Digite ao menos 3 caracteres e clique em Buscar.';
    td.style.textAlign = 'center';
    td.style.padding = '16px';
    tr.appendChild(td);
    els.tbody.appendChild(tr);
    return;
  }

  state.products.forEach((p) => {
    const tr = document.createElement('tr');

    const productId = p.product_id ?? '-';
    const sku = p.sku || '-';
    const description = p.description || '-';
    const active = p.is_active === true;

    // checkbox
    const tdCheck = document.createElement('td');
    const chk = document.createElement('input');
    chk.type = 'checkbox';
    chk.dataset.productId = productId;
    chk.checked = state.selected.has(String(productId));
    chk.addEventListener('change', onToggleProductSelection);
    tdCheck.appendChild(chk);

    // id
    const tdId = document.createElement('td');
    tdId.textContent = productId;

    // sku
    const tdSku = document.createElement('td');
    tdSku.textContent = sku;

    // desc
    const tdDesc = document.createElement('td');
    tdDesc.textContent = description;

    // status badge
    const tdStatus = document.createElement('td');
    const badge = document.createElement('span');
    badge.className = 'pab-status-badge ' + (active ? 'active' : 'inactive');
    badge.innerHTML = active ? '✔️ <span>Ativo</span>' : '❌ <span>Inativo</span>';
    tdStatus.appendChild(badge);

    // action per row
    const tdAction = document.createElement('td');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-toolbar btn-sm';
    btn.textContent = active ? 'Desativar' : 'Ativar';

    btn.addEventListener('click', async () => {
      const ok = await confirmCenterModal({
        title: active ? 'Desativar produto' : 'Ativar produto',
        message: `
          <div>
            Confirmar ação para este produto?
            <br><br>
            <strong>Produto ID:</strong> ${productId}<br>
            <strong>SKU:</strong> ${sku}<br>
            <strong>Descrição:</strong> ${description}
          </div>
        `,
        confirmText: active ? 'Desativar' : 'Ativar',
        cancelText: 'Cancelar',
      });
      if (!ok) return;

      try {
        await safeJson(`${API_BASE}${ROUTES.SET}`, {
          method: 'POST',
          body: JSON.stringify({
            is_active: !active,
            product_ids: [String(productId)],
          }),
        });

        showCenterModal({
          variant: 'success',
          title: 'OK',
          message: active ? 'Produto desativado.' : 'Produto ativado.',
          timeoutMs: 3500,
        });

        // se estava selecionado, mantém selecionado
        await fetchProducts();
      } catch (err) {
        console.error('[PAB] row action error', err);
        showCenterModal({
          variant: 'error',
          title: 'Erro',
          message: 'Falha ao atualizar status do produto. Veja o console.',
          timeoutMs: 7000,
        });
      }
    });

    tdAction.appendChild(btn);

    tr.append(tdCheck, tdId, tdSku, tdDesc, tdStatus, tdAction);
    els.tbody.appendChild(tr);
  });

  // selecionar todos (visíveis)
  const allVisibleIds = $$('#pab-products-body input[type="checkbox"]').map((c) => c.dataset.productId);
  const allSelectedOnPage =
    allVisibleIds.length && allVisibleIds.every((id) => state.selected.has(String(id)));

  els.selectAll.checked = !!allSelectedOnPage;
}

function buildBatchPayloadForOperation() {
  const q = (state.q || '').trim();
  const hasQ = q.length >= 3;

  // modo seleção: opera só IDs
  if (state.selectedMode) {
    return {
      product_ids: Array.from(state.selected),
    };
  }

  // modo filtro: pode operar por q + status
  const payload = {
    status: state.status, // restringe alvo
  };

  if (state.selected.size) {
    // se usuário selecionou algo, prioriza ids
    payload.product_ids = Array.from(state.selected);
    return payload;
  }

  // se não selecionou nada, exige ao menos q (>=3) OU status != all
  if (hasQ) payload.q = q;

  // se status == all e não tem q, é perigoso (mudaria tudo)
  if (!payload.q && (payload.status === 'all')) return null;

  return payload;
}

async function runBatch(op) {
  const isActivate = op === 'activate';
  const route = isActivate ? ROUTES.ACTIVATE : ROUTES.DEACTIVATE;

  const payload = buildBatchPayloadForOperation();
  if (!payload) {
    showCenterModal({
      variant: 'warning',
      title: 'Defina o alvo',
      message: 'Selecione produtos OU informe uma busca (>=3) OU filtre por ativos/inativos (não deixe "Todos").',
      timeoutMs: 7000,
    });
    return;
  }

  // valida seleção quando modo seleção
  if (state.selectedMode && !state.selected.size) {
    showCenterModal({
      variant: 'warning',
      title: 'Nenhum produto selecionado',
      message: 'No modo seleção, você precisa marcar ao menos um produto.',
      timeoutMs: 6000,
    });
    return;
  }

  const targetText =
    payload.product_ids?.length
      ? `${payload.product_ids.length} produto(s) selecionado(s)`
      : `Filtro: status=${payload.status}${payload.q ? `, q="${payload.q}"` : ''}`;

  const proceed = await confirmCenterModal({
    title: isActivate ? 'Ativar em lote' : 'Desativar em lote',
    message: `
      <div>
        Você está prestes a <strong>${isActivate ? 'ATIVAR' : 'DESATIVAR'}</strong> produtos.
        <br><br>
        <strong>Alvo:</strong> ${targetText}
        <br><br>
        Deseja continuar?
      </div>
    `,
    confirmText: isActivate ? 'Ativar' : 'Desativar',
    cancelText: 'Cancelar',
  });
  if (!proceed) return;

  try {
    await safeJson(`${API_BASE}${route}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    state.lastOp = isActivate ? 'Ativação em lote' : 'Desativação em lote';
    updateSummary();

    showCenterModal({
      variant: 'success',
      title: 'Concluído',
      message: isActivate ? 'Produtos ativados com sucesso.' : 'Produtos desativados com sucesso.',
      timeoutMs: 5000,
    });

    await fetchProducts();
  } catch (err) {
    console.error('[PAB] batch error', err);
    showCenterModal({
      variant: 'error',
      title: 'Erro na operação',
      message: 'Falha ao executar a operação em lote. Verifique o backend /api/products-active/batch/*.',
      timeoutMs: 9000,
    });
  }
}

function initEvents() {
  if (!els.searchInput || !els.searchBtn || !els.tbody) {
    console.error('[PAB] Missing required DOM elements.');
    return;
  }

  const debouncedSearch = debounce(() => {
    state.page = 1;
    state.q = (els.searchInput.value || '').trim();
    fetchProducts();
  }, 500);

  els.searchBtn.addEventListener('click', () => {
    state.page = 1;
    state.q = (els.searchInput.value || '').trim();
    fetchProducts();
  });

  els.searchInput.addEventListener('keyup', (ev) => {
    if (ev.key === 'Enter') {
      state.page = 1;
      state.q = (els.searchInput.value || '').trim();
      fetchProducts();
    } else {
      debouncedSearch();
    }
  });

  if (els.selectAll) els.selectAll.addEventListener('change', onToggleSelectAll);

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
      if (!els.nextPage.disabled) {
        state.page += 1;
        fetchProducts();
      }
    });
  }

  if (els.statusFilter) {
    els.statusFilter.addEventListener('change', () => {
      state.status = String(els.statusFilter.value || 'all');
      state.page = 1;
      fetchProducts();
      updateSummary();
    });
  }

  if (els.selectedMode) {
    els.selectedMode.addEventListener('change', () => {
      state.selectedMode = !!els.selectedMode.checked;
      updateSummary();
    });
  }

  if (els.activateBtn) els.activateBtn.addEventListener('click', () => runBatch('activate'));
  if (els.deactivateBtn) els.deactivateBtn.addEventListener('click', () => runBatch('deactivate'));

  // Ctrl+F foca busca
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
    updateSummary();
    await fetchProducts();
  } catch (err) {
    console.error('[PAB] bootstrap error:', err);
    showCenterModal({
      variant: 'error',
      title: 'Inicialização',
      message: 'Falha ao inicializar a tela. Verifique o console do navegador.',
      timeoutMs: 8000,
    });
  }
}

document.addEventListener('DOMContentLoaded', bootstrap);
