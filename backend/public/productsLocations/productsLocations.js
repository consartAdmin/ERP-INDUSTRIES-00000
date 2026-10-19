// ╔══════════════════════════════════════════════════════════════════════╗
// ║ productsLocations.js — Product Locations UI (Frontend, ESM)          ║
// ║ PRODNEX ERP · consumes /api/locations/*                              ║
// ║ ✅ UPDATE 2026-02: compatível com public."productsLocations"          ║
// ║ ✅ UPDATE: editor exibe código + descrição do produto                ║
// ║ ✅ UPDATE: lupa pesquisa por descrição do produto                    ║
// ║ ✅ UPDATE (AUTO SEARCH): busca automática + debounce                 ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { openProductsModalSearch } from '/public/modalsSearch/productsModalSearch.js';
import { showCenterModal } from '/public/includes/js/centerAlertModal.js';

// ---------------------------------------------------------------------
// Helper definitivo: utiliza a função global getApiBase() do apiBase.js
// ---------------------------------------------------------------------
function getApiBase() {
  try {
    if (typeof window !== 'undefined' && window.getApiBase) {
      return window.getApiBase();
    }
  } catch (err) {
    console.error('[siteMenu] Erro ao obter API base:', err);
  }
  return 'http://localhost:8080';
}

const API_BASE = getApiBase();
const LOC_API = `${API_BASE}/api/locations`;

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

// Cache
let currentEditId = null;
let cacheLocations = [];
let cacheLocals = [];
let cacheCorridors = [];
let cacheShelves = [];
let cacheBins = [];
let cachePositions = [];

// Controle de corrida
let __locReqSeq = 0;

document.addEventListener('DOMContentLoaded', () => {
  bindTabs();
  bindEvents();
  bindAutoSearch();
  loadLocalsFilter();
  loadLocals();

  // ?q=SKU (ex.: link "Gerenciar localizações" da Edição de Produtos) já abre filtrado
  const initialQ = new URLSearchParams(window.location.search).get('q');
  if (initialQ && $('#qLocalizacoes')) $('#qLocalizacoes').value = initialQ;

  loadLocations();
});

/* --------------------------------------------------------------------- */
/* Tabs                                                                  */
/* --------------------------------------------------------------------- */

function bindTabs() {
  const tabs = $$('[data-tab]');
  const panels = $$('[data-panel]');

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;

      tabs.forEach((t) => t.classList.remove('is-active'));
      panels.forEach((p) => p.classList.remove('is-active'));

      tab.classList.add('is-active');

      const panel = $(`[data-panel="${target}"]`);
      if (panel) panel.classList.add('is-active');
    });
  });
}

function openEditorTab() {
  const tabEditor = $('[data-tab="editor"]');
  const panelEditor = $('[data-panel="editor"]');
  const tabList = $('[data-tab="list"]');
  const panelList = $('[data-panel="list"]');

  tabEditor?.classList.add('is-active');
  panelEditor?.classList.add('is-active');

  tabList?.classList.remove('is-active');
  panelList?.classList.remove('is-active');
}

function openListTab() {
  const tabEditor = $('[data-tab="editor"]');
  const panelEditor = $('[data-panel="editor"]');
  const tabList = $('[data-tab="list"]');
  const panelList = $('[data-panel="list"]');

  tabList?.classList.add('is-active');
  panelList?.classList.add('is-active');

  tabEditor?.classList.remove('is-active');
  panelEditor?.classList.remove('is-active');
}

/* --------------------------------------------------------------------- */
/* Events                                                                */
/* --------------------------------------------------------------------- */

