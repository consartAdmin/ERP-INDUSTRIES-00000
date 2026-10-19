// ╔══════════════════════════════════════════════════════════════════════╗
// ║ productsBoxes.js — Frontend (ESM)                                     ║
// ║ Path: backend/public/productsBoxes/productsBoxes.js                   ║
// ║ Consome API: /api/products-boxes                                      ║
// ║ - Listagem com paginação/busca                                        ║
// ║ - CRUD Caixa                                                         ║
// ║ - Itens (product_code) por caixa (upsert/delete)                              ║
// ║ + Modal de Produtos (F2 / dblclick): /public/modalsSearch/productsModalSearch.js ║
// ║ + PDF: GET /api/products-boxes/pdf (box_id ou listagem)               ║
// ║ ✅ NOVO: Coluna "Descrição" (product_description) na tabela           ║
// ║ ✅ FIX: não quebra se campo "code" não existir no HTML/API            ║
// ║ ✅ FIX: confirmações com showCenterModal (NOVO centerAlertModal.js)    ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { openProductsModalSearch } from '/public/modalsSearch/productsModalSearch.js';
import { openProductsBoxesItemModal } from './productsBoxesModal.js';

// ✅ usa o NOVO centerAlertModal.js (showCenterModal com buttons[])
import { showCenterModal } from '/public/includes/js/centerAlertModal.js';

/* ──────────────────────────────────────────────────────────────
   CENTER ALERT MODAL (CONSART) — helpers padrão (toast + confirm)
────────────────────────────────────────────────────────────── */
function toastCenter(message, type = 'info', title) {
  const map = { info: 'info', success: 'success', warning: 'warning', error: 'error' };
  const variant = map[type] || 'info';

  const defaultTitle =
    variant === 'success' ? 'Tudo certo!'
      : variant === 'warning' ? 'Atenção'
        : variant === 'error' ? 'Ocorreu um erro'
          : 'Informação';

  // ✅ importante: não quebra se showCenterModal falhar
  try {
    if (typeof showCenterModal !== 'function') {
      console.warn('[centerAlertModal] showCenterModal não disponível. Fallback alert().');
      alert(`${title ?? defaultTitle}\n\n${String(message ?? '')}`);
      return;
    }

    showCenterModal({
      variant,
      title: title ?? defaultTitle,
      message: String(message ?? ''),
      timeoutMs: (variant === 'success' || variant === 'info') ? 4500 : null,
      okText: 'OK',
      closeText: 'Fechar',
    });
  } catch (e) {
    console.error('[centerAlertModal] Falha ao abrir modal:', e);
    alert(`${title ?? defaultTitle}\n\n${String(message ?? '')}`);
  }
}

function setHelperValue(helpers, field, value) {
  if (!helpers) return false;

  // tenta várias assinaturas comuns (snake_case e camelCase)
  const candidates = [
    `set${field}`,                                    // setProduct_code
    `set${field.replace(/_([a-z])/g, (_, c) => c.toUpperCase())}`, // setProductCode
    `set${field.toUpperCase()}`,                      // setPRODUCT_CODE (fallback raro)
  ];

  for (const fnName of candidates) {
    const fn = helpers[fnName];
    if (typeof fn === 'function') {
      fn.call(helpers, value);
      return true;
    }
  }

  // fallback ultra: tenta campos diretos se existirem
  if (field in helpers) {
    helpers[field] = value;
    return true;
  }

  console.warn(`[productsBoxes] Setter não encontrado para "${field}". Disponíveis:`, Object.keys(helpers));
  return false;
}

/**
 * ✅ Confirm padrão CONSART com o NOVO centerAlertModal.js (buttons[])
 * Retorna: true (confirmou) | false (cancelou/fechou)
 */
async function confirmCenter(message, title = 'Atenção') {
  const fallback = () => confirm(`${title}\n\n${String(message ?? '')}`);

  try {
    if (typeof showCenterModal !== 'function') return fallback();

    const btn = await showCenterModal({
      variant: 'warning',
      title,
      message: String(message ?? ''),
      timeoutMs: null,
      buttons: [
        { label: 'Cancelar',  variant: 'cancel'  },
        { label: 'Confirmar', variant: 'confirm' },
      ],
    });

    const v = String(btn?.variant || '').toLowerCase();
    return (v === 'confirm' || v === 'ok' || v === 'primary' || v === 'success');
  } catch (e) {
    console.error('[centerAlertModal] confirmCenter falhou:', e);
    return fallback();
  }
}

