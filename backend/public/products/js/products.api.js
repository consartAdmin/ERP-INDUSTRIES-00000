// ╔══════════════════════════════════════════════════════════════════════╗
// ║ products.api.js — API inline do módulo de produtos                  ║
// ║ PRODNEX ERP | ESM                                                   ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { API_BASE, SIGNED_TTL_MS } from './products.config.js';

const signedCache = new Map(); // key -> { url, exp }

const PRICE_TABLE_URLS = [
  `${API_BASE}/api/prices`,
  `${API_BASE}/api/priceTables`,
  `${API_BASE}/api/tabela-precos`,
  `${API_BASE}/api/tabela_cadastro_precos`,
];

function extractRows(response) {
  return response?.rows ?? response?.data?.rows ?? response?.data ?? response ?? [];
}

async function fetchFirstAvailable(urls, { signal } = {}) {
  let lastError;

  for (const url of urls) {
    try {
      return await fetchJSON(url, { signal });
    } catch (error) {
      if (error?.name === 'AbortError') throw error;
      lastError = error;
    }
  }

  throw lastError || new Error('Nenhum endpoint de preços disponível.');
}

function normalizePriceTables(response) {
  const rows = extractRows(response);
  if (!Array.isArray(rows)) return [];

  return rows
    .map((row) => ({
      id: Number(row.price_id ?? row.id ?? row.tabela_preco_id),
      name: row.name ?? row.nome ?? row.description ?? row.descricao ?? '',
      active: typeof row.active === 'boolean' ? row.active : (row.ativo ?? true),
    }))
    .filter((table) => Number.isInteger(table.id))
    .sort((a, b) => a.id - b.id);
}

function normalizeProductPrices(response) {
  const rows = extractRows(response);
  if (!Array.isArray(rows)) return [];

  return rows
    .map((row) => ({
      price_id: Number(row.price_id ?? row.tabela_preco_id),
      sale_price: row.sale_price ?? row.preco_venda ?? null,
    }))
    .filter((price) => Number.isInteger(price.price_id));
}

function isDefaultPriceTable(table, index) {
  const name = String(table?.name ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return /\b(padrao|varejo)\b/.test(name) || (!name && index === 0);
}

async function loadProductPriceRows(productCode, signal) {
  const code = encodeURIComponent(String(productCode).trim());

  const response = await fetchFirstAvailable([
    `${API_BASE}/api/products/${code}/prices`,
    `${API_BASE}/api/productsPrices/${code}`,
    `${API_BASE}/api/productsPrices?product_code=${code}`,
  ], { signal });

  return normalizeProductPrices(response);
}

async function addPriceTablesToProducts(rows, signal) {
  if (!rows.length) return rows;

  try {
    const catalogResponse = await fetchFirstAvailable(PRICE_TABLE_URLS, { signal });
    const catalog = normalizePriceTables(catalogResponse);
    if (!catalog.length) return rows;

    const defaultTable = catalog.find(isDefaultPriceTable) ?? catalog[0];
    const additionalTables = catalog.filter((table) => table.id !== defaultTable.id);

    const pricesByProduct = await Promise.all(rows.map(async (row) => {
      const productCode =
        row.product_code ??
        row.sku ??
        row.codigo;

      if (productCode == null || String(productCode).trim() === '') {
        return [];
      }

      try {
        return await loadProductPriceRows(productCode, signal);
      } catch (error) {
        if (error?.name === 'AbortError') throw error;
        console.warn(`[products] Preços do produto ${productId} indisponíveis:`, error?.message || error);
        return [];
      }
    }));

    return rows.map((row, index) => {
      const values = new Map(pricesByProduct[index].map((price) => [price.price_id, price.sale_price]));
      return {
        ...row,
        prices: additionalTables.map((table) => ({
          key: `price_table_${table.id}`,
          label: table.name || `Tabela ${table.id}`,
          value: values.get(table.id) ?? null,
        })),
      };
    });
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    console.warn('[products] Catálogo de tabelas de preços indisponível:', error?.message || error);
    return rows;
  }
}

/* ──────────────────────────────────────────────────────────────
   FETCH JSON
────────────────────────────────────────────────────────────── */
export async function fetchJSON(url, opts = {}) {
  const r = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });

  if (!r.ok) {
    let msg = r.statusText;
    try { msg = await r.text(); } catch { }
    throw new Error(`HTTP ${r.status} — ${msg}`);
  }

  if (r.status === 204) return null;

  const ct = r.headers.get('content-type') || '';

  if (!ct.toLowerCase().includes('application/json')) {
    const preview = (await r.text().catch(() => ''))
      .slice(0, 200)
      .replace(/\s+/g, ' ');

    throw new Error(
      `Resposta não-JSON (${ct}). Corpo: ${preview || '(vazio)'}`
    );
  }

  return await r.json();
}

