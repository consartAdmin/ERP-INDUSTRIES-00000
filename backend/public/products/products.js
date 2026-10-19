// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║ 🛒 public/products/products.js — Lista/Busca de Products (CONSART | ESM)  ║
// ║ Alinhado ao backend /api/products e /api/products/search                  ║
// ║ Campos: product_id, product_code, description, barcode, manufacturer_ref, ║
// ║         cost_price, stock_qty, price_varejo, product_location_id,         ║
// ║         is_active, imagem opcional, flag de produto fiscal                ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

/* ========================================================================== */
/* Estado                                                                     */
/* ========================================================================== */
let state = {
  page: 1,
  limit: 50,
  q: '',
  loading: false,
  aborter: null,
};

/* ========================================================================== */
/* Utils                                                                      */
/* ========================================================================== */
const qs  = (s, el = document) => el.querySelector(s);
const qsa = (s, el = document) => Array.from(el.querySelectorAll(s));

function fmtInt(v, def = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : def;
}
function fmtMoney(v) {
  const n = Number(v);
  return Number.isFinite(n)
    ? n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    : '—';
}
function fmtNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString('pt-BR') : '—';
}
function sanitize(v) {
  return (v ?? '').toString().replace(
    /[<>&]/g,
    (s) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[s])
  );
}
function setStatus(msg, type = 'info') {
  const el = qs('#statusArea');
  if (!el) return;
  el.textContent = msg || '';
  el.dataset.type = type;
}
function debounce(fn, ms = 300) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}
function dedupeById(rows) {
  const seen = new Set();
  return (rows || []).filter((r) => {
    const id = r?.product_id ?? r?.produto_id ?? r?.id;
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

/* ========================================================================== */
/* Helpers p/ obter elementos com IDs antigos/novos                            */
/* ========================================================================== */
function getSearchInput()    { return qs('#txtBusca') || qs('#campoBusca'); }
function getLimitSelect()    { return qs('#selLimit') || qs('#qtdPorPagina'); }
function getExportButton()   { return qs('#btnExport') || qs('#btnExportarExcel'); }
function getStockPdfButton() { return qs('#btnPosicaoEstoque'); } // ✅ FIX

/* ========================================================================== */
/* ✅ Footer (quantidade + página)                                             */
/* ========================================================================== */
function setFooterInfo({ total = null, page = null, pages = null } = {}) {
  const elTotal = qs('#lblTotal');
  const elPag   = qs('#lblPagina');

  if (elTotal) {
    if (Number.isFinite(Number(total))) elTotal.textContent = `${Number(total)} produto(s)`;
    else elTotal.textContent = `— produto(s)`;
  }

  if (elPag) {
    if (Number.isFinite(Number(page)) && Number.isFinite(Number(pages))) {
      elPag.textContent = `Página ${Number(page)} de ${Number(pages)}`;
    } else {
      elPag.textContent = `Página — de —`;
    }
  }
}

/* ========================================================================== */
/* API (inline) — alinhado ao backend (usa window.apiBase)                     */
/* ========================================================================== */
const API_BASE = (window.apiBase || window.location.origin || '').replace(/\/+$/, '');

async function fetchJSON(url, opts = {}) {
  const r = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });

  if (!r.ok) {
    let msg = r.statusText;
    try { msg = await r.text(); } catch {}
    throw new Error(`HTTP ${r.status} — ${msg}`);
  }

  if (r.status === 204) return null;

  const ct = r.headers.get('content-type') || '';
  if (!ct.toLowerCase().includes('application/json')) {
    const preview = (await r.text().catch(() => '')).slice(0, 200).replace(/\s+/g, ' ');
    throw new Error(`Resposta não-JSON (${ct}). Corpo: ${preview || '(vazio)'}`);
  }
  return await r.json();
}

async function fetchBlob(url, opts = {}) {
  const r = await fetch(url, opts);
  if (!r.ok) {
    let msg = r.statusText;
    try { msg = await r.text(); } catch {}
    throw new Error(`HTTP ${r.status} — ${msg}`);
  }
  return await r.blob();
}

/* ========================================================================== */
/* Signed URL / Proxy (GCS) — usa image_path (key) + cache                     */
/* ========================================================================== */
const SIGNED_TTL_MS = 25 * 60 * 1000;
const _signedCache = new Map(); // key -> { url, exp }

async function getSignedUrlForKey(key) {
  const k = (key || '').trim();
  if (!k) return '';

  const now = Date.now();
  const hit = _signedCache.get(k);
  if (hit?.url && hit.exp > now) return hit.url;

  const url = `${API_BASE}/api/gcs/images/signed-url?key=${encodeURIComponent(k)}`;
  const json = await fetchJSON(url);

  if (json?.ok && json?.url) {
    _signedCache.set(k, { url: json.url, exp: now + SIGNED_TTL_MS });
    return json.url;
  }
  return '';
}

function buildProxyUrlForKey(key) {
  const k = (key || '').trim();
  if (!k) return '';
  return `${API_BASE}/api/gcs/images/proxy?key=${encodeURIComponent(k)}`;
}

async function resolvePreviewUrlFromDataset(btnOrObj) {
  const path = (btnOrObj?.path ?? btnOrObj?.image_path ?? btnOrObj?.dataset?.path ?? '').trim();
  const url  = (btnOrObj?.url  ?? btnOrObj?.image_url  ?? btnOrObj?.dataset?.url  ?? '').trim();

  // ✅ 1) se tem image_path: usa SEMPRE proxy (same-origin)
  if (path) return buildProxyUrlForKey(path);

  // ✅ 2) se só tem URL (GCS pública), tenta proxy por URL
  if (url && /https?:\/\/storage\.googleapis\.com\//i.test(url)) {
    return `${API_BASE}/api/gcs/images/proxy?url=${encodeURIComponent(url)}`;
  }

  return url || '';
}

/* ========================================================================== */
/* Export PDF - Posição de Estoque                                             */
/* ========================================================================== */
async function exportStockPositionPdf() {
  const q = (getSearchInput()?.value || '').trim();

  const sp = new URLSearchParams();
  if (q) sp.set('q', q);

  const url = `${API_BASE}/api/products/stock-position/pdf?${sp.toString()}`;
  return await fetchBlob(url, { method: 'GET' });
}

/* ========================================================================== */
/* Lista de produtos com busca e paginação                                     */
/* ========================================================================== */
async function loadFromApi({ q = '', page = 1, limit = 50 } = {}) {
  const signal = state?.aborter?.signal;

  const sp = new URLSearchParams();
  if (q) sp.set('q', q);
  sp.set('page', String(page || 1));
  sp.set('limit', String(limit || 50));

  const url = q
    ? `${API_BASE}/api/products/search?${sp.toString()}`
    : `${API_BASE}/api/products?${sp.toString()}`;

  const res = await fetchJSON(url, { signal });

  // Normaliza retorno
  const data = (res?.data && typeof res.data === 'object') ? res.data : res;
  const rows = Array.isArray(data?.rows) ? data.rows : (Array.isArray(data) ? data : []);

  const total = Number(data?.total);
  const outTotal = Number.isFinite(total) ? total : rows.length;

  const outPg  = Number(data?.page  ?? page)  || page;
  const outLim = Number(data?.limit ?? limit) || limit;

  console.info('[products] endpoint usado:', url, { total: outTotal, count: rows.length, page: outPg, limit: outLim });
  return { rows, total: outTotal, page: outPg, limit: outLim };
}

/* ========================================================================== */
/* Upload de imagem — /api/products/:id/imagem                                  */
/* ========================================================================== */
async function uploadProductImage(productId, file) {
  const form = new FormData();
  form.append('file', file);

  const url = `${API_BASE}/api/products/${encodeURIComponent(productId)}/imagem`;
  const r = await fetch(url, { method: 'POST', body: form });

  if (!r.ok) {
    let msg = r.statusText;
    try { msg = await r.text(); } catch {}
    throw new Error(`HTTP ${r.status} — ${msg}`);
  }

  const json = await r.json().catch(() => ({}));
  const ok   = json?.ok !== false;
  const data = json?.data ?? json;
  return { ok, data };
}

/* ========================================================================== */
/* Exportação Excel                                                            */
/* ========================================================================== */
async function exportExcel() {
  const url = `${API_BASE}/api/products/export`;
  return await fetchBlob(url, { method: 'GET' });
}

/* ========================================================================== */
/* Carregar lista                                                             */
/* ========================================================================== */
async function loadProducts() {
  try {
    if (state.loading) state.aborter?.abort?.();
    state.aborter = new AbortController();
    state.loading = true;

    setStatus('Carregando produtos…');
    setFooterInfo({ total: null, page: null, pages: null });

    const data = await loadFromApi({ q: state.q, page: state.page, limit: state.limit });
    const rows = dedupeById(data?.rows);

    renderTable(rows);

    renderPagination({
      total: data?.total ?? 0,
      page:  data?.page  ?? state.page,
      limit: data?.limit ?? state.limit
    });

    // ✅ Status topo
    setStatus(`${data?.total ?? rows.length} produto(s)`, 'info');

    // ✅ Footer
    const total = Number(data?.total ?? rows.length) || 0;
    const pages = Math.max(Math.ceil(total / (state.limit || 1)), 1);
    setFooterInfo({ total, page: state.page, pages });

  } catch (err) {
    console.error('Erro ao carregar products:', err);
    setStatus(`Erro ao carregar products: ${err.message || err}`, 'error');
    setFooterInfo({ total: null, page: null, pages: null });
  } finally {
    state.loading = false;
  }
}

/* ========================================================================== */
/* Tabela                                                                     */
/* ========================================================================== */
function mapRow(r) {
  const product_imagem_id = r.product_imagem_id ?? r.productImagemId ?? null;

  const image_url  = r.image_url ?? r.imagem_url ?? '';
  const image_path = r.image_path ?? r.imagePath ?? r.imagem_path ?? '';

  const product_fiscal_id =
    r.product_fiscal_id ??
    r.produto_fiscal_id ??
    r.products_fiscal_id ??
    null;

  const has_fiscal_product =
    (typeof r.has_fiscal_product === 'boolean')
      ? r.has_fiscal_product
      : (typeof r.hasFiscalProduct === 'boolean')
        ? r.hasFiscalProduct
        : !!product_fiscal_id;

  const stockValue =
    r.stock ??
    r.stock_qty ??
    r.estoque ??
    null;

  const priceRetail =
    r.price_varejo ??
    r.preco_venda ??
    r.sale_price ??
    null;

  return {
    product_id:          r.product_id ?? r.produto_id ?? r.id ?? null,
    product_code:        r.product_code ?? r.sku ?? r.codigo ?? '',
    description:         r.description ?? r.descricao ?? '',
    barcode:             r.barcode ?? r.codigo_barras ?? '',
    manufacturer_ref:    r.manufacturer_ref ?? r.ref_fabricante ?? '',
    cost_price:          r.cost_price ?? r.preco_custo ?? null,

    stock:               stockValue,
    price_retail:        priceRetail,

    product_location_id: r.product_location_id ?? r.localizacao_id ?? null,

    product_imagem_id,
    image_url,
    image_path,
    has_image: !!(product_imagem_id || image_url || image_path),

    has_fiscal_product,
    is_active: (typeof r.is_active === 'boolean') ? r.is_active : true,
  };
}

function renderTable(rows) {
  const tbody = qs('#tblProducts tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (!rows?.length) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="13" class="empty">Nenhum produto encontrado.</td>`;
    tbody.appendChild(tr);
    return;
  }

  for (const raw of rows) {
    const r = mapRow(raw);
    const productCodeParam = encodeURIComponent(String(r.product_code ?? '').trim());

    const tr = document.createElement('tr');
    tr.dataset.id = r.product_id ?? '';

    const ativoBadge = r.is_active
      ? `<span class="badge ok">Ativo</span>`
      : `<span class="badge off">Inativo</span>`;

    const precoCusto   = fmtMoney(r.cost_price);
    const precoVarejo  = fmtMoney(r.price_retail);
    const estoque      = (r.stock == null ? '—' : fmtNumber(r.stock));
    const hasImg       = !!r.has_image;

    const fiscalIcon = r.has_fiscal_product
      ? `<span class="pf-icon pf-ok">✓</span>`
      : `<span class="pf-icon pf-none">✕</span>`;

    const cameraBtn = `
      <button
        type="button"
        class="btn btn-toolbar btn-sm btn-camera ${hasImg ? 'has-image' : 'no-image'}"
        data-url="${sanitize(r.image_url || '')}"
        data-path="${sanitize(r.image_path || '')}"
        title="${hasImg ? 'Visualizar foto' : 'Sem foto'}"
        aria-label="${hasImg ? 'Visualizar foto' : 'Sem foto'}"
      >📷</button>
    `;

    tr.innerHTML = `
      <td class="col-id">${r.product_id ?? ''}</td>
      <td class="col-code">${sanitize(r.product_code)}</td>
      <td class="col-descricao">${sanitize(r.description)}</td>
      <td class="col-codbarras">${sanitize(r.barcode) || '—'}</td>
      <td class="col-ref">${sanitize(r.manufacturer_ref) || '—'}</td>
      <td class="col-preco-custo">${precoCusto}</td>
      <td class="col-preco-varejo">${precoVarejo}</td>
      <td class="col-estoque">${estoque}</td>
      <td class="col-local">${r.product_location_id ?? '—'}</td>
      <td class="col-ativo">${ativoBadge}</td>
      <td class="col-fiscal">${fiscalIcon}</td>

      <td class="col-img">
        ${cameraBtn}
        <label class="btn btn-toolbar btn-sm btn-upload" title="Enviar imagem">
          📎
          <input type="file" accept="image/*" data-id="${r.product_id ?? ''}" hidden>
        </label>
      </td>

      <td class="col-actions">
        <a
          class="btn btn-toolbar btn-sm"
          href="/public/editProducts/editProducts.html?product_code=${productCodeParam}"
          title="Editar produto ${sanitize(r.product_code)}"
        >Editar</a>
      </td>
    `;

    tbody.appendChild(tr);
    makeRowDraggable(tr, r.product_id);
  }

  // Upload por linha
  qsa('input[type="file"][data-id]', tbody).forEach((inp) => {
    inp.addEventListener('change', onUploadImageTable);
  });

  // Hover/Click/Drop no botão da câmera
  qsa('button.btn-camera', tbody).forEach((btn) => {
    btn.addEventListener('mouseenter', onCameraEnter);
    btn.addEventListener('mousemove', onCameraMove);
    btn.addEventListener('mouseleave', onCameraLeave);
    btn.addEventListener('click', onCameraClick);

    btn.addEventListener('dragover', onCameraDragOver);
    btn.addEventListener('dragenter', onCameraDragOver);
    btn.addEventListener('dragleave', onCameraDragLeave);
    btn.addEventListener('drop', onCameraDrop);

    makeCameraButtonDropTarget(btn);
  });

  updateCameraFocusStyles();
}

/* ========================================================================== */
/* Drag da linha                                                              */
/* ========================================================================== */
function makeRowDraggable(tr, productId) {
  const id = fmtInt(productId);
  if (!tr || !id) return;

  tr.setAttribute('draggable', 'true');

  tr.addEventListener('dragstart', (e) => {
    e.dataTransfer.effectAllowed = 'copyMove';
    e.dataTransfer.setData('productId', String(id));
    tr.classList.add('is-dragging');
  });

  tr.addEventListener('dragend', () => {
    tr.classList.remove('is-dragging');
  });
}

/* ========================================================================== */
/* Drop target do botão câmera                                                 */
/* ========================================================================== */
function makeCameraButtonDropTarget(btn) {
  if (!btn) return;

  btn.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    btn.classList.add('camera-drop-hover');
  });

  btn.addEventListener('dragleave', (e) => {
    e.preventDefault();
    btn.classList.remove('camera-drop-hover');
  });

  btn.addEventListener('drop', (e) => {
    e.preventDefault();
    btn.classList.remove('camera-drop-hover');

    const productIdRaw = e.dataTransfer.getData('productId');
    const productId = fmtInt(productIdRaw);
    if (!productId) return;

    window.currentProductForCamera = productId;

    if (typeof window.onProductDroppedInCamera === 'function') {
      try { window.onProductDroppedInCamera(productId); }
      catch (err) { console.error('[products] erro em onProductDroppedInCamera (button):', err); }
    }

    setStatus?.(`Produto #${productId} selecionado na câmera.`, 'info');
    updateCameraFocusStyles();
  });
}