/* ✅ DEBUG opcional: rode no console window.__testCenterModal__() */
window.__testCenterModal__ = async () => {
  toastCenter('Toast INFO funcionando.', 'info');
  await new Promise(r => setTimeout(r, 600));
  toastCenter('Toast SUCCESS funcionando.', 'success');
  const ok = await confirmCenter('Confirmar que o modal está OK?', 'Teste');
  toastCenter(ok ? 'Você confirmou ✅' : 'Você cancelou ❌', ok ? 'success' : 'warning');
};

//______________________________________________________________________________________________________

const API_BASE = (window.apiBase || window.API_BASE || window.location.origin).replace(/\/$/, '');
const API = `${API_BASE}/api/products-boxes`;
const PDF_API = `${API}/pdf`; // ✅ backend: GET /api/products-boxes/pdf

/* ──────────────────────────────────────────────────────────────
   DOM
────────────────────────────────────────────────────────────── */
const el = (id) => document.getElementById(id);

const boxesList = el('boxesList');
const listCount = el('listCount');
const pageInfo  = el('pageInfo');

const searchQ      = el('searchQ');
const filterActive = el('filterActive');
const orderBy      = el('orderBy');
const pageSize     = el('pageSize');

const btnSearch  = el('btnSearch');
const btnPrev    = el('btnPrev');
const btnNext    = el('btnNext');
const btnNewBox  = el('btnNewBox');
const btnRefresh = el('btnRefresh');

const detailTitle    = el('detailTitle');
const detailSubtitle = el('detailSubtitle');

const btnSaveBox      = el('btnSaveBox');
const btnDeleteBox    = el('btnDeleteBox');
const btnToggleActive = el('btnToggleActive');
const btnResetForm    = el('btnResetForm');

const btnDownloadPdf     = el('btnDownloadPdf');
const btnDownloadListPdf = el('btnDownloadListPdf');

const boxForm = el('boxForm');
const box_id  = el('box_id');

/**
 * ✅ FIX: f_code estava sendo usado, mas pode não existir.
 * - Se seu HTML tiver <input id="code">, ele funciona.
 * - Se não tiver, fica null e o código não quebra.
 */
const f_code = el('code');

const f_name           = el('name');
const f_box_type       = el('box_type');
const f_location       = el('location');
const f_length_cm      = el('length_cm');
const f_width_cm       = el('width_cm');
const f_height_cm      = el('height_cm');
const f_max_weight_kg  = el('max_weight_kg');
const f_max_volume_cm3 = el('max_volume_cm3');
const f_notes          = el('notes');

const pillActive  = el('pillActive');
const timestamps  = el('timestamps');

const btnAddItem     = el('btnAddItem');
const btnReloadItems = el('btnReloadItems');
const itemsTbody     = el('itemsTbody');

const toast = el('toast');

/* ──────────────────────────────────────────────────────────────
   State
────────────────────────────────────────────────────────────── */
let state = {
  page: 1,
  pageSize: Number(pageSize?.value) || 50,
  total: 0,
  rows: [],
  selectedBox: null,
  selectedBoxItems: [],
  formSnapshot: null,
};

// quando tiver tabela de preço selecionada no sistema, preencha aqui
let selectedPriceId = null;

/* ──────────────────────────────────────────────────────────────
   Helpers
────────────────────────────────────────────────────────────── */
function showToast(message, detail = '') {
  if (!toast) return;
  toast.innerHTML = `${escapeHtml(message)}${detail ? `<small>${escapeHtml(detail)}</small>` : ''}`;
  toast.classList.add('is-show');
  window.clearTimeout(showToast._t);
  showToast._t = window.setTimeout(() => toast.classList.remove('is-show'), 2600);
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (m) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  }[m]));
}

