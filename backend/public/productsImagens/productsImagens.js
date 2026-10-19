/* ╔══════════════════════════════════════════════════════════════════════╗
   ║ FILE: productsImagens.js                                            ║
   ║ MODULE: Gestão de Imagens de Produtos                               ║
   ║ PRODNEX ERP                                                         ║
   ║ Frontend ESM com modal para nova imagem + busca de produto          ║
   ║ ✅ Integra productsModalSearch.js                                   ║
   ║ ✅ Busca por SKU / descrição / código de barras                     ║
   ║ ✅ Mantém compatibilidade com product_id digitado manualmente       ║
   ║ ✅ Permite selecionar produto no campo principal e no modal         ║
   ╚══════════════════════════════════════════════════════════════════════╝ */

'use strict';

import { openProductsModalSearch } from '/public/modalsSearch/productsModalSearch.js';

const API_BASE =
  (window.API_BASE || window.apiBase || window.location.origin || '').replace(/\/$/, '');

const DEBUG = true;

const ROUTES = {
  listByProduct: (productId) =>
    `${API_BASE}/api/products-imagens/product/${encodeURIComponent(productId)}`,

  getById: (id) =>
    `${API_BASE}/api/products-imagens/${encodeURIComponent(id)}`,

  create: () =>
    `${API_BASE}/api/products-imagens`,

  update: (id) =>
    `${API_BASE}/api/products-imagens/${encodeURIComponent(id)}`,

  setPrimary: (id) =>
    `${API_BASE}/api/products-imagens/${encodeURIComponent(id)}/primary`,

  reorder: (productId) =>
    `${API_BASE}/api/products-imagens/product/${encodeURIComponent(productId)}/reorder`,

  remove: (id) =>
    `${API_BASE}/api/products-imagens/${encodeURIComponent(id)}`
};

const state = {
  currentProductId: null,
  currentProductCode: '',
  currentProductDescription: '',
  currentProductBarcode: '',
  images: [],
  dirtyOrder: false,
  loading: false
};

const $ = (selector, root = document) => root.querySelector(selector);

function log(...args) {
  if (DEBUG) console.log('[productsImagens]', ...args);
}

function warn(...args) {
  console.warn('[productsImagens]', ...args);
}

function errlog(...args) {
  console.error('[productsImagens]', ...args);
}

function safeEl(selector) {
  return $(selector);
}

function toInt(value, fallback = null) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

function toBool(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (value === null || value === undefined || value === '') return fallback;

  const v = String(value).trim().toLowerCase();
  if (['true', '1', 'yes', 'y', 'on', 'sim'].includes(v)) return true;
  if (['false', '0', 'no', 'n', 'off', 'nao', 'não'].includes(v)) return false;

  return fallback;
}