/* ========================================================================== */
/* Drop zone da câmera                                                         */
/* ========================================================================== */
function bindCameraDropZone() {
  const area = qs('#cameraArea') || qs('[data-camera-dropzone]');
  if (!area) {
    console.warn('[products] Nenhuma área de câmera encontrada para drop (id="cameraArea" ou [data-camera-dropzone]).');
    return;
  }
  if (area._cameraDropBound) return;
  area._cameraDropBound = true;

  area.addEventListener('dragover', onCameraDragOver);
  area.addEventListener('dragleave', onCameraDragLeave);
  area.addEventListener('drop', onCameraDrop);
}

function onCameraDragOver(e) {
  e.preventDefault();
  const area = e.currentTarget;
  area?.classList?.add('camera-drop-hover');
  if (e.dataTransfer) e.dataTransfer.dropEffect = e.dataTransfer.files?.length ? 'copy' : 'move';
}

function onCameraDragLeave(e) {
  e.preventDefault();
  const area = e.currentTarget;
  area?.classList?.remove('camera-drop-hover');
}

async function onCameraDrop(e) {
  e.preventDefault();
  e.stopPropagation();

  const area = e.currentTarget;
  area?.classList?.remove('camera-drop-hover');

  const dt = e.dataTransfer;
  if (!dt) return;

  let productId = 0;
  const tr = area.closest ? area.closest('tr') : null;
  if (tr?.dataset?.id) productId = fmtInt(tr.dataset.id);

  if (!productId && tr) {
    const fileInput = tr.querySelector('input[type="file"][data-id]');
    if (fileInput?.dataset?.id) productId = fmtInt(fileInput.dataset.id);
  }

  if (!productId && window.currentProductForCamera) {
    productId = fmtInt(window.currentProductForCamera);
  }

  // Arquivo (foto)
  if (dt.files && dt.files.length) {
    const file = dt.files[0];
    if (!file) return;

    if (!productId) {
      setStatus?.('Selecione um produto antes de arrastar a foto.', 'error');
      return;
    }

    try {
      setStatus?.(`Enviando imagem do produto #${productId}…`);

      const res = await uploadProductImage(productId, file);
      if (!res?.ok) throw new Error(res?.error || 'Falha no upload.');

      const url  = res.data?.image_url || res.data?.imagem_url || res.data?.url || '';
      const path = res.data?.image_path || res.data?.imagePath || res.data?.path || '';

      const cam = tr?.querySelector('button.btn-camera');
      if (cam) {
        cam.dataset.url  = url || '';
        cam.dataset.path = path || '';
        cam.classList.toggle('has-image', !!(url || path));
        cam.classList.toggle('no-image', !(url || path));
        cam.title = (url || path) ? 'Visualizar foto' : 'Sem foto';
        cam.setAttribute('aria-label', cam.title);
      }

      setStatus?.(`Imagem atualizada para o produto #${productId}.`, 'success');
      updateCameraFocusStyles();
    } catch (err) {
      console.error('[products] Falha ao enviar imagem via drop:', err);
      setStatus?.(`Falha ao enviar imagem: ${err.message || err}`, 'error');
    }
    return;
  }

  // Linha (produto)
  const productIdRaw = dt.getData('productId');
  const productIdFromDrag = fmtInt(productIdRaw);
  const finalId = productIdFromDrag || productId;
  if (!finalId) return;

  window.currentProductForCamera = finalId;

  if (typeof window.onProductDroppedInCamera === 'function') {
    try { window.onProductDroppedInCamera(finalId); }
    catch (err) { console.error('[products] erro em onProductDroppedInCamera:', err); }
  }

  updateCameraFocusStyles();
  setStatus?.(`Produto #${finalId} selecionado na câmera.`, 'info');
}

