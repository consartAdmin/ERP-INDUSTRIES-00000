/*╔══════════════════════════════════════════════════════════════════════╗
  ║ OrdersLogisticsPacking.js — Packing & Volumes (PRODNEX ERP)           ║
  ║ Path: backend/public/OrdersLogisticsPacking/OrdersLogisticsPacking.js  ║
  ║ Stack: Vanilla JS | Fetch | HTML5 Drag&Drop                           ║
  ╚══════════════════════════════════════════════════════════════════════╝*/

'use strict';

import { showCenterModal } from '/public/includes/js/centerAlertModal.js';

const API_BASE =
  (typeof window !== 'undefined' && (window.apiBase || window.API_BASE)) ||
  (typeof window !== 'undefined' ? window.location.origin : '');

// Rotas do seu backend (Packing)
const ROUTES = Object.freeze({
  // modal search
  searchOrders: (q, limit = 25) =>
    `${API_BASE}/api/packing/orders/search?q=${encodeURIComponent(q)}&limit=${encodeURIComponent(limit)}`,

  // summary
  summary: (orderId) => `${API_BASE}/api/packing/orders/${encodeURIComponent(orderId)}/summary`,

  // ✅ PDF
  pdf: (orderId) => `${API_BASE}/api/packing/orders/${encodeURIComponent(orderId)}/pdf`,

  // volumes
  createVolume: (orderId) => `${API_BASE}/api/packing/orders/${encodeURIComponent(orderId)}/volumes`,
  deleteVolume: (volumeId) => `${API_BASE}/api/packing/volumes/${encodeURIComponent(volumeId)}`,

  // volume items
  addItemToVolume: (volumeId) => `${API_BASE}/api/packing/volumes/${encodeURIComponent(volumeId)}/items`,

  updateVolumeItem: (volumeItemId) => `${API_BASE}/api/packing/volume-items/${encodeURIComponent(volumeItemId)}`,

  updateVolume: (volumeId) =>
    `${API_BASE}/api/packing/volumes/${encodeURIComponent(volumeId)}`,

  deleteVolumeItem: (volumeItemId) => `${API_BASE}/api/packing/volume-items/${encodeURIComponent(volumeItemId)}`,

  moveVolumeItem: (volumeItemId) => `${API_BASE}/api/packing/volume-items/${encodeURIComponent(volumeItemId)}/move`,

  productUnits: (sku) =>
    `${API_BASE}/api/barcodes/active-units?product_code=${encodeURIComponent(sku)}`,
});

// Helpers DOM
const qs = (s, el = document) => el.querySelector(s);

