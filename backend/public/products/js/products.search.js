// ╔══════════════════════════════════════════════════════════════════════╗
// ║ products.search.js — Busca, limite e filtros da listagem             ║
// ║ PRODNEX ERP | ESM                                                    ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { loadProductsFilterOptions } from './products.api.js';
import { state } from './products.state.js';
import { debounce, fmtInt } from './products.utils.js';
import { getLimitSelect, getSearchButton, getSearchInput } from './products.dom.js';
import { loadProducts } from './products.render.js';

function getFilterEl(id) {
  return document.getElementById(id);
}

export function readFiltersFromDom() {
  state.filters.status = getFilterEl('filterStatus')?.value || '';
  state.filters.manufacturer_id = getFilterEl('filterManufacturer')?.value || '';
  state.filters.supplier_id = getFilterEl('filterSupplier')?.value || '';
  state.filters.group_id = getFilterEl('filterGroup')?.value || '';
  state.filters.subgroup_id = getFilterEl('filterSubgroup')?.value || '';
}

export function bindSearch() {
  const txt = getSearchInput();
  if (!txt) return;

  const run = debounce(() => {
    state.q = (txt.value || '').trim();
    readFiltersFromDom();
    state.page = 1;
    loadProducts();
  }, 350);

  txt.addEventListener('input', run);

  const btnBuscar = getSearchButton();
  if (btnBuscar) {
    btnBuscar.addEventListener('click', () => {
      state.q = (txt.value || '').trim();
      readFiltersFromDom();
      state.page = 1;
      loadProducts();
    });
  }
}

export function bindLimit() {
  const sel = getLimitSelect();
  if (!sel) return;

  sel.addEventListener('change', () => {
    state.limit = fmtInt(sel.value, 20);
    state.page = 1;
    loadProducts();
  });
}

export function bindFilters() {
  const ids = [
    'filterStatus',
    'filterManufacturer',
    'filterSupplier',
    'filterGroup',
    'filterSubgroup',
  ];

  ids.forEach((id) => {
    const el = getFilterEl(id);
    if (!el) return;

    el.addEventListener('change', async () => {
      if (id === 'filterGroup') {
        await reloadSubgroupsByGroup(el.value);
      }

      readFiltersFromDom();
      state.page = 1;
      loadProducts();
    });
  });

  const btnClear = document.getElementById('btnClearFilters');
  if (btnClear) {
    btnClear.addEventListener('click', async () => {
      ids.forEach((id) => {
        const el = getFilterEl(id);
        if (el) el.value = '';
      });

      await reloadSubgroupsByGroup('');

      readFiltersFromDom();
      state.page = 1;
      loadProducts();
    });
  }
}

/* ──────────────────────────────────────────────────────────────
   FILTER OPTIONS
────────────────────────────────────────────────────────────── */

function getOptionId(row) {
  return (
    row.id ??
    row.product_manufacturer_id ??
    row.manufacturer_id ??
    row.product_supplier_id ??
    row.supplier_id ??
    row.product_group_id ??
    row.group_id ??
    row.product_subgroup_id ??
    row.subgroup_id ??
    ''
  );
}

function getOptionName(row) {
  return (
    row.name ??
    row.nome ??
    row.description ??
    row.descricao ??
    ''
  );
}

function fillSelect(id, rows, firstLabel) {

  const sel = document.getElementById(id);

  if (!sel) return;

  sel.innerHTML = `<option value="">${firstLabel}</option>`;

  rows.forEach((row) => {

    const value = getOptionId(row);
    const label = getOptionName(row);

    if (!value || !label) {
      return;
    }

    const opt = document.createElement('option');

    opt.value = String(value);
    opt.textContent = String(label);

    sel.appendChild(opt);
  });
}

export async function loadFilterOptions() {

  try {

    console.log('[products] carregando filtros...');

    const options = await loadProductsFilterOptions();

    console.log('[products] filtros carregados:', options);

    fillSelect(
      'filterManufacturer',
      options.manufacturers || [],
      'Todos fabricantes'
    );

    fillSelect(
      'filterSupplier',
      options.suppliers || [],
      'Todos fornecedores'
    );

    fillSelect(
      'filterGroup',
      options.groups || [],
      'Todos grupos'
    );

    fillSelect(
      'filterSubgroup',
      options.subgroups || [],
      'Todos subgrupos'
    );

  } catch (e) {

    console.error(
      '[products][filters] erro ao carregar filtros:',
      e
    );
  }
}

/* ──────────────────────────────────────────────────────────────
   RELOAD SUBGROUPS BY GROUP
────────────────────────────────────────────────────────────── */
async function reloadSubgroupsByGroup(groupId) {

  try {

    const sel = document.getElementById('filterSubgroup');

    if (!sel) return;

    /* 🔄 RESET */
    sel.innerHTML =
      '<option value="">Todos subgrupos</option>';

    if (!groupId) {
      return;
    }

    const url =
      `/api/products-subgroups?group_id=` +
      encodeURIComponent(groupId);

    const res = await fetch(url);

    const json = await res.json();

    const rows =
      json?.rows ??
      json?.data?.rows ??
      [];

    rows.forEach((row) => {

      const id =
        row.product_subgroup_id ??
        row.subgroup_id ??
        row.id;

      const name =
        row.name ??
        row.nome ??
        row.description;

      if (!id || !name) return;

      const opt = document.createElement('option');

      opt.value = String(id);
      opt.textContent = String(name);

      sel.appendChild(opt);
    });

  } catch (err) {

    console.error(
      '[products] erro ao recarregar subgrupos:',
      err
    );
  }
}