function bindEvents() {
  $('#btnRecarregarLocalizacoes')?.addEventListener('click', () => {
    loadLocations();
  });

  $('#btnNovaLocalizacao')?.addEventListener('click', () => {
    resetForm();
    openEditorTab();
  });

  $('#btnBuscarLocalizacoes')?.addEventListener('click', () => {
    loadLocations();
  });

  $('#btnLimparFiltroLocalizacoes')?.addEventListener('click', () => {
    const q = $('#qLocalizacoes');
    const filtro = $('#filtroLocal');

    if (q) q.value = '';
    if (filtro) filtro.value = '';

    loadLocations();
  });

  $('#btnSalvarLocalizacao')?.addEventListener('click', handleSaveLocation);

  $('#btnCancelarLocalizacao')?.addEventListener('click', () => {
    resetForm();
    openListTab();
  });

  // Select hierarchy
  $('#localSelect')?.addEventListener('change', handleLocalChange);
  $('#corridorSelect')?.addEventListener('change', handleCorridorChange);
  $('#shelfSelect')?.addEventListener('change', handleShelfChange);
  $('#binSelect')?.addEventListener('change', handleBinChange);

  // Quick adds
  $('#btnAddLocal')?.addEventListener('click', quickAddLocal);
  $('#btnAddCorridor')?.addEventListener('click', quickAddCorridor);
  $('#btnAddShelf')?.addEventListener('click', quickAddShelf);
  $('#btnAddBin')?.addEventListener('click', quickAddBin);
  $('#btnAddPosition')?.addEventListener('click', quickAddPosition);

  // Busca de produto via modal (prioriza descrição)
  $('#btnSearchProduct')?.addEventListener('click', openProductSearchModalFromFields);

  // Enter nos campos do produto abre a busca
  $('#productDescription')?.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') {
      ev.preventDefault();
      openProductSearchModalFromFields();
    }
  });

  $('#productCode')?.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') {
      ev.preventDefault();
      openProductSearchModalFromFields();
    }
  });
}

function openProductSearchModalFromFields() {
  const inputCode = $('#productCode');
  const inputDescription = $('#productDescription');

  const codeValue = inputCode?.value?.trim() || '';
  const descriptionValue = inputDescription?.value?.trim() || '';

  // Prioriza descrição; se vazia, usa código
  const initialQuery = descriptionValue || codeValue || '';

  openProductsModalSearch({
    apiBase: API_BASE,
    initialQuery,

    onPick(product) {
      const code =
        product.product_code ??
        product.productCode ??
        product.sku ??
        product.codigo ??
        product.code ??
        '';

      const description =
        product.description ??
        product.product_description ??
        product.product_name ??
        product.nome ??
        product.descricao ??
        '';

      if (inputCode) inputCode.value = code || '';
      if (inputDescription) inputDescription.value = description || '';
    },
  });
}

/* --------------------------------------------------------------------- */
/* Auto Search                                                           */
/* --------------------------------------------------------------------- */

function debounce(fn, wait = 250) {
  let t = null;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

function bindAutoSearch() {
  const qInput = $('#qLocalizacoes');
  const localSelect = $('#filtroLocal');

  if (!qInput) return;

  const doSearchDebounced = debounce(() => {
    loadLocations();
  }, 250);

  qInput.addEventListener('input', () => {
    doSearchDebounced();
  });

  qInput.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') {
      ev.preventDefault();
      loadLocations();
    }

    if (ev.key === 'Escape') {
      qInput.value = '';
      loadLocations();
    }
  });

  localSelect?.addEventListener('change', () => {
    loadLocations();
  });
}

/* --------------------------------------------------------------------- */
/* Fetch helpers                                                         */
/* --------------------------------------------------------------------- */

async function apiGet(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`GET ${path} -> ${res.status}`);
  return res.json();
}

async function apiPost(path, body) {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const msg = await res.text();
    throw new Error(`POST ${path} -> ${res.status} ${msg}`);
  }

  return res.json();
}

async function apiPut(path, body) {
  const res = await fetch(path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const msg = await res.text();
    throw new Error(`PUT ${path} -> ${res.status} ${msg}`);
  }

  return res.json();
}

async function apiPatch(path, body = {}) {
  const res = await fetch(path, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const msg = await res.text();
    throw new Error(`PATCH ${path} -> ${res.status} ${msg}`);
  }

  return res.json();
}

async function apiDelete(path) {
  const res = await fetch(path, { method: 'DELETE' });

  if (!res.ok) {
    const msg = await res.text();
    throw new Error(`DELETE ${path} -> ${res.status} ${msg}`);
  }

  if (res.status === 204) return { ok: true };
  return res.json();
}