function normalizeString(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatDateTimeBR(value) {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString('pt-BR');
}

function resolveImageSrc(item) {
  const url = normalizeString(item?.image_url);
  const path = normalizeString(item?.image_path);
  if (url) return url;
  if (path) return path;
  return '';
}

function getAuthHeaders() {
  const token =
    localStorage.getItem('CONSART_TOKEN') ||
    localStorage.getItem('token') ||
    localStorage.getItem('access_token') ||
    localStorage.getItem('auth_token') ||
    localStorage.getItem('jwt') ||
    sessionStorage.getItem('CONSART_TOKEN') ||
    sessionStorage.getItem('token') ||
    sessionStorage.getItem('access_token') ||
    sessionStorage.getItem('auth_token') ||
    sessionStorage.getItem('jwt');

  return token
    ? {
        Authorization: `Bearer ${token}`,
        'x-access-token': token
      }
    : {};
}

function toast(message, type = 'info') {
  const prefix =
    type === 'error' ? '❌' :
    type === 'success' ? '✅' :
    type === 'warning' ? '⚠️' : 'ℹ️';

  log(`${type.toUpperCase()}: ${message}`);
  window.alert(`${prefix} ${message}`);
}

function setLoading(flag) {
  state.loading = Boolean(flag);

  const btnLoadImages = safeEl('#btnLoadImages');
  const btnSaveOrder = safeEl('#btnSaveOrder');
  const btnResetScreen = safeEl('#btnResetScreen');
  const btnOpenNewImageModal = safeEl('#btnOpenNewImageModal');
  const btnSearchProduct = safeEl('#btnSearchProduct');
  const btnSearchProductModal = safeEl('#btnSearchProductModal');

  if (btnLoadImages) {
    btnLoadImages.disabled = state.loading;
    btnLoadImages.textContent = state.loading ? 'Carregando...' : 'Carregar Imagens';
  }

  if (btnSaveOrder) {
    btnSaveOrder.disabled = state.loading || !state.dirtyOrder || !state.images.length;
  }

  if (btnResetScreen) btnResetScreen.disabled = state.loading;
  if (btnOpenNewImageModal) btnOpenNewImageModal.disabled = state.loading;
  if (btnSearchProduct) btnSearchProduct.disabled = state.loading;
  if (btnSearchProductModal) btnSearchProductModal.disabled = state.loading;
}

function setGalleryMessage(message, isEmpty = true) {
  const empty = safeEl('#galleryEmpty');
  const list = safeEl('#galleryList');
  if (!empty || !list) return;

  empty.innerHTML = message || 'Nenhuma imagem encontrada.';
  empty.style.display = isEmpty ? 'block' : 'none';

  if (isEmpty) list.innerHTML = '';
}

async function fetchJSON(url, options = {}) {
  let parsedBody = null;
  try {
    parsedBody = options.body ? JSON.parse(options.body) : null;
  } catch {
    parsedBody = options.body ?? null;
  }

  log('fetchJSON ->', options.method || 'GET', url, parsedBody);

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
      ...(options.headers || {})
    }
  });

  const rawText = await response.text();
  let data = null;

  try {
    data = rawText ? JSON.parse(rawText) : null;
  } catch {
    data = { raw: rawText };
  }

  log('fetchJSON <- status:', response.status, 'response:', data);

  if (!response.ok) {
    const message =
      data?.error ||
      data?.message ||
      data?.data?.error ||
      `Erro HTTP ${response.status}`;

    const error = new Error(message);
    error.status = response.status;
    error.payload = data;
    throw error;
  }

  return data;
}

function normalizeRows(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.rows)) return payload.rows;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.data?.rows)) return payload.data.rows;
  if (Array.isArray(payload?.data?.items)) return payload.data.items;
  if (Array.isArray(payload?.result)) return payload.result;
  return [];
}

function normalizeImage(row = {}) {
  return {
    product_imagem_id: toInt(row.product_imagem_id, 0),
    product_id: toInt(row.product_id, 0),
    image_url: normalizeString(row.image_url),
    image_path: normalizeString(row.image_path),
    image_alt: normalizeString(row.image_alt),
    is_primary: toBool(row.is_primary, false),
    position: toInt(row.position, 1) ?? 1,
    is_active: toBool(row.is_active, true),
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null
  };
}

function sortImages(a, b) {
  if ((a.position ?? 0) !== (b.position ?? 0)) {
    return (a.position ?? 0) - (b.position ?? 0);
  }
  return (a.product_imagem_id ?? 0) - (b.product_imagem_id ?? 0);
}

/* =========================================================================
 * PRODUCT SEARCH / SELECTION
 * ========================================================================= */

function getProductCode(product = {}) {
  return normalizeString(
    product.product_code ??
    product.sku ??
    product.codigo ??
    product.code
  );
}

function getProductDescription(product = {}) {
  return normalizeString(
    product.description ??
    product.descricao ??
    product.nome ??
    product.name
  );
}

function getProductId(product = {}) {
  return toInt(
    product.product_id ??
    product.id,
    null
  );
}

function getProductBarcode(product = {}) {
  return normalizeString(
    product.matched_barcode ??
    product.barcode ??
    product.product_barcode ??
    product.codigo_barras ??
    product.ean ??
    product.gtin
  );
}

function buildProductDisplayText({ productId, productCode, description, barcode }) {
  const parts = [];

  if (productCode) parts.push(productCode);
  if (description) parts.push(description);

  let text = parts.join(' — ');

  if (productId) {
    text += text ? ` [ID ${productId}]` : `ID ${productId}`;
  }

  if (barcode) {
    text += ` • CB ${barcode}`;
  }

  return text || (productId ? `ID ${productId}` : '');
}

