// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║ locations.js — Warehouse Locations | PRODNEX ERP (Frontend ESM)           ║
// ║ Path: backend/public/locations/locations.js                               ║
// ║ API base: /api/locations                                                  ║
// ║ - Hierarquia: locals/corridors/shelves/bins/positions                      ║
// ║ - Produto→Localização: product-locations (localizationProducts)            ║
// ║ Opcional: integra com /public/modalsSearch/productsModalSearch.js (F2)     ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

'use strict';

const API_BASE = '/api/locations';

/* -------------------------------------------------------------------------- */
/* DOM                                                                         */
/* -------------------------------------------------------------------------- */

const $ = (sel) => document.querySelector(sel);

const btnReloadAll = $('#btnReloadAll');
const chkOnlyActive = $('#chkOnlyActive');

const tabs = Array.from(document.querySelectorAll('.loc-tab'));
const panels = Array.from(document.querySelectorAll('.loc-tabpanel'));

const selLocal = $('#selLocal');
const selCorridor = $('#selCorridor');
const selShelf = $('#selShelf');
const selBin = $('#selBin');
const selPosition = $('#selPosition');

const selEntity = $('#selEntity');
const txtName = $('#txtName');
const txtDesc = $('#txtDesc');
const chkActive = $('#chkActive');
const btnCreate = $('#btnCreate');

const tbLocals = $('#tbLocals');
const tbCorridors = $('#tbCorridors');
const tbShelves = $('#tbShelves');
const tbBins = $('#tbBins');
const tbPositions = $('#tbPositions');

/* Product locations */
const txtProductCode = $('#txtProductCode');
const btnPickProduct = $('#btnPickProduct');

const plLocalId = $('#plLocalId');
const plCorridorId = $('#plCorridorId');
const plShelfId = $('#plShelfId');
const plBinId = $('#plBinId');
const plPositionId = $('#plPositionId');

const plLocal = $('#plLocal');
const plCorridor = $('#plCorridor');
const plShelf = $('#plShelf');
const plBin = $('#plBin');
const plPosition = $('#plPosition');

const plNotes = $('#plNotes');
const btnCreatePL = $('#btnCreatePL');
const btnClearPL = $('#btnClearPL');

const txtPLSearch = $('#txtPLSearch');
const btnSearchPL = $('#btnSearchPL');
const btnReloadPL = $('#btnReloadPL');
const tbProductLocations = $('#tbProductLocations');

/* -------------------------------------------------------------------------- */
/* Optional UI helpers (center modal/alert)                                    */
/* -------------------------------------------------------------------------- */

let centerAlertModal = null;

async function lazyLoadCenterAlert() {
  if (centerAlertModal) return centerAlertModal;
  try {
    const mod = await import('/public/includes/js/centerAlertModal.js');
    if (typeof mod.centerAlertModal === 'function') centerAlertModal = mod.centerAlertModal;
  } catch (_) {
    // ignore
  }
  return centerAlertModal;
}

async function uiAlert(title, message) {
  const fn = await lazyLoadCenterAlert();
  if (fn) return fn({ title, message });
  alert(`${title}\n\n${message}`);
}

/* -------------------------------------------------------------------------- */
/* Fetch wrapper                                                               */
/* -------------------------------------------------------------------------- */

async function apiFetch(path, opts = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });

  const contentType = res.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');
  const data = isJson ? await res.json().catch(() => null) : null;

  if (!res.ok) {
    const msg = data?.error || data?.message || `HTTP ${res.status}`;
    const detail = data?.detail ? `\n${data.detail}` : '';
    throw new Error(`${msg}${detail}`);
  }
  return data;
}

function boolToPill(active) {
  const on = !!active;
  return `<span class="loc-pill ${on ? 'is-on' : 'is-off'}">${on ? 'SIM' : 'NÃO'}</span>`;
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (m) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));
}

/* -------------------------------------------------------------------------- */
/* Tabs                                                                        */
/* -------------------------------------------------------------------------- */

