// ╔══════════════════════════════════════════════════════════════════════╗
// ║ selectLoads.js — Bootstrap + Infra do Editar Produto (Tabs)          ║
// ║ PRODNEX ERP — ESM                                                   ║
// ║ - Carrega produto por product_code/SKU                              ║
// ║ - Preenche combos                                                   ║
// ║ - Inicializa abas: Geral, Descrição, Preços, Fiscal, Unidades,       ║
// ║   Grades, Estoque e Registros                                       ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { showCenterModal } from '/public/includes/js/centerAlertModal.js';
import { openFiscalClassificationModal } from '/public/modalsSearch/fiscalClassificationModalSearch.js';

// Tabs
import { initDadosGeraisTab } from './tabDadosGerais.js';
import { initDescriptionTab } from './tabDescription.js';
import { initPricesTab } from './tabPrices.js';
import { initFiscalTab } from './tabFiscal.js';
import { initUnitsTab } from './tabUnits.js';
import { initGradesTab } from './tabGrades.js';
import { initEstoqueTab } from './tabStock.js';
import { initProductMovementsTab } from './productsMovements.js';
import { initProductImages } from './productImages.js';
import { initQuickCreate } from './quickCreate.js';

// ---------------------------------------------------------------------
// Helper definitivo: utiliza a função global getApiBase() do apiBase.js
// ---------------------------------------------------------------------
function getApiBase() {
  try {
    if (typeof window !== 'undefined' && window.getApiBase) return window.getApiBase();
  } catch (err) {
    console.error('[editProducts/selectLoads] Erro ao obter API base:', err);
  }
  return 'http://localhost:8080';
}

const API_BASE = getApiBase();

const ROUTES = Object.freeze({
  // Products
  products: `${API_BASE}/api/products`,

  productByCode: (productCode) =>
    `${API_BASE}/api/products/${encodeURIComponent(productCode)}`,

  productMovements: (productCode) =>
    `${API_BASE}/api/products/${encodeURIComponent(productCode)}/registros`,

  // Cadastros auxiliares
  groups: [
    `${API_BASE}/api/products-groups`,
    `${API_BASE}/api/productsGroups`,
  ],
  subgroups: [
    `${API_BASE}/api/products-subgroups`,
    `${API_BASE}/api/productsSubgroups`,
  ],
  // Combos de fabricante/fornecedor são carregados (com paginação) em tabDadosGerais.js
  // Obs.: /api/products-manufacturers é atendida antes pela tabela legada "productsManufactures" (vazia).
  fabricantes: `${API_BASE}/api/manufacturers`,
  // Obs.: /api/products-suppliers é a tabela de vínculo produto x fornecedor, não o cadastro.
  fornecedores: `${API_BASE}/api/suppliers`,
  localizacoes: [
    `${API_BASE}/api/product-locations`,
    `${API_BASE}/api/products-locations`,
    `${API_BASE}/api/localizacoes`,
  ],

  // 📦 BOXES
  boxes: [
    `${API_BASE}/api/products-boxes`,
    `${API_BASE}/api/productsBoxes`,
    `${API_BASE}/api/boxes`,
  ],

  // ⚖️ Fiscal
  fiscalClassification: `${API_BASE}/api/fiscalClassification`,
  fiscalClassificationAlt: `${API_BASE}/api/fiscal-classification`,
  fiscalProfile: `${API_BASE}/api/fiscalProfile`,
  fiscalProfileAlt: `${API_BASE}/api/fiscal-profile`,
  productsFiscal: `${API_BASE}/api/productsFiscal`,
  productsFiscalAlt: `${API_BASE}/api/products-fiscal`,
  productsFiscalV2: `${API_BASE}/api/v2/products-fiscal`,

  // 💾 Catálogo de Unidades
  units: `${API_BASE}/api/units`,

  // 🔗 Unidades do Produto
  // ✅ Agora usa public."productsBarCode" como tabela mestre
  // Mantemos os nomes productUnits* para não quebrar tabUnits.js
  productUnitsList: ({ product_code }) => [
    product_code
      ? `${API_BASE}/api/barcodes/by-product/${encodeURIComponent(product_code)}`
      : null,
  ].filter(Boolean),

  productUnitsUpsert: [
    `${API_BASE}/api/barcodes`,
  ],

  productUnitById: (id) => [
    `${API_BASE}/api/barcodes/${encodeURIComponent(id)}`,
  ],

  productUnitSetActive: (id) => [
    `${API_BASE}/api/barcodes/${encodeURIComponent(id)}/active`,
  ],

  productUnitsActiveByProduct: ({ product_code }) => [
    product_code
      ? `${API_BASE}/api/barcodes/active-units?product_code=${encodeURIComponent(product_code)}`
      : null,
  ].filter(Boolean),

  // 💰 Preços
  priceTables: [
    `${API_BASE}/api/prices`,
    `${API_BASE}/api/priceTables`,
    `${API_BASE}/api/tabela-precos`,
    `${API_BASE}/api/tabela_cadastro_precos`,
  ],
  productPrices: (productCode) => [
    `${API_BASE}/api/products/${encodeURIComponent(productCode)}/prices`,
    `${API_BASE}/api/productsPrices/${encodeURIComponent(productCode)}`,
    `${API_BASE}/api/productsPrices?product_code=${encodeURIComponent(productCode)}`,
  ],
  upsertPrices: (productCode) => [
    {
      url: `${API_BASE}/api/products/${encodeURIComponent(productCode)}/prices`,
      body: (_code, prices) => ({
        product_code: productCode,
        prices,
      }),
    },
    {
      url: `${API_BASE}/api/productsPrices/upsert`,
      body: (_code, prices) => ({
        product_code: productCode,
        prices,
      }),
    },
  ],

  // GRADES
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

  // 📦 Stock
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
  productStockAdjust: (id) => [
    `${API_BASE}/api/productsStock/${encodeURIComponent(id)}/adjust`,
    `${API_BASE}/api/products-stock/${encodeURIComponent(id)}/adjust`,
  ],
});

