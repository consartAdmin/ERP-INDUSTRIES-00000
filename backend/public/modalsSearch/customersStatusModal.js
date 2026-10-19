// ╔══════════════════════════════════════════════════════════════════════╗
// ║ customerStatusModal.js — Modal "Status do Cliente"                  ║
// ║ Path: backend/public/includes/js/customerStatusModal.js             ║
// ║ - Lê ID do cliente pela query ?id                                   ║
// ║ - Carrega tipos de status (customer_status_types)                   ║
// ║ - Carrega status atual do cliente                                   ║
// ║ - Abre modal somente ao clicar no botão "Status"                    ║
// ║ - Salva/atualiza status via POST /api/customer-status               ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { showCenterModal } from '/public/includes/js/centerAlertModal.js';

// ---------------------------------------------------------------------
// API base
// ---------------------------------------------------------------------
const API_BASE = (
  window.apiBase ||
  window.API_BASE ||
  window.location.origin
).replace(/\/$/, '');

const ROUTES = Object.freeze({
  customerStatusTypesSearch: `${API_BASE}/api/customer-status-types/search`,
  customerStatusByCustomer:  (id) =>
    `${API_BASE}/api/customer-status/by-customer/${encodeURIComponent(id)}`,
  customerStatusSet:         `${API_BASE}/api/customer-status`
});

// ---------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------
const $ = (sel, root = document) => root.querySelector(sel);

function getCurrentCustomerIdFromUrl() {
  try {
    const url = new URL(window.location.href);
    const id = url.searchParams.get('id');
    return id ? String(id).trim() : null; // ✅ mantém como string
  } catch {
    return null;
  }
}


function formatDateTimeBr(value) {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('pt-BR');
}

// ---------------------------------------------------------------------
// Estado local
// ---------------------------------------------------------------------
const els = {
  badge: null,
  lastUpdate: null,
  openBtn: null,
  overlay: null,
  statusSelect: null,
  note: null,
  meta: null,
  closeBtn: null,
  cancelBtn: null,
  saveBtn: null
};

let statusTypesCache = null;
let currentCustomerStatus = null;
let currentCustomerId = null;

// ---------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  currentCustomerId = getCurrentCustomerIdFromUrl();
  cacheElements();

  // 🔒 Garante que o modal NASCE fechado
  forceCloseModal();

  // se não tiver cliente ou elementos principais, não faz nada
  if (!currentCustomerId || !els.openBtn || !els.badge) return;

  bindEvents();

  // Só atualiza o "badge" — NÃO abre o modal
  loadAndRenderCurrentStatus().catch((err) =>
    console.warn('[customerStatusModal] falha ao carregar status inicial:', err)
  );
});

// ---------------------------------------------------------------------
// Cache de elementos
// ---------------------------------------------------------------------
function cacheElements() {
  els.badge        = $('#customerStatusBadge');
  els.lastUpdate   = $('#customerStatusLastUpdate');
  els.openBtn      = $('#btnOpenCustomerStatusModal');
  els.overlay      = $('#customerStatusModal');
  els.statusSelect = $('#csStatusSelect');
  els.note         = $('#csStatusNote');
  els.meta         = $('#csStatusMeta');
  els.closeBtn     = $('#csModalCloseBtn');
  els.cancelBtn    = $('#csModalCancelBtn');
  els.saveBtn      = $('#csModalSaveBtn');
}

// ---------------------------------------------------------------------
// Força o modal a ficar fechado (inicialização e close)
// ---------------------------------------------------------------------
function forceCloseModal() {
  if (!els.overlay) return;
  els.overlay.hidden = true;
  els.overlay.style.display = 'none';
  els.overlay.setAttribute('aria-hidden', 'true');
}

// ---------------------------------------------------------------------
// Eventos
// ---------------------------------------------------------------------
function bindEvents() {
  // Abrir modal
  els.openBtn.addEventListener('click', async () => {
    try {
      await ensureStatusTypesLoaded();
      await prepareModalFields();
      openModal();
    } catch (err) {
      console.error('[customerStatusModal] erro ao abrir modal:', err);
      showCenterModal({
        variant: 'error',
        title: 'Status do Cliente',
        message: 'Erro ao carregar informações de status.'
      });
    }
  });

  // Fechar modal (X / Cancelar / fundo)
  [els.closeBtn, els.cancelBtn].forEach((btn) => {
    if (!btn) return;
    btn.addEventListener('click', closeModal);
  });

  if (els.overlay) {
    els.overlay.addEventListener('click', (ev) => {
      if (ev.target === els.overlay) closeModal();
    });
  }

  // Salvar
  if (els.saveBtn) {
    els.saveBtn.addEventListener('click', onSaveStatusClick);
  }
}

// ---------------------------------------------------------------------
// View helpers
// ---------------------------------------------------------------------
function openModal() {
  if (!els.overlay) return;
  els.overlay.hidden = false;
  els.overlay.style.display = 'flex';   // segue o layout centrado
  els.overlay.removeAttribute('aria-hidden');
  document.body.classList.add('modal-open');
}

function closeModal() {
  forceCloseModal();
  document.body.classList.remove('modal-open');
}

