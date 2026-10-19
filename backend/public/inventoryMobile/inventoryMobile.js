// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: inventoryMobile.js                                            ║
// ║ MODULE: Inventory Mobile                                            ║
// ║ PRODNEX ERP | Mobile Web                                            ║
// ║ ✅ Usa backend existente de Inventories                              ║
// ║ ✅ Usa Products Mobile para resolver barcode/SKU                     ║
// ║ ✅ Suporte a lote via lot_id                                         ║
// ║ ✅ Localização por SELECT usando locationsBarCode                    ║
// ║ ✅ Campo exclusivo para escanear localização LOC-                    ║
// ║ ✅ Scanner aceita produto e localização LOC-                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

const API_BASE = '';

let scanner = null;
let scannerRunning = false;
let currentProduct = null;

const $ = (selector) => document.querySelector(selector);

const dom = {
  inventorySelect: $('#inventorySelect'),
  btnReloadInventories: $('#btnReloadInventories'),
  btnCreateInventory: $('#btnCreateInventory'),

  btnOpenScanner: $('#btnOpenScanner'),
  btnCloseScanner: $('#btnCloseScanner'),
  btnManualCode: $('#btnManualCode'),
  scannerModal: $('#scannerModal'),
  reader: $('#reader'),

  searchInput: $('#searchInput'),
  btnSearch: $('#btnSearch'),

  messageBox: $('#messageBox'),
  productCard: $('#productCard'),
  productDescription: $('#productDescription'),
  productCode: $('#productCode'),
  productStock: $('#productStock'),
  productLocation: $('#productLocation'),

  locationBarcodeInput: $('#locationBarcodeInput'),
  btnReadLocationBarcode: $('#btnReadLocationBarcode'),
  locationSelect: $('#locationSelect'),

  unitSelect: $('#unitSelect'),
  lotSelect: $('#lotSelect'),
  countedQty: $('#countedQty'),
  notes: $('#notes'),

  btnSaveCount: $('#btnSaveCount'),
  btnCreateLot: $('#btnCreateLot'),
  btnUpdateLocation: $('#btnUpdateLocation'),
};

function showMessage(text, type = 'error') {
  if (!dom.messageBox) return;

  dom.messageBox.textContent = text;
  dom.messageBox.className = `message ${type}`;
  dom.messageBox.classList.remove('hidden');
}

function clearMessage() {
  if (!dom.messageBox) return;

  dom.messageBox.textContent = '';
  dom.messageBox.className = 'message hidden';
}

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizeNumber(value) {
  const n = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function todayBRCode() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');

  return `INV-MOBILE-${yyyy}${mm}${dd}`;
}

function todayISODate() {
  return new Date().toISOString().slice(0, 10);
}

function formatDateBR(value) {
  if (!value) return '';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value).slice(0, 10);
  }

  return date.toLocaleDateString('pt-BR');
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

async function fetchJson(url, options = {}) {
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    const err = new Error(json.error || json.message || 'Erro na requisição.');
    err.status = res.status;
    err.payload = json;
    throw err;
  }

  return json;
}

async function loadInventories() {
  if (!dom.inventorySelect) return;

  dom.inventorySelect.innerHTML = `<option value="">Carregando...</option>`;

  try {
    const json = await fetchJson(`${API_BASE}/api/inventories?status=OPEN&limit=50`);
    const rows = Array.isArray(json.rows) ? json.rows : [];

    if (!rows.length) {
      dom.inventorySelect.innerHTML = `<option value="">Nenhum inventário aberto</option>`;
      return;
    }

    dom.inventorySelect.innerHTML = rows
      .map((inv) => {
        const id = inv.inventory_id || inv.id;
        const label = `${inv.code || `Inventário ${id}`} — ${inv.description || inv.status || 'OPEN'}`;

        return `<option value="${escapeHtml(id)}">${escapeHtml(label)}</option>`;
      })
      .join('');
  } catch (err) {
    console.error('[inventoryMobile][loadInventories] ERROR:', err);
    dom.inventorySelect.innerHTML = `<option value="">Erro ao carregar</option>`;
    showMessage(err.message || 'Erro ao carregar inventários.', 'error');
  }
}

