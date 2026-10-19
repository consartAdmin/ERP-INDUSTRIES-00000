/*╔══════════════════════════════════════════════════════════════════════╗
  ║ OrdersLogisticsPacking.js — Front Packing/Volumes (PRODNEX ERP)       ║
  ║ Path: backend/public/OrdersLogisticsPacking/OrdersLogisticsPacking.js ║
  ╚══════════════════════════════════════════════════════════════════════╝*/

'use strict';

const API_BASE =
  (typeof window !== 'undefined' && (window.apiBase || window.API_BASE)) ||
  (typeof window !== 'undefined' ? window.location.origin : '');

const ROUTES = Object.freeze({
  summary: (orderId) => `${API_BASE}/api/packing/orders/${encodeURIComponent(orderId)}/summary`,
  createVolume: (orderId) => `${API_BASE}/api/packing/orders/${encodeURIComponent(orderId)}/volumes`,
  deleteVolume: (volumeId) => `${API_BASE}/api/packing/volumes/${encodeURIComponent(volumeId)}`,
  addItemToVolume: (volumeId) => `${API_BASE}/api/packing/volumes/${encodeURIComponent(volumeId)}/items`,
  updateVolumeItem: (volumeItemId) => `${API_BASE}/api/packing/volume-items/${encodeURIComponent(volumeItemId)}`,
  deleteVolumeItem: (volumeItemId) => `${API_BASE}/api/packing/volume-items/${encodeURIComponent(volumeItemId)}`,
  moveVolumeItem: (volumeItemId) => `${API_BASE}/api/packing/volume-items/${encodeURIComponent(volumeItemId)}/move`,
});

/* ──────────────────────────────────────────────────────────────
   DOM helpers
────────────────────────────────────────────────────────────── */
const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];

const elOrderId = $('#olpOrderId');
const btnLoad = $('#btnLoadOrder');
const btnRefresh = $('#btnRefresh');
const btnCreateVolume = $('#btnCreateVolume');

const poolList = $('#poolList');
const volumesWrap = $('#volumesWrap');

const kpiOrder = $('#kpiOrder');
const kpiVolumes = $('#kpiVolumes');
const kpiNotPacked = $('#kpiNotPacked');
const kpiTotalWeight = $('#kpiTotalWeight');
const kpiTotalM3 = $('#kpiTotalM3');

const toastEl = $('#toast');

let currentOrderId = null;
let sortablePool = null;
const sortablesVolumes = new Map(); // volumeId -> Sortable instance

/* ──────────────────────────────────────────────────────────────
   Utils
────────────────────────────────────────────────────────────── */
function money(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function num(v, digits = 3) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function showToast(msg, isError = false) {
  toastEl.textContent = msg;
  toastEl.style.background = isError ? 'rgba(153,27,27,.95)' : 'rgba(17,24,39,.95)';
  toastEl.classList.add('show');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toastEl.classList.remove('show'), 2400);
}

