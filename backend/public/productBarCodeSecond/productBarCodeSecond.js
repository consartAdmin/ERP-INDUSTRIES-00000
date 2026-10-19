// ╔══════════════════════════════════════════════════════════════════════╗
// ║ productBarCodeSecond.js — UI & integrações front                     ║
// ║ PRODNEX ERP — Códigos de barras secundários                          ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { showCenterModal } from '/public/includes/js/centerAlertModal.js';
// 🔁 AGORA importamos a função nomeada openProductsModalSearch
import { openProductsModalSearch } from '/public/modalsSearch/productsModalSearch.js';
import openProductsUnitsModalSearch from '/public/modalsSearch/productsUnitsModalSearch.js';

// ---------------------------------------------------------------------
// API BASE — usa getApiBase() do backend/config/apiBase.js
// ---------------------------------------------------------------------
const ROOT_API =
  (typeof window !== 'undefined' &&
    (typeof window.getApiBase === 'function'
      ? window.getApiBase()
      : (window.apiBase || window.API_BASE))) ||
  'http://localhost:8080';

const API_BASE = `${ROOT_API}/api/product-barcode-second`;

// ---------------------------------------------------------------------
// DOM helpers
// ---------------------------------------------------------------------
const $  = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const elFilterForm         = $('#pbsFilterForm');
const elFilterProductCode  = $('#filterProductCode');
const elFilterSecondBar    = $('#filterSecondBarCode');
const elBtnClearFilters    = $('#btnPbsClearFilters');

const elCreateForm         = $('#pbsCreateForm');
const elCreateProductCode  = $('#createProductCode');
const elCreateProductIntId = $('#createProductInternalId');
const elCreateProductUnit  = $('#createProductUnitId');
const elCreateSecondBar    = $('#createSecondBarCode');
const elCreateCodeType     = $('#createCodeType');
const elBtnOpenProdModal   = $('#btnPbsOpenProductsModal');
const elBtnOpenUnitModal   = $('#btnPbsOpenUnitsModal'); // 🔍 nova lupa de unidade

const elTableBody          = $('#pbsTableBody');
const elTotalLabel         = $('#pbsTotalLabel');

let currentPage  = 1;
let currentLimit = 20;

// ---------------------------------------------------------------------
// Utils
// ---------------------------------------------------------------------
function buildQuery(params = {}) {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') sp.append(k, v);
  });
  return sp.toString();
}

async function httpJson(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    let msg = `Erro HTTP ${res.status}`;
    try {
      const data = await res.json();
      msg = data?.error || msg;
    } catch (_) {}
    throw new Error(msg);
  }
  return res.json();
}

// ---------------------------------------------------------------------
// Listagem
// ---------------------------------------------------------------------
async function loadTable(page = 1) {
  currentPage = page;

  const limit = currentLimit;
  const offset = (page - 1) * limit;

  const params = {
    product_code: elFilterProductCode.value.trim() || undefined,
    q: elFilterSecondBar.value.trim() || undefined,
    limit,
    offset,
  };

  const qs = buildQuery(params);
  const { rows, total } = await httpJson(`${API_BASE}?${qs}`);

  renderTable(rows);
  elTotalLabel.textContent = `${total} registro(s)`;
}

function renderTable(rows) {
  elTableBody.innerHTML = '';

  if (!rows || !rows.length) {
    const tr = document.createElement('tr');
    tr.className = 'pbs-table-empty-row';
    tr.innerHTML = `<td colspan="7">Nenhum registro encontrado.</td>`;
    elTableBody.appendChild(tr);
    return;
  }

  for (const row of rows) {
    const tr = document.createElement('tr');

    tr.innerHTML = `
      <td>${row.id}</td>
      <td>${row.product_code || ''}</td>
      <td title="${(row.product_description || '').replaceAll('"','&quot;')}">
        ${row.product_description || ''}
      </td>
      <td>${row.product_unit_id ?? ''}</td>
      <td>${row.second_bar_code || ''}</td>
      <td>${row.code_type || ''}</td>
      <td>
        <button
          type="button"
          class="btn btn-toolbar btn-sm pbs-btn-delete"
          data-id="${row.id}"
        >
          Remover
        </button>
      </td>
    `;

    elTableBody.appendChild(tr);
  }
}

// ---------------------------------------------------------------------
// Criação
// ---------------------------------------------------------------------
async function handleCreateSubmit(ev) {
  ev.preventDefault();

  const product_code    = elCreateProductCode.value.trim();
  const product_unit_id = elCreateProductUnit.value.trim();
  const second_bar_code = elCreateSecondBar.value.trim();
  const code_type       = elCreateCodeType.value;

  if (!product_code || !product_unit_id || !second_bar_code) {
    showCenterModal({
      type: 'warning',
      title: 'Campos obrigatórios',
      message:
        'Informe o produto, a unidade vinculada e o segundo código de barras.',
      timeoutMs: 3500,
    });
    return;
  }

  try {
    await httpJson(API_BASE, {
      method: 'POST',
      body: JSON.stringify({
        product_code,
        product_unit_id: Number(product_unit_id),
        second_bar_code,
        code_type,
      }),
    });

    showCenterModal({
      type: 'success',
      title: 'Código cadastrado',
      message: 'Novo código de barras secundário criado com sucesso.',
      timeoutMs: 2500,
    });

    elCreateSecondBar.value = '';
    // mantém produto e unidade para próxima inserção
    await loadTable(currentPage);
  } catch (err) {
    console.error(err);
    showCenterModal({
      type: 'error',
      title: 'Erro ao salvar',
      message: err.message || 'Não foi possível criar o registro.',
      timeoutMs: 4000,
    });
  }
}