function setActiveTab(tabId) {
  tabs.forEach((b) => b.classList.toggle('is-active', b.dataset.tab === tabId));
  panels.forEach((p) => p.classList.toggle('is-active', p.id === tabId));
}

tabs.forEach((btn) => {
  btn.addEventListener('click', () => setActiveTab(btn.dataset.tab));
});

/* -------------------------------------------------------------------------- */
/* Data caches                                                                 */
/* -------------------------------------------------------------------------- */

const state = {
  locals: [],
  corridors: [],
  shelves: [],
  bins: [],
  positions: [],
};

/* -------------------------------------------------------------------------- */
/* Loaders                                                                     */
/* -------------------------------------------------------------------------- */

function activeOnlyParam() {
  return chkOnlyActive.checked ? 'true' : 'false';
}

async function loadLocals() {
  state.locals = await apiFetch(`/locals?activeOnly=${activeOnlyParam()}`);
  renderSelect(selLocal, state.locals, 'Selecione...');
  renderTable('locals', state.locals, tbLocals);
}

async function loadCorridors() {
  const localId = getSelectedId(selLocal);
  const q = new URLSearchParams();
  if (localId) q.set('localId', String(localId));
  q.set('activeOnly', activeOnlyParam());
  state.corridors = await apiFetch(`/corridors?${q.toString()}`);
  renderSelect(selCorridor, state.corridors, 'Selecione...');
  renderTable('corridors', state.corridors, tbCorridors);
}

async function loadShelves() {
  const corridorId = getSelectedId(selCorridor);
  const q = new URLSearchParams();
  if (corridorId) q.set('corridorId', String(corridorId));
  q.set('activeOnly', activeOnlyParam());
  state.shelves = await apiFetch(`/shelves?${q.toString()}`);
  renderSelect(selShelf, state.shelves, 'Selecione...');
  renderTable('shelves', state.shelves, tbShelves);
}

async function loadBins() {
  const shelfId = getSelectedId(selShelf);
  const q = new URLSearchParams();
  if (shelfId) q.set('shelfId', String(shelfId));
  q.set('activeOnly', activeOnlyParam());
  state.bins = await apiFetch(`/bins?${q.toString()}`);
  renderSelect(selBin, state.bins, 'Selecione...');
  renderTable('bins', state.bins, tbBins);
}

async function loadPositions() {
  const binId = getSelectedId(selBin);
  const q = new URLSearchParams();
  if (binId) q.set('binId', String(binId));
  q.set('activeOnly', activeOnlyParam());
  state.positions = await apiFetch(`/positions?${q.toString()}`);
  renderSelect(selPosition, state.positions, 'Selecione...');
  renderTable('positions', state.positions, tbPositions);
}

async function reloadAllHierarchy() {
  await loadLocals();
  await loadCorridors();
  await loadShelves();
  await loadBins();
  await loadPositions();
}

/* -------------------------------------------------------------------------- */
/* Select helpers                                                              */
/* -------------------------------------------------------------------------- */

function renderSelect(selectEl, rows, placeholder = 'Selecione...') {
  const current = selectEl.value;
  selectEl.innerHTML = '';
  const opt0 = document.createElement('option');
  opt0.value = '';
  opt0.textContent = placeholder;
  selectEl.appendChild(opt0);

  rows.forEach((r) => {
    const opt = document.createElement('option');
    opt.value = String(r.id);
    opt.textContent = `${r.name}`;
    selectEl.appendChild(opt);
  });

  // try to keep old selection if exists
  if (current && rows.some((r) => String(r.id) === String(current))) {
    selectEl.value = current;
  } else {
    selectEl.value = '';
  }
}