/* --------------------------------------------------------------------- */
/* Helpers                                                               */
/* --------------------------------------------------------------------- */

function safeRows(data) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.rows)) return data.rows;
  return [];
}

function findLocalNameById(id) {
  const loc = cacheLocals.find((l) => String(l.id) === String(id));
  return loc?.name ?? '';
}

function setSelectByText(selectEl, text) {
  if (!selectEl) return null;

  const t = String(text ?? '').trim().toLowerCase();
  if (!t) return null;

  const opts = Array.from(selectEl.options || []);
  const hit = opts.find(
    (o) => String(o.textContent || '').trim().toLowerCase() === t,
  );

  if (hit) {
    selectEl.value = hit.value;
    return hit.value;
  }

  return null;
}

function getLocationDescription(loc) {
  return (
    loc?.product_description ||
    loc?.product_name ||
    loc?.description ||
    ''
  );
}

/* --------------------------------------------------------------------- */
/* Load lists                                                            */
/* --------------------------------------------------------------------- */

async function loadLocalsFilter() {
  try {
    const locals = await apiGet(`${LOC_API}/locals?activeOnly=true`);
    cacheLocals = Array.isArray(locals) ? locals : [];

    const select = $('#filtroLocal');
    if (!select) return;

    const current = select.value;
    select.innerHTML = '<option value="">Todos</option>';

    cacheLocals.forEach((loc) => {
      const opt = document.createElement('option');
      opt.value = String(loc.id);
      opt.textContent = loc.name;
      select.appendChild(opt);
    });

    if (current) select.value = current;
  } catch (err) {
    console.error('[localizacoes] loadLocalsFilter error:', err);
  }
}

async function loadLocals() {
  try {
    const locals = await apiGet(`${LOC_API}/locals?activeOnly=true`);
    cacheLocals = Array.isArray(locals) ? locals : [];

    const select = $('#localSelect');
    if (!select) return;

    const current = select.value;
    select.innerHTML = '<option value="">Selecione...</option>';

    cacheLocals.forEach((loc) => {
      const opt = document.createElement('option');
      opt.value = String(loc.id);
      opt.textContent = loc.name;
      select.appendChild(opt);
    });

    if (current) select.value = current;
  } catch (err) {
    console.error('[localizacoes] loadLocals error:', err);
  }
}

async function loadCorridors(localId) {
  try {
    const select = $('#corridorSelect');
    if (!select) return;

    if (!localId) {
      cacheCorridors = [];
      select.innerHTML = '<option value="">Selecione...</option>';
      return;
    }

    const corridors = await apiGet(
      `${LOC_API}/corridors?localId=${encodeURIComponent(localId)}&activeOnly=true`,
    );

    cacheCorridors = Array.isArray(corridors) ? corridors : [];

    const current = select.value;
    select.innerHTML = '<option value="">Selecione...</option>';

    cacheCorridors.forEach((c) => {
      const opt = document.createElement('option');
      opt.value = String(c.id);
      opt.textContent = c.name;
      select.appendChild(opt);
    });

    if (current) select.value = current;
  } catch (err) {
    console.error('[localizacoes] loadCorridors error:', err);
  }
}

async function loadShelves(corridorId) {
  try {
    const select = $('#shelfSelect');
    if (!select) return;

    if (!corridorId) {
      cacheShelves = [];
      select.innerHTML = '<option value="">Selecione...</option>';
      return;
    }

    const shelves = await apiGet(
      `${LOC_API}/shelves?corridorId=${encodeURIComponent(corridorId)}&activeOnly=true`,
    );

    cacheShelves = Array.isArray(shelves) ? shelves : [];

    const current = select.value;
    select.innerHTML = '<option value="">Selecione...</option>';

    cacheShelves.forEach((s) => {
      const opt = document.createElement('option');
      opt.value = String(s.id);
      opt.textContent = s.name;
      select.appendChild(opt);
    });

    if (current) select.value = current;
  } catch (err) {
    console.error('[localizacoes] loadShelves error:', err);
  }
}

