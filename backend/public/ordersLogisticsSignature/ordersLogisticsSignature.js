// ╔══════════════════════════════════════════════════════════════════════╗
// ║ ordersLogisticsSignature.js — Assinatura de Entrega (Frontend)      ║
// ║ PRODNEX ERP · Logística / Conferência Cega                          ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { showCenterModal } from '/public/includes/js/centerAlertModal.js';

/* ======================================================================
 * API_BASE (padrão CONSART)
 * ====================================================================== */
const API_BASE =
  (typeof window !== 'undefined' && (window.apiBase || window.API_BASE)) ||
  (typeof window !== 'undefined' ? window.location.origin : '');

/* ======================================================================
 * Config: rota que vai localizar pedido pela chave NF-e
 * (ajuste a URL conforme seu backend de logística)
 * ====================================================================== */
const ORDERS_LOGISTICS_FIND_BY_NFE =
  `${API_BASE}/api/orders-logistics/by-nfe-key`; // exemplo: GET /api/orders-logistics/by-nfe-key/:nfeKey

/* ======================================================================
 * Utils
 * ====================================================================== */
function getQueryParam(name) {
  if (typeof window === 'undefined') return null;
  const url = new URL(window.location.href);
  const value = url.searchParams.get(name);
  return value === null ? null : value;
}

function maskNfeKey(key) {
  if (!key) return '';
  const clean = String(key).replace(/\D/g, '');
  if (clean.length <= 10) return clean;
  return `${clean.slice(0, 4)} •••• •••• •••• •••• •••• ${clean.slice(-4)}`;
}

function onlyDigits(str) {
  return String(str || '').replace(/\D/g, '');
}

/* ======================================================================
 * Estado da tela
 * ====================================================================== */
const state = {
  orderId: null,
  nfeKey: null,
  isDrawing: false,
  hasStroke: false,
  isUnlocked: false,
  canvas: null,
  ctx: null,
};

/* ======================================================================
 * Inicialização
 * ====================================================================== */
document.addEventListener('DOMContentLoaded', () => {
  // 1) Tenta pegar parâmetros da URL (?orderId=...&nfeKey=...)
  const orderIdParam = getQueryParam('orderId') || getQueryParam('order_id');
  const nfeKeyParam = getQueryParam('nfeKey') || getQueryParam('nfe_key');

  if (orderIdParam && nfeKeyParam) {
    state.orderId = Number(orderIdParam);
    state.nfeKey = nfeKeyParam;
    unlockSignature('Dados recebidos da conferência cega.');
  } else {
    // Começa travado, vai depender da leitura da chave NF-e
    lockSignature();
  }

  renderHeaderInfo();

  initCanvas();
  initButtons();
});

/* ======================================================================
 * Lock / Unlock
 * ====================================================================== */
function renderHeaderInfo() {
  const orderDisplayEl = document.getElementById('orderIdDisplay');
  const nfeDisplayEl = document.getElementById('nfeKeyDisplay');

  if (orderDisplayEl) {
    orderDisplayEl.textContent = state.orderId ? `#${state.orderId}` : '#—';
  }
  if (nfeDisplayEl) {
    nfeDisplayEl.textContent = state.nfeKey ? maskNfeKey(state.nfeKey) : '—';
  }
}

function lockSignature() {
  state.isUnlocked = false;
  const section = document.getElementById('sigSection');
  if (section) {
    section.classList.add('sig-section--locked');
  }
}

function unlockSignature(message) {
  state.isUnlocked = true;
  const section = document.getElementById('sigSection');
  if (section) {
    section.classList.remove('sig-section--locked');
  }

  renderHeaderInfo();

  if (message) {
    showCenterModal?.({
      title: 'Chave NF-e validada',
      message,
      type: 'success',
    });
  }
}

/* ======================================================================
 * Canvas: configuração e eventos
 * ====================================================================== */
