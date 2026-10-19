// ╔══════════════════════════════════════════════════════════════════════╗
// ║ createProduct.js — Criar Produto (Geral + Preços + Fiscal + Unidades) ║
// ║ PRODNEX ERP — ESM, baseado no editProducts.js                         ║
// ║ ✅ product_code manual opcional; vazio usa geração automática no banco  ║
// ║ ✅ Cria produto via POST (sem exigir SKU) e libera as demais abas      ║
// ║ ✅ Preenche #produtoId (readonly) após criar                           ║
// ║ ✅ Tabelas de preço: render + cálculos + salvar                         ║
// ║ ✅ Fiscal: vincular classificação via modal                             ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { showCenterModal } from '/public/includes/js/centerAlertModal.js';
import { openFiscalClassificationModal } from '/public/modalsSearch/fiscalClassificationModalSearch.js';
import { openProductsModalSearch } from '/public/modalsSearch/productsModalSearch.js';

// ////////////////////////////
// CONFIG / ROTAS
// ////////////////////////////
function getApiBase() {
  try {
    if (typeof window !== 'undefined' && window.getApiBase) {
      return window.getApiBase();
    }
  } catch (err) {
    console.error('[createProduct] Erro ao obter API base:', err);
  }
  return 'http://localhost:8080';
}
const API_BASE = getApiBase();

const ROUTES = Object.freeze({
  // Products
  products: `${API_BASE}/api/products`,
  productByCode: (productCode) => `${API_BASE}/api/products/${encodeURIComponent(productCode)}`,

  // Cadastros auxiliares
  groups: [
    `${API_BASE}/api/products-groups`,
    `${API_BASE}/api/productsGroups`,
  ],
  subgroups: [
    `${API_BASE}/api/products-subgroups`,
    `${API_BASE}/api/productsSubgroups`,
  ],
  // Obs.: /api/products-manufacturers é atendida antes pela tabela legada "productsManufactures" (vazia).
  fabricantes: `${API_BASE}/api/manufacturers`,
  // Obs.: /api/products-suppliers é a tabela de vínculo produto x fornecedor, não o cadastro.
  fornecedores: `${API_BASE}/api/suppliers`,
  localizacoes: [
    `${API_BASE}/api/product-locations`,
    `${API_BASE}/api/products-locations`,
    `${API_BASE}/api/localizacoes`,
  ],

  // Fiscal
  fiscalClassification: `${API_BASE}/api/fiscalClassification`,
  fiscalClassificationAlt: `${API_BASE}/api/fiscal-classification`,
  fiscalProfile: `${API_BASE}/api/fiscalProfile`,
  fiscalProfileAlt: `${API_BASE}/api/fiscal-profile`,
  productsFiscalV2: `${API_BASE}/api/v2/products-fiscal`,

  // Units / productsUnits (reservado p/ quando você colar o bloco de unidades)
  units: `${API_BASE}/api/units`,
  productUnitsList: (pid) => [
    `${API_BASE}/api/products-units?product_id=${encodeURIComponent(pid)}&limit=200`,
    `${API_BASE}/api/productsUnits?product_id=${encodeURIComponent(pid)}&limit=200`,
  ],
  productUnitsUpsert: [
    `${API_BASE}/api/products-units/upsert`,
    `${API_BASE}/api/products-units`,
    `${API_BASE}/api/productsUnits/upsert`,
    `${API_BASE}/api/productsUnits`,
  ],
  productUnitById: (id) => [
    `${API_BASE}/api/products-units/${encodeURIComponent(id)}`,
    `${API_BASE}/api/productsUnits/${encodeURIComponent(id)}`,
  ],

  // Preços
  priceTables: [
    `${API_BASE}/api/prices`,
    `${API_BASE}/api/priceTables`,
    `${API_BASE}/api/tabela-precos`,
    `${API_BASE}/api/tabela_cadastro_precos`,
  ],
  productPrices: (productId) => [
    `${API_BASE}/api/products/${encodeURIComponent(productId)}/prices`,
    `${API_BASE}/api/productsPrices/${encodeURIComponent(productId)}`,
    `${API_BASE}/api/productsPrices?productId=${encodeURIComponent(productId)}`,
  ],
  upsertPrices: (productId) => [
    { url: `${API_BASE}/api/products/${encodeURIComponent(productId)}/prices`, body: (pid, prices) => ({ prices }) },
    { url: `${API_BASE}/api/productsPrices/upsert`, body: (pid, prices) => ({ productId: pid, prices }) },
  ],

  // Grades (reservado p/ quando você colar o bloco grades)
  gradesCandidates: [
    `${API_BASE}/api/grades`,
    `${API_BASE}/api/grades/list`,
    `${API_BASE}/api/grades/catalog`,
    `${API_BASE}/api/catalog/grades`,
    `${API_BASE}/api/product-grades/grades`,
    `${API_BASE}/api/products-grades/grades`,
    `${API_BASE}/api/productsGrades/grades`,
  ],
  productGradesList: (pid) => [
    `${API_BASE}/api/products-grades?product_id=${encodeURIComponent(pid)}&limit=500`,
    `${API_BASE}/api/productsGrades?product_id=${encodeURIComponent(pid)}&limit=500`,
    `${API_BASE}/api/products-grades/by-product/${encodeURIComponent(pid)}`,
    `${API_BASE}/api/productsGrades/by-product/${encodeURIComponent(pid)}`,
    `${API_BASE}/api/products/${encodeURIComponent(pid)}/grades`,
  ],
  productGradesCreate: [
    `${API_BASE}/api/products-grades`,
    `${API_BASE}/api/productsGrades`,
  ],
  productGradeById: (id) => [
    `${API_BASE}/api/products-grades/${encodeURIComponent(id)}`,
    `${API_BASE}/api/productsGrades/${encodeURIComponent(id)}`,
  ],

  // Stock (compat) reservado
  productsStock: `${API_BASE}/api/productsStock`,
  productsStockAlt: `${API_BASE}/api/products-stock`,
  productStockById: (id) => [
    `${API_BASE}/api/productsStock/${encodeURIComponent(id)}`,
    `${API_BASE}/api/products-stock/${encodeURIComponent(id)}`,
  ],
  productStockByProduct: (pid) => [
    `${API_BASE}/api/products/${encodeURIComponent(pid)}/stock`,
    `${API_BASE}/api/productsStock/by-product/${encodeURIComponent(pid)}`,
    `${API_BASE}/api/products-stock/by-product/${encodeURIComponent(pid)}`,
    `${API_BASE}/api/productsStock?product_id=${encodeURIComponent(pid)}`,
    `${API_BASE}/api/products-stock?product_id=${encodeURIComponent(pid)}`,
  ],
});

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