function toNum(v, def = 0) {
  const n = Number(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : def;
}
function toInt(v) {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

function fmtKg(v) {
  const n = toNum(v, NaN);
  if (!Number.isFinite(n)) return '—';
  return `${n.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} kg`;
}
function fmtCm(v) {
  const n = toNum(v, NaN);
  if (!Number.isFinite(n)) return '—';
  return `${n.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 3 })} cm`;
}
function fmtM3(v) {
  const n = toNum(v, NaN);
  if (!Number.isFinite(n)) return '—';
  return `${n.toLocaleString('pt-BR', { minimumFractionDigits: 6, maximumFractionDigits: 6 })} m³`;
}

function escapeHtml(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function setText(el, value) {
  if (!el) return;
  el.textContent = value;
}

// Fetch helper
async function api(url, opts = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) {
    const msg = data?.error || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

/* ──────────────────────────────────────────────────────────────
   State
────────────────────────────────────────────────────────────── */
const state = {
  orderId: null,
  summary: null,
};

/* ──────────────────────────────────────────────────────────────
   Elements
────────────────────────────────────────────────────────────── */
const elOrderId = qs('#olpOrderId');
const btnLoadOrder = qs('#btnLoadOrder');
const btnRefresh = qs('#btnRefresh');
const btnOpenOrderSearch = qs('#btnOpenOrderSearch');
const btnCreateVolume = qs('#btnCreateVolume');
const btnPdf = qs('#btnPdf');

const kpiOrder = qs('#kpiOrder');
const kpiVolumes = qs('#kpiVolumes');
const kpiNotPacked = qs('#kpiNotPacked');
const kpiWeight = qs('#kpiWeight');
const kpiM3 = qs('#kpiM3');

const notPackedMeta = qs('#notPackedMeta');
const notPackedList = qs('#notPackedList');
const notPackedEmpty = qs('#notPackedEmpty');
const volumesWrap = qs('#volumesWrap');
const volumesEmpty = qs('#volumesEmpty');

const toastWrap = qs('#toast');

/* ──────────────────────────────────────────────────────────────
   Modal: Search Orders
────────────────────────────────────────────────────────────── */
const modal = qs('#orderSearchModal');
const modalBackdrop = qs('.olp-modal__backdrop', modal);
const btnCloseModal = qs('#btnCloseOrderSearch');
const inputSearch = qs('#orderSearchInput');
const btnSearchGo = qs('#btnOrderSearchGo');
const thead = qs('#orderSearchThead');
const tbody = qs('#orderSearchTbody');
const hint = qs('#orderSearchHint');

/* ──────────────────────────────────────────────────────────────
   Modal: Create Volume (Dimensões)
────────────────────────────────────────────────────────────── */
const cvModal = qs('#createVolumeModal');
const cvBackdrop = qs('.olp-modal__backdrop', cvModal);
const cvForm = qs('#formCreateVolume');
const btnCloseCreateVolume = qs('#btnCloseCreateVolume');
const btnCancelCreateVolume = qs('#btnCancelCreateVolume');

const cvType = qs('#cvType');
const cvDesc = qs('#cvDesc');
const cvH = qs('#cvH');
const cvW = qs('#cvW');
const cvL = qs('#cvL');
const cvTare = qs('#cvTare');
const cvNotes = qs('#cvNotes');

/* ──────────────────────────────────────────────────────────────
   Toast
────────────────────────────────────────────────────────────── */
function toast(msg, type = 'ok', ms = 2800) {
  if (!toastWrap) return;

  const div = document.createElement('div');
  div.className = `olp-toast__item ${type === 'err' ? 'is-error' : ''}`;
  div.innerHTML = `<b>${type === 'err' ? 'Erro' : 'OK'}</b><span>${escapeHtml(msg)}</span>`;

  toastWrap.appendChild(div);
  setTimeout(() => div.remove(), ms);
}

/* ──────────────────────────────────────────────────────────────
   Modal open/close helpers
────────────────────────────────────────────────────────────── */
function openModal() {
  if (!modal) return;
  modal.classList.add('is-open');
  modal.setAttribute('aria-hidden', 'false');

  // ✅ limpa seleção anterior
  setActiveSearchRow(-1);

  setTimeout(() => {
    inputSearch?.focus();
    // opcional: deixa texto selecionado
    try { inputSearch?.select?.(); } catch { }
  }, 60);
}
function closeModal() {
  if (!modal) return;
  modal.classList.remove('is-open');
  modal.setAttribute('aria-hidden', 'true');
}

function openCreateVolumeModal() {
  if (!cvModal) return;
  cvModal.classList.add('is-open');
  cvModal.setAttribute('aria-hidden', 'false');
  setTimeout(() => cvType?.focus(), 60);
}
function closeCreateVolumeModal() {
  if (!cvModal) return;
  cvModal.classList.remove('is-open');
  cvModal.setAttribute('aria-hidden', 'true');
}

function escHandler(e) {
  if (e.key !== 'Escape') return;
  if (modal?.classList.contains('is-open')) closeModal();
  if (cvModal?.classList.contains('is-open')) closeCreateVolumeModal();
}

/* ──────────────────────────────────────────────────────────────
   Debounce
────────────────────────────────────────────────────────────── */
function debounce(fn, wait = 250) {
  let t = null;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

/* ──────────────────────────────────────────────────────────────
   Search Orders — Keyboard Navigation
────────────────────────────────────────────────────────────── */
const searchState = {
  cols: ['order_id'],
  rows: [],
  activeIndex: -1,
};

function setActiveSearchRow(idx) {
  const rowsCount = searchState.rows.length;

  // limpa highlights atuais
  const trsAll = [...(tbody?.querySelectorAll('tr') || [])];
  trsAll.forEach(tr => tr.classList.remove('is-active'));

  if (!rowsCount) {
    searchState.activeIndex = -1;
    return;
  }

  // clamp circular
  if (idx < 0) idx = rowsCount - 1;
  if (idx >= rowsCount) idx = 0;

  searchState.activeIndex = idx;

  const trs = [...(tbody?.querySelectorAll('tr[data-order-id]') || [])];
  const tr = trs[idx];
  if (tr) {
    tr.classList.add('is-active');
    tr.scrollIntoView({ block: 'nearest' });
  }
}

function selectActiveSearchRow() {
  const idx = searchState.activeIndex;
  const row = searchState.rows[idx];
  if (!row) return false;

  const id = row.order_id;
  if (!id) return false;

  elOrderId.value = id;
  closeModal();
  loadOrder(id);
  return true;
}

/* ──────────────────────────────────────────────────────────────
   Search Orders
────────────────────────────────────────────────────────────── */
function renderSearchTable(cols = ['order_id'], rows = []) {
  thead.innerHTML = '';
  tbody.innerHTML = '';

  // ✅ guarda estado p/ teclado
  searchState.cols = cols;
  searchState.rows = rows;
  searchState.activeIndex = -1;

  for (const c of cols) {
    const th = document.createElement('th');
    th.textContent = c;
    thead.appendChild(th);
  }

  if (!rows.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = cols.length;
    td.style.color = '#6b7280';
    td.textContent = 'Nenhum pedido encontrado.';
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  rows.forEach((r, i) => {
    const tr = document.createElement('tr');
    tr.dataset.orderId = r.order_id;
    tr.dataset.index = String(i);

    tr.addEventListener('click', () => {
      const id = r.order_id;
      if (!id) return;
      elOrderId.value = id;
      closeModal();
      loadOrder(id);
    });

    // ✅ mouse define seleção também (UX premium)
    tr.addEventListener('mouseenter', () => setActiveSearchRow(i));

    for (const c of cols) {
      const td = document.createElement('td');
      const v = r[c];
      td.textContent = (v === null || v === undefined || v === '') ? '—' : String(v);
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  });

  // ✅ já seleciona o primeiro resultado
  setActiveSearchRow(0);
}

async function doSearchOrders() {
  const q = String(inputSearch?.value || '').trim();
  if (!q) {
    if (hint) hint.textContent = 'Digite algo e clique em Buscar.';
    renderSearchTable(['order_id'], []);
    return;
  }

  if (hint) hint.textContent = 'Buscando...';
  try {
    const data = await api(ROUTES.searchOrders(q, 25), { method: 'GET' });
    const cols = data.cols || ['order_id'];
    const rows = data.rows || [];
    renderSearchTable(cols, rows);
    if (hint) hint.textContent = `${rows.length} resultado(s). Use ↑/↓ e Enter, ou clique para selecionar.`;
  } catch (err) {
    if (hint) hint.textContent = 'Falha ao buscar. Veja o toast.';
    toast(err.message || 'Erro ao pesquisar pedidos.', 'err');
  }
}
const doSearchOrdersDebounced = debounce(doSearchOrders, 250);

/* ──────────────────────────────────────────────────────────────
   Load Summary
────────────────────────────────────────────────────────────── */
async function loadOrder(orderId) {
  const id = toInt(orderId ?? elOrderId?.value);
  if (!id) {
    toast('Informe um Order ID válido.', 'err');
    return;
  }

  state.orderId = id;

  try {
    const data = await api(ROUTES.summary(id), { method: 'GET' });
    state.summary = data;

    const order = data.order;
    const volumes = data.volumes || [];
    const notPacked = data.notPacked || [];
    const volumeItems = data.volumeItems || [];

    setText(kpiOrder, order?.order_id ? String(order.order_id) : String(id));
    setText(kpiVolumes, String(volumes.length));
    setText(kpiNotPacked, String(notPacked.length));

    if (notPackedMeta) setText(notPackedMeta, `${notPacked.length} item(ns)`);

    const totalWeight = volumes.reduce((acc, v) => acc + toNum(v.weight_kg, 0), 0);
    const totalM3 = volumes.reduce((acc, v) => acc + toNum(v.volume_m3, 0), 0);

    setText(kpiWeight, totalWeight ? fmtKg(totalWeight) : '—');
    setText(kpiM3, totalM3 ? fmtM3(totalM3) : '—');

    renderNotPacked(notPacked);
    renderVolumes(volumes, volumeItems);

    toast(`Pedido ${id} carregado.`, 'ok');
  } catch (err) {
    toast(err.message || 'Falha ao carregar pedido.', 'err');
  }
}

function openPackingPdf() {
  const orderId = state.orderId ?? toInt(elOrderId?.value);
  if (!orderId) {
    toast('Carregue um pedido antes de gerar o PDF.', 'err');
    return;
  }
  window.open(ROUTES.pdf(orderId), '_blank', 'noopener');
}

/* ──────────────────────────────────────────────────────────────
   Render Not Packed
────────────────────────────────────────────────────────────── */
function renderNotPacked(rows = []) {
  if (!notPackedList) return;

  notPackedList.innerHTML = '';
  if (!rows.length) {
    if (notPackedEmpty) notPackedEmpty.classList.add('is-show');
    return;
  }
  if (notPackedEmpty) notPackedEmpty.classList.remove('is-show');

  for (const r of rows) {
    const card = document.createElement('div');
    card.className = 'olp-item';
    card.draggable = true;

    const orderItemId = r.order_item_id ?? r.orderItemId ?? null;
    const sku = r.sku ?? '';
    const desc = r.description ?? r.descricao ?? '(sem descrição)';
    const unit = r.unit ?? r.unidade ?? '';

    // ✅ Quantidade do item NO PEDIDO (total)
    const orderedQty =
      r.ordered_qty ??
      r.order_qty ??
      r.order_quantity ??
      r.qty_ordered ??
      r.quantity_ordered ??
      r.qtd_pedido ??
      r.qtd ??
      r.qty ??
      r.quantity ??
      0;

    // ✅ Quantidade já alocada/embalada (se vier do backend)
    const packedQty =
      r.packed_qty ??
      r.qty_packed ??
      r.quantity_packed ??
      r.alocado ??
      r.alocated_qty ??
      r.allocated_qty ??
      0;

    // ✅ Restante (preferimos o que vem do backend; senão calculamos)
    let remaining =
      r.remaining_qty ??
      r.remaining ??
      r.qty_remaining ??
      r.restante ??
      r.quantity_remaining ??
      null;

    if (remaining === null || remaining === undefined) {
      // calcula restante = pedido - embalado
      remaining = toNum(orderedQty, 0) - toNum(packedQty, 0);
    }

    // não deixa negativo
    remaining = Math.max(0, toNum(remaining, 0));

    // ✅ peso/dimensões do produto (vêm de join com productsBarCode)
    const unit_weight_kg = r.unit_weight_kg ?? r.weight_kg ?? r.peso_kg ?? r.peso ?? 0;
    const unit_height_cm = r.unit_height_cm ?? r.height_cm ?? r.altura_cm ?? r.altura ?? 0;
    const unit_width_cm = r.unit_width_cm ?? r.width_cm ?? r.largura_cm ?? r.largura ?? 0;
    const unit_length_cm = r.unit_length_cm ?? r.length_cm ?? r.comprimento_cm ?? r.comprimento ?? 0;

    card.addEventListener('dragstart', (e) => {
      const payload = {
        kind: 'notPacked',
        order_item_id: orderItemId,
        sku,
        description: desc,
        unit,
        remaining: toNum(remaining, 0),

        // ✅ vai junto pro POST /volumes/:id/items
        unit_weight_kg: toNum(unit_weight_kg, 0),
        unit_height_cm: toNum(unit_height_cm, 0),
        unit_width_cm: toNum(unit_width_cm, 0),
        unit_length_cm: toNum(unit_length_cm, 0),
      };

      e.dataTransfer.setData('application/json', JSON.stringify(payload));
      e.dataTransfer.effectAllowed = 'copy';
    });

    const metaParts = [
      `U.M: <b>${escapeHtml(unit || '—')}</b>`,
      `Pedido: <b>${escapeHtml(String(toNum(orderedQty, 0)))}</b>`,
      `Restante: <b>${escapeHtml(String(remaining))}</b>`,
      `Peso: <b>${escapeHtml(fmtKg(unit_weight_kg))}</b>`,
      `Dim: <b>${escapeHtml(`${fmtCm(unit_height_cm)} × ${fmtCm(unit_width_cm)} × ${fmtCm(unit_length_cm)}`)}</b>`,
    ];

    card.innerHTML = `
      <div class="olp-item__top">
        <div>
          <div class="olp-item__title">${escapeHtml(sku ? `${sku} — ${desc}` : desc)}</div>
          <div class="olp-item__sku">Item ID: ${escapeHtml(orderItemId ?? '—')}</div>
        </div>
        <div class="olp-chip">${escapeHtml(String(remaining))}</div>
      </div>

      <div class="olp-item__meta">
        <span>${metaParts.join(' • ')}</span>
      </div>
    `;

    notPackedList.appendChild(card);
  }
}

/* ──────────────────────────────────────────────────────────────
   Render Volumes
────────────────────────────────────────────────────────────── */
function renderVolumes(volumes = [], volumeItems = []) {
  if (!volumesWrap) return;

  volumesWrap.innerHTML = '';

  if (!volumes.length) {
    if (volumesEmpty) volumesEmpty.classList.add('is-show');
    return;
  }
  if (volumesEmpty) volumesEmpty.classList.remove('is-show');

  // group items by volume_id
  const map = new Map();
  for (const it of volumeItems) {
    const vid = it.volume_id ?? it.volumeId;
    if (!map.has(vid)) map.set(vid, []);
    map.get(vid).push(it);
  }

  for (const v of volumes) {
    const volumeId = v.id;
    const volNum = v.volume_number ?? '—';
    const status = v.status ?? 'OPEN';

    const dims = `${toNum(v.height_cm, 0)}x${toNum(v.width_cm, 0)}x${toNum(v.length_cm, 0)} cm`;
    const w = fmtKg(v.weight_kg);
    const m3 = fmtM3(v.volume_m3);

    const vol = document.createElement('div');
    vol.className = 'olp-volume';
    vol.dataset.volumeId = volumeId;

    const items = map.get(volumeId) || [];

    vol.innerHTML = `
      <div class="olp-volume__head">
        <div>
          <div class="olp-volume__title">Volume #${escapeHtml(String(volNum))}</div>
          <div class="olp-volume__sub">Status: ${escapeHtml(String(status))} • Dim: ${escapeHtml(dims)} • Peso: ${escapeHtml(w)} • Cubagem: ${escapeHtml(m3)}</div>
        </div>
        <div class="olp-volume__actions">
           <button class="olp-mini soft" data-action="dims" title="Editar dimensões">📐 Medidas</button>
           <button class="olp-mini soft" data-action="reload" title="Recarregar">↻</button>
           <button class="olp-mini danger olp-icon-btn" data-action="delete" title="Excluir volume" aria-label="Excluir volume">🗑️</button>        </div>
      </div>

      <div class="olp-volume__body">
        <div class="olp-dropzone" data-dropzone="1">
          <div class="olp-volumeItems" data-items="1"></div>
        </div>
      </div>
    `;

    // actions
    const btnDims = qs('[data-action="dims"]', vol);
    const btnDel = qs('[data-action="delete"]', vol);
    const btnReload = qs('[data-action="reload"]', vol);

    btnDims?.addEventListener('click', async () => {
      const mode = await showCenterModal({
        variant: 'info',
        title: 'Medidas do volume',
        message: 'Escolha qual origem de medidas deseja usar para este volume.',
        buttons: [
          { label: 'Cancelar', variant: 'cancel', action: () => null },
          { label: 'Do volume', variant: 'primary', action: () => 'VOLUME' },
          { label: 'Dos produtos/caixas', variant: 'success', action: () => 'PRODUCTS' }
        ]
      });

      if (!mode) return;

      if (mode === 'VOLUME') {
        openEditVolumeModal(v);
        return;
      }

      if (mode === 'PRODUCTS') {
        const volumeItems = items || [];

        if (!volumeItems.length) {
          toast('Este volume não possui itens para calcular medidas.', 'err');
          return;
        }

        const height_cm = Math.max(...volumeItems.map(i =>
          toNum(i.unit_height_cm ?? i.height_cm, 0)
        ));

        const width_cm = Math.max(...volumeItems.map(i =>
          toNum(i.unit_width_cm ?? i.width_cm, 0)
        ));

        const length_cm = Math.max(...volumeItems.map(i =>
          toNum(i.unit_length_cm ?? i.length_cm, 0)
        ));

        if (!height_cm || !width_cm || !length_cm) {
          toast('Os produtos/caixas deste volume estão sem dimensões.', 'err');
          return;
        }

        await api(ROUTES.updateVolume(volumeId), {
          method: 'PATCH',
          body: JSON.stringify({
            height_cm,
            width_cm,
            length_cm,
          }),
        });

        toast('Medidas do volume atualizadas pelos produtos/caixas.', 'ok');
        await loadOrder(state.orderId);
        return;
      }

      if (!mode) return;

      if (mode === '1') {
        openCreateVolumeModal(); // depois melhoramos para editar o volume atual
        return;
      }

      if (mode === '2') {
        toast('Próximo passo: calcular medidas pelos produtos/caixas.', 'ok');
        return;
      }

      toast('Opção inválida.', 'err');
    });

    btnDel?.addEventListener('click', async () => {
      const okDelete = await showCenterModal({
        variant: 'warning',
        title: 'Excluir volume',
        message: `Deseja excluir o Volume #${volNum}?`,
        buttons: [
          { label: 'Cancelar', variant: 'cancel', action: () => false },
          { label: 'Excluir', variant: 'danger', action: () => true }
        ]
      });

      if (!okDelete) return;

      try {
        await api(ROUTES.deleteVolume(volumeId), { method: 'DELETE' });
        toast('Volume excluído.', 'ok');
        await loadOrder(state.orderId);
      } catch (err) {
        toast(err.message || 'Falha ao excluir volume.', 'err');
      }
    });

    btnReload?.addEventListener('click', async () => loadOrder(state.orderId));

    // dropzone drag events
    const dropzone = qs('[data-dropzone="1"]', vol);

    dropzone?.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('is-over');
      e.dataTransfer.dropEffect = 'copy';
    });

    dropzone?.addEventListener('dragleave', () => dropzone.classList.remove('is-over'));

    dropzone?.addEventListener('drop', async (e) => {
      e.preventDefault();
      dropzone.classList.remove('is-over');

      let payload = null;
      try { payload = JSON.parse(e.dataTransfer.getData('application/json')); } catch { }
      if (!payload) return;

      // 1) drop from NOT packed -> addItemToVolume
      if (payload.kind === 'notPacked') {
        const remaining = toNum(payload.remaining, 0);
        const selected = await openPackingUnitModal(payload, remaining);

        if (!selected) return;



        console.log('[PACKING POST]', {
          volumeId,
          orderId: state.orderId,
          order_item_id: payload.order_item_id,
          sku: payload.sku,
          description: payload.description,
          selected,
          payload
        });

        try {
          console.log('==== PACKING ====');
          console.log(selected);
          await api(ROUTES.addItemToVolume(volumeId), {
            method: 'POST',
            body: JSON.stringify({
              order_item_id: payload.order_item_id,
              quantity: selected.quantity,

              product_unit_id: selected.product_unit_id,
              unit: selected.unit,
              fator: selected.fator,

              weight_source: selected.weight_source,
              dimensions_source: selected.dimensions_source,

              unit_weight_kg: selected.weight_kg,
              unit_height_cm: selected.height_cm,
              unit_width_cm: selected.width_cm,
              unit_length_cm: selected.length_cm,
            })
          });
          toast('Item adicionado ao volume.', 'ok');
          await loadOrder(state.orderId);
        } catch (err) {
          toast(err.message || 'Falha ao adicionar item.', 'err');
        }
        return;
      }

      // 2) drop from another volume -> moveVolumeItem
      if (payload.kind === 'volumeItem') {
        if (!payload.volume_item_id) return;
        if (Number(payload.from_volume_id) === Number(volumeId)) return;

        try {
          await api(ROUTES.moveVolumeItem(payload.volume_item_id), {
            method: 'POST',
            body: JSON.stringify({ to_volume_id: volumeId }),
          });
          toast('Item movido para outro volume.', 'ok');
          await loadOrder(state.orderId);
        } catch (err) {
          toast(err.message || 'Falha ao mover item.', 'err');
        }
        return;
      }
    });

    // render items
    const itemsWrap = qs('[data-items="1"]', vol);

    if (!items.length) {
      itemsWrap.innerHTML = `
        <div class="olp-dropHint" style="margin:0;">
          <div class="olp-dropHint__box"></div>
          <div class="olp-dropHint__text">Arraste itens aqui.</div>
        </div>`;
    } else {
      itemsWrap.innerHTML = '';
      for (const it of items) {
        const viId = it.id ?? it.volume_item_id ?? it.volumeItemId;
        const sku = it.sku ?? '';
        const desc = it.description ?? '(sem descrição)';
        const unit = it.unit ?? '';
        const qty = it.quantity ?? 0;

        // ✅ tenta ler peso/dim também do item do volume
        const unitWeightKg = it.unit_weight_kg ?? it.weight_kg ?? it.peso_kg ?? it.peso ?? 0;

        const lineWeightKg =
          it.line_weight_kg ??
          it.total_weight_kg ??
          (toNum(unitWeightKg, 0) * toNum(qty, 0));

        const hCm = it.unit_height_cm ?? it.height_cm ?? it.altura_cm ?? it.altura ?? 0;
        const wCm = it.unit_width_cm ?? it.width_cm ?? it.largura_cm ?? it.largura ?? 0;
        const lCm = it.unit_length_cm ?? it.length_cm ?? it.comprimento_cm ?? it.comprimento ?? 0;

        const card = document.createElement('div');
        card.className = 'olp-volumeItem';
        card.draggable = true;
        card.dataset.volumeItemId = viId;
        card.dataset.volumeId = volumeId;

        card.addEventListener('dragstart', (e) => {
          const payload = {
            kind: 'volumeItem',
            volume_item_id: viId,
            from_volume_id: volumeId,
          };
          e.dataTransfer.setData('application/json', JSON.stringify(payload));
          e.dataTransfer.effectAllowed = 'move';
        });

        card.innerHTML = `
          <div class="olp-volumeItem__row">
            <div>
              <div class="olp-volumeItem__name">${escapeHtml(sku ? `${sku} — ${desc}` : desc)}</div>
              <div class="olp-volumeItem__meta">
                U.M: ${escapeHtml(unit || '—')}
                • Qtd: ${escapeHtml(String(qty))}
                • Peso Unit.: ${escapeHtml(fmtKg(unitWeightKg))}
                • Peso Total: ${escapeHtml(fmtKg(lineWeightKg))}
                • Dim: ${escapeHtml(`${fmtCm(hCm)} × ${fmtCm(wCm)} × ${fmtCm(lCm)}`)}
                • VI ID: ${escapeHtml(String(viId))}
              </div>
            </div>
            <div class="olp-volumeItem__actions">
              <button class="olp-mini soft olp-icon-btn" data-act="edit" title="Editar quantidade" aria-label="Editar quantidade">
              ✏️
              </button>
              <button class="olp-mini danger" data-act="del" title="Excluir do volume">X</button>
            </div>
          </div>
        `;

        qs('[data-act="edit"]', card)?.addEventListener('click', async () => {
          const ask = prompt('Nova quantidade:', String(qty));
          const newQty = toNum(String(ask || '').replace(',', '.'), 0);
          if (!(newQty > 0)) return;

          try {
            await api(ROUTES.updateVolumeItem(viId), {
              method: 'PATCH',
              body: JSON.stringify({ quantity: newQty }),
            });
            toast('Quantidade atualizada.', 'ok');
            await loadOrder(state.orderId);
          } catch (err) {
            toast(err.message || 'Falha ao atualizar quantidade.', 'err');
          }
        });

        qs('[data-act="del"]', card)?.addEventListener('click', async () => {
          if (!confirm('Remover item do volume?')) return;
          try {
            await api(ROUTES.deleteVolumeItem(viId), { method: 'DELETE' });
            toast('Item removido.', 'ok');
            await loadOrder(state.orderId);
          } catch (err) {
            toast(err.message || 'Falha ao remover item.', 'err');
          }
        });

        itemsWrap.appendChild(card);
      }
    }

    volumesWrap.appendChild(vol);
  }
}

function openEditVolumeModal(volume) {
  if (!cvModal) return;

  cvModal.dataset.mode = 'edit';
  cvModal.dataset.volumeId = volume.id;

  if (cvType) cvType.value = volume.volume_type || 'BOX';
  if (cvDesc) cvDesc.value = volume.description || '';
  if (cvH) cvH.value = toNum(volume.height_cm, 0);
  if (cvW) cvW.value = toNum(volume.width_cm, 0);
  if (cvL) cvL.value = toNum(volume.length_cm, 0);
  if (cvTare) cvTare.value = toNum(volume.tare_kg, 0);
  if (cvNotes) cvNotes.value = volume.notes || '';

  qs('#cvTitle').textContent = 'Editar volume';
  qs('#formCreateVolume button[type="submit"]').textContent = 'Salvar volume';

  openCreateVolumeModal();
}

/* ──────────────────────────────────────────────────────────────
   Create Volume — via MODAL (sem prompt)
────────────────────────────────────────────────────────────── */
function resetCreateVolumeForm() {
  if (!cvForm) return;
  cvForm.reset();
  if (cvType) cvType.value = 'BOX';
  if (cvH) cvH.value = '';
  if (cvW) cvW.value = '';
  if (cvL) cvL.value = '';
  if (cvTare) cvTare.value = '';
  if (cvDesc) cvDesc.value = '';
  if (cvNotes) cvNotes.value = '';
}

async function submitCreateVolume() {
  const orderId = state.orderId ?? toInt(elOrderId?.value);
  if (!orderId) {
    toast('Carregue um pedido antes de criar volumes.', 'err');
    return;
  }

  const volume_type = String(cvType?.value || 'BOX').trim().toUpperCase();
  const description = String(cvDesc?.value || '').trim() || null;

  const height_cm = toNum(cvH?.value, 0);
  const width_cm = toNum(cvW?.value, 0);
  const length_cm = toNum(cvL?.value, 0);
  const tare_kg = toNum(cvTare?.value, 0);
  const notes = String(cvNotes?.value || '').trim() || null;

  if ([height_cm, width_cm, length_cm, tare_kg].some(v => v < 0)) {
    toast('Dimensões/Tara não podem ser negativas.', 'err');
    return;
  }

  try {
    const isEdit = cvModal?.dataset.mode === 'edit';
    const volumeId = cvModal?.dataset.volumeId;

    const url = isEdit
      ? ROUTES.deleteVolume(volumeId)
      : ROUTES.createVolume(orderId);

    await api(url, {
      method: isEdit ? 'PATCH' : 'POST',
      body: JSON.stringify({
        volume_type,
        description,
        height_cm,
        width_cm,
        length_cm,
        tare_kg,
        notes,
      }),
    });

    toast(isEdit ? 'Volume atualizado.' : 'Volume criado com dimensões.', 'ok');

    cvModal.dataset.mode = 'create';
    cvModal.dataset.volumeId = '';
    qs('#cvTitle').textContent = 'Criar volume';
    qs('#formCreateVolume button[type="submit"]').textContent = 'Criar volume';
    closeCreateVolumeModal();
    resetCreateVolumeForm();
    await loadOrder(orderId);
  } catch (err) {
    toast(err.message || 'Falha ao criar volume.', 'err');
  }
}

async function openPackingUnitModal(item, remainingQty = 0) {
  const data = await api(ROUTES.productUnits(item.sku), {
    method: 'GET',
  });

  const units =
    Array.isArray(data) ? data :
      Array.isArray(data.rows) ? data.rows :
        Array.isArray(data.data) ? data.data :
          Array.isArray(data.items) ? data.items :
            [];

  const normalizeCm = (v) => {
    const n = toNum(v, 0);
    if (!(n > 0)) return 0;

    // productsBarCode sometimes stores dimensions as meters:
    // 0.40 => 40 cm | 0.25 => 25 cm | 0.45 => 45 cm
    return n < 1 ? n * 100 : n;
  };

  const productDims = {
    weight_kg: toNum(item.unit_weight_kg, 0),
    height_cm: normalizeCm(item.unit_height_cm),
    width_cm: normalizeCm(item.unit_width_cm),
    length_cm: normalizeCm(item.unit_length_cm),
  };

  const unitOptions = units.length
    ? units.map((u, i) => `
      <option value="${i}">
        ${escapeHtml(u.unit || 'UN')} | fator ${escapeHtml(String(u.fator || 1))}
      </option>
    `).join('')
    : `<option value="">${escapeHtml(item.unit || 'UN')} | Produto</option>`;

  const result = await showCenterModal({
    variant: 'info',
    title: 'Adicionar item ao volume',

    message: `
      <div class="olp-pack-modal">

        <div style="font-weight:800;margin-bottom:10px;">
          ${escapeHtml(item.sku || '')} — ${escapeHtml(item.description || '')}
        </div>

        <label>Unidade</label>
        <select id="pmUnit" class="cm-input">
          ${unitOptions}
        </select>

        <label>Quantidade</label>
        <input
          id="pmQty"
          class="cm-input"
          type="number"
          min="0.001"
          step="0.001"
          value="${escapeHtml(String(remainingQty || 1))}">

        <label>Peso</label>
        <select id="pmWeightSource" class="cm-input">
          <option value="PRODUCT">Produto</option>
          <option value="UNIT" ${units.length ? 'selected' : ''}>Unidade/Caixa</option>
          <option value="MANUAL">Manual</option>
        </select>

        <label>Medidas</label>
        <select id="pmDimensionsSource" class="cm-input">
          <option value="PRODUCT">Produto</option>
          <option value="UNIT" ${units.length ? 'selected' : ''}>Unidade/Caixa</option>
          <option value="MANUAL">Manual</option>
        </select>

        <div id="pmManualFields" style="display:none;margin-top:10px;">
          <label>Peso unitário (kg)</label>
          <input
            id="pmManualWeight"
            class="cm-input"
            type="number"
            step="0.001"
            value="${productDims.weight_kg}">

          <label>Altura (cm)</label>
          <input
            id="pmManualH"
            class="cm-input"
            type="number"
            step="0.001"
            value="${productDims.height_cm}">

          <label>Largura (cm)</label>
          <input
            id="pmManualW"
            class="cm-input"
            type="number"
            step="0.001"
            value="${productDims.width_cm}">

          <label>Comprimento (cm)</label>
          <input
            id="pmManualL"
            class="cm-input"
            type="number"
            step="0.001"
            value="${productDims.length_cm}">
        </div>

      </div>
    `,

    buttons: [
      {
        label: 'Cancelar',
        variant: 'cancel',
        action: () => null,
      },
      {
        label: 'Adicionar',
        variant: 'success',

        action: ({ card }) => {
          const idx = toInt(card.querySelector('#pmUnit')?.value);

          const selectedUnit =
            units.length && idx !== null
              ? units[idx]
              : null;

          const qty = toNum(card.querySelector('#pmQty')?.value, 0);
          if (!(qty > 0)) return null;

          const weightSource = String(
            card.querySelector('#pmWeightSource')?.value || 'PRODUCT'
          ).toUpperCase();

          const dimensionsSource = String(
            card.querySelector('#pmDimensionsSource')?.value || 'PRODUCT'
          ).toUpperCase();

          const selectedWeightKg = toNum(
            selectedUnit?.weight_kg ??
            selectedUnit?.unit_weight_kg ??
            selectedUnit?.peso_kg ??
            selectedUnit?.peso ??
            selectedUnit?.weight ??
            selectedUnit?.pesoUnitario ??
            selectedUnit?.unitWeightKg,
            0
          );

          let weightKg = productDims.weight_kg;

          if (weightSource === 'UNIT') {
            weightKg = selectedWeightKg;
          }

          if (weightSource === 'PRODUCT' && !(weightKg > 0) && selectedWeightKg > 0) {
            weightKg = selectedWeightKg;
          }

          const selectedH = normalizeCm(
            selectedUnit?.height_cm ??
            selectedUnit?.altura_cm ??
            selectedUnit?.height
          );

          const selectedW = normalizeCm(
            selectedUnit?.width_cm ??
            selectedUnit?.largura_cm ??
            selectedUnit?.width
          );

          const selectedL = normalizeCm(
            selectedUnit?.length_cm ??
            selectedUnit?.comprimento_cm ??
            selectedUnit?.length
          );

          let h = dimensionsSource === 'UNIT' ? selectedH : productDims.height_cm;
          let w = dimensionsSource === 'UNIT' ? selectedW : productDims.width_cm;
          let l = dimensionsSource === 'UNIT' ? selectedL : productDims.length_cm;

          if (dimensionsSource === 'PRODUCT') {
            if (!(h > 0) && selectedH > 0) h = selectedH;
            if (!(w > 0) && selectedW > 0) w = selectedW;
            if (!(l > 0) && selectedL > 0) l = selectedL;
          }

          if (weightSource === 'MANUAL') {
            weightKg = toNum(card.querySelector('#pmManualWeight')?.value, 0);
          }

          if (dimensionsSource === 'MANUAL') {
            h = normalizeCm(card.querySelector('#pmManualH')?.value);
            w = normalizeCm(card.querySelector('#pmManualW')?.value);
            l = normalizeCm(card.querySelector('#pmManualL')?.value);
          }

          return {
            quantity: qty,

            product_unit_id: selectedUnit
              ? toInt(selectedUnit.product_unit_id)
              : null,

            unit: selectedUnit?.unit || item.unit,

            fator: selectedUnit
              ? toNum(selectedUnit.fator, 1)
              : 1,

            weight_source: weightSource,
            dimensions_source: dimensionsSource,

            weight_kg: weightKg,
            height_cm: h,
            width_cm: w,
            length_cm: l,
          };
        },
      },
    ],
  });

  return result;
}

/* ──────────────────────────────────────────────────────────────
   Boot
────────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  const mustHave = [
    ['#olpOrderId', elOrderId],
    ['#notPackedList', notPackedList],
    ['#volumesWrap', volumesWrap],
    ['#orderSearchModal', modal],
    ['#createVolumeModal', cvModal],
  ];

  const missing = mustHave.filter(([, el]) => !el).map(([sel]) => sel);
  if (missing.length) {
    console.warn('[OrdersLogisticsPacking] Elementos não encontrados:', missing.join(', '));
    return;
  }

  // Search modal events
  btnOpenOrderSearch?.addEventListener('click', openModal);
  btnCloseModal?.addEventListener('click', closeModal);
  modalBackdrop?.addEventListener('click', closeModal);

  btnSearchGo?.addEventListener('click', doSearchOrders);
  inputSearch?.addEventListener('input', doSearchOrdersDebounced);

  // ✅ teclado no input: ↑ ↓ Enter Esc
  inputSearch?.addEventListener('keydown', (e) => {
    const hasRows = (searchState.rows?.length || 0) > 0;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!hasRows) return;
      setActiveSearchRow(searchState.activeIndex + 1);
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!hasRows) return;
      setActiveSearchRow(searchState.activeIndex - 1);
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();

      // se tem linha ativa -> seleciona
      if (hasRows && searchState.activeIndex >= 0) {
        const ok = selectActiveSearchRow();
        if (ok) return;
      }

      // senão, busca
      doSearchOrders();
      return;
    }

    if (e.key === 'Escape') {
      closeModal();
    }
  });

  // Create volume modal events
  btnCreateVolume?.addEventListener('click', () => {
    cvModal.dataset.mode = 'create';
    cvModal.dataset.volumeId = '';
    qs('#cvTitle').textContent = 'Criar volume';
    qs('#formCreateVolume button[type="submit"]').textContent = 'Criar volume';
    resetCreateVolumeForm();
    openCreateVolumeModal();
  });

  btnCloseCreateVolume?.addEventListener('click', () => {
    closeCreateVolumeModal();
  });

  btnCancelCreateVolume?.addEventListener('click', () => {
    closeCreateVolumeModal();
  });

  cvBackdrop?.addEventListener('click', () => {
    closeCreateVolumeModal();
  });

  cvForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    submitCreateVolume();
  });

  // Global events
  document.addEventListener('keydown', escHandler);

  // Load / refresh
  btnLoadOrder?.addEventListener('click', () => loadOrder());
  btnRefresh?.addEventListener('click', () => {
    if (state.orderId) loadOrder(state.orderId);
    else loadOrder();
  });

  btnPdf?.addEventListener('click', openPackingPdf);

  // Boot (?orderId=)
  try {
    const url = new URL(window.location.href);
    const oid = url.searchParams.get('orderId');
    const id = toInt(oid);
    if (id) {
      elOrderId.value = id;
      loadOrder(id);
    }
  } catch { }
});