async function fetchJSON(url, opts = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });

  let data = null;
  try { data = await res.json(); } catch { /* ignore */ }

  if (!res.ok || (data && data.ok === false)) {
    const msg = (data && data.error) ? data.error : `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

function getOrderIdFromUI() {
  const v = String(elOrderId.value || '').trim();
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function getOrderIdFromQuery() {
  const p = new URLSearchParams(location.search);
  const v = p.get('order_id') || p.get('orderId') || p.get('id');
  const n = Number.parseInt(v || '', 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/* ──────────────────────────────────────────────────────────────
   Packing prompts (snapshot dimensions)
────────────────────────────────────────────────────────────── */
function promptQty(defaultQty) {
  const raw = window.prompt(`Quantidade para alocar no volume:`, String(defaultQty));
  if (raw === null) return null;
  const q = Number(String(raw).replace(',', '.'));
  if (!Number.isFinite(q) || q <= 0) return null;
  return q;
}

function promptUnitSpecs() {
  // Você pode trocar esses prompts por um modal bonito depois.
  // Por enquanto: simples e funciona 100%.
  const w = window.prompt('Peso unitário (kg):', '0');
  if (w === null) return null;
  const unit_weight_kg = Number(String(w).replace(',', '.'));
  if (!Number.isFinite(unit_weight_kg) || unit_weight_kg < 0) return null;

  const h = window.prompt('Altura unitária (cm):', '0');
  if (h === null) return null;
  const unit_height_cm = Number(String(h).replace(',', '.'));
  if (!Number.isFinite(unit_height_cm) || unit_height_cm < 0) return null;

  const wi = window.prompt('Largura unitária (cm):', '0');
  if (wi === null) return null;
  const unit_width_cm = Number(String(wi).replace(',', '.'));
  if (!Number.isFinite(unit_width_cm) || unit_width_cm < 0) return null;

  const l = window.prompt('Comprimento unitário (cm):', '0');
  if (l === null) return null;
  const unit_length_cm = Number(String(l).replace(',', '.'));
  if (!Number.isFinite(unit_length_cm) || unit_length_cm < 0) return null;

  return { unit_weight_kg, unit_height_cm, unit_width_cm, unit_length_cm };
}

/* ──────────────────────────────────────────────────────────────
   Render
────────────────────────────────────────────────────────────── */
function clearSortables() {
  if (sortablePool) {
    sortablePool.destroy();
    sortablePool = null;
  }
  for (const s of sortablesVolumes.values()) s.destroy();
  sortablesVolumes.clear();
}

function renderKpis(summary) {
  const order = summary.order;
  const volumes = summary.volumes || [];
  const notPacked = summary.notPacked || [];

  currentOrderId = order?.order_id ? Number(order.order_id) : currentOrderId;

  kpiOrder.textContent = currentOrderId ? `#${currentOrderId}` : '—';
  kpiVolumes.textContent = String(volumes.length);

  const notPackedCount = notPacked.reduce((acc, r) => acc + 1, 0);
  kpiNotPacked.textContent = String(notPackedCount);

  const totalWeight = volumes.reduce((acc, v) => acc + Number(v.weight_kg || 0), 0);
  const totalM3 = volumes.reduce((acc, v) => acc + Number(v.volume_m3 || 0), 0);

  kpiTotalWeight.textContent = `${num(totalWeight, 3)} kg`;
  kpiTotalM3.textContent = `${num(totalM3, 6)} m³`;
}

function poolItemHTML(r) {
  const title = `${r.description || '(sem descrição)'}`;
  const meta = [
    r.sku ? `SKU: ${r.sku}` : null,
    r.unit ? `U.M: ${r.unit}` : null,
    `Pedido: ${money(r.order_quantity)} | Alocado: ${money(r.packed_quantity)} | Restante: ${money(r.remaining_quantity)}`,
  ].filter(Boolean).join(' • ');

  // data-remaining usado pra default de quantidade
  return `
    <div class="olp-item"
      data-kind="pool"
      data-order-item-id="${r.order_item_id}"
      data-remaining="${r.remaining_quantity}"
      title="Arraste para um volume">
      <div class="olp-item__left">
        <div class="olp-item__title">${escapeHtml(title)}</div>
        <div class="olp-item__meta">${escapeHtml(meta)}</div>
      </div>
      <div class="olp-badge">${money(r.remaining_quantity)}</div>
    </div>
  `;
}

function volumeCardHTML(v, itemsByVolume) {
  const items = itemsByVolume.get(Number(v.id)) || [];
  const volTitle = `Volume ${v.volume_number}`;
  const sub = `${v.volume_type || 'BOX'} • Status: ${v.status || 'OPEN'}`;

  const totals = `
    <div class="olp-volume__totals">
      <span class="olp-badge">Peso: ${num(v.weight_kg || 0, 3)} kg</span>
      <span class="olp-badge">m³: ${num(v.volume_m3 || 0, 6)}</span>
      <span class="olp-badge">Tara: ${num(v.tare_kg || 0, 3)} kg</span>
    </div>
  `;

  const list = items.length
    ? items.map(volumeItemHTML).join('')
    : `<div class="olp-muted" style="padding:10px;">Arraste itens aqui…</div>`;

  return `
    <div class="olp-volume" data-volume-id="${v.id}">
      <div class="olp-volume__head">
        <div>
          <div class="olp-volume__title">${escapeHtml(volTitle)}</div>
          <div class="olp-volume__sub">${escapeHtml(sub)}</div>
        </div>
        <div style="display:flex; gap:8px;">
          <button class="olp-mini danger" data-action="delete-volume" data-volume-id="${v.id}" title="Excluir volume">🗑</button>
        </div>
      </div>

      <div class="olp-volume__body">
        ${totals}
        <div class="olp-dropzone olp-volume__list" data-dropzone="volume-items" data-volume-id="${v.id}">
          ${list}
        </div>
      </div>
    </div>
  `;
}