function toNumOrNull(v) {
  if (v === '' || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function findExistingItem(product_code) {
  const sku = String(product_code || '').trim();
  if (!sku) return null;

  return (state.selectedBoxItems || []).find(it =>
    String(it?.product_code || '').trim() === sku
  ) || null;
}

function normalizeStr(v) {
  const s = String(v ?? '').trim();
  return s ? s : null;
}

function requireSelectedBox() {
  if (!state.selectedBox?.box_id) {
    showToast('Selecione uma caixa primeiro.');
    return false;
  }
  return true;
}

/**
 * ✅ Confirm CONSART (ATUALIZADO p/ NOVO centerAlertModal.js):
 * - showCenterModal({ title, message, variant, buttons:[...] }) retorna o OBJETO do botão clicado
 * - fallback confirm() se algo falhar
 */
async function askConfirm(title, message) {
  return confirmCenter(message, title);
}

function setDisabled(disabled) {
  btnSaveBox && (btnSaveBox.disabled = disabled);
  btnDeleteBox && (btnDeleteBox.disabled = disabled);
  btnToggleActive && (btnToggleActive.disabled = disabled);
  btnResetForm && (btnResetForm.disabled = disabled);
  btnAddItem && (btnAddItem.disabled = disabled);
  btnReloadItems && (btnReloadItems.disabled = disabled);

  if (btnDownloadPdf) btnDownloadPdf.disabled = disabled || !state.selectedBox?.box_id;
  if (btnDownloadListPdf) btnDownloadListPdf.disabled = false;

  if (boxForm) {
    Array.from(boxForm.querySelectorAll('input,textarea,select')).forEach((i) => {
      if (i.id === 'box_id') return;
      i.disabled = disabled;
    });
  }
}

function snapshotForm() {
  const snap = {
    code: f_code?.value ?? '',
    name: f_name?.value ?? '',
    box_type: f_box_type?.value ?? '',
    location: f_location?.value ?? '',
    length_cm: f_length_cm?.value ?? '',
    width_cm: f_width_cm?.value ?? '',
    height_cm: f_height_cm?.value ?? '',
    max_weight_kg: f_max_weight_kg?.value ?? '',
    max_volume_cm3: f_max_volume_cm3?.value ?? '',
    notes: f_notes?.value ?? '',
  };
  state.formSnapshot = JSON.stringify(snap);
}

function isFormDirty() {
  if (!state.formSnapshot) return false;
  const current = JSON.stringify({
    code: f_code?.value ?? '',
    name: f_name?.value ?? '',
    box_type: f_box_type?.value ?? '',
    location: f_location?.value ?? '',
    length_cm: f_length_cm?.value ?? '',
    width_cm: f_width_cm?.value ?? '',
    height_cm: f_height_cm?.value ?? '',
    max_weight_kg: f_max_weight_kg?.value ?? '',
    max_volume_cm3: f_max_volume_cm3?.value ?? '',
    notes: f_notes?.value ?? '',
  });
  return current !== state.formSnapshot;
}

async function apiFetch(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });

  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* ignore */ }

  if (!res.ok) {
    const msg = json?.message || `Erro HTTP ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    err.payload = json;
    throw err;
  }
  return json;
}

/* ──────────────────────────────────────────────────────────────
   PDF Helpers
────────────────────────────────────────────────────────────── */
function openUrl(url) {
  if (!url) return;
  window.open(url, '_blank', 'noopener,noreferrer');
}

function generatePdfForSelectedBox() {
  if (!requireSelectedBox()) return;

  const qs = new URLSearchParams();
  qs.set('includeItems', 'true');

  const boxId = state.selectedBox.box_id;
  const url = `${API}/${boxId}/pdf?${qs.toString()}`;

  showToast('Gerando PDF...');
  openUrl(url);
}

function generatePdfForList() {
  const qv = normalizeStr(searchQ?.value);
  const av = normalizeStr(filterActive?.value);
  const ob = normalizeStr(orderBy?.value);

  const qs = new URLSearchParams();
  if (qv) qs.set('q', qv);
  if (av !== null) qs.set('active', av ?? '');
  if (ob) qs.set('orderBy', ob);

  qs.set('page', '1');
  qs.set('pageSize', '5000');
  qs.set('includeItems', 'true');

  const url = `${PDF_API}?${qs.toString()}`;
  showToast('Gerando PDF completo (caixas + itens)...');
  openUrl(url);
}

/* ──────────────────────────────────────────────────────────────
   Products Modal Search Integration (picker genérico)
────────────────────────────────────────────────────────────── */
function openProductPicker({ onPick } = {}) {
  openProductsModalSearch({
    apiBase: API_BASE,
    onPick: (p) => {
      const product_code =
      p?.product_code ??
      p?.sku ??
      p?.codigo ??
      p?.code ??
      '';

      const unit =
        p?.unit ??
        p?.unidade ??
        p?.unidade_padrao ??
        p?.unit_name ??
        p?.product_unit ??
        '';

      const desc =
        p?.description ??
        p?.descricao ??
        p?.nome ??
        p?.name ??
        '';

      onPick?.({
        product_code:  product_code ? String(product_code).trim() : '',
        unit: unit ? String(unit).trim() : '',
        desc: desc ? String(desc).trim() : '',
      });
    },
  });
}

// Disponibiliza o picker para o modal externo (se ele quiser usar)
window.__consartProductsPickerForBoxes__ = openProductPicker;

/* ──────────────────────────────────────────────────────────────
   Render
────────────────────────────────────────────────────────────── */
function renderBoxesList() {
  if (!boxesList) return;

  boxesList.innerHTML = '';

  if (listCount) listCount.textContent = String(state.total || 0);

  const totalPages = Math.max(1, Math.ceil((state.total || 0) / (state.pageSize || 50)));
  if (pageInfo) pageInfo.textContent = `${state.page} / ${totalPages}`;

  if (btnPrev) btnPrev.disabled = state.page <= 1;
  if (btnNext) btnNext.disabled = state.page >= totalPages;

  const rows = state.rows || [];
  if (!rows.length) {
    boxesList.innerHTML = `
      <tr>
        <td colspan="4" class="pbx__empty">Nenhuma caixa encontrada.</td>
      </tr>
    `;
    return;
  }

  for (const row of rows) {
    const tr = document.createElement('tr');
    tr.dataset.id = String(row.box_id);

    // ✅ marca selecionado
    if (state.selectedBox?.box_id === row.box_id) tr.classList.add('is-active');

    const code = (row.code ?? '').toString().trim() || `#${row.box_id}`;
    const name = (row.name ?? '').toString().trim() || '—';
    const type = (row.box_type ?? '').toString().trim() || '—';

    // ✅ seu backend usa "active" (true/false)
    const isActive = !!row.active;

    tr.innerHTML = `
      <td><strong>${escapeHtml(code)}</strong></td>
      <td>${escapeHtml(name)}</td>
      <td>${escapeHtml(type)}</td>
      <td>
        <span class="pbx__statusBadge ${isActive ? 'pbx__statusBadge--ok' : 'pbx__statusBadge--off'}">
          ${isActive ? 'Ativo' : 'Inativo'}
        </span>
      </td>
    `;

    tr.addEventListener('click', () => selectBox(row.box_id));
    boxesList.appendChild(tr);
  }
}