function syncProductIdFields(productId, options = {}) {
  const {
    productCode = '',
    description = '',
    barcode = '',
    writeMainInput = true,
    writeModalInput = true
  } = options;

  const pid = toInt(productId, null);

  if (pid && pid > 0) {
    state.currentProductId = pid;
    state.currentProductCode = normalizeString(productCode);
    state.currentProductDescription = normalizeString(description);
    state.currentProductBarcode = normalizeString(barcode);
  } else {
    state.currentProductId = null;
    state.currentProductCode = '';
    state.currentProductDescription = '';
    state.currentProductBarcode = '';
  }

  const mainInput = safeEl('#productIdSearch');
  if (mainInput) {
    mainInput.dataset.selectedProductId = pid ? String(pid) : '';
    mainInput.dataset.selectedProductCode = normalizeString(productCode);
    mainInput.dataset.selectedProductDescription = normalizeString(description);
    mainInput.dataset.selectedProductBarcode = normalizeString(barcode);

    if (writeMainInput) {
      mainInput.value = pid
        ? buildProductDisplayText({
            productId: pid,
            productCode,
            description,
            barcode
          })
        : '';
    }
  }

  const modalProductIdInput = safeEl('#modalProductId');
  if (modalProductIdInput) {
    modalProductIdInput.value = pid ? String(pid) : '';
    modalProductIdInput.dataset.selectedProductCode = normalizeString(productCode);
    modalProductIdInput.dataset.selectedProductDescription = normalizeString(description);
    modalProductIdInput.dataset.selectedProductBarcode = normalizeString(barcode);
  }

  const modalDisplayInput = safeEl('#modalProductSearch');
  if (modalDisplayInput) {
    modalDisplayInput.dataset.selectedProductId = pid ? String(pid) : '';
    modalDisplayInput.dataset.selectedProductCode = normalizeString(productCode);
    modalDisplayInput.dataset.selectedProductDescription = normalizeString(description);
    modalDisplayInput.dataset.selectedProductBarcode = normalizeString(barcode);

    if (writeModalInput) {
      modalDisplayInput.value = pid
        ? buildProductDisplayText({
            productId: pid,
            productCode,
            description,
            barcode
          })
        : '';
    }
  }
}

function clearSelectedProductData(input) {
  if (!input) return;
  delete input.dataset.selectedProductId;
  delete input.dataset.selectedProductCode;
  delete input.dataset.selectedProductDescription;
  delete input.dataset.selectedProductBarcode;
}

function resolveProductIdFromInput(input) {
  if (!input) return null;

  const datasetId = toInt(input.dataset.selectedProductId, null);
  if (datasetId && datasetId > 0) return datasetId;

  const raw = normalizeString(input.value);
  if (!raw) return null;

  if (/^\d+$/.test(raw)) {
    return toInt(raw, null);
  }

  const m = raw.match(/\[ID\s*(\d+)\]/i);
  if (m?.[1]) {
    return toInt(m[1], null);
  }

  return null;
}

function applyPickedProduct(product = {}, { autoLoad = false } = {}) {
  const productId = getProductId(product);
  const productCode = getProductCode(product);
  const description = getProductDescription(product);
  const barcode = getProductBarcode(product);

  if (!productId || productId <= 0) {
    toast('O produto selecionado não possui product_id válido.', 'warning');
    return;
  }

  syncProductIdFields(productId, {
    productCode,
    description,
    barcode,
    writeMainInput: true,
    writeModalInput: true
  });

  log('Produto selecionado via modal:', {
    productId,
    productCode,
    description,
    barcode
  });

  if (autoLoad) {
    loadImages(productId);
  }
}

function openProductSearchModal({ autoLoad = false } = {}) {
  openProductsModalSearch({
    apiBase: API_BASE,
    onPick: (product) => {
      applyPickedProduct(product, { autoLoad });
    }
  });
}

function openProductSearchModalForCreate() {
  openProductsModalSearch({
    apiBase: API_BASE,
    onPick: (product) => {
      applyPickedProduct(product, { autoLoad: false });
    }
  });
}

