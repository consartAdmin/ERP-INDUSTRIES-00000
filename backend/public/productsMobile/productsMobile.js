// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: productsMobile.js                                             ║
// ║ MODULE: Products Mobile                                             ║
// ║ PRODNEX ERP | Mobile Web                                            ║
// ║ ✅ Scanner via câmera                                                ║
// ║ ✅ Busca manual por barcode / SKU                                    ║
// ║ ✅ Exibição de estoque, unidades e localização                       ║
// ╚══════════════════════════════════════════════════════════════════════╝

const API_BASE = '';

let scanner = null;
let scannerRunning = false;

const $ = (selector) => document.querySelector(selector);

const dom = {
  btnStartScanner: $('#btnStartScanner'),
  btnStopScanner: $('#btnStopScanner'),
  reader: $('#reader'),

  searchInput: $('#searchInput'),
  btnSearch: $('#btnSearch'),

  loadingBox: $('#loadingBox'),
  messageBox: $('#messageBox'),
  productCard: $('#productCard'),

  productImage: $('#productImage'),
  productCode: $('#productCode'),
  productDescription: $('#productDescription'),
  productStock: $('#productStock'),
  stockStatus: $('#stockStatus'),
  productLocation: $('#productLocation'),
  productUnits: $('#productUnits'),
  costPrice: $('#costPrice'),
  salePrice: $('#salePrice'),
  productBarcode: $('#productBarcode'),
};

function showLoading(show = true) {
  dom.loadingBox.classList.toggle('hidden', !show);
}

function showMessage(text, type = 'error') {
  dom.messageBox.textContent = text;
  dom.messageBox.className = `message ${type}`;
  dom.messageBox.classList.remove('hidden');
}

function clearMessage() {
  dom.messageBox.textContent = '';
  dom.messageBox.className = 'message hidden';
}

function hideProduct() {
  dom.productCard.classList.add('hidden');
}

function moneyBR(value) {
  const n = Number(value || 0);

  return n.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function normalizeSearch(value) {
  return String(value || '').trim();
}

function statusLabel(status) {
  const s = String(status || '').toUpperCase();

  if (s === 'SEM_ESTOQUE') return '🔴 Sem estoque';
  if (s === 'ABAIXO_MINIMO') return '🟡 Abaixo mínimo';

  return '🟢 Normal';
}

function renderProduct(product) {
  if (!product) {
    hideProduct();
    return;
  }

  dom.productCode.textContent = product.product_code || '-';
  dom.productDescription.textContent = product.description || '-';

  dom.productStock.textContent = product.stock?.quantity ?? '0';
  dom.stockStatus.textContent = statusLabel(product.stock?.status);

  dom.productLocation.textContent = product.location?.label || 'Sem localização cadastrada';

  dom.costPrice.textContent = moneyBR(product.prices?.cost_price);
  dom.salePrice.textContent = moneyBR(product.prices?.sale_price);

  dom.productBarcode.textContent = product.barcode || '-';

  dom.productUnits.innerHTML = '';

  const units = Array.isArray(product.units) ? product.units : [];

  if (!units.length) {
    dom.productUnits.innerHTML = '<span class="unit-pill">UN</span>';
  } else {
    units.forEach((u) => {
      const pill = document.createElement('span');
      pill.className = 'unit-pill';
      pill.textContent = `${u.unit || 'UN'} x ${u.factor || 1}`;
      dom.productUnits.appendChild(pill);
    });
  }

  if (product.image_url) {
    dom.productImage.src = product.image_url;
    dom.productImage.classList.remove('hidden');
  } else {
    dom.productImage.src = '';
    dom.productImage.classList.add('hidden');
  }

  dom.productCard.classList.remove('hidden');
}

async function searchProduct(value) {
  const search = normalizeSearch(value);

  if (!search) {
    showMessage('Informe ou escaneie um código para consultar.', 'error');
    return;
  }

  clearMessage();
  hideProduct();
  showLoading(true);

  try {
    const url = `${API_BASE}/api/products-mobile/search/${encodeURIComponent(search)}`;

    const response = await fetch(url);

    const json = await response.json().catch(() => ({}));

    if (!response.ok || !json.success) {
      showMessage(json.message || 'Produto não encontrado.', 'error');
      return;
    }

    renderProduct(json.product);

    showMessage('Produto encontrado com sucesso.', 'success');
  } catch (error) {
    console.error('[productsMobile][searchProduct] ERROR:', error);

    showMessage('Erro ao consultar produto. Verifique a conexão.', 'error');
  } finally {
    showLoading(false);
  }
}

async function startScanner() {
  clearMessage();

  if (!window.Html5Qrcode) {
    showMessage('Biblioteca de scanner não carregada.', 'error');
    return;
  }

  if (scannerRunning) return;

  dom.reader.classList.remove('hidden');
  dom.btnStopScanner.classList.remove('hidden');

  scanner = new Html5Qrcode('reader');

  try {
    await scanner.start(
      { facingMode: 'environment' },
      {
        fps: 10,
        qrbox: {
          width: 260,
          height: 160,
        },
      },
      async (decodedText) => {
        const code = normalizeSearch(decodedText);

        if (!code) return;

        dom.searchInput.value = code;

        await stopScanner();

        await searchProduct(code);
      },
      () => {}
    );

    scannerRunning = true;
  } catch (error) {
    console.error('[productsMobile][startScanner] ERROR:', error);

    showMessage(
      'Não foi possível acessar a câmera. No iPhone, use HTTPS e permita o acesso à câmera.',
      'error'
    );

    await stopScanner();
  }
}

async function stopScanner() {
  try {
    if (scanner && scannerRunning) {
      await scanner.stop();
      await scanner.clear();
    }
  } catch (error) {
    console.warn('[productsMobile][stopScanner] WARN:', error);
  } finally {
    scannerRunning = false;
    scanner = null;

    dom.reader.classList.add('hidden');
    dom.btnStopScanner.classList.add('hidden');
  }
}

function bindEvents() {
  dom.btnStartScanner.addEventListener('click', startScanner);
  dom.btnStopScanner.addEventListener('click', stopScanner);

  dom.btnSearch.addEventListener('click', () => {
    searchProduct(dom.searchInput.value);
  });

  dom.searchInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      searchProduct(dom.searchInput.value);
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  bindEvents();

  console.log('[productsMobile] module loaded');
});