async function createInventoryToday() {
  clearMessage();

  try {
    const payload = {
      code: todayBRCode(),
      description: 'Inventário Mobile',
      type: 'GENERAL',
      status: 'OPEN',
      reference_date: todayISODate(),
      notes: 'Inventário criado pelo módulo mobile.',
    };

    const inv = await fetchJson(`${API_BASE}/api/inventories`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    await loadInventories();

    const id = inv.inventory_id || inv.id;

    if (id && dom.inventorySelect) {
      dom.inventorySelect.value = String(id);
    }

    showMessage('Inventário criado com sucesso.', 'success');
  } catch (err) {
    console.error('[inventoryMobile][createInventoryToday] ERROR:', err);
    showMessage(err.message || 'Erro ao criar inventário.', 'error');
  }
}

function getUnitIdFromApiUnit(unit = {}) {
  return (
    unit.product_unit_id ||
    unit.productUnitId ||
    unit.product_unitId ||
    unit.unit_id ||
    ''
  );
}

function renderUnits(product) {
  const units = Array.isArray(product?.units) ? product.units : [];

  if (!dom.unitSelect) return;

  dom.unitSelect.innerHTML = '';

  if (!units.length) {
    dom.unitSelect.innerHTML = `
      <option value="" data-unit="UN" data-factor="1">
        UN x 1
      </option>
    `;
    return;
  }

  dom.unitSelect.innerHTML = units
    .map((u) => {
      const id = getUnitIdFromApiUnit(u);
      const unit = u.unit || u.unidade || 'UN';
      const factor = Number(u.factor || u.fator || 1) || 1;
      const standard = u.standard ? ' — padrão' : '';

      return `
        <option
          value="${escapeHtml(id)}"
          data-unit="${escapeHtml(unit)}"
          data-factor="${escapeHtml(factor)}"
        >
          ${escapeHtml(unit)} x ${escapeHtml(factor)}${standard}
        </option>
      `;
    })
    .join('');
}

function renderLots(product) {
  const lots = Array.isArray(product?.lots) ? product.lots : [];

  if (!dom.lotSelect) return;

  dom.lotSelect.innerHTML = '';

  if (!lots.length) {
    dom.lotSelect.innerHTML = `<option value="">Sem lote encontrado</option>`;
    dom.btnCreateLot?.classList.remove('hidden');
    return;
  }

  dom.btnCreateLot?.classList.add('hidden');

  dom.lotSelect.innerHTML = [
    `<option value="">Selecione o lote</option>`,
    ...lots.map((lot) => {
      const id = lot.lot_id || lot.id || '';
      const code = lot.lot_code || lot.code || `Lote ${id}`;
      const expires = lot.expires_at || null;
      const qty = lot.qty_on_hand ?? 0;

      const label = [
        code,
        expires ? `Val: ${formatDateBR(expires)}` : '',
        `Qtd: ${qty}`,
      ]
        .filter(Boolean)
        .join(' — ');

      return `
        <option value="${escapeHtml(id)}">
          ${escapeHtml(label)}
        </option>
      `;
    }),
  ].join('');
}

async function loadLocationOptions(selectedLocationId = '') {
  if (!dom.locationSelect) return;

  dom.locationSelect.innerHTML = `<option value="">Carregando localizações...</option>`;

  try {
    const json = await fetchJson(`${API_BASE}/api/products-mobile/locations/options`);
    const rows = Array.isArray(json.rows) ? json.rows : [];

    if (!rows.length) {
      dom.locationSelect.innerHTML = `<option value="">Nenhuma localização cadastrada</option>`;
      return;
    }

    dom.locationSelect.innerHTML = [
      `<option value="">Selecione uma localização</option>`,
      ...rows.map((loc) => {
        const id = loc.location_barcode_id || loc.id || '';
        const label = loc.label || loc.barcode || `Local ${id}`;

        return `
          <option
            value="${escapeHtml(id)}"
            data-barcode="${escapeHtml(loc.barcode || '')}"
          >
            ${escapeHtml(label)}
          </option>
        `;
      }),
    ].join('');

    if (selectedLocationId) {
      dom.locationSelect.value = String(selectedLocationId);
    }
  } catch (err) {
    console.error('[inventoryMobile][loadLocationOptions] ERROR:', err);
    dom.locationSelect.innerHTML = `<option value="">Erro ao carregar localizações</option>`;
  }
}

function renderProduct(product) {
  currentProduct = product;

  if (dom.productDescription) {
    dom.productDescription.textContent = product.description || 'Produto';
  }

  if (dom.productCode) {
    dom.productCode.textContent = product.product_code || '-';
  }

  if (dom.productStock) {
    dom.productStock.textContent = product.stock?.quantity ?? 0;
  }

  if (dom.productLocation) {
    dom.productLocation.textContent = product.location?.label || 'Sem localização';
  }

  renderUnits(product);
  renderLots(product);

  const currentLocationId =
    product.location?.location_barcode_id ||
    product.location?.location_id ||
    product.product_location_id ||
    '';

  loadLocationOptions(currentLocationId);

  if (dom.countedQty) dom.countedQty.value = '';
  if (dom.notes) dom.notes.value = '';

  if (dom.locationBarcodeInput) {
    dom.locationBarcodeInput.value = '';
  }

  dom.productCard?.classList.remove('hidden');

  setTimeout(() => {
    dom.locationBarcodeInput?.focus();
  }, 150);
}

function isLocationBarcode(value) {
  return String(value || '').trim().toUpperCase().startsWith('LOC-');
}

async function getLocationByBarcode(barcode) {
  const code = normalizeText(barcode);

  if (!code) {
    throw new Error('Barcode de localização vazio.');
  }

  const json = await fetchJson(
    `${API_BASE}/api/products-mobile/locations/barcode/${encodeURIComponent(code)}`
  );

  return json.data || json.location || json.row || null;
}

async function applyLocationToCurrentProduct(location) {
  if (!location?.id && !location?.location_barcode_id) {
    showMessage('Localização inválida.', 'error');
    return;
  }

  const locationId = location.location_barcode_id || location.id;
  const label = location.label || location.barcode || `Local ${locationId}`;

  await loadLocationOptions(locationId);

  let option = [...dom.locationSelect.options].find(
    (opt) => String(opt.value) === String(locationId)
  );

  if (!option) {
    option = new Option(label, locationId, true, true);
    option.dataset.barcode = location.barcode || '';
    dom.locationSelect.add(option);
  }

  dom.locationSelect.value = String(locationId);

  if (dom.productLocation) {
    dom.productLocation.textContent = label;
  }

  if (dom.locationBarcodeInput) {
    dom.locationBarcodeInput.value = '';
    dom.locationBarcodeInput.focus();
  }

  showMessage('Localização preenchida pelo barcode.', 'success');
}

async function handleSearchValue(value) {
  const code = normalizeText(value);

  if (!code) {
    showMessage('Digite ou escaneie um código.', 'error');
    return;
  }

  clearMessage();

  try {
    if (isLocationBarcode(code)) {
      if (!currentProduct?.product_code) {
        showMessage('Primeiro escaneie/localize o produto. Depois escaneie a localização.', 'error');
        return;
      }

      const location = await getLocationByBarcode(code);

      if (!location) {
        showMessage('Localização não encontrada.', 'error');
        return;
      }

      await applyLocationToCurrentProduct(location);
      return;
    }

    await searchProduct(code);
  } catch (err) {
    console.error('[inventoryMobile][handleSearchValue] ERROR:', err);
    showMessage(err.message || 'Erro ao processar código.', 'error');
  }
}

async function searchProduct(value) {
  const search = normalizeText(value);

  if (!search) {
    showMessage('Digite ou escaneie um código.', 'error');
    return;
  }

  clearMessage();

  try {
    const json = await fetchJson(
      `${API_BASE}/api/products-mobile/search/${encodeURIComponent(search)}`
    );

    const product = json.product;

    if (!product) {
      currentProduct = null;
      dom.productCard?.classList.add('hidden');
      showMessage('Produto não encontrado.', 'error');
      return;
    }

    renderProduct(product);
    showMessage('Produto localizado.', 'success');

    if (dom.searchInput) {
      dom.searchInput.value = '';
    }
  } catch (err) {
    console.error('[inventoryMobile][searchProduct] ERROR:', err);

    currentProduct = null;
    dom.productCard?.classList.add('hidden');

    showMessage(err.message || 'Erro ao buscar produto.', 'error');
  }
}

async function saveCount() {
  clearMessage();

  const inventoryId = dom.inventorySelect?.value || '';
  const qty = normalizeNumber(dom.countedQty?.value);

  if (!inventoryId) {
    showMessage('Selecione ou crie um inventário.', 'error');
    return;
  }

  if (!currentProduct?.product_code) {
    showMessage('Nenhum produto selecionado.', 'error');
    return;
  }

  if (qty == null || qty < 0) {
    showMessage('Informe uma quantidade contada válida.', 'error');
    return;
  }

  const selectedUnit = dom.unitSelect?.options?.[dom.unitSelect.selectedIndex];
  const selectedLotId = normalizeText(dom.lotSelect?.value || '');
  const selectedLocationId = normalizeText(dom.locationSelect?.value || '');
  const selectedLocationOption =
    dom.locationSelect?.options?.[dom.locationSelect.selectedIndex];

  const payload = {
    product_code: currentProduct.product_code,
    barcode: currentProduct.barcode || null,
    counted_qty: qty,

    product_unit_id: selectedUnit?.value || null,
    unit: selectedUnit?.dataset?.unit || null,
    fator: Number(selectedUnit?.dataset?.factor || 1) || 1,

    product_location_id:
      selectedLocationId ||
      currentProduct.location?.location_id ||
      null,

    location_barcode_id:
      selectedLocationId ||
      currentProduct.location?.location_barcode_id ||
      null,

    location:
      selectedLocationOption?.textContent?.trim() ||
      currentProduct.location?.label ||
      null,

    location_barcode:
      selectedLocationOption?.dataset?.barcode ||
      null,

    lot_id: selectedLotId || null,

    notes: dom.notes?.value || 'Contagem via inventoryMobile',
  };

  console.log('[inventoryMobile][saveCount][payload]', payload);

  try {
    await fetchJson(`${API_BASE}/api/inventories/${inventoryId}/items`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    showMessage('Contagem salva com sucesso.', 'success');

    if (dom.countedQty) dom.countedQty.value = '';
    if (dom.notes) dom.notes.value = '';
    if (dom.searchInput) dom.searchInput.value = '';
    if (dom.locationBarcodeInput) dom.locationBarcodeInput.value = '';

    dom.productCard?.classList.add('hidden');

    currentProduct = null;
  } catch (err) {
    console.error('[inventoryMobile][saveCount] ERROR:', err);
    showMessage(err.message || 'Erro ao salvar contagem.', 'error');
  }
}

async function createLotForCurrentProduct() {
  if (!currentProduct?.product_code) {
    showMessage('Nenhum produto selecionado.', 'error');
    return;
  }

  const lotCode = prompt('Código do lote:', 'LOTE PADRÃO');

  if (!lotCode) return;

  const expiresAt = prompt('Validade (AAAA-MM-DD) opcional:', '') || null;

  try {
    await fetchJson(`${API_BASE}/api/productsStockLots`, {
      method: 'POST',
      body: JSON.stringify({
        product_code: currentProduct.product_code,
        product_stock_id: currentProduct.stock?.product_stock_id || null,
        lot_code: lotCode.trim() || 'LOTE PADRÃO',
        expires_at: expiresAt,
        qty_on_hand: 0,
      }),
    });

    showMessage('Lote criado com sucesso.', 'success');

    await searchProduct(currentProduct.product_code);
  } catch (err) {
    console.error('[inventoryMobile][createLot] ERROR:', err);
    showMessage(err.message || 'Erro ao criar lote.', 'error');
  }
}

async function updateCurrentProductLocation() {
  if (!currentProduct?.product_code) {
    showMessage('Nenhum produto selecionado.', 'error');
    return;
  }

  const locationId = normalizeText(dom.locationSelect?.value || '');

  if (!locationId) {
    showMessage('Selecione uma localização.', 'error');
    return;
  }

  try {
    await fetchJson(
      `${API_BASE}/api/products-mobile/${encodeURIComponent(
        currentProduct.product_code
      )}/location`,
      {
        method: 'PUT',
        body: JSON.stringify({
          location_barcode_id: locationId,
          location_id: locationId,
          product_location_id: locationId,
        }),
      }
    );

    showMessage('Localização atualizada com sucesso.', 'success');

    await searchProduct(currentProduct.product_code);
  } catch (err) {
    console.error('[inventoryMobile][updateLocation] ERROR:', err);
    showMessage(err.message || 'Erro ao atualizar localização.', 'error');
  }
}

async function openScanner() {
  clearMessage();

  if (!window.Html5Qrcode) {
    showMessage('Biblioteca de scanner não carregada.', 'error');
    return;
  }

  dom.scannerModal?.classList.remove('hidden');

  scanner = new Html5Qrcode('reader');

  try {
    await scanner.start(
      { facingMode: 'environment' },
      {
        fps: 10,
        qrbox: {
          width: 280,
          height: 160,
        },
        formatsToSupport: [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
        ],
      },
      async (decodedText) => {
        const code = normalizeText(decodedText);

        if (!code) return;

        await closeScanner();
        await handleSearchValue(code);
      },
      () => {}
    );

    scannerRunning = true;
  } catch (err) {
    console.error('[inventoryMobile][openScanner] ERROR:', err);

    showMessage(
      'Não foi possível abrir a câmera. Use HTTPS e permita acesso à câmera.',
      'error'
    );

    await closeScanner();
  }
}

async function closeScanner() {
  try {
    if (scanner && scannerRunning) {
      await scanner.stop();
      await scanner.clear();
    }
  } catch (err) {
    console.warn('[inventoryMobile][closeScanner] WARN:', err);
  } finally {
    scanner = null;
    scannerRunning = false;
    dom.scannerModal?.classList.add('hidden');
  }
}

function bindEvents() {
  dom.btnReloadInventories?.addEventListener('click', loadInventories);
  dom.btnCreateInventory?.addEventListener('click', createInventoryToday);

  dom.btnOpenScanner?.addEventListener('click', openScanner);
  dom.btnCloseScanner?.addEventListener('click', closeScanner);

  dom.btnManualCode?.addEventListener('click', async () => {
    await closeScanner();

    if (currentProduct?.product_code) {
      dom.locationBarcodeInput?.focus();
    } else {
      dom.searchInput?.focus();
    }
  });

  dom.btnSearch?.addEventListener('click', () => {
    handleSearchValue(dom.searchInput?.value);
  });

  dom.searchInput?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleSearchValue(dom.searchInput?.value);
    }
  });

  dom.btnReadLocationBarcode?.addEventListener('click', () => {
    handleSearchValue(dom.locationBarcodeInput?.value);
  });

  dom.locationBarcodeInput?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleSearchValue(dom.locationBarcodeInput?.value);
    }
  });

  dom.btnSaveCount?.addEventListener('click', saveCount);
  dom.btnCreateLot?.addEventListener('click', createLotForCurrentProduct);
  dom.btnUpdateLocation?.addEventListener('click', updateCurrentProductLocation);

  window.addEventListener('beforeunload', () => {
    if (scannerRunning) {
      closeScanner();
    }
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  bindEvents();
  await loadInventories();

  console.log('[inventoryMobile] loaded');
});