function getSelectedId(selectEl) {
  const v = selectEl.value;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/* -------------------------------------------------------------------------- */
/* Tables                                                                      */
/* -------------------------------------------------------------------------- */

function renderTable(entity, rows, tbody) {
  tbody.innerHTML = rows.map((r) => {
    return `
      <tr data-entity="${entity}" data-id="${r.id}">
        <td>${r.id}</td>
        <td title="${esc(r.description || '')}">${esc(r.name)}</td>
        <td>${boolToPill(r.active)}</td>
        <td>
          <div class="loc-actions-row">
            <button class="btn btn-toolbar btn-sm" data-act="edit">✏️</button>
            <button class="btn btn-toolbar btn-sm" data-act="toggle">${r.active ? '⛔' : '✅'}</button>
            <button class="btn btn-toolbar btn-sm" data-act="del">🗑️</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

/* -------------------------------------------------------------------------- */
/* CRUD (Hierarchy)                                                            */
/* -------------------------------------------------------------------------- */

function parentIdForEntity(entity) {
  // Based on your API: corridors.local_id, shelves.corridor_id, bins.shelf_id, positions.bin_id
  if (entity === 'corridors') return { key: 'local_id', value: getSelectedId(selLocal) };
  if (entity === 'shelves') return { key: 'corridor_id', value: getSelectedId(selCorridor) };
  if (entity === 'bins') return { key: 'shelf_id', value: getSelectedId(selShelf) };
  if (entity === 'positions') return { key: 'bin_id', value: getSelectedId(selBin) };
  return null;
}

function validateParent(entity) {
  const p = parentIdForEntity(entity);
  if (!p) return true;
  if (!p.value) return false;
  return true;
}

async function createEntity() {
  const entity = selEntity.value; // locals/corridors/shelves/bins/positions
  const name = String(txtName.value || '').trim();
  const description = String(txtDesc.value || '').trim() || null;
  const active = !!chkActive.checked;

  if (!name) {
    await uiAlert('Atenção', 'Informe o nome.');
    txtName.focus();
    return;
  }

  if (!validateParent(entity)) {
    const p = parentIdForEntity(entity);
    await uiAlert('Atenção', `Para criar "${entity}", selecione o pai (${p?.key}) no filtro.`);
    return;
  }

  const payload = { name, description, active };
  const p = parentIdForEntity(entity);
  if (p?.value) payload[p.key] = p.value;

  try {
    await apiFetch(`/${entity}`, { method: 'POST', body: JSON.stringify(payload) });
    txtName.value = '';
    txtDesc.value = '';
    await refreshEntity(entity);
  } catch (err) {
    await uiAlert('Erro', err.message);
  }
}

async function refreshEntity(entity) {
  if (entity === 'locals') return loadLocals();
  if (entity === 'corridors') return loadCorridors();
  if (entity === 'shelves') return loadShelves();
  if (entity === 'bins') return loadBins();
  if (entity === 'positions') return loadPositions();
}

async function editRow(entity, row) {
  const id = Number(row.dataset.id);
  const current = findRow(entity, id);
  if (!current) return;

  const name = prompt('Nome:', current.name ?? '');
  if (name === null) return;

  const description = prompt('Descrição (opcional):', current.description ?? '');
  if (description === null) return;

  // keep active as-is
  try {
    await apiFetch(`/${entity}/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ name: String(name).trim(), description: String(description).trim() || null }),
    });
    await refreshEntity(entity);
  } catch (err) {
    await uiAlert('Erro', err.message);
  }
}