/* ========================================================================== */
/* Foco visual da câmera                                                       */
/* ========================================================================== */
function updateCameraFocusStyles() {
  const current = fmtInt(window.currentProductForCamera || 0);
  const cams = qsa('button.btn-camera');

  cams.forEach((btn) => {
    const tr = btn.closest('tr');
    const id = fmtInt(tr?.dataset?.id || 0);
    const isFocused = current && id === current;

    btn.classList.toggle('camera-focused', isFocused);
    const noFocus = !current;
    btn.classList.toggle('camera-unfocused', noFocus);
  });
}

/* ========================================================================== */
/* Upload (tabela)                                                             */
/* ========================================================================== */
async function onUploadImageTable(ev) {
  const input = ev.currentTarget;
  const id = fmtInt(input.dataset.id);
  if (!id || !input.files?.length) return;

  const file = input.files[0];
  setStatus?.(`Enviando imagem do produto #${id}…`);

  try {
    const res = await uploadProductImage(id, file);
    if (!res?.ok) throw new Error(res?.error || 'Falha no upload.');

    const tr = input.closest('tr');
    const cam = tr?.querySelector('button.btn-camera');

    const url  = res.data?.image_url || res.data?.imagem_url || res.data?.url || '';
    const path = res.data?.image_path || res.data?.imagePath || res.data?.path || '';

    if (cam) {
      cam.dataset.url  = url || '';
      cam.dataset.path = path || '';
      cam.classList.toggle('has-image', !!(url || path));
      cam.classList.toggle('no-image', !(url || path));
      cam.title = (url || path) ? 'Visualizar foto' : 'Sem foto';
      cam.setAttribute('aria-label', cam.title);
    }

    setStatus?.(`Imagem atualizada para o produto #${id}.`, 'success');
    updateCameraFocusStyles();
  } catch (err) {
    console.error('Upload falhou:', err);
    setStatus?.(`Falha ao enviar imagem: ${err.message || err}`, 'error');
  } finally {
    input.value = '';
  }
}