// ---------------------------------------------------------------------
// Remoção
// ---------------------------------------------------------------------
async function handleDeleteClick(ev) {
  const btn = ev.target.closest('.pbs-btn-delete');
  if (!btn) return;

  const id = btn.dataset.id;
  if (!id) return;

  const confirma = window.confirm('Deseja realmente remover este código secundário?');
  if (!confirma) return;

  try {
    await httpJson(`${API_BASE}/${id}`, { method: 'DELETE' });
    await loadTable(currentPage);
  } catch (err) {
    console.error(err);
    showCenterModal({
      type: 'error',
      title: 'Erro ao remover',
      message: err.message || 'Não foi possível remover o registro.',
      timeoutMs: 4000,
    });
  }
}

// ---------------------------------------------------------------------
// Filtros
// ---------------------------------------------------------------------
function handleFiltersSubmit(ev) {
  ev.preventDefault();
  loadTable(1).catch(console.error);
}

function handleClearFilters() {
  elFilterProductCode.value = '';
  elFilterSecondBar.value = '';
  loadTable(1).catch(console.error);
}

// ---------------------------------------------------------------------
// 🔍 Modal de produtos (usando openProductsModalSearch + onPick)
// ---------------------------------------------------------------------
function openProductSearchModal() {
  try {
    openProductsModalSearch({
      apiBase: ROOT_API,
      onPick(product) {
        console.log('[productBarCodeSecond] produto escolhido no modal:', product);

        const code =
          product?.product_code ||
          product?.sku ||
          product?.code ||
          '';

        const name =
          product?.description ||
          product?.nome ||
          product?.name ||
          '';

        if (!code) {
          console.warn('[productBarCodeSecond] produto sem código identificável:', product);
          return;
        }

        // preenche o campo de produto com o código
        elCreateProductCode.value = code;

        // se quiser guardar o ID interno
        if (elCreateProductIntId) {
          elCreateProductIntId.value = product?.product_id || product?.id || '';
        }

        // foco na unidade
        elCreateProductUnit.focus();
      },
    });
  } catch (err) {
    console.error('[productBarCodeSecond] erro ao abrir modal de produtos:', err);
    showCenterModal({
      type: 'error',
      title: 'Erro ao abrir busca de produtos',
      message:
        'Não foi possível abrir o modal de produtos. Verifique o arquivo productsModalSearch.js.',
      timeoutMs: 4000,
    });
  }
}

// ---------------------------------------------------------------------
// 🔍 Modal de unidades (productsUnits)
// ---------------------------------------------------------------------
async function openUnitsSearchModal() {
  try {
    const productCode = elCreateProductCode.value.trim();
    const productId   = elCreateProductIntId?.value?.trim(); // 👈 ID interno

    if (!productCode || !productId) {
      showCenterModal({
        type: 'warning',
        title: 'Informe o produto primeiro',
        message: 'Selecione o produto antes de buscar a unidade vinculada.',
        timeoutMs: 3000,
      });
      return;
    }

    await openProductsUnitsModalSearch({
      productId,          // 👈 usa o ID interno para filtrar
      productCode,        // só para exibir no modal
      onSelect(unitRow) {
        console.log('[productBarCodeSecond] unidade escolhida:', unitRow);

        // tenta pegar o ID da unidade em vários campos possíveis
        const unitId =
          unitRow.product_unit_id ??
          unitRow.id ??
          unitRow.unit_id ??
          '';

        if (!unitId) return;

        elCreateProductUnit.value = unitId;
      },
    });
  } catch (err) {
    console.error('[productBarCodeSecond] erro ao abrir modal de unidades:', err);
    showCenterModal({
      type: 'error',
      title: 'Erro ao abrir busca de unidades',
      message:
        'Não foi possível abrir o modal de unidades. Verifique o arquivo productsUnitsModalSearch.js.',
      timeoutMs: 4000,
    });
  }
}

// ---------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------
function initEvents() {
  elFilterForm?.addEventListener('submit', handleFiltersSubmit);
  elBtnClearFilters?.addEventListener('click', handleClearFilters);

  elCreateForm?.addEventListener('submit', handleCreateSubmit);
  elTableBody?.addEventListener('click', handleDeleteClick);

  // Produto
  elBtnOpenProdModal?.addEventListener('click', openProductSearchModal);
  elCreateProductCode?.addEventListener('click', openProductSearchModal);

  // Unidade vinculada (nova lupa + clique no input)
  elBtnOpenUnitModal?.addEventListener('click', openUnitsSearchModal);
  elCreateProductUnit?.addEventListener('click', openUnitsSearchModal);
}

async function init() {
  initEvents();
  try {
    await loadTable(1);
  } catch (err) {
    console.error(err);
  }
}

document.addEventListener('DOMContentLoaded', init);