function renderBoxDetail(box) {
  if (!box) {
    detailTitle && (detailTitle.textContent = 'Selecione uma caixa');
    detailSubtitle && (detailSubtitle.textContent = 'Crie uma nova caixa ou selecione uma existente na lista.');
    box_id && (box_id.value = '');
    boxForm && boxForm.reset();
    pillActive && (pillActive.textContent = '—');
    timestamps && (timestamps.textContent = '');
    if (itemsTbody) itemsTbody.innerHTML = `<tr><td colspan="6" class="pbx__empty">Selecione uma caixa para carregar os itens.</td></tr>`;
    setDisabled(true);
    return;
  }

  detailTitle && (detailTitle.textContent = `Caixa #${box.box_id}`);

  const subtitleCode = normalizeStr(box.code) ? ` • ${box.code}` : '';
  detailSubtitle && (detailSubtitle.textContent = `${box.name}${subtitleCode}`);

  box_id && (box_id.value = box.box_id ?? '');
  if (f_code) f_code.value = box.code ?? '';
  f_name && (f_name.value = box.name ?? '');
  f_box_type && (f_box_type.value = box.box_type ?? '');
  f_location && (f_location.value = box.location ?? '');

  f_length_cm && (f_length_cm.value = box.length_cm ?? '');
  f_width_cm && (f_width_cm.value = box.width_cm ?? '');
  f_height_cm && (f_height_cm.value = box.height_cm ?? '');
  f_max_weight_kg && (f_max_weight_kg.value = box.max_weight_kg ?? '');
  f_max_volume_cm3 && (f_max_volume_cm3.value = box.max_volume_cm3 ?? '');
  f_notes && (f_notes.value = box.notes ?? '');

  if (pillActive) {
    pillActive.textContent = box.active ? 'Ativo' : 'Inativo';
    pillActive.style.borderColor = box.active ? 'rgba(53,197,143,0.35)' : 'rgba(226,75,75,0.35)';
    pillActive.style.color = box.active ? 'rgba(53,197,143,0.95)' : 'rgba(226,75,75,0.95)';
    pillActive.style.background = box.active ? 'rgba(53,197,143,0.10)' : 'rgba(226,75,75,0.10)';
  }

  const created = box.created_at ? new Date(box.created_at).toLocaleString('pt-BR') : '—';
  const updated = box.updated_at ? new Date(box.updated_at).toLocaleString('pt-BR') : '—';
  timestamps && (timestamps.textContent = `Criado: ${created} • Atualizado: ${updated}`);

  btnToggleActive && (btnToggleActive.textContent = box.active ? 'Inativar' : 'Ativar');

  setDisabled(false);
  snapshotForm();
}