function initCanvas() {
  const canvas = document.getElementById('signatureCanvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');

  state.canvas = canvas;
  state.ctx = ctx;

  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#111827';

  // Eventos mouse
  canvas.addEventListener('mousedown', onPointerDown);
  canvas.addEventListener('mousemove', onPointerMove);
  window.addEventListener('mouseup', onPointerUp);

  // Eventos touch
  canvas.addEventListener(
    'touchstart',
    (e) => {
      e.preventDefault();
      onPointerDown(e.touches[0]);
    },
    { passive: false }
  );
  canvas.addEventListener(
    'touchmove',
    (e) => {
      e.preventDefault();
      onPointerMove(e.touches[0]);
    },
    { passive: false }
  );
  canvas.addEventListener(
    'touchend',
    (e) => {
      e.preventDefault();
      onPointerUp(e.changedTouches?.[0] || e);
    },
    { passive: false }
  );
}

function resizeCanvas() {
  const canvas = state.canvas;
  if (!canvas) return;

  const container = canvas.parentElement;
  if (!container) return;

  const rect = container.getBoundingClientRect();
  const width = Math.max(260, rect.width - 4);
  const height = 180;

  canvas.width = width;
  canvas.height = height;

  state.hasStroke = false;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
}

/* ======================================================================
 * Handlers de desenho
 * ====================================================================== */
function getCanvasCoords(evtLike) {
  const canvas = state.canvas;
  if (!canvas) return { x: 0, y: 0 };
  const rect = canvas.getBoundingClientRect();
  const x = (evtLike.clientX ?? 0) - rect.left;
  const y = (evtLike.clientY ?? 0) - rect.top;
  return { x, y };
}

function onPointerDown(evtLike) {
  if (!state.isUnlocked) return; // travado até liberar pela NF-e

  const canvas = state.canvas;
  const ctx = state.ctx;
  if (!canvas || !ctx) return;

  state.isDrawing = true;

  const { x, y } = getCanvasCoords(evtLike);
  ctx.beginPath();
  ctx.moveTo(x, y);
}

function onPointerMove(evtLike) {
  if (!state.isUnlocked || !state.isDrawing) return;

  const canvas = state.canvas;
  const ctx = state.ctx;
  if (!canvas || !ctx) return;

  const { x, y } = getCanvasCoords(evtLike);
  ctx.lineTo(x, y);
  ctx.stroke();
  state.hasStroke = true;
}

function onPointerUp() {
  if (!state.isDrawing) return;
  state.isDrawing = false;
}

/* ======================================================================
 * Botões
 * ====================================================================== */
function initButtons() {
  const btnClear = document.getElementById('btnClearSignature');
  const btnSave = document.getElementById('btnSaveSignature');
  const btnBack = document.getElementById('btnBack');
  const btnUseNfeKey = document.getElementById('btnUseNfeKey');

  if (btnClear) {
    btnClear.addEventListener('click', () => {
      clearSignature();
    });
  }

  if (btnSave) {
    btnSave.addEventListener('click', () => {
      saveSignature();
    });
  }

  if (btnBack) {
    btnBack.addEventListener('click', () => {
      if (window.history.length > 1) {
        window.history.back();
      } else {
        window.location.href = '/public/ordersLogisticsBlindCheck/ordersLogisticsBlindCheck.html';
      }
    });
  }

  if (btnUseNfeKey) {
    btnUseNfeKey.addEventListener('click', () => {
      handleUseNfeKey();
    });
  }
}

function clearSignature() {
  const canvas = state.canvas;
  const ctx = state.ctx;
  if (!canvas || !ctx) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  state.hasStroke = false;
}

/* ======================================================================
 * Leitura/liberação pela chave NF-e
 * ====================================================================== */