// ──────────────────────────────────────────────────────────────
// MINI INFRA
// ──────────────────────────────────────────────────────────────
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

function updateHeaderProduct(product = {}) {
  const codeElement = document.getElementById('headerProductCode');
  const nameElement = document.getElementById('headerProductName');

  const productCode =
    product.product_code ??
    product.sku ??
    '';

  const productName =
    product.product_name ??
    product.description ??
    product.name ??
    '';

  if (codeElement) {
    codeElement.textContent = productCode
      ? `SKU ${productCode}`
      : 'SKU —';
  }

  if (nameElement) {
    nameElement.textContent =
      productName || 'Produto sem descrição';

    nameElement.title =
      productName || 'Produto sem descrição';
  }
}

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
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  const res = await fetch(url, { ...opts, headers });

  const ct = res.headers.get('content-type') || '';
  let body = null;

  if (ct.includes('application/json')) body = await res.json().catch(() => null);
  else {
    const txt = await res.text().catch(() => '');
    body = { message: txt };
  }

  if (!res.ok || body?.ok === false) {
    const msg = body?.error || body?.message || `${res.status} ${res.statusText}`;
    const err = new Error(msg);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

function normalizeBarcode(v) {
  if (v == null) return '';
  const s = String(v).trim();
  return s.replace(/[^\d]/g, '');
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
    for (const key of Object.keys(inner)) if (Array.isArray(inner[key])) return inner[key];
  }

  if (Array.isArray(data.results)) return data.results;
  for (const key of Object.keys(data)) if (Array.isArray(data[key])) return data[key];
  return [];
}