/** ✅ decide a "Descrição" que vai aparecer na tabela */
function getItemDescription(it) {
  const d1 = normalizeStr(it?.product_description);
  if (d1) return d1;

  const d2 = normalizeStr(it?.notes);
  if (d2) return d2;

  return '—';
}

function renderItems(items = []) {
  state.selectedBoxItems = items;

  if (!itemsTbody) return;

  if (!state.selectedBox?.box_id) {
    itemsTbody.innerHTML = `<tr><td colspan="6" class="pbx__empty">Selecione uma caixa para carregar os itens.</td></tr>`;
    return;
  }

  if (!items.length) {
    itemsTbody.innerHTML = `<tr><td colspan="6" class="pbx__empty">Nenhum item cadastrado para esta caixa.</td></tr>`;
    return;
  }

  itemsTbody.innerHTML = '';
  for (const it of items) {
    const tr = document.createElement('tr');
    const desc = getItemDescription(it);

    tr.innerHTML = `
      <td><strong>${escapeHtml(it.product_code)}</strong></td>
      <td>${escapeHtml(it.quantity ?? '')}</td>
      <td>${escapeHtml(it.unit ?? '')}</td>
      <td class="pbx__tdDesc" title="${escapeHtml(desc)}">${escapeHtml(desc)}</td>
      <td>${escapeHtml(it.notes ?? '')}</td>
      <td style="text-align:right;">
        <div class="pbx__rowActions">
          <button class="btn btn-toolbar btn-sm" data-act="edit" type="button">Editar</button>
          <button class="btn btn-toolbar btn-sm" data-act="del" type="button">Excluir</button>
        </div>
      </td>
    `;

    tr.querySelector('[data-act="edit"]')?.addEventListener('click', () => onEditItem(it));
    tr.querySelector('[data-act="del"]')?.addEventListener('click', () => onDeleteItem(it.product_code));

    itemsTbody.appendChild(tr);
  }
}

/* ──────────────────────────────────────────────────────────────
   Loaders
────────────────────────────────────────────────────────────── */
async function loadBoxes() {
  state.pageSize = Number(pageSize?.value) || 50;

  const qs = new URLSearchParams();
  const qv = normalizeStr(searchQ?.value);
  const av = normalizeStr(filterActive?.value);
  const ob = normalizeStr(orderBy?.value);

  if (qv) qs.set('q', qv);
  if (av !== null) qs.set('active', av);
  qs.set('page', String(state.page));
  qs.set('pageSize', String(state.pageSize));
  if (ob) qs.set('orderBy', ob);

  const data = await apiFetch(`${API}?${qs.toString()}`);
  const list = data?.data;

  state.total = Number(list?.total || 0);
  state.rows = list?.rows || [];

  renderBoxesList();
}