function volumeItemHTML(vi) {
  const title = `${vi.description || '(sem descrição)'}`;
  const meta = [
    vi.sku ? `SKU: ${vi.sku}` : null,
    vi.unit ? `U.M: ${vi.unit}` : null,
    `Qtd: ${money(vi.quantity)}`,
    `Peso(linha): ${num(vi.line_weight_kg || 0, 3)} kg`,
    `m³(linha): ${num(vi.line_volume_m3 || 0, 6)}`,
  ].filter(Boolean).join(' • ');

  return `
    <div class="olp-vitem"
      data-kind="volume-item"
      data-volume-item-id="${vi.id}"
      data-order-item-id="${vi.order_item_id}">
      <div style="min-width:0;">
        <div class="olp-vitem__title">${escapeHtml(title)}</div>
        <div class="olp-vitem__meta">${escapeHtml(meta)}</div>
      </div>

      <div class="olp-vitem__actions">
        <button class="olp-mini" data-action="edit-qty" data-volume-item-id="${vi.id}" title="Editar quantidade">✎</button>
        <button class="olp-mini danger" data-action="delete-item" data-volume-item-id="${vi.id}" title="Remover do volume">✕</button>
      </div>
    </div>
  `;
}

function escapeHtml(s) {
  return String(s ?? '')
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'","&#039;");
}

/* ──────────────────────────────────────────────────────────────
   Sortable setup
────────────────────────────────────────────────────────────── */
function setupSortables() {
  clearSortables();

  // Pool: clone-only (não remove do pool)
  sortablePool = new Sortable(poolList, {
    group: { name: 'packing', pull: 'clone', put: false },
    sort: false,
    animation: 160,
    ghostClass: 'is-ghost',
  });

  // Cada volume list
  $$('.olp-volume__list').forEach((zone) => {
    const volumeId = Number(zone.dataset.volumeId);

    const s = new Sortable(zone, {
      group: { name: 'packing', pull: true, put: true },
      animation: 160,
      onAdd: async (evt) => {
        const toVolumeId = Number(evt.to.dataset.volumeId);
        const el = evt.item;

        // Se veio do pool => el é clone
        const fromPool = el?.dataset?.kind === 'pool' || evt.from === poolList;

        try {
          if (fromPool) {
            // remove o clone da UI (vamos recarregar tudo após salvar)
            el.remove?.();

            const orderItemId = Number(el.dataset.orderItemId);
            const remaining = Number(el.dataset.remaining || 0) || 0;

            const qty = promptQty(remaining || 1);
            if (qty === null) {
              showToast('Operação cancelada.', true);
              await loadSummary(currentOrderId);
              return;
            }

            const specs = promptUnitSpecs();
            if (!specs) {
              showToast('Peso/dimensões inválidos ou cancelado.', true);
              await loadSummary(currentOrderId);
              return;
            }

            await fetchJSON(ROUTES.addItemToVolume(toVolumeId), {
              method: 'POST',
              body: JSON.stringify({
                order_item_id: orderItemId,
                quantity: qty,
                ...specs,
              }),
            });

            showToast('Item alocado no volume.');
            await loadSummary(currentOrderId);
            return;
          }

          // Se veio de outro volume => move
          const volumeItemId = Number(el.dataset.volumeItemId);
          if (!volumeItemId || !toVolumeId) {
            showToast('Falha ao identificar item/volume.', true);
            await loadSummary(currentOrderId);
            return;
          }

          await fetchJSON(ROUTES.moveVolumeItem(volumeItemId), {
            method: 'POST',
            body: JSON.stringify({ to_volume_id: toVolumeId }),
          });

          showToast('Item movido de volume.');
          await loadSummary(currentOrderId);
        } catch (err) {
          console.error('onAdd error:', err);
          showToast(err.message || 'Erro ao processar drag & drop.', true);
          await loadSummary(currentOrderId);
        }
      },
    });

    sortablesVolumes.set(volumeId, s);
  });
}