async function toggleRow(entity, row) {
  const id = Number(row.dataset.id);
  const current = findRow(entity, id);
  if (!current) return;

  const next = !current.active;
  try {
    await apiFetch(`/${entity}/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ active: next }),
    });
    await refreshEntity(entity);
  } catch (err) {
    await uiAlert('Erro', err.message);
  }
}

async function deleteRow(entity, row) {
  const id = Number(row.dataset.id);
  const current = findRow(entity, id);
  if (!current) return;

  const ok = confirm(`Excluir "${current.name}" (id ${id})?`);
  if (!ok) return;

  try {
    await apiFetch(`/${entity}/${id}`, { method: 'DELETE' });
    await refreshEntity(entity);
  } catch (err) {
    await uiAlert('Erro', err.message);
  }
}

function findRow(entity, id) {
  const map = {
    locals: state.locals,
    corridors: state.corridors,
    shelves: state.shelves,
    bins: state.bins,
    positions: state.positions,
  };
  return (map[entity] || []).find((r) => Number(r.id) === Number(id)) || null;
}

/* -------------------------------------------------------------------------- */
/* Product Locations                                                          */
/* -------------------------------------------------------------------------- */

function buildLocationLabel(plRow) {
  // Use text fields when present; fallback to ids
  const parts = [
    plRow.local ?? (plRow.local_id ? `L${plRow.local_id}` : null),
    plRow.corridor ?? (plRow.corridor_id ? `C${plRow.corridor_id}` : null),
    plRow.shelf ?? (plRow.shelf_id ? `S${plRow.shelf_id}` : null),
    plRow.bin ?? (plRow.bin_id ? `B${plRow.bin_id}` : null),
    plRow.position ?? (plRow.position_id ? `P${plRow.position_id}` : null),
  ].filter(Boolean);

  return parts.join(' / ');
}

async function loadProductLocations({ sku = null } = {}) {
  const q = new URLSearchParams();
  if (sku) q.set('productCode', sku); // your controller accepts productCode/product_code
  const rows = await apiFetch(`/product-locations?${q.toString()}`);

  tbProductLocations.innerHTML = rows.map((r) => {
    return `
      <tr data-plid="${r.id}">
        <td>${r.id}</td>
        <td>${esc(r.product_code)}</td>
        <td title="${esc(r.product_description || '')}">${esc(r.product_description || '')}</td>
        <td title="${esc(buildLocationLabel(r))}">${esc(buildLocationLabel(r))}</td>
        <td>
          <div class="loc-actions-row">
            <button class="btn btn-toolbar btn-sm" data-plact="use">⬅️</button>
            <button class="btn btn-toolbar btn-sm" data-plact="del">🗑️</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function clearPLForm() {
  plLocalId.value = '';
  plCorridorId.value = '';
  plShelfId.value = '';
  plBinId.value = '';
  plPositionId.value = '';

  plLocal.value = '';
  plCorridor.value = '';
  plShelf.value = '';
  plBin.value = '';
  plPosition.value = '';

  plNotes.value = '';
}

async function saveProductLocation() {
  const sku = String(txtProductCode.value || '').trim();
  if (!sku) {
    await uiAlert('Atenção', 'Informe o SKU do produto.');
    txtProductCode.focus();
    return;
  }

  const payload = {
    product_code: sku,
    local_id: plLocalId.value ? Number(plLocalId.value) : null,
    corridor_id: plCorridorId.value ? Number(plCorridorId.value) : null,
    shelf_id: plShelfId.value ? Number(plShelfId.value) : null,
    bin_id: plBinId.value ? Number(plBinId.value) : null,
    position_id: plPositionId.value ? Number(plPositionId.value) : null,
    local: plLocal.value ? String(plLocal.value).trim() : null,
    corridor: plCorridor.value ? String(plCorridor.value).trim() : null,
    shelf: plShelf.value ? String(plShelf.value).trim() : null,
    bin: plBin.value ? String(plBin.value).trim() : null,
    position: plPosition.value ? String(plPosition.value).trim() : null,
    notes: plNotes.value ? String(plNotes.value).trim() : null,
  };

  try {
    await apiFetch('/product-locations', { method: 'POST', body: JSON.stringify(payload) });
    await loadProductLocations({ sku });
    await uiAlert('OK', 'Localização salva com sucesso.');
  } catch (err) {
    await uiAlert('Erro', err.message);
  }
}

async function deleteProductLocationRow(plId) {
  const ok = confirm(`Excluir localização do produto? (id ${plId})`);
  if (!ok) return;

  try {
    await apiFetch(`/product-locations/${plId}`, { method: 'DELETE' });
    const sku = String(txtPLSearch.value || '').trim() || null;
    await loadProductLocations({ sku });
  } catch (err) {
    await uiAlert('Erro', err.message);
  }
}

function applyPLToForm(rowData) {
  txtProductCode.value = rowData.product_code ?? '';

  plLocalId.value = rowData.local_id ?? '';
  plCorridorId.value = rowData.corridor_id ?? '';
  plShelfId.value = rowData.shelf_id ?? '';
  plBinId.value = rowData.bin_id ?? '';
  plPositionId.value = rowData.position_id ?? '';

  plLocal.value = rowData.local ?? '';
  plCorridor.value = rowData.corridor ?? '';
  plShelf.value = rowData.shelf ?? '';
  plBin.value = rowData.bin ?? '';
  plPosition.value = rowData.position ?? '';

  plNotes.value = rowData.notes ?? '';
}

/* -------------------------------------------------------------------------- */
/* Optional: Product modal (F2)                                                */
/* -------------------------------------------------------------------------- */

async function tryOpenProductsModal(initial = '') {
  // Uses your existing modal if present:
  // /public/modalsSearch/productsModalSearch.js exporting openProductsModalSearch
  try {
    const mod = await import('/public/modalsSearch/productsModalSearch.js');
    const openProductsModalSearch = mod.openProductsModalSearch || mod.default || null;

    if (typeof openProductsModalSearch !== 'function') {
      await uiAlert('Aviso', 'Modal de produtos não encontrado (export openProductsModalSearch).');
      return null;
    }

    return await new Promise((resolve) => {
      openProductsModalSearch({
        apiBase: '/api',
        title: 'Selecionar Produto',
        initial,
        onPickProduct: (p) => resolve(p),
      });
    });
  } catch (err) {
    await uiAlert('Aviso', 'Não foi possível abrir o modal de produtos.\n' + err.message);
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/* Events                                                                      */
/* -------------------------------------------------------------------------- */

btnReloadAll.addEventListener('click', async () => {
  try {
    await reloadAllHierarchy();
    await loadProductLocations({ sku: null });
  } catch (err) {
    await uiAlert('Erro', err.message);
  }
});

chkOnlyActive.addEventListener('change', async () => {
  try {
    await reloadAllHierarchy();
  } catch (err) {
    await uiAlert('Erro', err.message);
  }
});

/* Cascade filters */
selLocal.addEventListener('change', async () => {
  try {
    // reset lower selects
    selCorridor.value = '';
    selShelf.value = '';
    selBin.value = '';
    selPosition.value = '';
    await loadCorridors();
    await loadShelves();
    await loadBins();
    await loadPositions();
  } catch (err) {
    await uiAlert('Erro', err.message);
  }
});

selCorridor.addEventListener('change', async () => {
  try {
    selShelf.value = '';
    selBin.value = '';
    selPosition.value = '';
    await loadShelves();
    await loadBins();
    await loadPositions();
  } catch (err) {
    await uiAlert('Erro', err.message);
  }
});

selShelf.addEventListener('change', async () => {
  try {
    selBin.value = '';
    selPosition.value = '';
    await loadBins();
    await loadPositions();
  } catch (err) {
    await uiAlert('Erro', err.message);
  }
});

selBin.addEventListener('change', async () => {
  try {
    selPosition.value = '';
    await loadPositions();
  } catch (err) {
    await uiAlert('Erro', err.message);
  }
});

/* Create */
btnCreate.addEventListener('click', createEntity);

txtName.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    createEntity();
  }
});

/* Refresh buttons on lists */
document.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-refresh]');
  if (!btn) return;
  const entity = btn.getAttribute('data-refresh');
  try {
    await refreshEntity(entity);
  } catch (err) {
    await uiAlert('Erro', err.message);
  }
});