async function handleUseNfeKey() {
  const input = document.getElementById('nfeKeyInput');
  const raw = input?.value || '';
  const digits = onlyDigits(raw);

  if (!digits || digits.length !== 44) {
    showCenterModal?.({
      title: 'Chave NF-e inválida',
      message: 'Informe uma chave de acesso válida (44 dígitos).',
      type: 'warning',
    });
    input?.focus();
    return;
  }

  try {
    // Aqui consultamos o backend de logística para localizar o pedido
    const resp = await fetch(`${ORDERS_LOGISTICS_FIND_BY_NFE}/${digits}`);
    const data = await resp.json().catch(() => ({}));

    if (!resp.ok || !data?.success || !data?.order) {
      throw new Error(
        data?.error ||
          'Não foi possível localizar o pedido vinculado a esta chave NF-e.'
      );
    }

    const order = data.order;

    state.orderId = Number(order.id || order.order_id);
    state.nfeKey = order.nfe_key || digits;

    unlockSignature('Pedido localizado pela chave da NF-e.');
  } catch (err) {
    console.error('handleUseNfeKey() failed:', err);
    lockSignature();

    showCenterModal?.({
      title: 'NF-e não localizada',
      message:
        err?.message ||
        'Não conseguimos localizar o pedido pela chave informada. Verifique a chave e tente novamente.',
      type: 'error',
    });
  }
}

/* ======================================================================
 * Salvar assinatura
 * ====================================================================== */
async function saveSignature() {
  const nameInput = document.getElementById('signedName');
  const signedName = (nameInput?.value || '').trim();

  if (!state.isUnlocked) {
    showCenterModal?.({
      title: 'Assinatura bloqueada',
      message:
        'Primeiro leia ou informe a chave de acesso da NF-e para liberar a assinatura.',
      type: 'warning',
    });
    return;
  }

  if (!signedName) {
    showCenterModal?.({
      title: 'Nome obrigatório',
      message: 'Informe o nome legível de quem está recebendo as mercadorias.',
      type: 'warning',
    });
    nameInput?.focus();
    return;
  }

  if (!state.hasStroke) {
    showCenterModal?.({
      title: 'Assinatura vazia',
      message: 'Por favor, assine no espaço indicado antes de salvar.',
      type: 'warning',
    });
    return;
  }

  if (!state.orderId || !state.nfeKey) {
    showCenterModal?.({
      title: 'Dados incompletos',
      message:
        'Não foi possível identificar o pedido ou a NF-e. Verifique a chave e tente novamente.',
      type: 'error',
    });
    return;
  }

  const canvas = state.canvas;
  if (!canvas) return;

  const btnSave = document.getElementById('btnSaveSignature');
  const originalText = btnSave?.textContent;

  try {
    if (btnSave) {
      btnSave.disabled = true;
      btnSave.textContent = 'Salvando...';
    }

    const dataUrl = canvas.toDataURL('image/png');

    const payload = {
      order_id: state.orderId,
      nfe_key: state.nfeKey,
      signed_name: signedName,
      signature_image: dataUrl,
    };

    const resp = await fetch(`${API_BASE}/api/signatures-deliveries`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const result = await resp.json().catch(() => ({}));

    if (!resp.ok || !result.success) {
      console.error('Erro ao salvar assinatura:', result);
      throw new Error(result?.error || 'Erro ao salvar assinatura.');
    }

    showCenterModal?.({
      title: 'Assinatura salva',
      message: 'A assinatura de entrega foi registrada com sucesso.',
      type: 'success',
    });

    // Aqui você pode redirecionar de volta para a tela de logística:
    // window.location.href = `/public/ordersLogisticsBlindCheck/ordersLogisticsBlindCheck.html?orderId=${state.orderId}`;
  } catch (err) {
    console.error('saveSignature() failed:', err);
    showCenterModal?.({
      title: 'Erro ao salvar',
      message:
        err?.message ||
        'Ocorreu um erro ao salvar a assinatura. Tente novamente em instantes.',
      type: 'error',
    });
  } finally {
    if (btnSave) {
      btnSave.disabled = false;
      btnSave.textContent = originalText || 'Salvar Assinatura';
    }
  }
}