async function loadBins(shelfId) {
  try {
    const select = $('#binSelect');
    if (!select) return;

    if (!shelfId) {
      cacheBins = [];
      select.innerHTML = '<option value="">Selecione...</option>';
      return;
    }

    const bins = await apiGet(
      `${LOC_API}/bins?shelfId=${encodeURIComponent(shelfId)}&activeOnly=true`,
    );

    cacheBins = Array.isArray(bins) ? bins : [];

    const current = select.value;
    select.innerHTML = '<option value="">Selecione...</option>';

    cacheBins.forEach((b) => {
      const opt = document.createElement('option');
      opt.value = String(b.id);
      opt.textContent = b.name;
      select.appendChild(opt);
    });

    if (current) select.value = current;
  } catch (err) {
    console.error('[localizacoes] loadBins error:', err);
  }
}

async function loadPositions(binId) {
  try {
    const select = $('#positionSelect');
    if (!select) return;

    if (!binId) {
      cachePositions = [];
      select.innerHTML = '<option value="">Selecione...</option>';
      return;
    }

    const positions = await apiGet(
      `${LOC_API}/positions?binId=${encodeURIComponent(binId)}&activeOnly=true`,
    );

    cachePositions = Array.isArray(positions) ? positions : [];

    const current = select.value;
    select.innerHTML = '<option value="">Selecione...</option>';

    cachePositions.forEach((p) => {
      const opt = document.createElement('option');
      opt.value = String(p.id);
      opt.textContent = p.name;
      select.appendChild(opt);
    });

    if (current) select.value = current;
  } catch (err) {
    console.error('[localizacoes] loadPositions error:', err);
  }
}

/* --------------------------------------------------------------------- */
/* Handlers select hierarchy                                             */
/* --------------------------------------------------------------------- */

function handleLocalChange() {
  const localId = $('#localSelect')?.value || null;
  loadCorridors(localId);

  if ($('#shelfSelect')) $('#shelfSelect').innerHTML = '<option value="">Selecione...</option>';
  if ($('#binSelect')) $('#binSelect').innerHTML = '<option value="">Selecione...</option>';
  if ($('#positionSelect')) $('#positionSelect').innerHTML = '<option value="">Selecione...</option>';
}

function handleCorridorChange() {
  const corridorId = $('#corridorSelect')?.value || null;
  loadShelves(corridorId);

  if ($('#binSelect')) $('#binSelect').innerHTML = '<option value="">Selecione...</option>';
  if ($('#positionSelect')) $('#positionSelect').innerHTML = '<option value="">Selecione...</option>';
}

function handleShelfChange() {
  const shelfId = $('#shelfSelect')?.value || null;
  loadBins(shelfId);

  if ($('#positionSelect')) $('#positionSelect').innerHTML = '<option value="">Selecione...</option>';
}

function handleBinChange() {
  const binId = $('#binSelect')?.value || null;
  loadPositions(binId);
}

/* --------------------------------------------------------------------- */
/* Quick add helpers                                                     */
/* --------------------------------------------------------------------- */

async function quickAddLocal() {
  const name = prompt('Nome do local (ex: DEPÓSITO CENTRAL):');
  if (!name) return;

  try {
    const created = await apiPost(`${LOC_API}/locals`, { name, active: true });
    await loadLocals();
    await loadLocalsFilter();

    if ($('#localSelect') && created?.id) {
      $('#localSelect').value = String(created.id);
    }
  } catch (err) {
    console.error('[localizacoes] quickAddLocal error:', err);
    alert('Erro ao criar local.');
  }
}

async function quickAddCorridor() {
  const localId = $('#localSelect')?.value || null;
  const name = prompt('Nome do corredor (ex: A1, B3):');
  if (!name) return;

  try {
    const created = await apiPost(`${LOC_API}/corridors`, {
      name,
      local_id: localId ? Number(localId) : null,
      active: true,
    });

    await loadCorridors(localId);

    if ($('#corridorSelect') && created?.id) {
      $('#corridorSelect').value = String(created.id);
    }
  } catch (err) {
    console.error('[localizacoes] quickAddCorridor error:', err);
    alert('Erro ao criar corredor.');
  }
}