function ensureSearchButtons() {
  const mainInput = safeEl('#productIdSearch');
  if (mainInput && !safeEl('#btnSearchProduct')) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'btnSearchProduct';
    btn.className = 'btn btn-light';
    btn.textContent = 'Buscar Produto';
    btn.title = 'Buscar produto por SKU, descrição ou código de barras';
    btn.style.marginLeft = '8px';

    if (mainInput.parentElement) {
      mainInput.parentElement.appendChild(btn);
    }
  }

  const modalProductId = safeEl('#modalProductId');
  const existingModalBtn = safeEl('#btnSearchProductModal');

  if (modalProductId && !existingModalBtn) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'btnSearchProductModal';
    btn.className = 'btn btn-light';
    btn.textContent = 'Buscar Produto';
    btn.title = 'Buscar produto por SKU, descrição ou código de barras';
    btn.style.marginLeft = '8px';

    const wrapper = modalProductId.parentElement;
    if (wrapper) {
      wrapper.appendChild(btn);
    }

    if (!safeEl('#modalProductSearch')) {
      const display = document.createElement('input');
      display.type = 'text';
      display.id = 'modalProductSearch';
      display.placeholder = 'Produto selecionado...';
      display.readOnly = true;
      display.style.marginTop = '8px';
      display.style.width = '100%';

      if (wrapper) {
        wrapper.appendChild(display);
      }
    }
  }
}

/* =========================================================================
 * MODAL
 * ========================================================================= */

function isModalOpen() {
  return safeEl('#newImageModal')?.classList.contains('is-open');
}

function openNewImageModal() {
  const modal = safeEl('#newImageModal');
  if (!modal) return;

  resetModalForm();

  if (state.currentProductId) {
    syncProductIdFields(state.currentProductId, {
      productCode: state.currentProductCode,
      description: state.currentProductDescription,
      barcode: state.currentProductBarcode,
      writeMainInput: false,
      writeModalInput: true
    });
  }

  modal.classList.add('is-open');
  modal.setAttribute('aria-hidden', 'false');

  safeEl('#modalImageUrl')?.focus();
}

function closeNewImageModal() {
  const modal = safeEl('#newImageModal');
  if (!modal) return;

  modal.classList.remove('is-open');
  modal.setAttribute('aria-hidden', 'true');
}

function setModalPreview(src = '') {
  const box = safeEl('#newImageModal .preview-box');
  const img = safeEl('#modalNewImagePreview');

  if (!box || !img) return;

  img.src = src || '';

  if (src) {
    box.classList.add('has-image');
  } else {
    box.classList.remove('has-image');
  }
}

function resetModalForm() {
  const form = safeEl('#formNewImageModal');
  const position = safeEl('#modalPosition');

  form?.reset();
  if (position) position.value = 1;
  setModalPreview('');

  if (state.currentProductId) {
    syncProductIdFields(state.currentProductId, {
      productCode: state.currentProductCode,
      description: state.currentProductDescription,
      barcode: state.currentProductBarcode,
      writeMainInput: false,
      writeModalInput: true
    });
  } else {
    const modalProductId = safeEl('#modalProductId');
    if (modalProductId) modalProductId.value = '';
    const modalProductSearch = safeEl('#modalProductSearch');
    if (modalProductSearch) {
      modalProductSearch.value = '';
      clearSelectedProductData(modalProductSearch);
    }
  }
}

/* =========================================================================
 * MAIN HELPERS
 * ========================================================================= */

function resetScreen() {
  state.currentProductId = null;
  state.currentProductCode = '';
  state.currentProductDescription = '';
  state.currentProductBarcode = '';
  state.images = [];
  state.dirtyOrder = false;

  const productIdSearch = safeEl('#productIdSearch');
  if (productIdSearch) {
    productIdSearch.value = '';
    clearSelectedProductData(productIdSearch);
  }

  const modalProductId = safeEl('#modalProductId');
  if (modalProductId) modalProductId.value = '';

  const modalProductSearch = safeEl('#modalProductSearch');
  if (modalProductSearch) {
    modalProductSearch.value = '';
    clearSelectedProductData(modalProductSearch);
  }

  const list = safeEl('#galleryList');
  const btnSaveOrder = safeEl('#btnSaveOrder');

  if (list) list.innerHTML = '';
  setGalleryMessage('Nenhuma imagem carregada. Selecione um produto e clique em <strong>Carregar Imagens</strong>.', true);

  if (btnSaveOrder) btnSaveOrder.disabled = true;
}