// ──────────────────────────────────────────────────────────────
// CONTROLADOR DE ABAS
// ──────────────────────────────────────────────────────────────
function initTabs({
  tabButtonsSelector = '.aba-btn',
  panelSelector = '.aba',
  activeClass = 'ativa',
  defaultPanelId = 'aba-geral',
} = {}) {
  const $btns = $$(tabButtonsSelector);
  const $panels = $$(panelSelector);
  if (!$btns.length || !$panels.length) return;

  function activate(panelId, pushState = true) {
    $btns.forEach((b) => { b.classList.remove(activeClass); b.setAttribute('aria-selected', 'false'); });
    $panels.forEach((p) => { p.classList.remove(activeClass); p.hidden = true; });

    const btn = $btns.find((b) => b.dataset.aba === panelId);
    const panel = document.getElementById(panelId);
    if (btn) { btn.classList.add(activeClass); btn.setAttribute('aria-selected', 'true'); }
    if (panel) { panel.classList.add(activeClass); panel.hidden = false; }

    if (pushState) {
      const url = new URL(location.href);
      url.searchParams.set('tab', panelId.replace('aba-', ''));
      history.replaceState(null, '', url.toString());
    }
  }

  $btns.forEach((b) => b.addEventListener('click', (e) => {
    e.preventDefault();
    const id = b.dataset.aba;
    if (id) activate(id);
  }));

  document.addEventListener('keydown', (e) => {
    // ⛔ NÃO interferir se estiver digitando em input, textarea ou contenteditable
    const tag = document.activeElement?.tagName;
    const isEditable =
      tag === 'INPUT' ||
      tag === 'TEXTAREA' ||
      document.activeElement?.isContentEditable;

    if (isEditable) return;

    // ⛔ só reage às setas
    if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;

    const idx = $btns.findIndex((b) => b.classList.contains(activeClass));
    if (idx < 0) return;

    const nextIdx =
      e.key === 'ArrowRight'
        ? (idx + 1) % $btns.length
        : (idx - 1 + $btns.length) % $btns.length;

    const nextId = $btns[nextIdx].dataset.aba;
    if (nextId) activate(nextId);
  });

  const usp = new URLSearchParams(location.search);
  const tabParam = usp.get('tab');
  const hashId = location.hash?.slice(1);
  const startPanel =
    (hashId && document.getElementById(hashId)) ? hashId
      : (tabParam && document.getElementById(`aba-${tabParam}`)) ? `aba-${tabParam}`
        : defaultPanelId;

  $panels.forEach((p) => (p.hidden = !p.classList.contains(activeClass)));
  activate(startPanel, false);

  return { activate };
}

// ──────────────────────────────────────────────────────────────
// ProductsApi fallback (mantém o comportamento do seu arquivo original)
// ──────────────────────────────────────────────────────────────
const ProductsApi = (() => {
  const mod = (window && (window.productsApi || window.productsApiModule || window.ProductsApi)) || null;

  const wrap = (fn) => async (...args) => {
    if (mod && (mod[fn] || mod?.default?.[fn])) {
      const api = { ...(mod.default || {}), ...mod };
      const r = await api[fn](...args);
      if (r?.ok) return r.data ?? r;
      throw new Error(r?.error || 'Erro na API');
    }

    if (fn === 'getProduct') {
      const productCode = String(args[0] ?? '').trim();

      if (!productCode) {
        throw new Error('product_code é obrigatório.');
      }

      return jfetch(
        ROUTES.productByCode(productCode),
      );
    }

    if (fn === 'updateProduct') {
      const [productCodeRaw, data] = args;
      const productCode = String(productCodeRaw ?? '').trim();

      if (!productCode) {
        throw new Error('product_code é obrigatório.');
      }

      return jfetch(
        ROUTES.productByCode(productCode),
        {
          method: 'PUT',
          body: JSON.stringify(data),
        },
      );
    }
    throw new Error(`Função não suportada no fallback: ${fn}`);
  };

  return { getProduct: wrap('getProduct'), updateProduct: wrap('updateProduct') };
})();

function getProductRefFromURL() {
  const usp = new URLSearchParams(location.search);

  const ref = String(
    usp.get('product_code') ??
    usp.get('sku') ??
    usp.get('id') ??
    '',
  ).trim();

  return ref || null;
}

