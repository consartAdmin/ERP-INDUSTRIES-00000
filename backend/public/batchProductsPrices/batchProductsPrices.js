// ╔══════════════════════════════════════════════════════════════════╗
// ║ batchProductsPrices.js — Reajuste de Preços em Lote (frontend)  ║
// ║ - Lista produtos via /api/products/search                        ║
// ║ - Carrega preço atual via /api/products/:productId/prices        ║
// ║ - Reajusta em lote via /api/products-prices/batch/adjust         ║
// ║ - Upsert em lote via /api/products-prices/batch/upsert           ║
// ╚══════════════════════════════════════════════════════════════════╝

const qs  = (s, el = document) => el.querySelector(s);
const qsa = (s, el = document) => [...el.querySelectorAll(s)];

// -------------------------------------------------------------------
// API base
// -------------------------------------------------------------------
function getApiBase() {
  if (typeof window !== 'undefined' && (window.apiBase || window.API_BASE)) {
    return window.apiBase || window.API_BASE;
  }
  return 'http://localhost:8080';
}
const API_BASE = getApiBase();

async function apiRequest(path, { method = 'GET', body } = {}) {
  const url = `${API_BASE.replace(/\/+$/, '')}${path}`;
  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json?.ok === false) {
      const msg = json?.error || json?.message || `HTTP ${res.status}`;
      console.error('[batchProductsPrices] API error:', method, url, msg, json);
      return { ok: false, error: msg, status: res.status, data: json?.data ?? null };
    }
    return { ok: true, data: json?.data ?? json, status: res.status };
  } catch (err) {
    console.error('[batchProductsPrices] Network error:', method, url, err);
    return { ok: false, error: err.message || 'Erro de rede', status: 0, data: null };
  }
}

// -------------------------------------------------------------------
// Estado da tela
// -------------------------------------------------------------------
const state = {
  page: 1,
  limit: 20,
  total: 0,
  q: '',
  // Set com o **ID interno** do produto (product_id INTEGER)
  selectedProductIds: new Set(),
  currentPriceTable: null,
  lastAdjustRows: 0
};

// -------------------------------------------------------------------
// DOM refs
// -------------------------------------------------------------------
const inputSearch       = qs('#bpp-search-input');
const btnSearch         = qs('#bpp-search-btn');
const chkSelectAll      = qs('#bpp-select-all');
const tbodyProducts     = qs('#bpp-products-body');
const btnPrevPage       = qs('#bpp-prev-page');
const btnNextPage       = qs('#bpp-next-page');
const spanPageInfo      = qs('#bpp-page-info');
const spanSelectedCount = qs('#bpp-selected-count');

const selectPriceTable  = qs('#bpp-price-table');
const selectMode        = qs('#bpp-mode');
const selectOperation   = qs('#bpp-operation');
const fieldOperation    = qs('#bpp-field-operation');
const spanValuePrefix   = qs('#bpp-value-prefix');
const spanValueHint     = qs('#bpp-value-hint');
const inputValue        = qs('#bpp-value');
const btnApplyAdjust    = qs('#bpp-apply-adjust');
const spanStatusAdjust  = qs('#bpp-status-adjust');

const spanSummarySelected = qs('#bpp-summary-selected');
const spanSummaryTable    = qs('#bpp-summary-table');
const spanSummaryRule     = qs('#bpp-summary-rule');
const spanSummaryRows     = qs('#bpp-summary-rows');

const textareaItems     = qs('#bpp-items-textarea');
const btnSendUpsert     = qs('#bpp-send-upsert');
const spanStatusUpsert  = qs('#bpp-status-upsert');
const previewCard       = qs('#bpp-preview-card');
const previewBody       = qs('#bpp-preview-body');

// -------------------------------------------------------------------
// Carregar tabelas de preço
// -------------------------------------------------------------------
async function loadPriceTables() {
  const resp = await apiRequest('/api/prices?active=true&limit=500');
  if (!resp.ok) {
    selectPriceTable.innerHTML = '<option value="">Erro ao carregar tabelas</option>';
    return;
  }

  const rows = resp.data?.rows || resp.data || [];
  if (!rows.length) {
    selectPriceTable.innerHTML = '<option value="">Nenhuma tabela encontrada</option>';
    return;
  }

  selectPriceTable.innerHTML = '<option value="">Selecione...</option>';
  rows.forEach((r) => {
    const id   = r.id ?? r.price_id;
    const name = r.name ?? r.descricao ?? `Tabela ${id}`;
    if (!id) return;
    const opt = document.createElement('option');
    opt.value = String(id);
    opt.textContent = `${id} — ${name}`;
    selectPriceTable.appendChild(opt);
  });
}