async function selectBox(id) {
  if (state.selectedBox?.box_id && isFormDirty()) {
    const ok = await askConfirm(
      'Alterações não salvas',
      'Você tem alterações não salvas. Deseja trocar de caixa e perder as alterações?'
    );
    if (!ok) return;
  }

  const data = await apiFetch(`${API}/${id}`);
  const box = data?.data || null;
  state.selectedBox = box;

  renderBoxDetail(box);
  await loadItems();
  await loadBoxes();
}

async function loadItems() {
  if (!state.selectedBox?.box_id) return;

  const data = await apiFetch(`${API}/${state.selectedBox.box_id}/items`);
  const items = data?.data || [];
  renderItems(items);
}

/* ──────────────────────────────────────────────────────────────
   Actions — Box
────────────────────────────────────────────────────────────── */
function clearSelection() {
  state.selectedBox = null;
  state.selectedBoxItems = [];
  renderBoxDetail(null);
  renderBoxesList();
}

async function setNewBoxMode() {
  if (state.selectedBox?.box_id && isFormDirty()) {
    const ok = await askConfirm(
      'Alterações não salvas',
      'Você tem alterações não salvas. Criar nova caixa e perder alterações?'
    );
    if (!ok) return;
  }

  state.selectedBox = null;
  boxForm && boxForm.reset();
  box_id && (box_id.value = '');

  detailTitle && (detailTitle.textContent = 'Nova Caixa');
  detailSubtitle && (detailSubtitle.textContent = 'Preencha os dados e clique em Salvar.');

  if (pillActive) {
    pillActive.textContent = 'Ativo (novo)';
    pillActive.style.borderColor = 'rgba(53,197,143,0.35)';
    pillActive.style.color = 'rgba(53,197,143,0.95)';
    pillActive.style.background = 'rgba(53,197,143,0.10)';
  }
  timestamps && (timestamps.textContent = '');

  if (itemsTbody) itemsTbody.innerHTML = `<tr><td colspan="6" class="pbx__empty">Salve a caixa para gerenciar os itens.</td></tr>`;

  if (boxForm) {
    Array.from(boxForm.querySelectorAll('input,textarea,select')).forEach((i) => {
      if (i.id === 'box_id') return;
      i.disabled = false;
    });
  }

  btnSaveBox && (btnSaveBox.disabled = false);
  btnResetForm && (btnResetForm.disabled = false);
  btnDeleteBox && (btnDeleteBox.disabled = true);
  btnToggleActive && (btnToggleActive.disabled = true);
  btnAddItem && (btnAddItem.disabled = true);
  btnReloadItems && (btnReloadItems.disabled = true);
  btnDownloadPdf && (btnDownloadPdf.disabled = true);

  snapshotForm();
  f_name?.focus();
}

function getFormPayload() {
  const payload = {
    code: normalizeStr(f_code?.value),
    name: normalizeStr(f_name?.value),
    box_type: normalizeStr(f_box_type?.value),
    location: normalizeStr(f_location?.value),
    length_cm: toNumOrNull(f_length_cm?.value),
    width_cm: toNumOrNull(f_width_cm?.value),
    height_cm: toNumOrNull(f_height_cm?.value),
    max_weight_kg: toNumOrNull(f_max_weight_kg?.value),
    max_volume_cm3: toNumOrNull(f_max_volume_cm3?.value),
    notes: normalizeStr(f_notes?.value) ? String(f_notes.value) : null,
  };

  // ✅ se não existir input code, remove do payload
  if (!f_code) delete payload.code;

  Object.keys(payload).forEach((k) => {
    if (payload[k] === undefined) delete payload[k];
  });

  return payload;
}

async function onSaveBox() {
  const payload = getFormPayload();
  if (!payload.name) {
    showToast('Nome é obrigatório.');
    f_name?.focus();
    return;
  }

  try {
    let saved = null;

    if (!box_id?.value) {
      const res = await apiFetch(API, { method: 'POST', body: JSON.stringify(payload) });
      saved = res?.data;
      showToast('Caixa criada com sucesso.');
    } else {
      const res = await apiFetch(`${API}/${box_id.value}`, { method: 'PUT', body: JSON.stringify(payload) });
      saved = res?.data;
      toastCenter('Caixa salva com sucesso.', 'success');
    }

    state.selectedBox = saved;
    renderBoxDetail(saved);
    await loadBoxes();
    await loadItems();
  } catch (err) {
    toastCenter(`Erro ao salvar caixa:\n${err.message}`, 'error');
  }
}