async function resolveProductFromRef(ref) {
  const requestedCode = String(ref ?? '').trim();

  if (!requestedCode) {
    throw new Error(
      'Produto não informado na URL (?product_code=, ?sku= ou ?id=).',
    );
  }

  // 1) A referência pública principal é o product_code/SKU.
  //    Isso preserva zeros à esquerda (ex.: "00004828").
  try {
    const data = await ProductsApi.getProduct(requestedCode);
    const produto = data?.data ?? data;

    const productCode = String(
      produto?.product_code ??
      produto?.sku ??
      requestedCode,
    ).trim();

    const productIdRaw =
      produto?.product_id ??
      produto?.id ??
      null;

    const productId =
      productIdRaw == null || productIdRaw === ''
        ? null
        : Number(productIdRaw);

    if (productCode) {
      return {
        productId: Number.isFinite(productId) && productId > 0
          ? productId
          : null,
        productCode,
        produto,
      };
    }
  } catch (error) {
    if (Number(error?.status) !== 404) {
      throw error;
    }
  }

  // 2) Fallback por pesquisa textual/exata.
  const candidates = [
    `${ROUTES.products}/search?q=${encodeURIComponent(requestedCode)}&limit=20&page=1`,
    `${ROUTES.products}?q=${encodeURIComponent(requestedCode)}&limit=20&page=1`,
  ];

  let lastErr = null;

  for (const url of candidates) {
    try {
      const response = await jfetch(url);
      const rows = extractRows(response);

      const produto =
        rows.find((item) =>
          String(
            item?.product_code ??
            item?.sku ??
            '',
          ).trim() === requestedCode
        ) ??
        rows[0] ??
        null;

      if (!produto) {
        continue;
      }

      const productCode = String(
        produto.product_code ??
        produto.sku ??
        '',
      ).trim();

      if (!productCode) {
        continue;
      }

      const productIdRaw =
        produto.product_id ??
        produto.id ??
        null;

      const productId =
        productIdRaw == null || productIdRaw === ''
          ? null
          : Number(productIdRaw);

      return {
        productId: Number.isFinite(productId) && productId > 0
          ? productId
          : null,
        productCode,
        produto,
      };
    } catch (error) {
      lastErr = error;
    }
  }

  throw (
    lastErr ||
    new Error(
      `Não consegui resolver o produto pelo product_code/SKU "${requestedCode}".`,
    )
  );
}