async function quickAddShelf() {
  const corridorId = $('#corridorSelect')?.value || null;
  const name = prompt('Nome da prateleira (ex: 3, 4B):');
  if (!name) return;

  try {
    const created = await apiPost(`${LOC_API}/shelves`, {
      name,
      corridor_id: corridorId ? Number(corridorId) : null,
      active: true,
    });

    await loadShelves(corridorId);

    if ($('#shelfSelect') && created?.id) {
      $('#shelfSelect').value = String(created.id);
    }
  } catch (err) {
    console.error('[localizacoes] quickAddShelf error:', err);
    alert('Erro ao criar prateleira.');
  }
}

async function quickAddBin() {
  const shelfId = $('#shelfSelect')?.value || null;
  const name = prompt('Nome do bin (ex: B, C, 7B):');
  if (!name) return;

  try {
    const created = await apiPost(`${LOC_API}/bins`, {
      name,
      shelf_id: shelfId ? Number(shelfId) : null,
      active: true,
    });

    await loadBins(shelfId);

    if ($('#binSelect') && created?.id) {
      $('#binSelect').value = String(created.id);
    }
  } catch (err) {
    console.error('[localizacoes] quickAddBin error:', err);
    alert('Erro ao criar bin.');
  }
}

async function quickAddPosition() {
  const binId = $('#binSelect')?.value || null;
  const name = prompt('Nome da posição (ex: 7, 7A):');
  if (!name) return;

  try {
    const created = await apiPost(`${LOC_API}/positions`, {
      name,
      bin_id: binId ? Number(binId) : null,
      active: true,
    });

    await loadPositions(binId);

    if ($('#positionSelect') && created?.id) {
      $('#positionSelect').value = String(created.id);
    }
  } catch (err) {
    console.error('[localizacoes] quickAddPosition error:', err);
    alert('Erro ao criar posição.');
  }
}

/* --------------------------------------------------------------------- */
/* Load product locations                                                */
/* --------------------------------------------------------------------- */

async function loadLocations() {
  const reqId = ++__locReqSeq;

  try {
    const q = $('#qLocalizacoes')?.value?.trim() || '';
    const filtroLocal = $('#filtroLocal')?.value || '';

    const params = new URLSearchParams();

    if (q) params.set('q', q);
    if (filtroLocal) params.set('storeId', filtroLocal);

    const query = params.toString();
    const raw = await apiGet(
      `${LOC_API}/product-locations${query ? `?${query}` : ''}`,
    );

    if (reqId !== __locReqSeq) return;

    const rows = safeRows(raw);

    cacheLocations = filtroLocal
      ? rows.filter((loc) => String(loc.store_id || '') === String(filtroLocal))
      : rows;

    renderLocationsTable();
  } catch (err) {
    if (reqId !== __locReqSeq) return;
    console.error('[localizacoes] loadLocations error:', err);
    alert('Error loading locations.');
  }
}