// -------------------------------------------------------------------
// UI de modo (percent / amount / set / margin)
// -------------------------------------------------------------------
function refreshModeUI() {
  const mode = selectMode.value || 'percent';

  if (mode === 'percent') {
    fieldOperation.style.display = '';
    spanValuePrefix.textContent  = '%';
    spanValueHint.textContent    = 'Informe apenas o número. Ex: 10 = 10%.';
  } else if (mode === 'amount') {
    fieldOperation.style.display = '';
    spanValuePrefix.textContent  = 'R$';
    spanValueHint.textContent    = 'Informe o valor em reais. Ex: 2 = R$ 2,00.';
  } else if (mode === 'set') {
    fieldOperation.style.display = 'none';
    spanValuePrefix.textContent  = 'R$';
    spanValueHint.textContent    = 'Define diretamente o novo preço de venda.';
  } else if (mode === 'margin') {
    // 🔹 Margem de lucro baseada no custo do produto
    fieldOperation.style.display = 'none';
    spanValuePrefix.textContent  = '%';
    spanValueHint.textContent    =
      'Define o novo preço pela margem de lucro sobre o CUSTO do produto. Ex: 50 = custo + 50%.';
  }
}

// -------------------------------------------------------------------
// Carregar lista de produtos (esquerda)
// -------------------------------------------------------------------
async function loadProducts() {
  const { page, limit, q } = state;

  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('limit', String(limit));
  if (q && q.length >= 3) params.set('q', q);

  const resp = await apiRequest(`/api/products/search?${params.toString()}`);
  if (!resp.ok) {
    console.error('[batchProductsPrices] loadProducts error:', resp.error);
    tbodyProducts.innerHTML = '<tr><td colspan="4">Erro ao carregar produtos.</td></tr>';
    return;
  }

  const data = resp.data?.data ?? resp.data ?? {};
  const rows = data.rows || data || [];
  state.total = data.total ?? rows.length;

  renderProducts(rows);
  updatePagination();
}

// Renderizar grid de produtos
function renderProducts(rows) {
  tbodyProducts.innerHTML = '';

  if (!rows.length) {
    tbodyProducts.innerHTML = '<tr><td colspan="4">Nenhum produto encontrado.</td></tr>';
    return;
  }

  const priceId = state.currentPriceTable ? Number(state.currentPriceTable) : null;

  rows.forEach((r) => {
    // ID interno (INTEGER) usado em todas as APIs de preços
    const internalId = r.product_id ?? r.id;
    const sku  = r.product_code || r.sku || internalId;
    const desc = r.description || r.descricao || '';

    const tr = document.createElement('tr');
    const isChecked = state.selectedProductIds.has(String(internalId));

    tr.innerHTML = `
      <td>
        <input 
          type="checkbox" 
          class="bpp-row-check" 
          data-id="${internalId ?? ''}" 
          data-sku="${sku ?? ''}"
          ${isChecked ? 'checked' : ''}
        />
      </td>
      <td>${sku || ''}</td>
      <td>${desc}</td>
      <td class="bpp-price-cell">-</td>
    `;

    tbodyProducts.appendChild(tr);

    // Carrega preço atual (se tiver tabela selecionada)
    const priceCell = tr.querySelector('.bpp-price-cell');
    if (internalId && priceId) {
      loadPriceForProductAndTable(internalId, priceId, priceCell);
    }
  });

  updateSelectedCountLabel();
}

// Carrega preço atual de um produto para uma tabela específica
async function loadPriceForProductAndTable(productId, priceId, cell) {
  if (!cell || !productId || !Number.isInteger(Number(priceId))) {
    if (cell) cell.textContent = '-';
    return;
  }

  const path = `/api/products/${encodeURIComponent(productId)}/prices`;
  const resp = await apiRequest(path);
  if (!resp.ok) {
    cell.textContent = '-';
    return;
  }

  const rows = resp.data?.rows || resp.data || [];
  const item = rows.find((r) => Number(r.price_id) === Number(priceId));

  if (!item) {
    cell.textContent = '-';
    return;
  }

  const val = item.sale_price != null ? Number(item.sale_price) : null;
  cell.textContent = Number.isFinite(val) ? val.toFixed(2) : '-';
}