// ////////////////////////////
// UI helpers
// ////////////////////////////
function toast(message, type = 'info', title) {
  const map = { info: 'info', success: 'success', warning: 'warning', error: 'error' };
  const variant = map[type] || 'info';
  const defaultTitle =
    variant === 'success' ? 'Tudo certo!'
      : variant === 'warning' ? 'Atenção'
        : variant === 'error' ? 'Ocorreu um erro'
          : 'Informação';

  showCenterModal({
    variant,
    title: title ?? defaultTitle,
    message: String(message ?? ''),
    timeoutMs: (variant === 'success' || variant === 'info') ? 4500 : null,
    okText: 'OK',
    closeText: 'Fechar',
  });
}

async function jfetch(url, opts = {}) {
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...opts });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.ok === false) {
    const msg = json?.error || json?.message || `${res.status} ${res.statusText}`;
    throw new Error(msg);
  }
  return json;
}

const Num = {
  parse(str) {
    if (str == null) return null;
    if (typeof str === 'number') return Number.isFinite(str) ? str : null;
    const s = String(str)
      .replace(/\s+/g, '')
      .replace(/(?<=\d)[. ](?=\d{3}([,.]|$))/g, '')
      .replace(/,/g, '.');
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  },
  toNumOrNull(v) { return this.parse(v); },
  formatBR(v, dec = 2) {
    const n = Number(v);
    if (!Number.isFinite(n)) return '';
    return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(n);
  },
};

function extractRows(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.rows)) return data.rows;
  if (data.data) {
    const inner = data.data;
    if (Array.isArray(inner)) return inner;
    if (Array.isArray(inner.rows)) return inner.rows;
    if (Array.isArray(inner.results)) return inner.results;
    for (const key of Object.keys(inner)) {
      if (Array.isArray(inner[key])) return inner[key];
    }
  }
  if (Array.isArray(data.results)) return data.results;
  for (const key of Object.keys(data)) {
    if (Array.isArray(data[key])) return data[key];
  }
  return [];
}

// ////////////////////////////
// ABAS
// ////////////////////////////
function initTabs({
  tabButtonsSelector = '.tab',
  panelSelector = '.tab-panel',
  activeClass = 'is-active',
  defaultPanelId = 'aba-geral',
} = {}) {
  const buttons = $$(tabButtonsSelector);
  const panels = $$(panelSelector);

  if (!buttons.length || !panels.length) {
    console.warn('[createProduct] Botões ou painéis de abas não encontrados.');
    return null;
  }

  function activate(panelId, pushState = true) {
    const targetPanel = document.getElementById(panelId);
    const targetButton = buttons.find(
      (button) => button.dataset.tab === panelId
    );

    if (!targetPanel || !targetButton) {
      console.warn(`[createProduct] Aba não encontrada: ${panelId}`);
      return;
    }

    if (targetButton.disabled) {
      return;
    }

    buttons.forEach((button) => {
      const active = button === targetButton;

      button.classList.toggle(activeClass, active);
      button.setAttribute(
        'aria-selected',
        active ? 'true' : 'false'
      );
      button.tabIndex = active ? 0 : -1;
    });

    panels.forEach((panel) => {
      const active = panel === targetPanel;

      panel.classList.toggle(activeClass, active);
      panel.setAttribute(
        'aria-hidden',
        active ? 'false' : 'true'
      );
    });

    if (pushState) {
      const url = new URL(window.location.href);

      url.searchParams.set(
        'tab',
        panelId.replace(/^aba-/, '')
      );

      history.replaceState(null, '', url.toString());
    }
  }

  buttons.forEach((button) => {
    button.addEventListener('click', () => {
      const panelId = button.dataset.tab;

      if (panelId) {
        activate(panelId);
      }
    });
  });

  const params = new URLSearchParams(window.location.search);
  const tabParam = params.get('tab');
  const requestedPanelId = tabParam
    ? `aba-${tabParam}`
    : defaultPanelId;

  const requestedButton = buttons.find(
    (button) => button.dataset.tab === requestedPanelId
  );

  const startPanelId =
    requestedButton &&
      !requestedButton.disabled &&
      document.getElementById(requestedPanelId)
      ? requestedPanelId
      : defaultPanelId;

  activate(startPanelId, false);

  return { activate };
}

// ////////////////////////////
// FIELDS (IDs do HTML)
// ////////////////////////////
const FIELDS = {
  // gerais
  product_code: '#produtoId',
  description: '#descricao',
  barcode: '#codigoBarras',
  manufacturer_ref: '#refFabricante',

  product_group_id: '#product_group_id',
  product_subgroup_id: '#product_subgroup_id',
  manufacturer_id: '#manufacturer_id',
  supplier_id: '#supplier_id',
  product_location_id: '#product_location_id',

  width_cm: '#largura',
  length_cm: '#comprimento',
  height_cm: '#altura',
  weight_kg: '#peso',

  // preços
  cost_price: '#cost_price',
  prices_tbody: '#corpoTabelaPrecos',
  form_prices: '#formPrecos',

  // fiscal
  products_fiscal_id: '#products_fiscal_id',
  form_fiscal: '#formFiscal',
  btn_save_fiscal: '#btnSalvarFiscal',
  btn_open_class_modal: '#btnVincularClassificacaoFiscal',

  // forms
  form_geral: '#formDadosGerais',
  btn_save_geral: '#btnSalvarDadosGerais',
  btn_copy_product: '#btnCopiarProduto',
};

const ACTIVE_SELECTOR = '#produtoAtivo';

const getEl = (s) => (s ? $(s) : null);
const getVal = (s) => (getEl(s)?.value ?? '');
const setVal = (s, v) => { const el = getEl(s); if (el) el.value = v ?? ''; };

const getChecked = (sel, fallback = true) => {
  const el = getEl(sel);
  if (!el) return fallback;
  return !!el.checked;
};
const setChecked = (sel, value) => {
  const el = getEl(sel);
  if (!el) return;
  el.checked = !!value;
};