/* ========================================================================== */
/* Preview hover da câmera                                                     */
/* ========================================================================== */
let _previewEl = null;
let _previewPinnedUntil = 0;

function ensurePreviewEl() {
  if (_previewEl) return _previewEl;

  const el = document.createElement('div');
  el.className = 'img-hover-preview';
  el.style.position = 'fixed';
  el.style.zIndex = '9999';
  el.style.pointerEvents = 'none';
  el.style.background = 'white';
  el.style.border = '1px solid var(--line, #e5e7eb)';
  el.style.boxShadow = 'var(--shadow, 0 6px 20px rgba(2,6,23,.08))';
  el.style.borderRadius = '10px';
  el.style.padding = '6px';
  el.style.display = 'none';
  el.innerHTML = `<img alt="preview" style="max-width:220px; max-height:220px; display:block; border-radius:8px;">`;

  document.body.appendChild(el);
  _previewEl = el;

  const img = el.querySelector('img');
  img.addEventListener('error', () => {
    console.warn('[products] IMG preview falhou ao carregar:', img.src);
  });

  return el;
}

async function onCameraEnter(e) {
  const btn = e.currentTarget;
  const urlDirect = btn.dataset.url || '';
  const path = btn.dataset.path || '';
  if (!urlDirect && !path) return;

  const el = ensurePreviewEl();
  const img = el.querySelector('img');

  el.style.display = 'block';
  positionPreview(e);

  try {
    const finalUrl = await resolvePreviewUrlFromDataset({ dataset: { url: urlDirect, path } });
    if (!finalUrl) { el.style.display = 'none'; return; }
    img.src = finalUrl;
  } catch (err) {
    console.warn('[products] preview resolve failed:', err);
    if (urlDirect) img.src = urlDirect;
    else el.style.display = 'none';
  }
}