/* Table actions */
document.addEventListener('click', async (e) => {
  const tr = e.target.closest('tr[data-entity][data-id]');
  if (!tr) return;

  const entity = tr.dataset.entity;
  const actBtn = e.target.closest('button[data-act]');
  if (!actBtn) return;

  const act = actBtn.dataset.act;
  if (act === 'edit') return editRow(entity, tr);
  if (act === 'toggle') return toggleRow(entity, tr);
  if (act === 'del') return deleteRow(entity, tr);
});

/* Product location search/save */
btnCreatePL.addEventListener('click', saveProductLocation);
btnClearPL.addEventListener('click', clearPLForm);

btnSearchPL.addEventListener('click', async () => {
  const sku = String(txtPLSearch.value || '').trim();
  try {
    await loadProductLocations({ sku: sku || null });
  } catch (err) {
    await uiAlert('Erro', err.message);
  }
});

btnReloadPL.addEventListener('click', async () => {
  try {
    await loadProductLocations({ sku: null });
  } catch (err) {
    await uiAlert('Erro', err.message);
  }
});

txtPLSearch.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    btnSearchPL.click();
  }
});

txtProductCode.addEventListener('keydown', async (e) => {
  if (e.key === 'F2') {
    e.preventDefault();
    const picked = await tryOpenProductsModal(String(txtProductCode.value || '').trim());
    if (picked?.product_code || picked?.sku || picked?.code) {
      const sku = picked.product_code ?? picked.sku ?? picked.code;
      txtProductCode.value = String(sku).trim();
      txtPLSearch.value = String(sku).trim();
      await loadProductLocations({ sku: String(sku).trim() });
    }
  }

  if (e.key === 'Enter') {
    e.preventDefault();
    const sku = String(txtProductCode.value || '').trim();
    if (sku) {
      txtPLSearch.value = sku;
      await loadProductLocations({ sku });
    } else {
      // empty SKU: open modal if available
      const picked = await tryOpenProductsModal('');
      if (picked?.product_code || picked?.sku || picked?.code) {
        const psku = picked.product_code ?? picked.sku ?? picked.code;
        txtProductCode.value = String(psku).trim();
        txtPLSearch.value = String(psku).trim();
        await loadProductLocations({ sku: String(psku).trim() });
      }
    }
  }
});