function buildNoDataMessage(productId) {
  return `
    Nenhuma imagem encontrada para o produto <strong>${escapeHtml(productId)}</strong>.<br>
    <small>Esta tela consulta por <strong>product_id interno</strong>.</small>
  `;
}

/* =========================================================================
 * LOAD
 * ========================================================================= */

async function loadImages(productId) {
  const parsedProductId = toInt(productId);

  if (!parsedProductId || parsedProductId <= 0) {
    toast('Selecione um produto válido.', 'warning');
    return;
  }

  setLoading(true);

  try {
    const payload = await fetchJSON(ROUTES.listByProduct(parsedProductId), {
      method: 'GET'
    });

    const rows = normalizeRows(payload);

    state.currentProductId = parsedProductId;
    state.images = rows.map(normalizeImage).sort(sortImages);
    state.dirtyOrder = false;

    renderGallery();

    if (!state.images.length) {
      setGalleryMessage(buildNoDataMessage(parsedProductId), true);
    }
  } catch (error) {
    errlog('loadImages error:', error);
    setGalleryMessage(
      `Falha ao carregar imagens.<br><small>${escapeHtml(error.message || 'Erro desconhecido')}</small>`,
      true
    );
    toast(`Falha ao carregar imagens: ${error.message}`, 'error');
  } finally {
    setLoading(false);
  }
}

/* =========================================================================
 * RENDER
 * ========================================================================= */

function buildGalleryCard(item) {
  const src = resolveImageSrc(item);

  return `
    <div class="gallery-card__preview">
      ${
        src
          ? `<img src="${escapeHtml(src)}" alt="${escapeHtml(item.image_alt || 'Imagem do produto')}" />`
          : `<div class="gallery-card__preview--empty">Sem imagem</div>`
      }
    </div>

    <div class="gallery-card__body">
      <div class="gallery-card__top">
        <div>
          ${item.is_primary ? `<span class="badge badge--primary">Imagem Principal</span>` : ''}
          ${!item.is_active ? `<span class="badge badge--inactive">Inativa</span>` : ''}
        </div>

        <div class="sort-actions">
          <button class="btn btn-light btn-move-up" type="button" data-id="${item.product_imagem_id}" title="Mover para cima">↑</button>
          <button class="btn btn-light btn-move-down" type="button" data-id="${item.product_imagem_id}" title="Mover para baixo">↓</button>
        </div>
      </div>

      <div class="fields-inline fields-gap-3">
        <div><strong>ID:</strong> ${item.product_imagem_id}</div>
        <div><strong>Posição:</strong> ${item.position}</div>
        <div><strong>Produto:</strong> ${item.product_id}</div>
        <div><strong>Status:</strong> ${item.is_active ? 'Ativa' : 'Inativa'}</div>
        <div><strong>Criada em:</strong> ${escapeHtml(formatDateTimeBR(item.created_at))}</div>
        <div><strong>Atualizada em:</strong> ${escapeHtml(formatDateTimeBR(item.updated_at))}</div>
      </div>

      <div class="fields-inline fields-gap-3" data-form-id="${item.product_imagem_id}">
        <div class="fields fields-h-6 fields-w-12 fields-font-3">
          <label>Image URL *</label>
          <input type="text" name="image_url" value="${escapeHtml(item.image_url)}" required />
         </div>
        </div>

        <div class="fields fields-h-6 fields-w-12 fields-font-3">
          <label>Image Path</label>
          <input type="text" name="image_path" value="${escapeHtml(item.image_path)}" />
         </div>
        </div>

       <div class="fields fields-h-6 fields-w-12 fields-font-3">
        <label>Posição</label>
          <input type="number" name="position" min="1" value="${item.position}" />
         </div>
       </div>

        <div class="fields fields-h-6 fields-w-12 fields-font-3">
          <label class="checkbox">
            <input type="checkbox" name="is_active" ${item.is_active ? 'checked' : ''} />
            <span>Ativa</span>
          </label>
        </div>
       </div>
      </div>

      <div class="gallery-actions">
        <button class="btn btn-primary btn-save" type="button" data-id="${item.product_imagem_id}">
          Salvar Alterações
        </button>

        <button class="btn btn-success btn-primary-image" type="button" data-id="${item.product_imagem_id}">
          Tornar Principal
        </button>

        <button class="btn btn-danger btn-delete" type="button" data-id="${item.product_imagem_id}">
          Excluir
        </button>
      </div>
    </div>
  `;
}