async function onDeleteBox() {
  if (!requireSelectedBox()) return;

  const ok = await askConfirm(
    'Excluir caixa',
    `Excluir a caixa #${state.selectedBox.box_id}? (itens serão removidos junto)`
  );
  if (!ok) return;

  try {
    await apiFetch(`${API}/${state.selectedBox.box_id}`, { method: 'DELETE' });
    showToast('Caixa excluída.');
    clearSelection();
    await loadBoxes();
  } catch (err) {
    showToast('Erro ao excluir caixa', err.message);
  }
}

async function onToggleActive() {
  if (!requireSelectedBox()) return;

  try {
    const nextActive = !state.selectedBox.active;
    const res = await apiFetch(`${API}/${state.selectedBox.box_id}`, {
      method: 'PUT',
      body: JSON.stringify({ active: nextActive }),
    });

    state.selectedBox = res?.data;
    renderBoxDetail(state.selectedBox);
    await loadBoxes();
    showToast(nextActive ? 'Caixa ativada.' : 'Caixa inativada.');
  } catch (err) {
    showToast('Erro ao alterar status', err.message);
  }
}

function onResetForm() {
  if (!state.selectedBox?.box_id) {
    boxForm?.reset();
    snapshotForm();
    return;
  }
  renderBoxDetail(state.selectedBox);
  snapshotForm();
}

/* ──────────────────────────────────────────────────────────────
   Actions — Items (USANDO MODAL EXTERNO)
────────────────────────────────────────────────────────────── */
async function onAddItem() {
  if (!requireSelectedBox()) return;

  const result = await openProductsBoxesItemModal({
    apiBase: API_BASE,
    initial: null,
onPickProduct: (helpers) => {

  openProductsModalSearch({
    onPick: (product) => {

      helpers.setSku(product.product_code);
      helpers.setUnit(product.unit);
      helpers.setDesc(product.product_description);
      helpers.focusQty();

    }
  });

}

  });

  if (!result) return;

const productCode = normalizeStr(result.product_code ?? result.sku);
const qtdNova = Number(toNumOrNull(result.quantity) || 0);

if (!productCode) {
  toastCenter('SKU obrigatório.', 'warning');
  return;
}

if (qtdNova <= 0) {
  toastCenter('Quantidade inválida.', 'warning');
  return;
}

// ✅ se já existe, soma
const existente = findExistingItem(productCode);
const qtdFinal = existente
  ? (Number(existente.quantity || 0) + qtdNova)
  : qtdNova;

await apiFetch(`${API}/${state.selectedBox.box_id}/items`, {
  method: 'POST',
  body: JSON.stringify({
    product_code: productCode,
    quantity: qtdFinal,
    unit: normalizeStr(result.unit) || existente?.unit || null,
    notes: normalizeStr(result.notes ?? result.desc)
      ? String(result.notes ?? result.desc)
      : (existente?.notes ?? null),
  }),
});

  showToast('Item salvo.');
  await loadItems();
}

async function onEditItem(item) {
  if (!requireSelectedBox()) return;

  const result = await openProductsBoxesItemModal({
    apiBase: API_BASE,
    initial: {
      product_code: item?.product_code ?? '',
      quantity: item?.quantity ?? '',
      unit: item?.unit ?? '',
      notes: item?.notes ?? '',
      desc: item?.product_description ?? '',
    },
onPickProduct: (helpers) => {

  openProductsModalSearch({
    onPick: (product) => {

      helpers.setSku(product.product_code);
      helpers.setUnit(product.unit);
      helpers.setDesc(product.product_description);
      helpers.focusQty();

    }
  });

}

  });

  if (!result) return;

const productCode = normalizeStr(result.product_code ?? result.sku);
const qtdNova = Number(toNumOrNull(result.quantity) || 0);

if (!productCode) {
  toastCenter('SKU obrigatório.', 'warning');
  return;
}

if (qtdNova <= 0) {
  toastCenter('Quantidade inválida.', 'warning');
  return;
}

// ✅ se já existe, soma
const existente = findExistingItem(productCode);
const qtdFinal = existente
  ? (Number(existente.quantity || 0) + qtdNova)
  : qtdNova;

await apiFetch(`${API}/${state.selectedBox.box_id}/items`, {
  method: 'POST',
  body: JSON.stringify({
    product_code: productCode,
    quantity: qtdFinal,
    unit: normalizeStr(result.unit) || existente?.unit || null,
    notes: normalizeStr(result.notes ?? result.desc)
      ? String(result.notes ?? result.desc)
      : (existente?.notes ?? null),
  }),
});

  toastCenter('Item salvo com sucesso.', 'success', 'Tudo certo!');
  await loadItems();
}