function onCameraMove(e) {
  if (!_previewEl || _previewEl.style.display === 'none') return;
  positionPreview(e);
}

function onCameraLeave() {
  if (Date.now() < _previewPinnedUntil) return;
  if (_previewEl) _previewEl.style.display = 'none';
}

async function onCameraClick(e) {
  const btn = e.currentTarget;
  const urlDirect = btn.dataset.url || '';
  const path = btn.dataset.path || '';
  if (!urlDirect && !path) return;

  const el = ensurePreviewEl();
  const img = el.querySelector('img');

  el.style.display = 'block';
  _previewPinnedUntil = Date.now() + 2000;

  try {
    const finalUrl = await resolvePreviewUrlFromDataset({ dataset: { url: urlDirect, path } });
    if (finalUrl) img.src = finalUrl;
    else if (urlDirect) img.src = urlDirect;
  } catch (err) {
    console.warn('[products] preview resolve failed (click):', err);
    if (urlDirect) img.src = urlDirect;
  }

  setTimeout(() => {
    if (Date.now() >= _previewPinnedUntil && el) el.style.display = 'none';
  }, 2100);
}

function positionPreview(e) {
  const el = ensurePreviewEl();
  const pad = 12;
  let x = e.clientX + pad;
  let y = e.clientY + pad;

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const rect = el.getBoundingClientRect();

  if (x + rect.width > vw - pad)  x = e.clientX - rect.width - pad;
  if (y + rect.height > vh - pad) y = e.clientY - rect.height - pad;

  el.style.left = `${Math.max(0, x)}px`;
  el.style.top  = `${Math.max(0, y)}px`;
}