// -------------------------------------------------------------------
// Paginação
// -------------------------------------------------------------------
function updatePagination() {
  const { page, limit, total } = state;
  const totalPages = total > 0 ? Math.ceil(total / limit) : 1;

  spanPageInfo.textContent = `Página ${page} de ${totalPages}`;
  btnPrevPage.disabled = page <= 1;
  btnNextPage.disabled = page >= totalPages;
}

// -------------------------------------------------------------------
// Seleção de produtos (usando ID interno)
// -------------------------------------------------------------------
function updateSelectedCountLabel() {
  const count = state.selectedProductIds.size;
  spanSelectedCount.textContent   = String(count);
  spanSummarySelected.textContent = String(count);
}

function handleRowCheckboxChange(e) {
  const chk = e.target.closest('.bpp-row-check');
  if (!chk) return;

  const id  = chk.getAttribute('data-id');
  if (!id) return;

  if (chk.checked) state.selectedProductIds.add(String(id));
  else state.selectedProductIds.delete(String(id));

  updateSelectedCountLabel();
}

function handleSelectAllToggle() {
  const checked = chkSelectAll.checked;
  qsa('.bpp-row-check', tbodyProducts).forEach((chk) => {
    chk.checked = checked;
    const id = chk.getAttribute('data-id');
    if (!id) return;
    if (checked) state.selectedProductIds.add(String(id));
    else state.selectedProductIds.delete(String(id));
  });
  updateSelectedCountLabel();
}

// -------------------------------------------------------------------
// Reajuste em lote
// -------------------------------------------------------------------
async function applyAdjust() {
  spanStatusAdjust.textContent = '';
  spanStatusAdjust.classList.remove('success', 'error');

  const price_id = Number(selectPriceTable.value);
  if (!Number.isInteger(price_id)) {
    spanStatusAdjust.textContent = 'Selecione uma tabela de preço válida.';
    spanStatusAdjust.classList.add('error');
    return;
  }

  const mode  = selectMode.value || 'percent';  // agora pode ser 'margin'
  const op    = selectOperation.value || 'increase';
  const value = Number(String(inputValue.value || '').replace(',', '.'));

  if (!Number.isFinite(value) || isNaN(value)) {
    spanStatusAdjust.textContent = 'Informe um valor numérico válido.';
    spanStatusAdjust.classList.add('error');
    return;
  }

  const product_ids = [...state.selectedProductIds]; // IDs internos
  const payload = { price_id, mode, value };

  if (mode === 'percent' || mode === 'amount') {
    payload.operation = op;
  }
  // modo 'set' e 'margin' não usam operation

  if (product_ids.length) {
    payload.product_ids = product_ids;
  }

  spanStatusAdjust.textContent = 'Aplicando reajuste em lote...';

  const resp = await apiRequest('/api/products-prices/batch/adjust', {
    method: 'POST',
    body: payload
  });

  if (!resp.ok) {
    spanStatusAdjust.textContent = `Erro: ${resp.error}`;
    spanStatusAdjust.classList.add('error');
    return;
  }

  const rows = resp.data?.rows || resp.data || [];
  state.lastAdjustRows = Array.isArray(rows) ? rows.length : 0;

  spanStatusAdjust.textContent = 'Reajuste aplicado com sucesso.';
  spanStatusAdjust.classList.add('success');

  // Atualiza resumo
 const rule =
    mode === 'percent'
      ? `${op === 'decrease' ? 'redução' : 'aumento'} de ${value}%`
      : mode === 'amount'
      ? `${op === 'decrease' ? 'redução' : 'aumento'} de R$ ${value.toFixed(2)}`
      : mode === 'margin'
      ? `margem de lucro alvo: ${value}% (preço = custo ÷ (1 - margem/100))`
      : `definição de preço: R$ ${value.toFixed(2)}`;
      
  spanSummaryTable.textContent = `#${price_id}`;
  spanSummaryRule.textContent  = rule;
  spanSummaryRows.textContent  = String(state.lastAdjustRows);

  // Recarrega lista para refletir novos preços
  state.currentPriceTable = price_id;
  loadProducts();
}