function renderGallery() {
  const list = safeEl('#galleryList');
  const empty = safeEl('#galleryEmpty');
  const btnSaveOrder = safeEl('#btnSaveOrder');

  if (!list || !empty) {
    warn('Elementos da galeria não encontrados no HTML.');
    return;
  }

  list.innerHTML = '';

  if (!state.images.length) {
    empty.style.display = 'block';
    if (btnSaveOrder) btnSaveOrder.disabled = true;
    return;
  }

  empty.style.display = 'none';
  if (btnSaveOrder) btnSaveOrder.disabled = !state.dirtyOrder;

  for (const item of state.images) {
    const card = document.createElement('article');
    card.className = `gallery-card ${item.is_primary ? 'is-primary' : ''}`;
    card.dataset.id = String(item.product_imagem_id);
    card.innerHTML = buildGalleryCard(item);
    list.appendChild(card);
  }
}

/* =========================================================================
 * REORDER
 * ========================================================================= */

function moveImage(id, direction) {
  const index = state.images.findIndex((img) => img.product_imagem_id === Number(id));
  if (index < 0) return;

  const targetIndex = direction === 'up' ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= state.images.length) return;

  const current = state.images[index];
  state.images[index] = state.images[targetIndex];
  state.images[targetIndex] = current;

  state.images = state.images.map((item, idx) => ({
    ...item,
    position: idx + 1
  }));

  state.dirtyOrder = true;
  renderGallery();
}

async function saveOrder() {
  if (!state.currentProductId || !state.images.length) {
    toast('Nenhuma imagem carregada para reordenar.', 'warning');
    return;
  }

  setLoading(true);

  try {
    const orderedIds = state.images.map((img) => img.product_imagem_id);

    await fetchJSON(ROUTES.reorder(state.currentProductId), {
      method: 'PATCH',
      body: JSON.stringify({ orderedIds })
    });

    state.dirtyOrder = false;
    toast('Ordem das imagens salva com sucesso.', 'success');
    await loadImages(state.currentProductId);
  } catch (error) {
    errlog('saveOrder error:', error);
    toast(`Falha ao salvar ordem: ${error.message}`, 'error');
  } finally {
    setLoading(false);
  }
}

/* =========================================================================
 * CREATE
 * ========================================================================= */