/* ========================================================================== */
/* Paginação (✅ FIX total + classe pg)                                        */
/* ========================================================================== */
function renderPagination({ total, page, limit }) {
  state.page = page;
  state.limit = limit;

  const el = qs('#paginacao');
  if (!el) return;

  const pages = Math.max(Math.ceil((total || 0) / (limit || 1)), 1);

  const mk = (p, label = p, disabled = false, current = false) => `
    <button
      class="btn btn-toolbar btn-sm pg ${current ? 'is-active' : ''}"
      data-p="${p}"
      ${disabled ? 'disabled' : ''}
      type="button"
    >${label}</button>
  `;

  let html = '';
  html += mk(1, '« Primeiro', page === 1);
  html += mk(Math.max(1, page - 1), '‹ Anterior', page === 1);

  const win = 5;
  const start = Math.max(1, page - Math.floor(win / 2));
  const end = Math.min(pages, start + win - 1);
  for (let p = start; p <= end; p++) html += mk(p, String(p), false, p === page);

  html += mk(Math.min(pages, page + 1), 'Próxima ›', page === pages);
  html += mk(pages, 'Última »', page === pages);

  el.innerHTML = html;

  qsa('button.pg', el).forEach((btn) => {
    btn.addEventListener('click', () => {
      const p = fmtInt(btn.dataset.p, 1);
      if (p !== state.page) {
        state.page = p;
        loadProducts();
      }
    });
  });

  setFooterInfo({ total: Number(total) || 0, page: state.page, pages });
}