// -------------------------------------------------------------------
// Importação / upsert lote
// -------------------------------------------------------------------
function parseUpsertLines(raw) {
  if (!raw) return [];
  return raw
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => !!l)
    .map((line) => {
      const [skuOrId, priceId, sale, markup, lucro] = line.split(';').map((p) => p.trim());
      const price_id = Number(priceId);
      if (!skuOrId || !Number.isInteger(price_id)) return null;

      const sale_price       = sale   ? Number(String(sale).replace(',', '.'))   : null;
      const markup_percent   = markup ? Number(String(markup).replace(',', '.')) : null;
      const gross_profit_pct = lucro  ? Number(String(lucro).replace(',', '.'))  : null;

      return {
        product_id: skuOrId, // aqui você pode usar o mesmo valor que a tabela productsPrices espera
        price_id,
        sale_price:       Number.isFinite(sale_price)       ? sale_price       : null,
        markup_percent:   Number.isFinite(markup_percent)   ? markup_percent   : null,
        gross_profit_pct: Number.isFinite(gross_profit_pct) ? gross_profit_pct : null
      };
    })
    .filter(Boolean);
}

function renderUpsertPreview(items) {
  if (!items.length) {
    previewCard.hidden = true;
    previewBody.innerHTML = '';
    return;
  }
  previewBody.innerHTML = '';
  items.forEach((it) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${it.product_id}</td>
      <td>${it.price_id}</td>
      <td>${it.sale_price ?? ''}</td>
      <td>${it.markup_percent ?? ''}</td>
      <td>${it.gross_profit_pct ?? ''}</td>
    `;
    previewBody.appendChild(tr);
  });
  previewCard.hidden = false;
}

async function handleUpsert() {
  spanStatusUpsert.textContent = '';
  spanStatusUpsert.classList.remove('success', 'error');

  const raw   = textareaItems.value;
  const items = parseUpsertLines(raw);

  if (!items.length) {
    spanStatusUpsert.textContent = 'Nenhuma linha válida encontrada.';
    spanStatusUpsert.classList.add('error');
    renderUpsertPreview([]);
    return;
  }

  renderUpsertPreview(items);
  spanStatusUpsert.textContent = `Enviando ${items.length} item(ns)...`;

  const resp = await apiRequest('/api/products-prices/batch/upsert', {
    method: 'POST',
    body: { items }
  });

  if (!resp.ok) {
    spanStatusUpsert.textContent = `Erro: ${resp.error}`;
    spanStatusUpsert.classList.add('error');
    return;
  }

  const rows = resp.data?.rows || resp.data || [];
  spanStatusUpsert.textContent =
    `Lote processado com sucesso. Linhas afetadas: ${rows.length}.`;
  spanStatusUpsert.classList.add('success');
}

// -------------------------------------------------------------------
// Event listeners
// -------------------------------------------------------------------
function setupEvents() {
  if (btnSearch) {
    btnSearch.addEventListener('click', () => {
      const q = (inputSearch.value || '').trim();
      state.q = q;
      state.page = 1;
      loadProducts();
    });
  }

  if (inputSearch) {
    inputSearch.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const q = (inputSearch.value || '').trim();
        state.q = q;
        state.page = 1;
        loadProducts();
      }
    });
  }

  if (btnPrevPage) {
    btnPrevPage.addEventListener('click', () => {
      if (state.page > 1) {
        state.page -= 1;
        loadProducts();
      }
    });
  }

  if (btnNextPage) {
    btnNextPage.addEventListener('click', () => {
      state.page += 1;
      loadProducts();
    });
  }

  if (tbodyProducts) {
    tbodyProducts.addEventListener('change', handleRowCheckboxChange);
  }

  if (chkSelectAll) {
    chkSelectAll.addEventListener('change', handleSelectAllToggle);
  }

  if (selectMode) {
    selectMode.addEventListener('change', refreshModeUI);
  }

  if (selectPriceTable) {
    selectPriceTable.addEventListener('change', () => {
      state.currentPriceTable = selectPriceTable.value || null;
      loadProducts();
    });
  }

  if (btnApplyAdjust) {
    btnApplyAdjust.addEventListener('click', applyAdjust);
  }

  if (btnSendUpsert) {
    btnSendUpsert.addEventListener('click', handleUpsert);
  }
}

// -------------------------------------------------------------------
// Init
// -------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  loadPriceTables();
  refreshModeUI();
  loadProducts();
  setupEvents();
});