function renderLocationsTable() {
  const tbody = $('#tblLocalizacoes tbody');
  if (!tbody) return;

  tbody.innerHTML = '';

  cacheLocations.forEach((loc) => {
    const tr = document.createElement('tr');

    const tdProd = document.createElement('td');
    tdProd.textContent = loc.product_code || '';
    tr.appendChild(tdProd);

    const tdDesc = document.createElement('td');
    tdDesc.textContent = getLocationDescription(loc);
    tr.appendChild(tdDesc);

    const tdLocal = document.createElement('td');
    tdLocal.textContent = loc.store_id ? findLocalNameById(loc.store_id) : '';
    tr.appendChild(tdLocal);

    const tdCorr = document.createElement('td');
    tdCorr.textContent = loc.corredor || '';
    tr.appendChild(tdCorr);

    const tdShelf = document.createElement('td');
    tdShelf.textContent = loc.prateleira || '';
    tr.appendChild(tdShelf);

    const tdBin = document.createElement('td');
    tdBin.textContent = loc.bandeja || '';
    tr.appendChild(tdBin);

    const tdPos = document.createElement('td');
    tdPos.textContent = loc.box || '';
    tr.appendChild(tdPos);

    const tdNotes = document.createElement('td');
    tdNotes.textContent = loc.observacao || '';
    tr.appendChild(tdNotes);

    // ⭐ Principal (products.product_location_id — exibida na Edição de Produtos)
    const tdPrimary = document.createElement('td');
    tdPrimary.classList.add('pl-col-primary');
    if (loc.is_primary) {
      const badge = document.createElement('span');
      badge.className = 'pl-primary-badge';
      badge.textContent = '⭐ Principal';
      tdPrimary.appendChild(badge);
    } else if (loc.is_active !== false) {
      const btnPrimary = document.createElement('button');
      btnPrimary.type = 'button';
      btnPrimary.className = 'btn btn-toolbar btn-sm';
      btnPrimary.textContent = '☆ Tornar principal';
      btnPrimary.title = 'Usar esta como localização principal do produto';
      btnPrimary.addEventListener('click', () => setPrimaryLocation(loc, btnPrimary));
      tdPrimary.appendChild(btnPrimary);
    }
    tr.appendChild(tdPrimary);

    const tdActions = document.createElement('td');
    tdActions.classList.add('col-acoes');

    const actionsWrapper = document.createElement('div');
    actionsWrapper.classList.add('page-locations__row-actions');

    const btnEdit = document.createElement('button');
    btnEdit.type = 'button';
    btnEdit.className = 'btn btn-toolbar btn-sm';
    btnEdit.textContent = '✏ Editar';
    btnEdit.addEventListener('click', () => startEditLocation(loc.id));
    actionsWrapper.appendChild(btnEdit);

    const btnDelete = document.createElement('button');
    btnDelete.type = 'button';
    btnDelete.className = 'btn btn-toolbar btn-sm';
    btnDelete.textContent = '🗑 Excluir';
    btnDelete.addEventListener('click', () => deleteLocation(loc.id));
    actionsWrapper.appendChild(btnDelete);

    tdActions.appendChild(actionsWrapper);
    tr.appendChild(tdActions);

    tbody.appendChild(tr);
  });

  const totalInfo = $('#totalInfoLocalizacoes');
  if (totalInfo) {
    totalInfo.textContent = `${cacheLocations.length} localização(ões)`;
  }
}

/** Marca a localização como principal do produto e recarrega a lista */
async function setPrimaryLocation(loc, btn) {
  if (!loc?.id) return;
  if (btn) btn.disabled = true;

  try {
    await apiPatch(`${LOC_API}/product-locations/${encodeURIComponent(loc.id)}/primary`);
    await loadLocations();
  } catch (err) {
    console.error('[localizacoes] setPrimaryLocation error:', err);
    alert('Não foi possível definir a localização principal.');
    if (btn) btn.disabled = false;
  }
}

/* --------------------------------------------------------------------- */
/* Form handling                                                         */
/* --------------------------------------------------------------------- */

function resetForm() {
  currentEditId = null;

  if ($('#locationId')) $('#locationId').value = '';
  if ($('#editorLocalizacaoTitle')) $('#editorLocalizacaoTitle').textContent = 'Nova localização';

  if ($('#productCode')) $('#productCode').value = '';
  if ($('#productDescription')) $('#productDescription').value = '';
  if ($('#notes')) $('#notes').value = '';

  if ($('#localSelect')) $('#localSelect').value = '';
  if ($('#corridorSelect')) $('#corridorSelect').innerHTML = '<option value="">Selecione...</option>';
  if ($('#shelfSelect')) $('#shelfSelect').innerHTML = '<option value="">Selecione...</option>';
  if ($('#binSelect')) $('#binSelect').innerHTML = '<option value="">Selecione...</option>';
  if ($('#positionSelect')) $('#positionSelect').innerHTML = '<option value="">Selecione...</option>';
}

