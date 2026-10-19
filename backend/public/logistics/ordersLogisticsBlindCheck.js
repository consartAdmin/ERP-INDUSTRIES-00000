// ╔════════════════════════════════════════════════════════════════════╗
// ║ ordersLogisticsBlindCheck.js — Conferência Cega (Front)           ║
// ║ PRODNEX ERP | ESM                                                 ║
// ║ Foco: leitura da CHAVE DE ACESSO (NF-e) pela câmera               ║
// ╚════════════════════════════════════════════════════════════════════╝

/* global Quagga */

const API_BASE =
  (window.API_BASE || window.apiBase || window.location.origin).replace(/\/$/, '');

// ---------------------------------------------------------------------
// Elementos da tela
// ---------------------------------------------------------------------
const btnScanInvoice  = document.getElementById('btnScanInvoice');
const btnScanProduct  = document.getElementById('btnScanProduct');
const btnCloseCamera  = document.getElementById('btnCloseCamera');
const cameraModal     = document.getElementById('cameraModal');
const cameraViewport  = document.getElementById('cameraViewport'); // <div> alvo do Quagga

const invoiceKeyInput   = document.getElementById('invoice_key');
const invoiceStatusSpan = document.getElementById('invoice_status');
const productBarcodeInput = document.getElementById('product_barcode');

const expectedListEl = document.getElementById('expectedList');
const productListEl  = document.getElementById('productList');

// ---------------------------------------------------------------------
// Estado interno
// ---------------------------------------------------------------------
let scanMode = null;          // 'invoice' | 'product'
let currentLogistics = null;
let expectedItems   = [];
let pickedLog       = [];

let lastCode  = null;
let lastCodeTs = 0;
let scanning  = false;

// ---------------------------------------------------------------------
// Helpers UI
// ---------------------------------------------------------------------
function setInvoiceStatus(msg, type = 'info') {
  if (!invoiceStatusSpan) return;
  invoiceStatusSpan.textContent = msg || '';
  invoiceStatusSpan.classList.remove('status-error', 'status-ok', 'status-info');
  invoiceStatusSpan.classList.add(
    type === 'error' ? 'status-error' :
    type === 'ok'    ? 'status-ok'    :
                       'status-info'
  );
}

function addProductLogEntry(entry) {
  pickedLog.unshift(entry);
  if (pickedLog.length > 50) pickedLog.length = 50;
  renderProductLog();
}

// ---------------------------------------------------------------------
// Renderizações
// ---------------------------------------------------------------------
function renderExpectedList() {
  if (!expectedListEl) return;
  expectedListEl.innerHTML = '';

  if (!expectedItems.length) {
    const li = document.createElement('li');
    li.textContent = 'Nenhum item carregado da NF.';
    li.className = 'empty-row';
    expectedListEl.appendChild(li);
    return;
  }

  for (const item of expectedItems) {
    const li = document.createElement('li');

    const expected = Number(item.expected_qty || 0);
    const picked   = Number(item.picked_qty || 0);

    let statusClass = '';
    let statusText  = '';

    if (picked === 0) {
      statusClass = 'item-pending';
      statusText  = 'Aguardando';
    } else if (picked === expected) {
      statusClass = 'item-ok';
      statusText  = 'Conferido';
    } else if (picked < expected) {
      statusClass = 'item-partial';
      statusText  = 'Parcial';
    } else if (picked > expected) {
      statusClass = 'item-over';
      statusText  = 'Acima do esperado';
    }

    li.className = `expected-item ${statusClass}`;

    li.innerHTML = `
      <div class="expected-main">
        <span class="expected-name">${item.product_name || '-'}</span>
        <span class="expected-sku">SKU/GTIN: ${item.sku || '-'}</span>
      </div>
      <div class="expected-qtys">
        <span class="expected-qty">NF: <strong>${expected}</strong></span>
        <span class="picked-qty">Conferido: <strong>${picked}</strong></span>
        <span class="status-label">${statusText}</span>
      </div>
    `;

    expectedListEl.appendChild(li);
  }
}

function renderProductLog() {
  if (!productListEl) return;
  productListEl.innerHTML = '';

  if (!pickedLog.length) {
    const li = document.createElement('li');
    li.textContent = 'Nenhuma leitura registrada ainda.';
    li.className = 'empty-row';
    productListEl.appendChild(li);
    return;
  }

  for (const log of pickedLog) {
    const li = document.createElement('li');
    li.className = `product-log-item ${log.statusClass || ''}`;
    li.innerHTML = `
      <div class="log-main">
        <span class="log-sku">${log.sku}</span>
        <span class="log-name">${log.product_name || ''}</span>
      </div>
      <div class="log-extra">
        <span>Qtd NF: <strong>${log.expected_qty}</strong></span>
        <span>Qtd Conferida: <strong>${log.picked_qty}</strong></span>
        ${log.message ? `<span class="log-msg">${log.message}</span>` : ''}
      </div>
    `;
    productListEl.appendChild(li);
  }
}