// ////////////////////////////
// Combos
// ////////////////////////////
async function fillSelect(urlOrList, selectSelector, { idKey = 'id', textKey = 'name', placeholder = 'Selecione...' } = {}) {
  const sel = getEl(selectSelector);
  if (!sel) return;

  const urls = Array.isArray(urlOrList) ? urlOrList : [urlOrList];

  let data = null;
  let lastErr = null;

  for (const u of urls) {
    if (!u) continue;
    try {
      data = await jfetch(u);
      break;
    } catch (err) {
      lastErr = err;
      const msg = String(err?.message || '').toLowerCase();
      if (msg.includes('404') || msg.includes('not found')) continue;
      break;
    }
  }

  if (!data) {
    console.warn(`⚠️ Nenhum endpoint válido para ${selectSelector}. Último erro:`, lastErr?.message || lastErr);
    return;
  }

  const rows = extractRows(data);
  sel.innerHTML = `<option value="">${placeholder}</option>`;
  rows.forEach((r) => {
    const opt = document.createElement('option');
    opt.value = r[idKey] ?? r.product_group_id ?? r.product_subgroup_id ?? r.id;
    opt.textContent = r[textKey] ?? r.name ?? r.nome ?? `#${opt.value}`;
    sel.appendChild(opt);
  });
}

// Busca TODAS as páginas de uma API paginada por page/limit
// (/api/suppliers: limit máx. 200 | /api/manufacturers: limit máx. 500)
async function fetchAllByPage(baseUrl, { pageSize = 200, maxPages = 150, query = '' } = {}) {
  const out = [];
  const sep = baseUrl.includes('?') ? '&' : '?';

  for (let page = 1; page <= maxPages; page++) {
    const data = await jfetch(`${baseUrl}${sep}page=${page}&limit=${pageSize}${query ? `&${query}` : ''}`);
    const rows = extractRows(data);
    out.push(...rows);

    const total = Number(data?.data?.total ?? data?.total ?? 0);
    if (rows.length < pageSize || (total && out.length >= total)) break;
  }

  return out;
}

async function fillSelectAllPages(url, selectSelector, { pageSize, query, idKey, textKeys, placeholder }) {
  const sel = getEl(selectSelector);
  if (!sel) return;

  let rows = [];
  try {
    rows = await fetchAllByPage(url, { pageSize, query });
  } catch (err) {
    console.warn(`⚠️ Falha ao carregar ${selectSelector}:`, err?.message || err);
  }

  sel.innerHTML = `<option value="">${placeholder}</option>`;
  rows.forEach((r) => {
    const id = r[idKey] ?? r.id;
    if (id == null) return;
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = textKeys.map((k) => r[k]).find((v) => v != null && v !== '') ?? `#${id}`;
    sel.appendChild(opt);
  });
}

function setupGroupSubgroupLink(groupSel = FIELDS.product_group_id, subSel = FIELDS.product_subgroup_id) {
  const grp = getEl(groupSel);
  const sub = getEl(subSel);
  if (!grp || !sub) return;

  sub.disabled = true;
  sub.innerHTML = '<option value="">Selecione um grupo primeiro...</option>';

  grp.addEventListener('change', async () => {
    const groupId = Number(grp.value);

    sub.innerHTML = '<option value="">Carregando...</option>';
    sub.disabled = true;

    if (!groupId) {
      sub.innerHTML = '<option value="">Selecione um grupo primeiro...</option>';
      return;
    }

    try {
      const urls = ROUTES.subgroups.map(u => `${u}?group_id=${groupId}`);
      let rows = [];
      for (const u of urls) {
        try {
          const resp = await jfetch(u);
          rows = extractRows(resp);
          if (rows.length) break;
        } catch (_) { /* tenta próximo */ }
      }

      sub.innerHTML = '<option value="">Selecione...</option>';

      if (!rows.length) {
        sub.innerHTML = '<option value="">Nenhum subgrupo encontrado</option>';
        return;
      }

      rows.forEach(r => {
        const id = r.product_subgroup_id ?? r.id;
        const name = r.name ?? r.nome ?? `Subgrupo #${id}`;
        const opt = document.createElement('option');
        opt.value = id;
        opt.textContent = name;
        sub.appendChild(opt);
      });

      sub.disabled = false;
    } catch (err) {
      sub.innerHTML = '<option value="">Erro ao carregar subgrupos</option>';
      console.error('Erro (grupo→subgrupo):', err);
    }
  });
}

async function carregarCombos() {
  await Promise.all([
    fillSelect(ROUTES.groups, FIELDS.product_group_id, { idKey: 'product_group_id', textKey: 'name' }),
    fillSelect(ROUTES.subgroups, FIELDS.product_subgroup_id, { idKey: 'product_subgroup_id', textKey: 'name' }),
    fillSelect(ROUTES.localizacoes, FIELDS.product_location_id, { idKey: 'id', textKey: 'nome' }),
    fillSelectAllPages(ROUTES.fabricantes, FIELDS.manufacturer_id, {
      pageSize: 500,
      query: 'sort=trade_name&dir=asc',
      idKey: 'manufacturer_id',
      textKeys: ['trade_name', 'corporate_name', 'name'],
      placeholder: '— Selecione um fabricante —',
    }),
    fillSelectAllPages(ROUTES.fornecedores, FIELDS.supplier_id, {
      pageSize: 200,
      query: 'sort=name&dir=asc',
      idKey: 'supplier_id',
      textKeys: ['name', 'company_name', 'trading_name', 'fantasy_name'],
      placeholder: '— Selecione um fornecedor —',
    }),
  ]);
}

// ////////////////////////////
// CREATE product (SKU manual opcional; vazio = geração automática)
// ////////////////////////////
function coletarFormularioCreate() {
  const n = (v) => Num.toNumOrNull(v);
  const productCode = String(getVal(FIELDS.product_code) ?? '').trim();

  const payload = {
    description: getVal(FIELDS.description)?.trim(),
    barcode: getVal(FIELDS.barcode)?.trim() || null,
    manufacturer_ref: getVal(FIELDS.manufacturer_ref)?.trim() || null,

    product_group_id: n(getVal(FIELDS.product_group_id)),
    product_subgroup_id: n(getVal(FIELDS.product_subgroup_id)),
    manufacturer_id: n(getVal(FIELDS.manufacturer_id)),
    supplier_id: n(getVal(FIELDS.supplier_id)),
    product_location_id: n(getVal(FIELDS.product_location_id)),

    width_cm: n(getVal(FIELDS.width_cm)),
    length_cm: n(getVal(FIELDS.length_cm)),
    height_cm: n(getVal(FIELDS.height_cm)),
    weight_kg: n(getVal(FIELDS.weight_kg)),

    cost_price: n(getVal(FIELDS.cost_price)),
    is_active: getChecked(ACTIVE_SELECTOR, true),
  };

  // O controller aceita product_code como texto. Se estiver vazio, omitimos a
  // propriedade e o trigger do PostgreSQL mantém a geração automática.
  if (productCode) payload.product_code = productCode;

  return payload;
}