async function handleSaveLocation(evt) {
  evt.preventDefault();

  const product_code = $('#productCode')?.value.trim() || '';
  const notes = $('#notes')?.value.trim() || '';

  if (!product_code) {
    alert('Product code is required.');
    $('#productCode')?.focus();
    return;
  }

  const localSelect = $('#localSelect');
  const corridorSelect = $('#corridorSelect');
  const shelfSelect = $('#shelfSelect');
  const binSelect = $('#binSelect');
  const positionSelect = $('#positionSelect');

  const store_id = localSelect?.value ? Number(localSelect.value) : null;

  if (!store_id || !corridorSelect?.value || !shelfSelect?.value) {
    alert('Selecione Local, Corredor e Prateleira (tabelas auxiliares).');
    return;
  }

  const corredor = corridorSelect.value
    ? corridorSelect.options[corridorSelect.selectedIndex].textContent.trim()
    : null;

  const prateleira = shelfSelect.value
    ? shelfSelect.options[shelfSelect.selectedIndex].textContent.trim()
    : null;

  const bandeja = binSelect?.value
    ? binSelect.options[binSelect.selectedIndex].textContent.trim()
    : null;

  const box = positionSelect?.value
    ? positionSelect.options[positionSelect.selectedIndex].textContent.trim()
    : null;

  const payload = {
    product_code,
    store_id,
    corredor,
    prateleira,
    bandeja,
    box,
    observacao: notes || null,
    is_active: true,
  };

  try {
    if (currentEditId) {
      await apiPut(`${LOC_API}/product-locations/${currentEditId}`, payload);
    } else {
      await apiPost(`${LOC_API}/product-locations`, payload);
    }

    resetForm();
    openListTab();
    await loadLocations();
  } catch (err) {
    console.error('[localizacoes] handleSaveLocation error:', err);
    alert('Error saving location.');
  }
}

/* --------------------------------------------------------------------- */
/* Edit / delete                                                         */
/* --------------------------------------------------------------------- */

async function startEditLocation(id) {
  const loc = cacheLocations.find((l) => Number(l.id) === Number(id));
  if (!loc) return;

  currentEditId = id;

  if ($('#locationId')) $('#locationId').value = id;
  if ($('#editorLocalizacaoTitle')) {
    $('#editorLocalizacaoTitle').textContent = `Editar localização #${id}`;
  }

  if ($('#productCode')) $('#productCode').value = loc.product_code || '';
  if ($('#productDescription')) $('#productDescription').value = getLocationDescription(loc);
  if ($('#notes')) $('#notes').value = loc.observacao || '';

  if (loc.store_id && $('#localSelect')) {
    $('#localSelect').value = String(loc.store_id);
    await loadCorridors(loc.store_id);
  } else {
    if ($('#localSelect')) $('#localSelect').value = '';
    if ($('#corridorSelect')) $('#corridorSelect').innerHTML = '<option value="">Selecione...</option>';
  }

  if (loc.corredor) {
    setSelectByText($('#corridorSelect'), loc.corredor);
    const corridorId = $('#corridorSelect')?.value || null;
    await loadShelves(corridorId);
  } else {
    if ($('#corridorSelect')) $('#corridorSelect').innerHTML = '<option value="">Selecione...</option>';
  }

  if (loc.prateleira) {
    setSelectByText($('#shelfSelect'), loc.prateleira);
    const shelfId = $('#shelfSelect')?.value || null;
    await loadBins(shelfId);
  } else {
    if ($('#shelfSelect')) $('#shelfSelect').innerHTML = '<option value="">Selecione...</option>';
  }

  if (loc.bandeja) {
    setSelectByText($('#binSelect'), loc.bandeja);
    const binId = $('#binSelect')?.value || null;
    await loadPositions(binId);
  } else {
    if ($('#binSelect')) $('#binSelect').innerHTML = '<option value="">Selecione...</option>';
  }

  if (loc.box) {
    setSelectByText($('#positionSelect'), loc.box);
  } else {
    if ($('#positionSelect')) $('#positionSelect').innerHTML = '<option value="">Selecione...</option>';
  }

  openEditorTab();
}

async function deleteLocation(id) {
  const ok = await showCenterModal({
    variant: 'warning',
    title: 'Confirmar exclusão',
    message: 'Deseja realmente excluir esta localização?',
    okText: 'Sim, excluir',
    closeText: 'Cancelar',
  });
  if (ok !== true) return;

  try {
    await apiDelete(`${LOC_API}/product-locations/${id}`);
    await loadLocations();
  } catch (err) {
    console.error('[localizacoes] deleteLocation error:', err);
    showCenterModal({
      variant: 'error',
      title: 'Erro',
      message: 'Não foi possível excluir a localização.',
    });
  }
}