/* ──────────────────────────────────────────────────────────────
   FETCH BLOB
────────────────────────────────────────────────────────────── */
export async function fetchBlob(url, opts = {}) {
  const r = await fetch(url, opts);

  if (!r.ok) {
    let msg = r.statusText;
    try { msg = await r.text(); } catch { }
    throw new Error(`HTTP ${r.status} — ${msg}`);
  }

  return await r.blob();
}

/* ──────────────────────────────────────────────────────────────
   IMAGENS GCS
────────────────────────────────────────────────────────────── */
export async function getSignedUrlForKey(key) {
  const k = (key || '').trim();

  if (!k) return '';

  const now = Date.now();
  const hit = signedCache.get(k);

  if (hit?.url && hit.exp > now) {
    return hit.url;
  }

  const url =
    `${API_BASE}/api/gcs/images/signed-url?key=` +
    encodeURIComponent(k);

  const json = await fetchJSON(url);

  if (json?.ok && json?.url) {
    signedCache.set(k, {
      url: json.url,
      exp: now + SIGNED_TTL_MS,
    });

    return json.url;
  }

  return '';
}

export function buildProxyUrlForKey(key) {
  const k = (key || '').trim();

  if (!k) return '';

  return (
    `${API_BASE}/api/gcs/images/proxy?key=` +
    encodeURIComponent(k)
  );
}

export async function resolvePreviewUrlFromDataset(btnOrObj) {
  const path = (
    btnOrObj?.path ??
    btnOrObj?.image_path ??
    btnOrObj?.dataset?.path ??
    ''
  ).trim();

  const url = (
    btnOrObj?.url ??
    btnOrObj?.image_url ??
    btnOrObj?.dataset?.url ??
    ''
  ).trim();

  // URL pública direta primeiro (igual à Edição de Produtos): não depende das
  // credenciais do backend. O proxy fica só para quando não há URL.
  if (url && /^https?:\/\//i.test(url)) {
    return url;
  }

  if (path) {
    return buildProxyUrlForKey(path);
  }

  return url || '';
}

/* ──────────────────────────────────────────────────────────────
   EXPORT PDF — POSIÇÃO ESTOQUE
────────────────────────────────────────────────────────────── */
export async function exportStockPositionPdf(searchText = '') {
  const q = (searchText || '').trim();

  const sp = new URLSearchParams();

  if (q) {
    sp.set('q', q);
  }

  const url =
    `${API_BASE}/api/products/stock-position/pdf?` +
    sp.toString();

  return await fetchBlob(url, { method: 'GET' });
}

/* ──────────────────────────────────────────────────────────────
   LISTAGEM PRODUTOS
────────────────────────────────────────────────────────────── */
export async function loadFromApi({
  q = '',
  page = 1,
  limit = 50,
  filters = {},
  signal,
} = {}) {

  const sp = new URLSearchParams();

  if (q) {
    sp.set('q', q);
  }

  sp.set('page', String(page || 1));
  sp.set('limit', String(limit || 50));

  /* ✅ FILTROS NOVOS */
  if (filters.status) {
    sp.set('status', filters.status);
  }

  if (filters.manufacturer_id) {
    sp.set('manufacturer_id', filters.manufacturer_id);
  }

  if (filters.supplier_id) {
    sp.set('supplier_id', filters.supplier_id);
  }

  if (filters.group_id) {
    sp.set('group_id', filters.group_id);
  }

  if (filters.subgroup_id) {
    sp.set('subgroup_id', filters.subgroup_id);
  }

  const url = `${API_BASE}/api/products?${sp.toString()}`;

  const res = await fetchJSON(url, { signal });

  const data =
    (res?.data && typeof res.data === 'object')
      ? res.data
      : res;

  const rawRows =
    Array.isArray(data?.rows)
      ? data.rows
      : (Array.isArray(data) ? data : []);

  const rows = await addPriceTablesToProducts(rawRows, signal);

  const total = Number(data?.total);

  const outTotal =
    Number.isFinite(total)
      ? total
      : rows.length;

  const outPg =
    Number(data?.page ?? page) || page;

  const outLim =
    Number(data?.limit ?? limit) || limit;

  console.info('[products] endpoint usado:', url, {
    filters,
    total: outTotal,
    count: rows.length,
    page: outPg,
    limit: outLim,
  });

  return {
    rows,
    total: outTotal,
    page: outPg,
    limit: outLim,
  };
}