// ──────────────────────────────────────────────────────────────
// COMBOS (grupos, etc.)
// ──────────────────────────────────────────────────────────────
async function fillSelect(
  urlOrList,
  selectSelector,
  { idKey = 'id', textKey = 'name', placeholder = 'Selecione...' } = {},
) {
  const sel = $(selectSelector);
  if (!sel) return;

  const urls = Array.isArray(urlOrList) ? urlOrList : [urlOrList];
  let data = null;
  let lastErr = null;

  for (const u of urls) {
    if (!u) continue;
    try { data = await jfetch(u); break; }
    catch (err) {
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

async function carregarCombos({ FIELDS }) {
  await Promise.all([
    fillSelect(ROUTES.groups, FIELDS.product_group_id, { idKey: 'product_group_id', textKey: 'name' }),
    fillSelect(ROUTES.subgroups, FIELDS.product_subgroup_id, { idKey: 'product_subgroup_id', textKey: 'name' }),
    // ❌ localizações removido: será carregado por SKU na aba geral
    fillSelect(ROUTES.boxes, FIELDS.box_id, { idKey: 'box_id', textKey: 'name', placeholder: '— Selecione uma box —' }),
  ]);
}

function setupGroupSubgroupLink({ FIELDS }) {
  const grp = $(FIELDS.product_group_id);
  const sub = $(FIELDS.product_subgroup_id);
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
      let lastErr = null;

      for (const u of urls) {
        try {
          const resp = await jfetch(u);
          rows = extractRows(resp);
          if (Array.isArray(rows) && rows.length) break;
        } catch (err) { lastErr = err; }
      }

      sub.innerHTML = '<option value="">Selecione...</option>';

      if (!rows || !rows.length) {
        console.warn('Nenhum subgrupo encontrado. Último erro:', lastErr?.message || lastErr);
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

// ──────────────────────────────────────────────────────────────
// helpers bootstrap
// ──────────────────────────────────────────────────────────────
function waitFor(fn, { timeoutMs = 4000, intervalMs = 60 } = {}) {
  return new Promise((resolve, reject) => {
    const t0 = Date.now();
    const tick = () => {
      try { const v = fn(); if (v) return resolve(v); } catch (_) { }
      if (Date.now() - t0 > timeoutMs) return reject(new Error('Timeout ao aguardar condição'));
      setTimeout(tick, intervalMs);
    };
    tick();
  });
}

// ──────────────────────────────────────────────────────────────
// ProductsLocationsApi — Localizações por SKU (fallback multi-rota)
// ──────────────────────────────────────────────────────────────
const ProductsLocationsApi = (() => {
  const pickId = (r) =>
    r.id ??
    r.product_location_id ??
    r.location_id ??
    r.products_location_id ??
    null;

  const buildLabel = (r) => {
    if (r.label) return String(r.label);

    const parts = [
      r.local || r.location || r.nome || r.name,
      r.corredor,
      r.gondola,
      r.prateleira,
      r.bandeja,
      r.posicao,
    ].filter(Boolean);

    const base = parts.join(' / ');
    const obs = r.observacao || r.obs || r.notes || '';
    return obs ? `${base} — ${obs}` : (base || `Localização #${pickId(r)}`);
  };

  const normalize = (rows) =>
    (Array.isArray(rows) ? rows : [])
      .map((r) => {
        const id = pickId(r);
        if (id == null) return null;
        return {
          id: Number(id),
          product_code: r.product_code ?? r.sku ?? null,
          label: buildLabel(r),
          raw: r,
        };
      })
      .filter(Boolean);

  async function tryMany(urls, fetchFn) {
    let lastErr = null;
    for (const u of urls) {
      if (!u) continue;
      try {
        const resp = await fetchFn(u);
        const rows = extractRows(resp);
        if (Array.isArray(rows)) return rows;
        if (resp && typeof resp === 'object') return [resp];
      } catch (e) {
        lastErr = e;
        const msg = String(e?.message || '').toLowerCase();
        if (msg.includes('404') || msg.includes('not found')) continue;
        break;
      }
    }
    if (lastErr) throw lastErr;
    return [];
  }

  return {
    async listLocationsByProductCode(productCode, { onlyActive = true } = {}) {
      const sku = String(productCode || '').trim();
      if (!sku) return [];

      const candidates = [
        ...ROUTES.localizacoes.map((b) => `${b}?product_code=${encodeURIComponent(sku)}${onlyActive ? '&active=1' : ''}`),
        ...ROUTES.localizacoes.map((b) => `${b}?sku=${encodeURIComponent(sku)}${onlyActive ? '&active=1' : ''}`),

        `${API_BASE}/api/product-locations/by-product/${encodeURIComponent(sku)}${onlyActive ? '?active=1' : ''}`,
        `${API_BASE}/api/products-locations/by-product/${encodeURIComponent(sku)}${onlyActive ? '?active=1' : ''}`,
        `${API_BASE}/api/product-locations/by-sku/${encodeURIComponent(sku)}${onlyActive ? '?active=1' : ''}`,
        `${API_BASE}/api/products-locations/by-sku/${encodeURIComponent(sku)}${onlyActive ? '?active=1' : ''}`,
      ];

      const rawRows = await tryMany(candidates, jfetch);
      return normalize(rawRows);
    },
  };
})();

// ──────────────────────────────────────────────────────────────
// CONTEXTO COMPARTILHADO (passado para as abas)
// ──────────────────────────────────────────────────────────────
const ctx = Object.freeze({
  API_BASE,
  ROUTES,
  $,
  $$,
  toast,
  jfetch,
  Num,
  extractRows,
  normalizeBarcode,
  showCenterModal,
  openFiscalClassificationModal,
  ProductsApi,
  ProductsLocationsApi, // ✅ AGORA SIM: disponível para tabDadosGerais.js
  carregarCombos,
  setupGroupSubgroupLink,
  waitFor,

  // ✅ opcional: as abas podem ler ctx.state.product
  state: { product: null },
});

// ──────────────────────────────────────────────────────────────
// BOOTSTRAP
// ──────────────────────────────────────────────────────────────
async function boot() {
  window.tabs = initTabs({
    tabButtonsSelector: '.aba-btn',
    panelSelector: '.aba',
    activeClass: 'ativa',
    defaultPanelId: 'aba-geral',
  });

  const ref = getProductRefFromURL();
  const { productId, productCode } = await resolveProductFromRef(ref);

  try {
    // Inicia aba Geral primeiro (ela define FIELDS, e também preenche formulário)
    const geral = initDadosGeraisTab(ctx);

    // combos + link grupo->subgrupo (depende do FIELDS da aba geral)
    await ctx.carregarCombos({ FIELDS: geral.FIELDS });
    ctx.setupGroupSubgroupLink({ FIELDS: geral.FIELDS });
    initQuickCreate(ctx, { FIELDS: geral.FIELDS });

    // carrega produto (dados gerais)
    const data = await ctx.ProductsApi.getProduct(productCode);
    const produto = data?.data ?? data;
    if (!produto) throw new Error('Produto não encontrado');

    // ✅ cache no ctx.state para fallback de abas
    ctx.state.product = produto;

    // ✅ Atualiza SKU e descrição no cabeçalho da página
    updateHeaderProduct(produto);

    // preenche geral + restaura selects
    geral.preencherFormulario(produto);

    // ✅ Atualiza o cabeçalho enquanto a descrição é editada
    const descriptionInput = document.getElementById('descricao');

    if (descriptionInput) {
      descriptionInput.addEventListener('input', () => {
        const headerName = document.getElementById('headerProductName');

        if (headerName) {
          const value = descriptionInput.value.trim();

          headerName.textContent =
            value || 'Produto sem descrição';

          headerName.title =
            value || 'Produto sem descrição';
        }
      });
    }

    // espera subgrupo carregar (se o grupo disparar change)
    const grp = ctx.$(geral.FIELDS.product_group_id);
    const sub = ctx.$(geral.FIELDS.product_subgroup_id);

    if (grp && produto.product_group_id) {
      grp.value = String(produto.product_group_id);
      grp.dispatchEvent(new Event('change'));
      if (sub && produto.product_subgroup_id) {
        await ctx.waitFor(() => sub.options && sub.options.length > 1).catch(() => null);
        sub.value = String(produto.product_subgroup_id);
        sub.disabled = false;
      }
    } else if (sub) {
      sub.disabled = false;
      if (produto.product_subgroup_id) sub.value = String(produto.product_subgroup_id);
    }

    // carrega box por produto (se existir endpoint)
    if (productCode) await geral.carregarBoxDoProduto(productCode).catch(() => { });

    // init abas
    await initDescriptionTab(ctx, {
      productCode: produto.product_code ?? produto.sku ?? productCode,
    });
    await initPricesTab(ctx, { productCode });
    await initEstoqueTab(ctx, {
      productId,
      productCode,
      initialProductStockId: produto.product_stock_id ?? produto.productStockId ?? null,
    });
    await initFiscalTab(ctx, { productId, productCode });
    await initUnitsTab(ctx, { productId, productCode });
    await initGradesTab(ctx, { productId, productCode });
    initProductMovementsTab(ctx, { productCode });
    initProductImages(ctx, { productCode });

    // handlers de salvar da aba geral (submit)
    geral.bindSalvarDadosGerais(productCode);

  } catch (err) {
    console.error('[editProducts] boot error:', err);
    ctx.toast(`❌ Falha ao carregar edição: ${err.message}`, 'error');
  }
}

document.addEventListener('DOMContentLoaded', boot);