/* ──────────────────────────────────────────────────────────────
   Load / actions
────────────────────────────────────────────────────────────── */
async function loadSummary(orderId) {
  if (!orderId) return;

  try {
    const data = await fetchJSON(ROUTES.summary(orderId));

    renderKpis(data);

    // Render pool
    const notPacked = data.notPacked || [];
    poolList.innerHTML = notPacked.length
      ? notPacked.map(poolItemHTML).join('')
      : `<div class="olp-muted" style="padding:10px;">Nenhum item pendente (tudo alocado).</div>`;

    // Map items by volume
    const itemsByVolume = new Map();
    (data.volumeItems || []).forEach((vi) => {
      const vid = Number(vi.volume_id);
      if (!itemsByVolume.has(vid)) itemsByVolume.set(vid, []);
      itemsByVolume.get(vid).push(vi);
    });

    // Render volumes
    const volumes = data.volumes || [];
    volumesWrap.innerHTML = volumes.length
      ? volumes.map((v) => volumeCardHTML(v, itemsByVolume)).join('')
      : `<div class="olp-muted" style="padding:10px;">Nenhum volume criado. Clique em “Criar volume”.</div>`;

    setupSortables();
  } catch (err) {
    console.error('loadSummary error:', err);
    showToast(err.message || 'Erro ao carregar pedido.', true);
  }
}

async function createVolume() {
  if (!currentOrderId) return showToast('Informe um Order ID.', true);

  try {
    await fetchJSON(ROUTES.createVolume(currentOrderId), {
      method: 'POST',
      body: JSON.stringify({ volume_type: 'BOX', tare_kg: 0 }),
    });
    showToast('Volume criado.');
    await loadSummary(currentOrderId);
  } catch (err) {
    console.error('createVolume error:', err);
    showToast(err.message || 'Erro ao criar volume.', true);
  }
}

async function deleteVolume(volumeId) {
  if (!volumeId) return;
  if (!confirm('Excluir este volume? (itens dentro serão removidos)')) return;

  try {
    await fetchJSON(ROUTES.deleteVolume(volumeId), { method: 'DELETE' });
    showToast('Volume excluído.');
    await loadSummary(currentOrderId);
  } catch (err) {
    console.error('deleteVolume error:', err);
    showToast(err.message || 'Erro ao excluir volume.', true);
  }
}

async function editVolumeItemQty(volumeItemId) {
  const raw = prompt('Nova quantidade:', '1');
  if (raw === null) return;

  const qty = Number(String(raw).replace(',', '.'));
  if (!Number.isFinite(qty) || qty <= 0) {
    showToast('Quantidade inválida.', true);
    return;
  }

  try {
    await fetchJSON(ROUTES.updateVolumeItem(volumeItemId), {
      method: 'PATCH',
      body: JSON.stringify({ quantity: qty }),
    });
    showToast('Quantidade atualizada.');
    await loadSummary(currentOrderId);
  } catch (err) {
    console.error('edit qty error:', err);
    showToast(err.message || 'Erro ao atualizar quantidade.', true);
  }
}

async function deleteVolumeItem(volumeItemId) {
  if (!confirm('Remover este item do volume?')) return;

  try {
    await fetchJSON(ROUTES.deleteVolumeItem(volumeItemId), { method: 'DELETE' });
    showToast('Item removido.');
    await loadSummary(currentOrderId);
  } catch (err) {
    console.error('delete item error:', err);
    showToast(err.message || 'Erro ao remover item.', true);
  }
}

/* ──────────────────────────────────────────────────────────────
   Events
────────────────────────────────────────────────────────────── */
btnLoad.addEventListener('click', async () => {
  const id = getOrderIdFromUI();
  if (!id) return showToast('Informe um Order ID válido.', true);

  currentOrderId = id;
  await loadSummary(id);
});

btnRefresh.addEventListener('click', async () => {
  if (!currentOrderId) {
    const id = getOrderIdFromUI();
    if (!id) return showToast('Informe um Order ID.', true);
    currentOrderId = id;
  }
  await loadSummary(currentOrderId);
});

btnCreateVolume.addEventListener('click', createVolume);

// Delegação de eventos para botões nos cards
document.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;

  const action = btn.dataset.action;

  if (action === 'delete-volume') {
    const volumeId = Number(btn.dataset.volumeId);
    await deleteVolume(volumeId);
  }

  if (action === 'edit-qty') {
    const volumeItemId = Number(btn.dataset.volumeItemId);
    await editVolumeItemQty(volumeItemId);
  }

  if (action === 'delete-item') {
    const volumeItemId = Number(btn.dataset.volumeItemId);
    await deleteVolumeItem(volumeItemId);
  }
});

// Enter no input do Order ID
elOrderId.addEventListener('keydown', async (e) => {
  if (e.key === 'Enter') btnLoad.click();
});

/* ──────────────────────────────────────────────────────────────
   Boot
────────────────────────────────────────────────────────────── */
(function boot() {
  const qOrder = getOrderIdFromQuery();
  if (qOrder) {
    elOrderId.value = String(qOrder);
    currentOrderId = qOrder;
    loadSummary(qOrder);
  }
})();
