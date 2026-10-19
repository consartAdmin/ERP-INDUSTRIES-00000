// ╔══════════════════════════════════════════════════════════════════════╗
// ║ productsStock.js — Gestão Estoque Min./Máx.                         ║
// ║ PRODNEX ERP | ESM                                                   ║
// ║ ✅ Busca digitada sem modal                                          ║
// ║ ✅ Filtros Grupo/Subgrupo/Fabricante                                ║
// ║ ✅ Sugestão de Compra PDF                                           ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

const API_BASE =
  (typeof window.getApiBase === 'function' && window.getApiBase()) ||
  window.apiBase ||
  window.API_BASE ||
  '';

const API = `${API_BASE}/api/productsStock`;

const ROUTES = {
  groups: [
    `${API_BASE}/api/productsGroups`,
    `${API_BASE}/api/products-groups`,
    `${API_BASE}/api/products-groups/list`,
  ],
  subgroups: [
    `${API_BASE}/api/productsSubgroups`,
    `${API_BASE}/api/products-subgroups`,
    `${API_BASE}/api/products-subgroups/list`,
  ],
  manufacturers: [
    `${API_BASE}/api/productsManufactures`,
    `${API_BASE}/api/products-manufactures`,
    `${API_BASE}/api/products-manufacturers`,
  ],
};

const $ = (id) => document.getElementById(id);

const el = {
  fProductSearch: $('fProductSearch'),
  fGroup: $('fGroup'),
  fSubgroup: $('fSubgroup'),
  fManufacturer: $('fManufacturer'),
  fSearch: $('fSearch'),
  fStatus: $('fStatus'),
  fOrder: $('fOrder'),
  fPageSize: $('fPageSize'),

  btnApply: $('btnApply'),
  btnClear: $('btnClear'),
  btnEnsure: $('btnEnsure'),
  btnNew: $('btnNew'),
  btnPurchaseSuggestionPdf: $('btnPurchaseSuggestionPdf'),

  tbBody: $('tbBody'),
  lblInfo: $('lblInfo'),
  chkAll: $('chkAll'),
  btnSaveSelected: $('btnSaveSelected'),
  btnPrev: $('btnPrev'),
  btnNext: $('btnNext'),
  lblPage: $('lblPage'),

  modalNew: $('modalNew'),
  btnCloseNew: $('btnCloseNew'),
  btnCancelNew: $('btnCancelNew'),
  btnCreateNew: $('btnCreateNew'),
  nQty: $('nQty'),
  nMin: $('nMin'),
  nMax: $('nMax'),
};

const state = {
  limit: Number(el.fPageSize?.value || 20),
  offset: 0,
  total: 0,
  rows: [],
  selected: new Set(),
  searchTimer: null,
};

function toast(msg) {
  if (typeof window.showCenterModal === 'function') {
    window.showCenterModal('Aviso', String(msg || ''));
    return;
  }
  alert(String(msg || ''));
}