// ---------------------------------------------------------------------
// Reset
// ---------------------------------------------------------------------
function resetConference() {
  currentLogistics = null;
  expectedItems = [];
  pickedLog = [];

  if (invoiceKeyInput) invoiceKeyInput.value = '';
  if (productBarcodeInput) productBarcodeInput.value = '';

  setInvoiceStatus('NF ainda não carregada.', 'info');
  renderExpectedList();
  renderProductLog();
}

// ---------------------------------------------------------------------
// Backend: carregar NF a partir do código de barras
// ---------------------------------------------------------------------
async function loadInvoiceFromBackend(barcodeRaw) {
  if (!barcodeRaw) {
    setInvoiceStatus('Código da nota vazio.', 'error');
    return;
  }

  try {
    setInvoiceStatus('Carregando NF a partir do código...', 'info');

    const resp = await fetch(`${API_BASE}/api/logistics/blind-check/start-from-nf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        barcode: barcodeRaw,
        checker_user_id: null,
      }),
    });

    const data = await resp.json();

    if (!resp.ok) {
      console.error('[BlindCheck] Erro ao carregar NF:', data);
      setInvoiceStatus(data?.error || 'Falha ao carregar NF.', 'error');
      return;
    }

    currentLogistics = data.logistics || null;
    expectedItems = (data.items || []).map((it) => ({
      ...it,
      picked_qty: 0,
    }));

    if (invoiceKeyInput && currentLogistics?.invoice_barcode) {
      invoiceKeyInput.value = currentLogistics.invoice_barcode;
    }

    setInvoiceStatus(
      `NF carregada com sucesso. Itens esperados: ${expectedItems.length}.`,
      'ok',
    );

    renderExpectedList();
    renderProductLog();

    if (productBarcodeInput) {
      productBarcodeInput.focus();
      productBarcodeInput.select?.();
    }
  } catch (err) {
    console.error('[BlindCheck] EXC loadInvoiceFromBackend:', err);
    setInvoiceStatus('Erro de comunicação com o servidor ao carregar NF.', 'error');
  }
}

// ---------------------------------------------------------------------
// Conferência local de produto
// ---------------------------------------------------------------------
function registerProductScan(barcodeRaw) {
  if (!barcodeRaw) return;

  const code = String(barcodeRaw).trim();
  if (!code) return;

  if (!expectedItems.length) {
    addProductLogEntry({
      sku: code,
      product_name: 'NF não carregada',
      expected_qty: 0,
      picked_qty: 0,
      statusClass: 'log-error',
      message: 'Leia a nota fiscal antes de bipar os produtos.',
    });
    return;
  }

  const item = expectedItems.find((it) => String(it.sku || '').trim() === code);

  if (!item) {
    addProductLogEntry({
      sku: code,
      product_name: 'Produto não consta na NF',
      expected_qty: 0,
      picked_qty: 0,
      statusClass: 'log-warning',
      message: 'Produto não encontrado na lista de itens da NF.',
    });
    return;
  }

  item.picked_qty = Number(item.picked_qty || 0) + 1;

  const expected = Number(item.expected_qty || 0);
  const picked   = Number(item.picked_qty || 0);

  let msg = '';
  let statusClass = '';

  if (picked === expected) {
    msg = 'Quantidade conferida exatamente igual ao esperado.';
    statusClass = 'log-ok';
  } else if (picked < expected) {
    msg = `Ainda faltam ${expected - picked} unid(s).`;
    statusClass = 'log-partial';
  } else if (picked > expected) {
    msg = `Acima do esperado (+${picked - expected}).`;
    statusClass = 'log-over';
  }

  addProductLogEntry({
    sku: code,
    product_name: item.product_name,
    expected_qty: expected,
    picked_qty: picked,
    statusClass,
    message: msg,
  });

  renderExpectedList();
}

// ---------------------------------------------------------------------
// CÂMERA — Quagga LiveStream focado em NF-e (Interleaved 2 of 5)
// ---------------------------------------------------------------------
function openCameraModal(mode) {
  scanMode = mode;
  lastCode = null;
  lastCodeTs = 0;

  if (!cameraModal || !cameraViewport) {
    alert('Elemento de câmera não encontrado na página.');
    return;
  }

  if (typeof Quagga === 'undefined') {
    alert('Leitor de código de barras não pôde ser carregado (QuaggaJS).');
    return;
  }

  cameraModal.hidden = false;
  document.body.classList.add('no-scroll');

  startScanner();
}

function closeCameraModal() {
  stopScanner();

  if (cameraModal) cameraModal.hidden = true;
  document.body.classList.remove('no-scroll');
}

function startScanner() {
  if (scanning) return;
  scanning = true;

  Quagga.init(
    {
      inputStream: {
        type: 'LiveStream',
        target: cameraViewport,
        constraints: {
          facingMode: 'environment',
          width:  { ideal: 1920 },
          height: { ideal: 1080 },
        },
        // área central da tela (bate com a miralinha)
        area: {
          top:    '20%',   // deixa 20% em cima
          right:  '10%',   // 10% à direita
          left:   '10%',   // 10% à esquerda
          bottom: '20%',   // 20% embaixo → faixa central bem larga
        },
      },

      locator: {
        patchSize: 'x-large', // melhor para barras longas
        halfSample: false,
      },

      numOfWorkers: navigator.hardwareConcurrency || 4,
      frequency: 10,

      decoder: {
        readers: [
          'i2of5_reader',  // Interleaved 2 of 5 (NF-e)
        ],
      },

      locate: true,
    },
    (err) => {
      if (err) {
        console.error('[BlindCheck] Erro init Quagga:', err);
        scanning = false;
        alert('Erro ao iniciar o leitor: ' + (err.message || err));
        closeCameraModal();
        return;
      }

      console.log('[BlindCheck] Scanner NF-e (i2of5) iniciado.');
      Quagga.start();
      Quagga.onDetected(onQuaggaDetected);
    },
  );
}

function stopScanner() {
  if (!scanning) return;
  scanning = false;

  try {
    Quagga.offDetected(onQuaggaDetected);
    Quagga.stop();
  } catch (err) {
    console.warn('[BlindCheck] Erro ao parar Quagga:', err);
  }
}

// ---------------------------------------------------------------------
// Tratamento da leitura do Quagga
// ---------------------------------------------------------------------
function onQuaggaDetected(result) {
  if (!result?.codeResult?.code) return;

  let rawCode = String(result.codeResult.code || '').trim();
  if (!rawCode) return;

  // NF-e → só queremos dígitos, 44 caracteres
  const numeric = rawCode.replace(/\D/g, '');

  // debug leve no console
  console.log('[BlindCheck] detectado bruto:', rawCode, '→ numérico:', numeric);

  if (numeric.length !== 44) {
    // ignora leituras estranhas ou incompletas
    return;
  }

  const now = Date.now();
  if (numeric === lastCode && now - lastCodeTs < 1500) {
    return;
  }

  lastCode = numeric;
  lastCodeTs = now;

  console.log('[BlindCheck] CHAVE NF-e reconhecida:', numeric);

  closeCameraModal();
  handleDetectedCode(numeric);
}

function handleDetectedCode(code) {
  if (scanMode === 'invoice') {
    if (invoiceKeyInput) invoiceKeyInput.value = code;
    loadInvoiceFromBackend(code);
  } else if (scanMode === 'product') {
    if (productBarcodeInput) productBarcodeInput.value = code;
    registerProductScan(code);
  }
}

// ---------------------------------------------------------------------
// Eventos da tela
// ---------------------------------------------------------------------
if (btnScanInvoice) {
  btnScanInvoice.addEventListener('click', () => openCameraModal('invoice'));
}

if (btnScanProduct) {
  btnScanProduct.addEventListener('click', () => openCameraModal('product'));
}

if (btnCloseCamera) {
  btnCloseCamera.addEventListener('click', () => closeCameraModal());
}

// Enter no campo da chave
if (invoiceKeyInput) {
  invoiceKeyInput.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') {
      ev.preventDefault();
      const val = invoiceKeyInput.value.trim();
      if (val) loadInvoiceFromBackend(val);
    }
  });
}

// Enter no campo produto
if (productBarcodeInput) {
  productBarcodeInput.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') {
      ev.preventDefault();
      const val = productBarcodeInput.value.trim();
      if (val) {
        registerProductScan(val);
        productBarcodeInput.select?.();
      }
    }
  });
}

// Garante que o scanner pare ao sair da página
window.addEventListener('beforeunload', () => {
  stopScanner();
});

// Estado inicial
resetConference();