async function onDeleteItem(product_code) {
  if (!requireSelectedBox()) return;

  const ok = await askConfirm('Remover item', `Remover product_code "${product_code}" desta caixa?`);
  if (!ok) return;

  try {
    await apiFetch(`${API}/${state.selectedBox.box_id}/items/${encodeURIComponent(product_code)}`, { method: 'DELETE' });
    showToast('Item removido.');
    await loadItems();
  } catch (err) {
    showToast('Erro ao remover item', err.message);
  }
}

/* ──────────────────────────────────────────────────────────────
   Events
────────────────────────────────────────────────────────────── */
btnSearch?.addEventListener('click', async () => {
  state.page = 1;
  try { await loadBoxes(); } catch (e) { showToast('Erro ao carregar lista', e.message); }
});

searchQ?.addEventListener('keydown', async (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    state.page = 1;
    try { await loadBoxes(); } catch (err) { showToast('Erro ao carregar lista', err.message); }
  }
});

filterActive?.addEventListener('change', async () => {
  state.page = 1;
  try { await loadBoxes(); } catch (err) { showToast('Erro ao carregar lista', err.message); }
});

orderBy?.addEventListener('change', async () => {
  state.page = 1;
  try { await loadBoxes(); } catch (err) { showToast('Erro ao carregar lista', err.message); }
});

pageSize?.addEventListener('change', async () => {
  state.page = 1;
  try { await loadBoxes(); } catch (err) { showToast('Erro ao carregar lista', err.message); }
});

btnPrev?.addEventListener('click', async () => {
  state.page = Math.max(1, state.page - 1);
  try { await loadBoxes(); } catch (err) { showToast('Erro ao carregar lista', err.message); }
});

btnNext?.addEventListener('click', async () => {
  state.page += 1;
  try { await loadBoxes(); } catch (err) { showToast('Erro ao carregar lista', err.message); }
});

btnNewBox?.addEventListener('click', () => { setNewBoxMode(); });

btnRefresh?.addEventListener('click', async () => {
  try {
    await loadBoxes();
    if (state.selectedBox?.box_id) await selectBox(state.selectedBox.box_id);
    showToast('Atualizado.');
  } catch (err) {
    showToast('Erro ao atualizar', err.message);
  }
});

btnSaveBox?.addEventListener('click', onSaveBox);
btnDeleteBox?.addEventListener('click', onDeleteBox);
btnToggleActive?.addEventListener('click', onToggleActive);
btnResetForm?.addEventListener('click', onResetForm);

btnAddItem?.addEventListener('click', onAddItem);
btnReloadItems?.addEventListener('click', async () => {
  try { await loadItems(); showToast('Itens recarregados.'); }
  catch (err) { showToast('Erro ao carregar itens', err.message); }
});

btnDownloadPdf?.addEventListener('click', generatePdfForSelectedBox);
btnDownloadListPdf?.addEventListener('click', generatePdfForList);

boxForm?.addEventListener('input', () => {
  if (btnResetForm) btnResetForm.disabled = false;
});

/* ──────────────────────────────────────────────────────────────
   Boot
────────────────────────────────────────────────────────────── */
(async function init() {
  try {
    renderBoxDetail(null);
    await loadBoxes();

    if (btnDownloadListPdf) btnDownloadListPdf.disabled = false;

    showToast('Módulo carregado.');
  } catch (err) {
    showToast('Erro ao iniciar módulo', err.message);
  }
})();