btnPickProduct.addEventListener('click', async () => {
  const picked = await tryOpenProductsModal(String(txtProductCode.value || '').trim());
  if (picked?.product_code || picked?.sku || picked?.code) {
    const sku = picked.product_code ?? picked.sku ?? picked.code;
    txtProductCode.value = String(sku).trim();
    txtPLSearch.value = String(sku).trim();
    await loadProductLocations({ sku: String(sku).trim() });
  }
});

/* Product locations table actions */
tbProductLocations.addEventListener('click', async (e) => {
  const tr = e.target.closest('tr[data-plid]');
  if (!tr) return;

  const actBtn = e.target.closest('button[data-plact]');
  if (!actBtn) return;

  const plId = Number(tr.dataset.plid);
  const act = actBtn.dataset.plact;

  if (act === 'del') {
    return deleteProductLocationRow(plId);
  }

  if (act === 'use') {
    // fetch all for current filter and apply selected row quickly by scanning DOM text
    try {
      // For accuracy, reload list for current filter and find by id
      const sku = String(txtPLSearch.value || '').trim() || null;
      const q = new URLSearchParams();
      if (sku) q.set('productCode', sku);
      const rows = await apiFetch(`/product-locations?${q.toString()}`);
      const row = rows.find((r) => Number(r.id) === Number(plId));
      if (row) applyPLToForm(row);
      setActiveTab('tabProduct');
    } catch (err) {
      await uiAlert('Erro', err.message);
    }
  }
});

/* -------------------------------------------------------------------------- */
/* Init                                                                        */
/* -------------------------------------------------------------------------- */

async function init() {
  try {
    setActiveTab('tabHierarchy');
    await reloadAllHierarchy();
    await loadProductLocations({ sku: null });
  } catch (err) {
    await uiAlert('Erro', err.message);
  }
}

init();