/* ──────────────────────────────────────────────────────────────
   FILTROS — OPTIONS
────────────────────────────────────────────────────────────── */
export async function loadProductsFilterOptions() {

  const urls = {
    manufacturers: `${API_BASE}/api/products-manufactures`,
    suppliers: `${API_BASE}/api/products-suppliers`,
    groups: `${API_BASE}/api/products-groups`,
    subgroups: `${API_BASE}/api/products-subgroups`,
  };

  const [
    manufacturers,
    suppliers,
    groups,
    subgroups,
  ] = await Promise.allSettled([
    fetchJSON(urls.manufacturers),
    fetchJSON(urls.suppliers),
    fetchJSON(urls.groups),
    fetchJSON(urls.subgroups),
  ]);

  return {
    manufacturers: normalizeOptions(manufacturers),
    suppliers: normalizeOptions(suppliers),
    groups: normalizeOptions(groups),
    subgroups: normalizeOptions(subgroups),
  };
}

function normalizeOptions(result) {

  if (result.status !== 'fulfilled') {
    console.warn(
      '[products][filters] erro:',
      result.reason
    );

    return [];
  }

  const json = result.value;

  const data = json?.data ?? json;

  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data?.rows)) {
    return data.rows;
  }

  /* ✅ APIs CONSART geralmente retornam:
     { ok:true, data:{ rows:[...] } }
  */
  if (Array.isArray(data?.data?.rows)) {
    return data.data.rows;
  }

  if (Array.isArray(json?.data?.rows)) {
    return json.data.rows;
  }

  if (Array.isArray(json?.rows)) {
    return json.rows;
  }

  return [];
}

/* ──────────────────────────────────────────────────────────────
   UPLOAD IMAGEM
────────────────────────────────────────────────────────────── */
export async function uploadProductImage(productCode, file, barcodeId = null) {

  const code = String(productCode ?? '').trim();

  if (!code) {
    throw new Error('product_code inválido.');
  }

  if (!(file instanceof File || file instanceof Blob)) {
    throw new Error('Arquivo inválido.');
  }

  const form = new FormData();

  form.append('file', file);
  form.append('product_code', code);

  if (barcodeId !== null && barcodeId !== undefined && barcodeId !== '') {
    const normalizedBarcodeId = Number(barcodeId);
    if (!Number.isInteger(normalizedBarcodeId) || normalizedBarcodeId <= 0) {
      throw new Error('barcode_id inválido.');
    }
    form.append('barcode_id', String(normalizedBarcodeId));
  }

  const url =
    `${API_BASE}/api/products/` +
    `${encodeURIComponent(code)}/imagem`;

  const r = await fetch(url, {
    method: 'POST',
    body: form,
  });

  if (!r.ok) {
    let msg = r.statusText;

    try {
      msg = await r.text();
    } catch { }

    throw new Error(`HTTP ${r.status} — ${msg}`);
  }

  const json =
    await r.json().catch(() => ({}));

  const ok = json?.ok !== false;

  const data = json?.data ?? json;

  return { ok, data };
}

/* ──────────────────────────────────────────────────────────────
   EXPORT EXCEL
────────────────────────────────────────────────────────────── */
export async function exportExcel({ q = '', filters = {} } = {}) {
  const params = new URLSearchParams();

  if (q) params.set('q', q);
  if (filters.status) params.set('status', filters.status);
  if (filters.manufacturer_id) {
    params.set('manufacturer_id', filters.manufacturer_id);
  }
  if (filters.supplier_id) {
    params.set('supplier_id', filters.supplier_id);
  }
  if (filters.group_id) {
    params.set('group_id', filters.group_id);
  }
  if (filters.subgroup_id) {
    params.set('subgroup_id', filters.subgroup_id);
  }

  const query = params.toString();
  const url = `${API_BASE}/api/products/export${query ? `?${query}` : ''}`;

  return fetchBlob(url, { method: 'GET' });
}