function applyBadge(statusRow) {
  if (!els.badge) return;

  if (!statusRow) {
    els.badge.textContent = 'Não definido';
    els.badge.classList.add('status-badge--neutral');
    els.badge.style.backgroundColor = '';
    els.badge.style.color = '';
    if (els.lastUpdate) els.lastUpdate.textContent = '';
    return;
  }

  const {
    status_name_pt,
    status_color_hex,
    updated_at,
    note
  } = statusRow;

  els.badge.textContent = status_name_pt || 'Sem status';
  els.badge.classList.remove('status-badge--neutral');

  if (status_color_hex) {
    els.badge.style.backgroundColor = status_color_hex;
    els.badge.style.color = '#ffffff';
  } else {
    els.badge.style.backgroundColor = '';
    els.badge.style.color = '';
  }

  if (els.lastUpdate) {
    let txt = 'Última atualização: ' + (updated_at ? formatDateTimeBr(updated_at) : '—');
    if (note) txt += ` • ${note}`;
    els.lastUpdate.textContent = txt;
  }
}

// ---------------------------------------------------------------------
// Carregamento de dados
// ---------------------------------------------------------------------
async function ensureStatusTypesLoaded() {
  if (statusTypesCache) return statusTypesCache;

  const url = `${ROUTES.customerStatusTypesSearch}?is_active=true&limit=100`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });

  if (!res.ok) {
    throw new Error(`StatusTypes HTTP ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();
  statusTypesCache = data.rows || data.items || data.data || [];

  if (els.statusSelect) {
    els.statusSelect.innerHTML =
      '<option value="">Selecione um status...</option>';

    statusTypesCache.forEach((t) => {
      const opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = t.name_pt || t.name || `Status #${t.id}`;
      els.statusSelect.appendChild(opt);
    });
  }

  return statusTypesCache;
}

async function loadAndRenderCurrentStatus() {
  if (!currentCustomerId) return;

  const res = await fetch(ROUTES.customerStatusByCustomer(currentCustomerId), {
    headers: { Accept: 'application/json' }
  });

  if (res.status === 404) {
    currentCustomerStatus = null;
    applyBadge(null);
    return;
  }

  if (!res.ok) {
    throw new Error(`StatusByCustomer HTTP ${res.status}: ${await res.text()}`);
  }

  currentCustomerStatus = await res.json();
  applyBadge(currentCustomerStatus);
}

// Prepara campos do modal antes de abrir
async function prepareModalFields() {
  await loadAndRenderCurrentStatus(); // garante currentCustomerStatus atualizado

  if (!els.statusSelect || !els.note || !els.meta) return;

  if (currentCustomerStatus) {
    els.statusSelect.value =
      String(currentCustomerStatus.status_type_id || '');
    els.note.value = currentCustomerStatus.note || '';
    els.meta.textContent =
      'Última atualização: ' +
      (currentCustomerStatus.updated_at
        ? formatDateTimeBr(currentCustomerStatus.updated_at)
        : '—');
  } else {
    els.statusSelect.value = '';
    els.note.value = '';
    els.meta.textContent = 'Defina um status para este cliente.';
  }
}

// ---------------------------------------------------------------------
// Abre o modal com um tipo já selecionado (ex.: tipo recém-criado pelo
// "+" da Edição de Clientes). Recarrega os tipos para incluir o novo.
// ---------------------------------------------------------------------
export async function openCustomerStatusModalWithType(statusTypeId) {
  if (!els.overlay || !currentCustomerId) return;

  statusTypesCache = null;
  await ensureStatusTypesLoaded();
  await prepareModalFields();

  if (els.statusSelect && statusTypeId) {
    els.statusSelect.value = String(statusTypeId);
  }

  openModal();
}

// ---------------------------------------------------------------------
// Salvar
// ---------------------------------------------------------------------
async function onSaveStatusClick() {
  try {
    if (!currentCustomerId) {
      showCenterModal({
        variant: 'warning',
        title: 'Status do Cliente',
        message: 'ID do cliente não encontrado.'
      });
      return;
    }

    const statusTypeId = els.statusSelect
      ? Number(els.statusSelect.value || 0)
      : 0;
    const note = els.note ? els.note.value : '';

    if (!statusTypeId) {
      showCenterModal({
        variant: 'warning',
        title: 'Status do Cliente',
        message: 'Selecione um status para o cliente.'
      });
      return;
    }

    const res = await fetch(ROUTES.customerStatusSet, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({
        customer_id: currentCustomerId,      // ✅ string
        status_type_id: statusTypeId,
        note
      })
    });

    const js = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(js?.message || js?.error || `HTTP ${res.status}`);
    }

    // Recarrega status para badge + modal com dados consistentes
    await loadAndRenderCurrentStatus();
    closeModal();

    showCenterModal({
      variant: 'success',
      title: 'Status do Cliente',
      message: 'Status atualizado com sucesso.',
      timeoutMs: 2000
    });
  } catch (err) {
    console.error('[customerStatusModal] erro ao salvar:', err);
    showCenterModal({
      variant: 'error',
      title: 'Status do Cliente',
      message: 'Não foi possível salvar o status do cliente.'
    });
  }
}