function normalizeCreatedProduct(resp) {
  // aceita vários formatos de retorno
  const raw = resp?.data ?? resp;
  const p = raw?.data ?? raw;

  const product_id = p?.product_id ?? p?.id ?? raw?.product_id ?? raw?.id ?? null;
  const product_code = p?.product_code ?? p?.sku ?? raw?.product_code ?? raw?.sku ?? null;

  return {
    product_id: product_id != null ? String(product_id) : null,
    product_code: product_code != null ? String(product_code) : null,
    raw: p,
  };
}

async function createProduct(payload) {
  return jfetch(ROUTES.products, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

function normalizeProductCode(value) {
  const code = String(value ?? '').trim();
  if (/^\d+$/.test(code)) return code.replace(/^0+(?=\d)/, '');
  return code.toUpperCase();
}

function isSameProductCode(left, right) {
  const a = normalizeProductCode(left);
  const b = normalizeProductCode(right);
  return Boolean(a) && a === b;
}

// Mesma estratégia de resolução do editProducts: SKU direto, busca e fallback da seleção.
async function getProductByCode(productCode, selectedProduct = null) {
  const code = String(productCode ?? '').trim();
  if (!code) throw new Error('product_code inválido para importação.');

  try {
    return await jfetch(ROUTES.productByCode(code));
  } catch (directError) {
    const candidates = [
      `${ROUTES.products}/search?q=${encodeURIComponent(code)}&limit=20&page=1`,
      `${ROUTES.products}?q=${encodeURIComponent(code)}&limit=20&page=1`,
    ];

    for (const url of candidates) {
      try {
        const rows = extractRows(await jfetch(url));
        const match = rows.find((row) => isSameProductCode(
          row?.product_code ?? row?.sku ?? row?.codigo,
          code,
        ));
        if (match) return match;
      } catch (_) { /* tenta o próximo endpoint */ }
    }

    const selectedCode =
      selectedProduct?.product_code ??
      selectedProduct?.sku ??
      selectedProduct?.codigo ??
      selectedProduct?.code;
    if (selectedProduct && isSameProductCode(selectedCode, code)) return selectedProduct;

    throw directError;
  }
}

async function updateProduct(productCode, payload) {
  const code = String(productCode ?? '').trim();
  if (!code) throw new Error('product_code inválido para atualização.');

  return jfetch(ROUTES.productByCode(code), {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

// ////////////////////////////
// Tabs guard
// ////////////////////////////
function disableDependentTabs(disabled) {
  $$('.tab').forEach((button) => {
    const panelId = button.dataset.tab;

    if (!panelId || panelId === 'aba-geral') {
      return;
    }

    button.disabled = Boolean(disabled);
    button.setAttribute(
      'aria-disabled',
      disabled ? 'true' : 'false'
    );
  });
}

// ////////////////////////////
// PRICE API (igual ao edit)
// ////////////////////////////
const PriceApi = (() => {
  async function tryFetch(urls, opts) {
    let lastErr;
    for (const u of urls) {
      try { return await jfetch(u, opts); } catch (err) { lastErr = err; }
    }
    throw lastErr || new Error('Endpoints de preços indisponíveis');
  }

  async function listTables() {
    const resp = await tryFetch(ROUTES.priceTables);
    const rows = extractRows(resp);

    const mapped = rows.map((r) => ({
      id: Number(r.price_id ?? r.id ?? r.tabela_preco_id),
      name: r.name ?? r.nome ?? r.descricao ?? `Tabela ${r.price_id ?? r.id ?? ''}`,
      description: r.description ?? r.descricao ?? null,
      active: typeof r.active === 'boolean' ? r.active : (r.ativo ?? true),
    })).filter((t) => Number.isInteger(t.id));

    mapped.sort((a, b) => a.id - b.id);
    return mapped;
  }

  async function getPricesByProduct(productId) {
    const resp = await tryFetch(ROUTES.productPrices(productId));
    const rows = extractRows(resp);

    return rows.map((r) => ({
      price_id: Number(r.price_id ?? r.tabela_preco_id),
      sale_price: Num.toNumOrNull(r.sale_price ?? r.preco_venda),
      markup_percent: Num.toNumOrNull(r.markup_percent),
      gross_profit_pct: Num.toNumOrNull(r.gross_profit_pct),
    })).filter((p) => Number.isInteger(p.price_id));
  }

  async function upsert(productId, prices) {
    let lastErr;
    for (const cand of ROUTES.upsertPrices(productId)) {
      try {
        const body = cand.body(productId, prices);
        const resp = await jfetch(cand.url, { method: 'POST', body: JSON.stringify(body) });
        return resp?.data ?? resp;
      } catch (err) { lastErr = err; }
    }
    throw lastErr || new Error('Não foi possível salvar preços');
  }

  return { listTables, getPricesByProduct, upsert };
})();

function renderPriceRows(tables = [], prices = []) {
  const tbody = getEl(FIELDS.prices_tbody);
  if (!tbody) return;

  const byId = new Map(prices.map((p) => [Number(p.price_id), p]));
  tbody.innerHTML = '';

  tables.forEach((t) => {
    const current = byId.get(Number(t.id)) || {};
    const tr = document.createElement('tr');
    tr.dataset.priceId = String(t.id);

    tr.innerHTML = `
      <td><strong>${t.name ?? `Tabela ${t.id}`}</strong></td>
      <td><input type="text" inputmode="decimal" class="inp-markup" value="${Num.formatBR(current.markup_percent ?? '')}" /></td>
      <td><input type="text" inputmode="decimal" class="inp-gross"  value="${Num.formatBR(current.gross_profit_pct ?? '')}" /></td>
      <td><input type="text" inputmode="decimal" class="inp-sale"   value="${Num.formatBR(current.sale_price ?? '')}" /></td>
    `;
    tbody.appendChild(tr);
  });
}

function collectPriceRows() {
  const tbody = getEl(FIELDS.prices_tbody);
  if (!tbody) return [];
  return Array.from(tbody.querySelectorAll('tr'))
    .map((tr) => {
      const price_id = Number(tr.dataset.priceId);
      const markup_percent = Num.toNumOrNull(tr.querySelector('.inp-markup')?.value);
      const gross_profit_pct = Num.toNumOrNull(tr.querySelector('.inp-gross')?.value);
      const sale_price = Num.toNumOrNull(tr.querySelector('.inp-sale')?.value);
      return { price_id, markup_percent, gross_profit_pct, sale_price };
    })
    .filter((r) => Number.isInteger(r.price_id));
}

function calcularValoresAutomaticamente(tr, campoAlterado, { formatEdited = false } = {}) {
  const custo = Num.toNumOrNull($(FIELDS.cost_price)?.value);
  if (custo == null || !isFinite(custo) || custo <= 0) return;

  const inpMarkup = tr.querySelector('.inp-markup');
  const inpLucro = tr.querySelector('.inp-gross');
  const inpVenda = tr.querySelector('.inp-sale');

  let markup = Num.toNumOrNull(inpMarkup.value);
  let lucro = Num.toNumOrNull(inpLucro.value);
  let venda = Num.toNumOrNull(inpVenda.value);

  if (campoAlterado === 'markup' && markup != null) {
    venda = custo * (1 + markup / 100);
    if (venda > 0) lucro = ((venda - custo) / venda) * 100;
    if (!Number.isNaN(lucro)) inpLucro.value = Num.formatBR(lucro);
    if (!Number.isNaN(venda)) inpVenda.value = Num.formatBR(venda);
    if (formatEdited && !Number.isNaN(markup)) inpMarkup.value = Num.formatBR(markup);
  } else if (campoAlterado === 'lucro' && lucro != null && Math.abs(1 - lucro / 100) > 1e-9) {
    const denom = 1 - lucro / 100; if (Math.abs(denom) < 1e-9) return;
    venda = custo / denom;
    markup = ((venda / custo) - 1) * 100;
    if (!Number.isNaN(markup)) inpMarkup.value = Num.formatBR(markup);
    if (!Number.isNaN(venda)) inpVenda.value = Num.formatBR(venda);
    if (formatEdited && !Number.isNaN(lucro)) inpLucro.value = Num.formatBR(lucro);
  } else if (campoAlterado === 'venda' && venda != null && venda > 0) {
    markup = ((venda / custo) - 1) * 100;
    lucro = ((venda - custo) / venda) * 100;
    if (!Number.isNaN(markup)) inpMarkup.value = Num.formatBR(markup);
    if (!Number.isNaN(lucro)) inpLucro.value = Num.formatBR(lucro);
    if (formatEdited && !Number.isNaN(venda)) inpVenda.value = Num.formatBR(venda);
  }
}

function attachPriceListeners() {
  const tbodySel = FIELDS.prices_tbody;

  $(tbodySel)?.addEventListener('input', (e) => {
    const tr = e.target.closest('tr'); if (!tr || !(e.target instanceof HTMLInputElement)) return;
    if (e.target.classList.contains('inp-markup')) calcularValoresAutomaticamente(tr, 'markup', { formatEdited: false });
    else if (e.target.classList.contains('inp-gross')) calcularValoresAutomaticamente(tr, 'lucro', { formatEdited: false });
    else if (e.target.classList.contains('inp-sale')) calcularValoresAutomaticamente(tr, 'venda', { formatEdited: false });
  });

  $(tbodySel)?.addEventListener('blur', (e) => {
    if (!(e.target instanceof HTMLInputElement)) return;
    if (!e.target.matches('.inp-markup, .inp-gross, .inp-sale')) return;
    const tr = e.target.closest('tr'); if (!tr) return;
    if (e.target.classList.contains('inp-markup')) calcularValoresAutomaticamente(tr, 'markup', { formatEdited: true });
    else if (e.target.classList.contains('inp-gross')) calcularValoresAutomaticamente(tr, 'lucro', { formatEdited: true });
    else if (e.target.classList.contains('inp-sale')) calcularValoresAutomaticamente(tr, 'venda', { formatEdited: true });
  }, true);
}

async function salvarTabelaPrecos(productId) {
  try {
    const rows = collectPriceRows();
    if (!rows.length) { toast('Nenhuma linha para salvar.', 'error'); return; }
    await PriceApi.upsert(productId, rows);
    toast('✅ Tabela de preços salva!', 'success');
  } catch (err) {
    console.error('save prices error:', err);
    toast(`❌ Falha ao salvar preços: ${err.message}`, 'error');
  }
}

// ////////////////////////////
// Fiscal — vincular via modal
// ////////////////////////////
async function openFiscalClassificationModalPromise({ productId, apiBase = '' } = {}) {
  return new Promise((resolve) => {
    if (typeof openFiscalClassificationModal !== 'function') {
      console.error('[createProduct] openFiscalClassificationModal não está disponível');
      resolve(null);
      return;
    }
    openFiscalClassificationModal({
      apiBase,
      context: 'create-product',
      productId,
      onPick: (data) => resolve(data || null),
      onClose: () => resolve(null),
    });
  });
}

async function vincularClassificacaoFiscal(productCode) {
  try {
    const code = String(productCode ?? '').trim();
    if (!code) throw new Error('product_code inválido para vínculo fiscal.');

    const escolha = await openFiscalClassificationModalPromise({
      productId: __createdProductId,
      apiBase: '',
    });
    if (!escolha) return;

    const toIntOrNull = (v) => {
      const n = Number(v);
      return Number.isInteger(n) ? n : null;
    };

    const classificationId =
      toIntOrNull(escolha.fiscal_classification_id ?? escolha.classification_id ?? escolha.id);
    if (!classificationId) {
      toast('Não foi possível identificar a Classificação Fiscal selecionada.', 'error');
      return;
    }

    await jfetch(`${ROUTES.productsFiscalV2}/current`, {
      method: 'PUT',
      body: JSON.stringify({
        product_code: code,
        fiscal_classification_id: classificationId,
        source_system: 'createProduct',
        source_reference: `createProduct:${code}`,
      }),
    });

    toast('✅ Fiscal vinculado!', 'success');
  } catch (err) {
    console.error('Erro ao vincular fiscal:', err);
    toast(`❌ Falha ao vincular fiscal: ${err.message}`, 'error');
  }
}

// ////////////////////////////
// BOOTSTRAP
// ////////////////////////////
let __createdProductId = null;
let __createdProductCode = null;
let __copySource = null;

async function fetchFirstAvailable(urls) {
  let lastError;
  for (const url of urls) {
    if (!url) continue;
    try { return await jfetch(url); }
    catch (error) { lastError = error; }
  }
  throw lastError || new Error('Nenhum endpoint disponível.');
}

async function postFirstAvailable(urls, payload) {
  let lastError;
  for (const url of urls) {
    if (!url) continue;
    try {
      return await jfetch(url, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    } catch (error) { lastError = error; }
  }
  throw lastError || new Error('Nenhum endpoint disponível para gravação.');
}

function buildCopiedUnitBarcode(productCode, unitId, factor) {
  const digits = (value) => String(value ?? '').replace(/\D+/g, '');
  const sku = digits(productCode).padStart(6, '0').slice(-6);
  const unit = digits(unitId).padStart(2, '0').slice(-2);
  const scaledFactor = Math.round((Num.toNumOrNull(factor) || 1) * 10);
  const base12 = `2${sku}${unit}${String(scaledFactor).padStart(3, '0').slice(-3)}`;
  let sum = 0;
  for (let index = 0; index < 12; index += 1) {
    sum += Number(base12[index]) * (index % 2 === 0 ? 1 : 3);
  }
  return `${base12}${sum % 10 === 0 ? 0 : 10 - (sum % 10)}`;
}

async function cloneUnits(sourceCode, targetCode) {
  const response = await fetchFirstAvailable([
    `${API_BASE}/api/barcodes/by-product/${encodeURIComponent(sourceCode)}`,
    `${API_BASE}/api/products-units?product_code=${encodeURIComponent(sourceCode)}&limit=500`,
    `${API_BASE}/api/productsUnits?product_code=${encodeURIComponent(sourceCode)}&limit=500`,
  ]);
  const units = extractRows(response);

  for (const unit of units) {
    const unitId = Number(unit.product_unit_id ?? unit.unit_id);
    if (!Number.isInteger(unitId)) continue;
    const factor = Num.toNumOrNull(unit.fator ?? unit.factor) || 1;
    await postFirstAvailable([
      `${API_BASE}/api/barcodes`,
      `${API_BASE}/api/products-units`,
      `${API_BASE}/api/productsUnits`,
    ], {
      product_code: targetCode,
      product_unit_id: unitId,
      unit_id: Number(unit.unit_id ?? unitId),
      unit: unit.unit ?? unit.sigla ?? null,
      fator: factor,
      description: unit.description ?? unit.descricao ?? '',
      barcode: buildCopiedUnitBarcode(targetCode, unitId, factor),
      standard: Boolean(unit.standard ?? unit.padrao),
      is_active: unit.is_active !== false,
      width_cm: Num.toNumOrNull(unit.width_cm),
      length_cm: Num.toNumOrNull(unit.length_cm),
      height_cm: Num.toNumOrNull(unit.height_cm),
      weight_kg: Num.toNumOrNull(unit.weight_kg),
    });
  }

  return units.length;
}

async function cloneGrades(sourceProductId, targetProductId, targetCode) {
  if (!Number.isInteger(Number(sourceProductId))) return 0;
  const sourceId = Number(sourceProductId);
  const response = await fetchFirstAvailable([
    `${API_BASE}/api/products-grades?product_id=${encodeURIComponent(sourceId)}&limit=500`,
    `${API_BASE}/api/productsGrades?product_id=${encodeURIComponent(sourceId)}&limit=500`,
    `${API_BASE}/api/products-grades/by-product/${encodeURIComponent(sourceId)}`,
    `${API_BASE}/api/productsGrades/by-product/${encodeURIComponent(sourceId)}`,
  ]);
  const grades = extractRows(response);

  for (const grade of grades) {
    const gradeId = Number(grade.grade_id);
    if (!Number.isInteger(gradeId)) continue;
    await postFirstAvailable([
      `${API_BASE}/api/products-grades`,
      `${API_BASE}/api/productsGrades`,
    ], {
      product_id: Number(targetProductId),
      product_code: targetCode,
      grade_id: gradeId,
      stock: Math.max(0, Math.trunc(Number(grade.stock ?? grade.qty ?? grade.quantidade ?? 0) || 0)),
      is_active: grade.is_active !== false && grade.ativo !== false,
    });
  }

  return grades.length;
}

async function cloneFiscal(sourceCode, targetCode) {
  const source = String(sourceCode ?? '').trim();
  const target = String(targetCode ?? '').trim();
  if (!source || !target) throw new Error('SKU de origem ou destino inválido.');

  const response = await jfetch(
    `${ROUTES.productsFiscalV2}/current/${encodeURIComponent(source)}`
  );
  const currentFiscal = response?.fiscal ?? response?.data ?? null;

  // Copiar um produto sem vínculo fiscal continua sendo uma operação válida.
  if (!currentFiscal) return 0;

  const classificationId = Number(currentFiscal.fiscal_classification_id);
  if (!Number.isInteger(classificationId) || classificationId <= 0) {
    throw new Error('O vínculo fiscal de origem não possui uma classificação válida.');
  }

  await jfetch(`${ROUTES.productsFiscalV2}/current`, {
    method: 'PUT',
    body: JSON.stringify({
      product_code: target,
      fiscal_classification_id: classificationId,
      source_system: 'createProductCopy',
      source_reference: `copied-from:${source}`,
      extra_payload: {
        copied_from_product_code: source,
      },
    }),
  });

  return 1;
}

async function cloneUnitsAndGrades(targetProductId, targetCode) {
  if (!__copySource?.productCode) return { units: 0, grades: 0, fiscal: 0, errors: [] };
  const result = { units: 0, grades: 0, fiscal: 0, errors: [] };

  try {
    result.units = await cloneUnits(__copySource.productCode, targetCode);
  } catch (error) {
    console.error('[createProduct] Falha ao copiar unidades:', error);
    result.errors.push(`unidades: ${error.message}`);
  }

  try {
    result.grades = await cloneGrades(__copySource.productId, targetProductId, targetCode);
  } catch (error) {
    console.error('[createProduct] Falha ao copiar grades:', error);
    result.errors.push(`grades: ${error.message}`);
  }

  try {
    result.fiscal = await cloneFiscal(__copySource.productCode, targetCode);
  } catch (error) {
    console.error('[createProduct] Falha ao copiar vínculo fiscal:', error);
    result.errors.push(`fiscal: ${error.message}`);
  }

  return result;
}

function setAfterCreateUiState(productId, productCodeMaybe = null) {
  __createdProductId = String(productId);
  __createdProductCode = productCodeMaybe != null ? String(productCodeMaybe).trim() : null;

  // ✅ Preenche SKU/código gerado (se veio no retorno)
  if (productCodeMaybe) setVal(FIELDS.product_code, String(productCodeMaybe));

  // ✅ trava o campo SKU (em create, sempre readonly)
  const skuEl = getEl(FIELDS.product_code);
  if (skuEl) {
    skuEl.setAttribute('readonly', 'readonly');
    skuEl.classList.add('is-readonly');
  }

  disableDependentTabs(false);

  // opcional: fixar URL para virar "edit mode"
  const url = new URL(location.href);
  url.searchParams.set('id', __createdProductId);
  if (__createdProductCode) url.searchParams.set('code', __createdProductCode);
  history.replaceState(null, '', url.toString());

  toast('✅ Produto criado! Abas liberadas para completar cadastro.', 'success');
}

let __savingGeneralData = false;

async function salvarDadosGeraisCreate() {
  if (__savingGeneralData) return;

  const payload = coletarFormularioCreate();

  // ✅ NÃO exigir product_code (trigger gera)
  if (!payload.description) {
    toast('Informe a Descrição do produto.', 'error');
    getEl(FIELDS.description)?.focus();
    return;
  }

  const saveButton = getEl(FIELDS.btn_save_geral);

  try {
    __savingGeneralData = true;

    if (saveButton) {
      saveButton.disabled = true;
      saveButton.textContent = '⏳ Salvando...';
    }

    // Produto já criado: atualiza o mesmo registro.
    if (__createdProductId) {
      await updateProduct(__createdProductCode || getVal(FIELDS.product_code), payload);

      const headerName = $('#headerProductName');
      if (headerName) headerName.textContent = payload.description;

      toast('✅ Dados gerais atualizados!', 'success');
      return;
    }

    // Produto novo: cria apenas uma vez.
    const resp = await createProduct(payload);
    const created = normalizeCreatedProduct(resp);
    const newId = created.product_id;
    const newCode = created.product_code;

    if (!newId) {
      console.warn('[createProduct] resposta sem product_id:', resp);
      toast('Produto criado, mas não retornou product_id. Verifique o backend.', 'warning');
      return;
    }

    setAfterCreateUiState(newId, newCode);

    const headerCode = $('#headerProductCode');
    const headerName = $('#headerProductName');
    if (headerCode) headerCode.textContent = newCode ? `SKU ${newCode}` : `Produto #${newId}`;
    if (headerName) headerName.textContent = payload.description;

    if (!newCode) {
      toast('Produto criado, mas o backend não retornou product_code para abrir a edição.', 'warning');
      return;
    }

    const cloned = await cloneUnitsAndGrades(Number(newId), newCode);
    if (cloned.errors.length) {
      toast(
        `Produto criado. Importação parcial (${cloned.errors.join(' | ')}). Abrindo a edição para revisão.`,
        'warning'
      );
    } else if (__copySource) {
      const fiscalMessage = cloned.fiscal
        ? ' e vínculo fiscal importado'
        : ' e sem vínculo fiscal de origem';
      toast(
        `✅ Produto criado com ${cloned.units} unidade(s), ${cloned.grades} grade(s)${fiscalMessage}!`,
        'success'
      );
    }

    // O restante do cadastro usa exatamente a lógica modular do editProducts.
    window.setTimeout(() => {
      window.location.assign(
        `/public/editProducts/editProducts.html?product_code=${encodeURIComponent(newCode)}`
      );
    }, 500);

  } catch (err) {
    const action = __createdProductId ? 'atualizar' : 'criar';
    console.error(`[createProduct] Falha ao ${action}:`, err);
    toast(`❌ Falha ao ${action} produto: ${err.message}`, 'error');
  } finally {
    __savingGeneralData = false;

    if (saveButton) {
      saveButton.disabled = false;
      saveButton.textContent = '💾 Salvar Dados Gerais';
    }
  }
}

function prepareSkuFieldForCreate() {
  const skuEl = getEl(FIELDS.product_code);
  if (!skuEl) return;

  skuEl.removeAttribute('readonly');
  skuEl.classList.remove('is-readonly');
  skuEl.setAttribute('aria-readonly', 'false');
  skuEl.placeholder = 'Informe o SKU ou deixe vazio para gerar automaticamente';
}

function unwrapProductResponse(response) {
  const raw = response?.data ?? response;
  return raw?.data ?? raw;
}

function waitForSelectOption(select, expectedValue, timeoutMs = 3000) {
  return new Promise((resolve) => {
    const value = String(expectedValue ?? '');

    if (!select || !value) {
      resolve(false);
      return;
    }

    const startedAt = Date.now();

    function check() {
      const exists = Array.from(select.options)
        .some((option) => String(option.value) === value);

      if (exists) {
        select.value = value;
        resolve(true);
        return;
      }

      if (Date.now() - startedAt >= timeoutMs) {
        resolve(false);
        return;
      }

      window.setTimeout(check, 50);
    }

    check();
  });
}

async function importarProdutoParaNovoCadastro(selectedProduct) {
  const sourceProductCode = String(
    selectedProduct?.product_code ??
    selectedProduct?.sku ??
    selectedProduct?.codigo ??
    selectedProduct?.code ??
    ''
  ).trim();

  if (!sourceProductCode) {
    toast('O produto selecionado não possui product_code.', 'error');
    return;
  }

  const copyButton = getEl(FIELDS.btn_copy_product);

  try {
    if (copyButton) {
      copyButton.disabled = true;
      copyButton.textContent = '⏳ Importando...';
    }

    const response = await getProductByCode(sourceProductCode, selectedProduct);
    const product = unwrapProductResponse(response);

    if (!product || typeof product !== 'object') {
      throw new Error('O backend não retornou os dados do produto.');
    }

    /*
     * Muito importante:
     * mantém esta tela em modo de criação.
     * O produto original nunca será atualizado.
     */
    __createdProductId = null;
    __createdProductCode = null;
    __copySource = {
      productCode: sourceProductCode,
      productId: Number(product.product_id ?? product.id) || null,
    };

    const url = new URL(window.location.href);
    url.searchParams.delete('id');
    url.searchParams.delete('code');
    url.searchParams.set('tab', 'geral');
    history.replaceState(null, '', url.toString());

    // Nunca copiar identificadores únicos
    setVal(FIELDS.product_code, '');
    setVal(FIELDS.barcode, '');

    // Informações gerais
    setVal(FIELDS.description, product.description ?? '');
    setVal(FIELDS.manufacturer_ref, product.manufacturer_ref ?? '');
    setVal(FIELDS.manufacturer_id, product.manufacturer_id ?? '');
    setVal(FIELDS.supplier_id, product.supplier_id ?? '');
    setVal(FIELDS.product_location_id, product.product_location_id ?? '');

    setVal(FIELDS.width_cm, product.width_cm ?? '');
    setVal(FIELDS.length_cm, product.length_cm ?? '');
    setVal(FIELDS.height_cm, product.height_cm ?? '');
    setVal(FIELDS.weight_kg, product.weight_kg ?? '');

    const costPrice = Num.toNumOrNull(product.cost_price);

    setVal(
      FIELDS.cost_price,
      costPrice == null ? '' : Num.formatBR(costPrice)
    );

    setChecked(
      ACTIVE_SELECTOR,
      product.is_active !== false
    );

    // Grupo
    const groupSelect = getEl(FIELDS.product_group_id);
    const subgroupSelect = getEl(FIELDS.product_subgroup_id);

    const groupId = product.product_group_id;
    const subgroupId = product.product_subgroup_id;

    if (groupSelect && groupId) {
      groupSelect.value = String(groupId);

      // Dispara o carregamento dos subgrupos
      groupSelect.dispatchEvent(
        new Event('change', { bubbles: true })
      );

      if (subgroupSelect && subgroupId) {
        await waitForSelectOption(
          subgroupSelect,
          subgroupId
        );
      }
    } else {
      setVal(FIELDS.product_group_id, '');
      setVal(FIELDS.product_subgroup_id, '');
    }

    // Nome da localização
    const locationSelect = getEl(FIELDS.product_location_id);
    const locationLabel = $('#product_location_label');

    if (locationLabel) {
      const selectedLocation =
        locationSelect?.options?.[locationSelect.selectedIndex];

      locationLabel.value =
        product.product_location_name ??
        product.location_name ??
        product.location_description ??
        selectedLocation?.textContent ??
        '';
    }

    // Descrição detalhada, quando existir
    const detailedDescription = $('#descricaoDetalhada');

    if (detailedDescription) {
      detailedDescription.value =
        product.detailed_description ??
        product.description_detailed ??
        product.long_description ??
        product.description ??
        '';

      detailedDescription.dispatchEvent(
        new Event('input', { bubbles: true })
      );
    }

    // Cabeçalho
    const headerCode = $('#headerProductCode');
    const headerName = $('#headerProductName');

    if (headerCode) {
      headerCode.textContent = 'SKU —';
    }

    if (headerName) {
      headerName.textContent =
        `${product.description ?? 'Produto'} — cópia para edição`;
    }

    // Continua bloqueado até criar efetivamente o novo produto
    disableDependentTabs(true);

    // Volta para Dados Gerais
    window.tabs?.activate?.('aba-geral', false);

    toast(
      'Produto importado. Informe o novo SKU ou deixe-o vazio para gerar automaticamente; depois salve os Dados Gerais.',
      'success'
    );

    getEl(FIELDS.description)?.focus();

  } catch (err) {
    console.error(
      '[createProduct] Erro ao importar produto:',
      err
    );

    toast(
      `❌ Falha ao importar produto: ${err.message}`,
      'error'
    );
  } finally {
    if (copyButton) {
      copyButton.disabled = false;
      copyButton.textContent = '📋 Copiar Produto';
    }
  }
}

async function boot() {
  window.tabs = initTabs({
    tabButtonsSelector: '.tab',
    panelSelector: '.tab-panel',
    activeClass: 'is-active',
    defaultPanelId: 'aba-geral',
  });

  disableDependentTabs(true);

  try {
    await carregarCombos();
    setupGroupSubgroupLink();

    // default (novo): ativo marcado
    setChecked(ACTIVE_SELECTOR, true);

    // sku auto: prepara campo
    prepareSkuFieldForCreate();

    // carrega tabelas de preço para já renderizar vazio (sem productId ainda)
    const tables = await PriceApi.listTables().catch(() => []);
    renderPriceRows(tables, []);
    attachPriceListeners();

    // se a página já foi aberta com ?id= (modo híbrido), libera
    const usp = new URLSearchParams(location.search);
    const id = usp.get('id');
    if (id) {
      __createdProductId = id;
      disableDependentTabs(false);

      // se veio também um product_code na url (?code=) ou o próprio id já é sku
      const code = usp.get('code');
      if (code) {
        __createdProductCode = code;
        setVal(FIELDS.product_code, code);
      }

      toast('Modo híbrido: produto já informado na URL. Abas liberadas.', 'info');
    }
  } catch (err) {
    console.error('boot error:', err);
    toast(`⚠️ Erro ao inicializar tela: ${err.message}`, 'error');
  }

  $(FIELDS.btn_copy_product)?.addEventListener('click', (event) => {
    event.preventDefault();

    if (__createdProductId) {
      toast(
        'Este produto já foi criado. Abra uma nova tela de cadastro para copiar outro produto.',
        'warning'
      );

      return;
    }

    openProductsModalSearch({
      apiBase: API_BASE,
      autoHydrate: false,

      onPick: async (selectedProduct) => {
        await importarProdutoParaNovoCadastro(selectedProduct);
      },
    });
  });


  // handlers
  $(FIELDS.form_geral)?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await salvarDadosGeraisCreate();
  });

  $(FIELDS.form_prices)?.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!__createdProductId) return toast('Crie o produto primeiro para salvar preços.', 'warning');
    salvarTabelaPrecos(__createdProductId);
  });

  $(FIELDS.btn_open_class_modal)?.addEventListener('click', (e) => {
    e.preventDefault();
    if (!__createdProductId) return toast('Crie o produto primeiro para vincular fiscal.', 'warning');
    vincularClassificacaoFiscal(__createdProductCode || getVal(FIELDS.product_code));
  });
}

document.addEventListener('DOMContentLoaded', boot);