function esc(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function fmtQty(v) {
  return num(v).toLocaleString('pt-BR', {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
}

function fmtDate(v) {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('pt-BR');
}

function statusOf(r) {
  const qty = num(r.stock_qty);
  const min = num(r.stock_min);
  const max = num(r.stock_max);

  if (qty < min) return { key: 'below_min', label: 'Abaixo do mínimo', cls: 'danger' };
  if (max > 0 && qty > max) return { key: 'above_max', label: 'Acima do máximo', cls: 'warn' };
  return { key: 'ok', label: 'OK', cls: 'ok' };
}

function validateMinMax(min, max) {
  const smin = Math.max(0, num(String(min).replace(',', '.')));
  const smax = Math.max(0, num(String(max).replace(',', '.')));

  if (smax < smin) {
    return { ok: false, error: 'Estoque máximo não pode ser menor que o mínimo.' };
  }

  return { ok: true, smin, smax };
}

async function http(method, url, body) {
  const opts = { method, headers: {} };

  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }

  const res = await fetch(url, opts);
  const data = await res.json().catch(() => ({}));

  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);

  return data;
}

function buildQuery() {
  const url = new URL(API, location.origin);

  url.searchParams.set('limit', String(state.limit));
  url.searchParams.set('offset', String(state.offset));

  const q = el.fProductSearch?.value?.trim();
  const id = el.fSearch?.value?.trim();
  const status = el.fStatus?.value;
  const order = el.fOrder?.value;
  const group = el.fGroup?.value;
  const subgroup = el.fSubgroup?.value;
  const manufacturer = el.fManufacturer?.value;

  if (q) url.searchParams.set('q', q);
  if (status) url.searchParams.set('status', status);
  if (order) url.searchParams.set('order', order);
  if (group) url.searchParams.set('group_id', group);
  if (subgroup) url.searchParams.set('subgroup_id', subgroup);
  if (manufacturer) url.searchParams.set('manufacturer_id', manufacturer);

  return { url, id };
}

async function load() {
  try {
    const { url, id } = buildQuery();

    if (id) {
      const one = await http('GET', `${API}/${encodeURIComponent(id)}`);
      state.rows = one?.product_stock_id ? [one] : [];
      state.total = state.rows.length;
    } else {
      const data = await http('GET', url.toString());
      state.rows = Array.isArray(data.rows) ? data.rows : [];
      state.total = Number(data.total || 0);
    }

    state.selected.clear();
    render();
  } catch (err) {
    toast(err.message || err);
  }
}

function render() {
  renderInfo();
  renderPager();
  renderTable();
}

function renderInfo() {
  const from = state.total ? state.offset + 1 : 0;
  const to = Math.min(state.offset + state.limit, state.total);

  el.lblInfo.textContent = state.total
    ? `Mostrando ${from}-${to} de ${state.total}`
    : 'Nenhum registro encontrado.';
}

function renderPager() {
  const page = Math.floor(state.offset / state.limit) + 1;
  const pages = Math.max(1, Math.ceil(state.total / state.limit));

  el.lblPage.textContent = `Página ${page} / ${pages}`;
  el.btnPrev.disabled = state.offset <= 0;
  el.btnNext.disabled = state.offset + state.limit >= state.total;
}

function renderTable() {
  el.tbBody.innerHTML = '';

  for (const r of state.rows) {
    const st = statusOf(r);
    const suggestion = Math.max(0, num(r.stock_max) - num(r.stock_qty));

    const tr = document.createElement('tr');
    tr.dataset.id = r.product_stock_id;

    tr.innerHTML = `
      <td class="col-check">
        <input type="checkbox" class="row-check">
      </td>

      <td class="col-id"><b>#${esc(r.product_stock_id)}</b></td>

      <td class="col-prod">
        <div class="ps-prod">
          <div class="ps-prod-main">${esc(r.product_description || '—')}</div>
          <div class="ps-prod-sub">SKU: ${esc(r.product_code || '—')}</div>
        </div>
      </td>

      <td class="col-group">${esc(r.product_group_name || '—')}</td>
      <td class="col-manufacturer">${esc(r.manufacturer_name || '—')}</td>

      <td class="col-qty">${fmtQty(r.stock_qty)}</td>

      <td class="col-min">
        <input class="input-mini inp-min" type="number" step="0.001" value="${num(r.stock_min).toFixed(3)}">
      </td>

      <td class="col-max">
        <input class="input-mini inp-max" type="number" step="0.001" value="${num(r.stock_max).toFixed(3)}">
      </td>

      <td class="col-suggestion"><b>${fmtQty(suggestion)}</b></td>

      <td class="col-status">
        <span class="badge ${st.cls}">${st.label}</span>
      </td>

      <td class="col-updated">${fmtDate(r.updated_at)}</td>

      <td class="col-actions">
        <div class="row-actions">
          <button class="btn btn-soft btn-save">Salvar</button>
          <button class="btn btn-ghost btn-adjust">Ajustar</button>
          <button class="btn btn-danger btn-del">Excluir</button>
        </div>
      </td>
    `;

    el.tbBody.appendChild(tr);
  }

  refreshBulk();
}

function refreshBulk() {
  el.btnSaveSelected.disabled = state.selected.size === 0;
  el.chkAll.checked = state.rows.length > 0 && state.selected.size === state.rows.length;
}

async function saveRow(tr) {
  const id = tr.dataset.id;
  const min = tr.querySelector('.inp-min')?.value;
  const max = tr.querySelector('.inp-max')?.value;
  const v = validateMinMax(min, max);

  if (!v.ok) return toast(v.error);

  await http('PUT', `${API}/${id}`, {
    stock_min: v.smin,
    stock_max: v.smax,
  });

  toast(`Registro #${id} salvo.`);
  await load();
}

async function saveSelected() {
  const trs = [...el.tbBody.querySelectorAll('tr')].filter((tr) =>
    state.selected.has(String(tr.dataset.id))
  );

  for (const tr of trs) await saveRow(tr);
}

async function adjustRow(tr) {
  const id = tr.dataset.id;
  const value = prompt(`Ajuste incremental para #${id}`, '0');
  if (value === null) return;

  const delta = Number(String(value).replace(',', '.'));
  if (!Number.isFinite(delta)) return toast('Delta inválido.');

  await http('PATCH', `${API}/${id}/adjust`, { delta });
  toast(`Estoque ajustado.`);
  await load();
}

async function deleteRow(tr) {
  const id = tr.dataset.id;
  if (!confirm(`Excluir registro #${id}?`)) return;

  await http('DELETE', `${API}/${id}`);
  toast('Registro excluído.');
  await load();
}

async function createNew() {
  const qty = num(String(el.nQty.value).replace(',', '.'));
  const v = validateMinMax(el.nMin.value, el.nMax.value);

  if (!v.ok) return toast(v.error);

  await http('POST', API, {
    stock_qty: qty,
    stock_min: v.smin,
    stock_max: v.smax,
  });

  closeNewModal();
  toast('Registro criado.');
  await load();
}

function openNewModal() {
  el.nQty.value = '0';
  el.nMin.value = '0';
  el.nMax.value = '0';
  el.modalNew.classList.add('show');
  el.modalNew.setAttribute('aria-hidden', 'false');
}

function closeNewModal() {
  el.modalNew.classList.remove('show');
  el.modalNew.setAttribute('aria-hidden', 'true');
}

function downloadPurchaseSuggestionPdf() {
  const url = new URL(`${API}/purchase-suggestion/pdf`, location.origin);

  const q = el.fProductSearch?.value?.trim();
  const group = el.fGroup?.value;
  const subgroup = el.fSubgroup?.value;
  const manufacturer = el.fManufacturer?.value;

  if (q) url.searchParams.set('q', q);
  if (group) url.searchParams.set('group_id', group);
  if (subgroup) url.searchParams.set('subgroup_id', subgroup);
  if (manufacturer) url.searchParams.set('manufacturer_id', manufacturer);

  window.open(url.toString(), '_blank');
}

async function loadSelect(urls, select) {
  if (!select) return;

  const list = Array.isArray(urls) ? urls : [urls];

  for (const url of list) {
    try {
      const data = await http('GET', url);

      const rows =
        Array.isArray(data?.rows) ? data.rows :
          Array.isArray(data?.data) ? data.data :
            Array.isArray(data?.items) ? data.items :
              Array.isArray(data) ? data :
                [];

      if (!rows.length) continue;

      for (const r of rows) {
        const id =
          r.product_group_id ??
          r.product_subgroup_id ??
          r.product_manufacturer_id ??
          r.manufacturer_id ??
          r.id;

        const label =
          r.name ??
          r.nome ??
          r.description ??
          r.descricao ??
          id;

        if (!id) continue;

        const opt = document.createElement('option');
        opt.value = id;
        opt.textContent = label;
        select.appendChild(opt);
      }

      console.log('[productsStock][select loaded]', url, rows.length);
      return;
    } catch (err) {
      console.warn('[productsStock][select fallback fail]', url, err.message);
    }
  }
}

async function loadFilterOptions() {
  try {
    const data = await http('GET', `${API}/filter-options`);

    fillSelect(el.fGroup, data.groups || []);
    fillSelect(el.fSubgroup, data.subgroups || []);
    fillSelect(el.fManufacturer, data.manufacturers || []);
  } catch (err) {
    console.error('[productsStock][filter-options]', err);
  }
}

function fillSelect(select, rows = []) {
  if (!select) return;

  select.innerHTML = `<option value="">Todos</option>`;

  for (const r of rows) {
    const opt = document.createElement('option');
    opt.value = r.id;
    opt.textContent = r.name || r.description || r.id;
    select.appendChild(opt);
  }
}

el.btnApply?.addEventListener('click', () => {
  state.offset = 0;
  load();
});

el.btnClear?.addEventListener('click', () => {
  el.fProductSearch.value = '';
  el.fSearch.value = '';
  el.fStatus.value = '';
  el.fOrder.value = 'id_desc';
  el.fGroup.value = '';
  el.fSubgroup.value = '';
  el.fManufacturer.value = '';
  state.offset = 0;
  load();
});

el.fProductSearch?.addEventListener('input', () => {
  clearTimeout(state.searchTimer);
  state.searchTimer = setTimeout(() => {
    state.offset = 0;
    load();
  }, 450);
});

[el.fStatus, el.fOrder, el.fGroup, el.fSubgroup, el.fManufacturer].forEach((input) => {
  input?.addEventListener('change', () => {
    state.offset = 0;
    load();
  });
});

el.fPageSize?.addEventListener('change', () => {
  state.limit = Math.max(1, Math.min(300, Number(el.fPageSize.value) || 20));
  state.offset = 0;
  load();
});

el.btnPrev?.addEventListener('click', () => {
  state.offset = Math.max(0, state.offset - state.limit);
  load();
});

el.btnNext?.addEventListener('click', () => {
  state.offset += state.limit;
  load();
});

el.tbBody?.addEventListener('click', async (ev) => {
  const btn = ev.target.closest('button');
  if (!btn) return;

  const tr = ev.target.closest('tr');
  if (!tr) return;

  try {
    if (btn.classList.contains('btn-save')) await saveRow(tr);
    if (btn.classList.contains('btn-adjust')) await adjustRow(tr);
    if (btn.classList.contains('btn-del')) await deleteRow(tr);
  } catch (err) {
    toast(err.message || err);
  }
});

el.tbBody?.addEventListener('change', (ev) => {
  const chk = ev.target.closest('.row-check');
  if (!chk) return;

  const tr = ev.target.closest('tr');
  const id = String(tr?.dataset?.id || '');

  if (chk.checked) state.selected.add(id);
  else state.selected.delete(id);

  refreshBulk();
});

el.chkAll?.addEventListener('change', () => {
  state.selected.clear();

  if (el.chkAll.checked) {
    for (const r of state.rows) state.selected.add(String(r.product_stock_id));
  }

  el.tbBody.querySelectorAll('.row-check').forEach((chk) => {
    chk.checked = el.chkAll.checked;
  });

  refreshBulk();
});

el.btnSaveSelected?.addEventListener('click', async () => {
  try {
    await saveSelected();
  } catch (err) {
    toast(err.message || err);
  }
});

el.btnEnsure?.addEventListener('click', async () => {
  try {
    await http('POST', `${API}/ensure`);
    toast('Ensure OK.');
    await load();
  } catch (err) {
    toast(err.message || err);
  }
});

el.btnPurchaseSuggestionPdf?.addEventListener('click', downloadPurchaseSuggestionPdf);

el.btnNew?.addEventListener('click', openNewModal);
el.btnCloseNew?.addEventListener('click', closeNewModal);
el.btnCancelNew?.addEventListener('click', closeNewModal);
el.btnCreateNew?.addEventListener('click', () => {
  createNew().catch((err) => toast(err.message || err));
});

el.modalNew?.addEventListener('click', (ev) => {
  if (ev.target === el.modalNew) closeNewModal();
});

await loadFilterOptions();
await load();