/* ========================================================================== */
/* Exportar Excel                                                             */
/* ========================================================================== */
function bindExport() {
  const btn = getExportButton();
  if (!btn) return;

  btn.addEventListener('click', async () => {
    try {
      setStatus('Gerando Excel…');
      const blob = await exportExcel();

      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'produtos.xlsx';
      document.body.appendChild(a);
      a.click();
      a.remove();

      setStatus('Excel exportado com sucesso.', 'success');
    } catch (err) {
      console.error('Export falhou:', err);
      setStatus(`Falha ao exportar Excel: ${err.message || err}`, 'error');
    }
  });
}

/* ========================================================================== */
/* Busca e limit                                                              */
/* ========================================================================== */
function bindSearch() {
  const txt = getSearchInput();
  if (!txt) return;

  const run = debounce(() => {
    state.q = (txt.value || '').trim();
    state.page = 1;
    loadProducts();
  }, 350);

  txt.addEventListener('input', run);

  const btnBuscar = qs('#btnBuscar');
  if (btnBuscar) {
    btnBuscar.addEventListener('click', () => {
      state.q = (txt.value || '').trim();
      state.page = 1;
      loadProducts();
    });
  }
}

function bindLimit() {
  const sel = getLimitSelect();
  if (!sel) return;

  sel.addEventListener('change', () => {
    state.limit = fmtInt(sel.value, 20);
    state.page = 1;
    loadProducts();
  });
}

/* ========================================================================== */
/* PDF Posição Estoque                                                        */
/* ========================================================================== */
function bindStockPdf() {
  const btn = getStockPdfButton();
  if (!btn) {
    console.warn('[products] Botão #btnPosicaoEstoque não encontrado no HTML.');
    return;
  }

  btn.addEventListener('click', async () => {
    try {
      setStatus('Gerando PDF (Posição de Estoque)…');

      const blob = await exportStockPositionPdf();

      const d = new Date();
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');

      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `posicao_estoque_${yyyy}-${mm}-${dd}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();

      setStatus('PDF gerado com sucesso.', 'success');
    } catch (err) {
      console.error('[products] PDF falhou:', err);
      setStatus(`Falha ao gerar PDF: ${err.message || err}`, 'error');
    }
  });
}

/* ========================================================================== */
/* Bootstrap                                                                  */
/* ========================================================================== */
function bootstrap() {
  try {
    const sel = getLimitSelect();
    if (sel) state.limit = fmtInt(sel.value, 20);

    bindSearch();
    bindLimit();
    bindExport();
    bindCameraDropZone();
    bindStockPdf();

    loadProducts();
  } catch (e) {
    console.error('[products] bootstrap error:', e);
    setStatus('Falha ao inicializar a página de produtos.', 'error');
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap, { once: true });
} else {
  bootstrap();
}

/* ========================================================================== */
/* ⚠️ Observação                                                               */
/* ========================================================================== */
/* Você já tinha referências a CSS e funções:                                  */
/* - cameraArea / data-camera-dropzone (se não existir no HTML, fica warning) */
/* - window.onProductDroppedInCamera (opcional)                                */
/* Tudo isso está “safe” e não quebra a página.                               */