async function createImageFromModal(event) {
  event.preventDefault();

  const modalProductIdInput = safeEl('#modalProductId');
  const payload = {
    product_id: toInt(modalProductIdInput?.value),
    image_url: normalizeString(safeEl('#modalImageUrl')?.value) || null,
    image_path: normalizeString(safeEl('#modalImagePath')?.value) || null,
    image_alt: normalizeString(safeEl('#modalImageAlt')?.value) || null,
    is_primary: safeEl('#modalIsPrimary')?.checked || false,
    position: toInt(safeEl('#modalPosition')?.value, 1) ?? 1,
    is_active: true
  };

  log('createImageFromModal payload:', payload);

  if (!payload.product_id || payload.product_id <= 0) {
    toast('Selecione um produto válido.', 'warning');
    return;
  }

  if (!payload.image_url) {
    toast('O campo Image URL é obrigatório.', 'warning');
    return;
  }

  setLoading(true);

  try {
    await fetchJSON(ROUTES.create(), {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    toast('Imagem cadastrada com sucesso.', 'success');

    state.currentProductId = payload.product_id;

    if (!state.currentProductCode && modalProductIdInput?.dataset?.selectedProductCode) {
      state.currentProductCode = normalizeString(modalProductIdInput.dataset.selectedProductCode);
    }
    if (!state.currentProductDescription && modalProductIdInput?.dataset?.selectedProductDescription) {
      state.currentProductDescription = normalizeString(modalProductIdInput.dataset.selectedProductDescription);
    }
    if (!state.currentProductBarcode && modalProductIdInput?.dataset?.selectedProductBarcode) {
      state.currentProductBarcode = normalizeString(modalProductIdInput.dataset.selectedProductBarcode);
    }

    syncProductIdFields(payload.product_id, {
      productCode: state.currentProductCode,
      description: state.currentProductDescription,
      barcode: state.currentProductBarcode,
      writeMainInput: true,
      writeModalInput: true
    });

    closeNewImageModal();
    await loadImages(payload.product_id);
  } catch (error) {
    errlog('createImageFromModal error:', error);
    toast(`Falha ao salvar imagem: ${error.message}`, 'error');
  } finally {
    setLoading(false);
  }
}

/* =========================================================================
 * UPDATE
 * ========================================================================= */

async function saveImageCard(id) {
  const form = document.querySelector(`form[data-form-id="${id}"]`);
  if (!form) {
    toast('Formulário da imagem não encontrado.', 'warning');
    return;
  }

  const item = state.images.find((img) => img.product_imagem_id === Number(id));
  if (!item) {
    toast('Imagem não encontrada no estado da tela.', 'warning');
    return;
  }

  const formData = new FormData(form);

  const payload = {
    product_id: item.product_id,
    image_url: normalizeString(formData.get('image_url')) || null,
    image_path: normalizeString(formData.get('image_path')) || null,
    image_alt: normalizeString(formData.get('image_alt')) || null,
    position: toInt(formData.get('position'), 1) ?? 1,
    is_active: formData.get('is_active') === 'on'
  };

  if (!payload.image_url) {
    toast('O campo Image URL é obrigatório.', 'warning');
    return;
  }

  setLoading(true);

  try {
    await fetchJSON(ROUTES.update(id), {
      method: 'PATCH',
      body: JSON.stringify(payload)
    });

    toast('Imagem atualizada com sucesso.', 'success');
    await loadImages(item.product_id);
  } catch (error) {
    errlog('saveImageCard error:', error);
    toast(`Falha ao atualizar imagem: ${error.message}`, 'error');
  } finally {
    setLoading(false);
  }
}

async function makePrimary(id) {
  const item = state.images.find((img) => img.product_imagem_id === Number(id));
  if (!item) {
    toast('Imagem não encontrada.', 'warning');
    return;
  }

  setLoading(true);

  try {
    await fetchJSON(ROUTES.setPrimary(id), {
      method: 'PATCH',
      body: JSON.stringify({
        product_id: item.product_id
      })
    });

    toast('Imagem principal definida com sucesso.', 'success');
    await loadImages(item.product_id);
  } catch (error) {
    errlog('makePrimary error:', error);
    toast(`Falha ao definir imagem principal: ${error.message}`, 'error');
  } finally {
    setLoading(false);
  }
}

async function removeImage(id) {
  const item = state.images.find((img) => img.product_imagem_id === Number(id));
  if (!item) {
    toast('Imagem não encontrada.', 'warning');
    return;
  }

  const ok = window.confirm(`Deseja realmente excluir a imagem ID ${id}?`);
  if (!ok) return;

  setLoading(true);

  try {
    await fetchJSON(ROUTES.remove(id), {
      method: 'DELETE'
    });

    toast('Imagem removida com sucesso.', 'success');
    await loadImages(item.product_id);
  } catch (error) {
    errlog('removeImage error:', error);
    toast(`Falha ao excluir imagem: ${error.message}`, 'error');
  } finally {
    setLoading(false);
  }
}

/* =========================================================================
 * BINDS
 * ========================================================================= */

function bindPreviewInputs() {
  const sync = () => {
    const url = normalizeString(safeEl('#modalImageUrl')?.value);
    const path = normalizeString(safeEl('#modalImagePath')?.value);
    setModalPreview(url || path || '');
  };

  safeEl('#modalImageUrl')?.addEventListener('input', sync);
  safeEl('#modalImagePath')?.addEventListener('input', sync);
}

function bindModalEvents() {
  safeEl('#btnOpenNewImageModal')?.addEventListener('click', openNewImageModal);
  safeEl('#btnCloseNewImageModal')?.addEventListener('click', closeNewImageModal);
  safeEl('#btnCancelNewImageModal')?.addEventListener('click', closeNewImageModal);
  safeEl('#newImageModalBackdrop')?.addEventListener('click', closeNewImageModal);
  safeEl('#formNewImageModal')?.addEventListener('submit', createImageFromModal);

  safeEl('#btnSearchProductModal')?.addEventListener('click', () => {
    openProductSearchModalForCreate();
  });

  safeEl('#modalProductSearch')?.addEventListener('click', () => {
    openProductSearchModalForCreate();
  });

  safeEl('#modalProductSearch')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      openProductSearchModalForCreate();
    }
  });

  safeEl('#modalProductId')?.addEventListener('input', () => {
    const input = safeEl('#modalProductId');
    if (!input) return;

    const parsed = toInt(input.value, null);
    if (parsed && parsed > 0) {
      state.currentProductId = parsed;
      const modalSearch = safeEl('#modalProductSearch');
      if (modalSearch && !normalizeString(modalSearch.value)) {
        modalSearch.value = `ID ${parsed}`;
      }
    } else {
      const modalSearch = safeEl('#modalProductSearch');
      if (modalSearch) {
        modalSearch.value = '';
        clearSelectedProductData(modalSearch);
      }
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isModalOpen()) {
      closeNewImageModal();
    }
  });
}

function bindMainEvents() {
  safeEl('#btnLoadImages')?.addEventListener('click', () => {
    const input = safeEl('#productIdSearch');
    const productId = resolveProductIdFromInput(input);

    log('btnLoadImages -> productId:', productId, {
      rawSearch: normalizeString(input?.value),
      datasetSelectedProductId: input?.dataset?.selectedProductId
    });

    loadImages(productId);
  });

  safeEl('#btnSearchProduct')?.addEventListener('click', () => {
    openProductSearchModal({ autoLoad: false });
  });

  safeEl('#productIdSearch')?.addEventListener('dblclick', () => {
    openProductSearchModal({ autoLoad: false });
  });

  safeEl('#productIdSearch')?.addEventListener('input', () => {
    const input = safeEl('#productIdSearch');
    if (!input) return;

    const raw = normalizeString(input.value);

    if (/^\d+$/.test(raw)) {
      input.dataset.selectedProductId = raw;
      return;
    }

    clearSelectedProductData(input);
  });

  safeEl('#btnResetScreen')?.addEventListener('click', resetScreen);
  safeEl('#btnSaveOrder')?.addEventListener('click', saveOrder);

  safeEl('#productIdSearch')?.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;

    e.preventDefault();

    const input = safeEl('#productIdSearch');
    const raw = normalizeString(input?.value);
    const productId = resolveProductIdFromInput(input);

    if (productId && productId > 0) {
      loadImages(productId);
      return;
    }

    if (raw) {
      openProductSearchModal({ autoLoad: false });
      return;
    }

    toast('Informe um product_id ou clique em "Buscar Produto".', 'warning');
  });

  safeEl('#galleryList')?.addEventListener('click', async (e) => {
    const button = e.target.closest('button');
    if (!button) return;

    const id = Number(button.dataset.id);
    if (!id) return;

    if (button.classList.contains('btn-save')) {
      await saveImageCard(id);
      return;
    }

    if (button.classList.contains('btn-primary-image')) {
      await makePrimary(id);
      return;
    }

    if (button.classList.contains('btn-delete')) {
      await removeImage(id);
      return;
    }

    if (button.classList.contains('btn-move-up')) {
      moveImage(id, 'up');
      return;
    }

    if (button.classList.contains('btn-move-down')) {
      moveImage(id, 'down');
    }
  });
}

/* =========================================================================
 * INIT
 * ========================================================================= */

function init() {
  log('Inicializando módulo productsImagens...');
  log('API_BASE:', API_BASE);
  log('ROUTES:', ROUTES);

  ensureSearchButtons();
  bindMainEvents();
  bindModalEvents();
  bindPreviewInputs();
  resetScreen();
}

document.addEventListener('DOMContentLoaded', init);