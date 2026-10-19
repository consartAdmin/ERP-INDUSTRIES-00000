// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: manufacturesOrders.js                                         ║
// ║ MODULE: Manufactures Orders                                         ║
// ║ DESCRIPTION: Pedidos para Fabricantes                               ║
// ║ PRODNEX ERP | ESM                                                   ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import {
  openManufacturesModalSearch,
} from '/public/modalsSearch/manufacturesModalSearch.js';

import {
  createManufacturesOrderModal,
  openManufacturesOrderModal,
  closeManufacturesOrderModal,
} from './manufacturesOrderModal.js';

const API_BASE = '/api/manufactures-orders';

const PRODUCTS_ROUTES = [
  '/api/products/search',
  '/api/products',
  '/api/productsStock/search',
];

const PRODUCTS_BY_MANUFACTURE_ROUTES = [
  '/api/products-manufactures/products',
];

let orders = [];
let currentOrder = null;
let currentItems = [];
let selectedProduct = null;
let selectedManufacture = null;

let els = {};

document.addEventListener('DOMContentLoaded', async () => {
  loadCss('/public/modalsSearch/manufacturesModalSearch.css');

  createManufacturesOrderModal();
  refreshElements();
  bindEvents();

  await loadOrders();
});

function refreshElements() {
  els = {
    ordersTableBody: document.getElementById('ordersTableBody'),

    searchInput: document.getElementById('searchInput'),
    statusFilter: document.getElementById('statusFilter'),
    manufacturerFilter: document.getElementById('manufacturerFilter'),

    btnNovoPedido: document.getElementById('btnNovoPedido'),
    btnAtualizar: document.getElementById('btnAtualizar'),
    btnExportarExcel: document.getElementById('btnExportarExcel'),
    btnExportarPdf: document.getElementById('btnExportarPdf'),

    orderModal: document.getElementById('orderModal'),
    btnCloseModal: document.getElementById('btnCloseModal'),
    btnCancelModal: document.getElementById('btnCancelModal'),
    btnSaveOrder: document.getElementById('btnSaveOrder'),

    orderNumber: document.getElementById('orderNumber'),
    orderStatus: document.getElementById('orderStatus'),
    manufacturerName: document.getElementById('manufacturerName'),
    manufacturerImportFilter: document.getElementById('manufacturerImportFilter'),
    btnSearchManufacturer: document.getElementById('btnSearchManufacturer'),
    btnApplyManufacturerFilter: document.getElementById('btnApplyManufacturerFilter'),
    orderNotes: document.getElementById('orderNotes'),

    productSearch: document.getElementById('productSearch'),
    productAutocomplete: document.getElementById('productAutocomplete'),
    productQuantity: document.getElementById('productQuantity'),
    productCost: document.getElementById('productCost'),
    btnAddProduct: document.getElementById('btnAddProduct'),

    itemsTableBody: document.getElementById('itemsTableBody'),
    modalTotalCost: document.getElementById('modalTotalCost'),
    loadingOverlay: document.getElementById('loadingOverlay'),

    kpiTotalPedidos: document.getElementById('kpiTotalPedidos'),
    kpiTotalCustos: document.getElementById('kpiTotalCustos'),
    kpiTotalItens: document.getElementById('kpiTotalItens'),
    kpiPedidosAbertos: document.getElementById('kpiPedidosAbertos'),
  };
}

function loadCss(href) {
  if ([...document.querySelectorAll('link')].some(link => link.href.includes(href))) return;

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
}

function bindEvents() {
  els.btnNovoPedido?.addEventListener('click', openNewOrder);
  els.btnAtualizar?.addEventListener('click', loadOrders);

  els.searchInput?.addEventListener('input', debounce(loadOrders, 400));
  els.statusFilter?.addEventListener('change', loadOrders);
  els.manufacturerFilter?.addEventListener('input', debounce(loadOrders, 400));

  els.btnCloseModal?.addEventListener('click', closeModal);
  els.btnCancelModal?.addEventListener('click', closeModal);
  els.btnSaveOrder?.addEventListener('click', saveOrder);

  els.btnAddProduct?.addEventListener('click', addProductToOrder);
  els.productSearch?.addEventListener('input', debounce(searchProducts, 300));

  els.btnExportarExcel?.addEventListener('click', exportExcel);
  els.btnExportarPdf?.addEventListener('click', exportPdf);

  els.btnSearchManufacturer?.addEventListener('click', openManufacturerModal);

  els.btnApplyManufacturerFilter?.addEventListener('click', async () => {
    if (!selectedManufacture) {
      toast('Selecione um fabricante primeiro.', 'warning');
      return;
    }

    currentItems = [];
    await importProductsFromManufacturer(selectedManufacture);
  });
}

function debounce(fn, delay = 300) {
  let timer;

  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

function money(value) {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function numberBR(value, decimals = 3) {
  return Number(value || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function formatDate(value) {
  if (!value) return '-';

  try {
    return new Date(value).toLocaleString('pt-BR');
  } catch {
    return value;
  }
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function showLoading(show = true) {
  els.loadingOverlay?.classList.toggle('hidden', !show);
}

function toast(message, type = 'info') {
  console.log(`[${type}]`, message);

  if (window.showToast) {
    window.showToast(message, type);
    return;
  }

  alert(message);
}

function getStatusBadge(status = '') {
  const map = {
    OPEN: 'badge badge-open',
    IN_PROGRESS: 'badge badge-progress',
    FINISHED: 'badge badge-finished',
    CANCELLED: 'badge badge-cancelled',
  };

  const label = {
    OPEN: 'ABERTO',
    IN_PROGRESS: 'EM PRODUÇÃO',
    FINISHED: 'FINALIZADO',
    CANCELLED: 'CANCELADO',
  };

  return `<span class="${map[status] || 'badge'}">${label[status] || status}</span>`;
}

async function api(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(json.error || json.message || 'Erro na requisição.');
  }

  return json;
}

function extractRows(json) {
  if (Array.isArray(json)) return json;
  if (Array.isArray(json.rows)) return json.rows;
  if (Array.isArray(json.data)) return json.data;
  if (Array.isArray(json.items)) return json.items;
  if (Array.isArray(json.products)) return json.products;
  return [];
}

function normalizeOrdersResponse(response) {
  if (Array.isArray(response)) return response;

  if (Array.isArray(response?.rows))
    return response.rows;

  if (Array.isArray(response?.data))
    return response.data;

  if (Array.isArray(response?.data?.rows))
    return response.data.rows;

  if (Array.isArray(response?.result?.rows))
    return response.result.rows;

  return [];
}

async function loadOrders() {
  try {
    showLoading(true);

    const params = new URLSearchParams();

    params.set('pageSize', '100');

    if (els.searchInput?.value) params.set('search', els.searchInput.value);
    if (els.statusFilter?.value) params.set('status', els.statusFilter.value);

    const response = await api(`${API_BASE}?${params.toString()}`);

    orders = extractRows(response);

    renderOrders();
    renderKpis();
  } catch (error) {
    console.error('[manufacturesOrders][loadOrders]', error);
    toast(error.message, 'error');
  } finally {
    showLoading(false);
  }
}

function renderOrders() {
  const manufacturerSearch = String(els.manufacturerFilter?.value || '').toLowerCase();

  let rows = [...orders];

  if (manufacturerSearch) {
    rows = rows.filter(order =>
      String(order.manufacturer_name || '')
        .toLowerCase()
        .includes(manufacturerSearch),
    );
  }

  if (!els.ordersTableBody) return;

  els.ordersTableBody.innerHTML = '';

  if (!rows.length) {
    els.ordersTableBody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align:center;padding:40px;">
          Nenhum pedido encontrado.
        </td>
      </tr>
    `;
    return;
  }

  for (const order of rows) {
    const id = order.manufacture_order_id || order.id || order.order_id;

    const tr = document.createElement('tr');

    tr.innerHTML = `
      <td><strong>${escapeHtml(order.order_number || '-')}</strong></td>
      <td>${escapeHtml(order.manufacturer_name || '-')}</td>
      <td>${getStatusBadge(order.status)}</td>
      <td>${order.items_count || 0}</td>
      <td><strong>${money(order.total_cost)}</strong></td>
      <td>${formatDate(order.created_at)}</td>
      <td>
        <div class="table-actions-inline">
        <button class="btn btn-toolbar btn-sm" onclick="window.editManufactureOrder(${id})" title="Editar">
         <i class="fa-solid fa-pen"></i>
        </button>

        <button class="btn btn-toolbar btn-sm" onclick="window.printManufactureOrderManufacturer(${id})" title="PDF Fabricante">
          <i class="fa-solid fa-paper-plane"></i>
        </button>

        <button class="btn btn-toolbar btn-sm" onclick="window.excelManufactureOrder(${id})" title="Excel">
         <i class="fa-solid fa-file-excel"></i>
        </button>

        <button class="btn btn-toolbar btn-sm btn-danger-local" onclick="window.deleteManufactureOrder(${id})" title="Excluir">
         <i class="fa-solid fa-trash"></i>
        </button>
        </div>
        </td>
        `;

    els.ordersTableBody.appendChild(tr);
  }
}

function renderKpis() {
  const totalPedidos = orders.length;
  const totalCustos = orders.reduce((sum, item) => sum + Number(item.total_cost || 0), 0);
  const totalItens = orders.reduce((sum, item) => sum + Number(item.items_count || 0), 0);
  const pedidosAbertos = orders.filter(item => item.status === 'OPEN').length;

  if (els.kpiTotalPedidos) els.kpiTotalPedidos.textContent = totalPedidos;
  if (els.kpiTotalCustos) els.kpiTotalCustos.textContent = money(totalCustos);
  if (els.kpiTotalItens) els.kpiTotalItens.textContent = totalItens;
  if (els.kpiPedidosAbertos) els.kpiPedidosAbertos.textContent = pedidosAbertos;
}

function openModal() {
  openManufacturesOrderModal();
}

function closeModal() {
  closeManufacturesOrderModal();
}

function openNewOrder() {
  currentOrder = null;
  currentItems = [];
  selectedProduct = null;
  selectedManufacture = null;

  if (els.orderNumber) els.orderNumber.value = '';
  if (els.orderStatus) els.orderStatus.value = 'OPEN';
  if (els.manufacturerName) els.manufacturerName.value = '';
  if (els.orderNotes) els.orderNotes.value = '';
  if (els.manufacturerImportFilter) els.manufacturerImportFilter.value = 'all';

  if (els.productSearch) els.productSearch.value = '';
  if (els.productQuantity) els.productQuantity.value = 1;
  if (els.productCost) els.productCost.value = '';

  renderItems();
  openModal();
}

function openManufacturerModal() {
  openManufacturesModalSearch(async manufacture => {
    if (!manufacture) return;

    selectedManufacture = manufacture;

    if (els.manufacturerName) {
      els.manufacturerName.value = manufacture.name || manufacture.manufacturer_name || '';
    }

    await importProductsFromManufacturer(manufacture);
  });
}

async function importProductsFromManufacturer(manufacture) {
  const manufactureId = manufacture?.id || manufacture?.manufacturer_id || manufacture?.raw?.id || '';
  const manufactureName = manufacture?.name || manufacture?.manufacturer_name || '';
  const filter = els.manufacturerImportFilter?.value || 'all';

  if (!manufactureId && !manufactureName) return;

  try {
    showLoading(true);

    let products = [];

    for (const route of PRODUCTS_BY_MANUFACTURE_ROUTES) {
      try {
        const params = new URLSearchParams();

        if (manufactureId) {
          params.set('manufacture_id', manufactureId);
          params.set('manufacturer_id', manufactureId);
          params.set('id', manufactureId);
        }

        if (manufactureName) {
          params.set('manufacture_name', manufactureName);
          params.set('manufacturer_name', manufactureName);
          params.set('name', manufactureName);
          params.set('q', manufactureName);
        }

        params.set('filter', filter);
        params.set('limit', '500');

        const response = await api(`${route}?${params.toString()}`);
        products = extractRows(response);

        if (products.length) break;
      } catch (error) {
        console.warn('[manufacturesOrders][importProductsFromManufacturer][route fail]', route, error.message);
      }
    }

    if (!products.length) {
      toast('Nenhum produto encontrado para o filtro selecionado.', 'warning');
      return;
    }

    const alreadyAdded = new Set(
      currentItems.map(item =>
        String(item.product_code || item.sku || item.product_stock_id || ''),
      ),
    );

    let added = 0;

    for (const product of products) {
      const productKey = String(
        product.product_code ||
        product.sku ||
        product.product_stock_id ||
        '',
      );

      if (!productKey || alreadyAdded.has(productKey)) continue;

      const stockQty = Number(product.stock_qty || 0);
      const stockMin = Number(product.stock_min || 0);
      const stockMax = Number(product.stock_max || 0);

      const suggestedQty =
        stockMax > stockQty
          ? Math.max(stockMax - stockQty, 1)
          : 1;

      currentItems.push({
        product_stock_id: product.product_stock_id || null,
        product_code: product.product_code || product.sku || null,
        sku: product.sku || product.product_code || null,
        description: product.description || product.name || product.product_name || '-',
        unit: product.unit || product.unidade || product.um || 'UN',
        quantity: suggestedQty,
        cost_price: Number(product.cost_price || product.preco_custo || product.cost || 0),
        stock_qty: stockQty,
        stock_min: stockMin,
        stock_max: stockMax,
      });

      alreadyAdded.add(productKey);
      added++;
    }

    renderItems();

    toast(`${added} produto(s) importado(s) pelo filtro selecionado.`, 'success');
  } catch (error) {
    console.error('[manufacturesOrders][importProductsFromManufacturer]', error);
    toast(error.message, 'error');
  } finally {
    showLoading(false);
  }
}

async function searchProducts() {
  const query = String(els.productSearch?.value || '').trim();

  if (query.length < 2) {
    els.productAutocomplete?.classList.add('hidden');
    return;
  }

  try {
    let products = [];

    for (const route of PRODUCTS_ROUTES) {
      try {
        const url = `${route}?q=${encodeURIComponent(query)}&limit=10`;
        const response = await api(url);

        products = extractRows(response);

        if (products.length) break;
      } catch (err) {
        console.warn('[manufacturesOrders][searchProducts][route fail]', route, err.message);
      }
    }

    renderProductsAutocomplete(products);
  } catch (error) {
    console.error('[manufacturesOrders][searchProducts]', error);
  }
}

function renderProductsAutocomplete(products = []) {
  if (!els.productAutocomplete) return;

  els.productAutocomplete.innerHTML = '';

  if (!products.length) {
    els.productAutocomplete.classList.add('hidden');
    return;
  }

  for (const product of products) {
    const item = document.createElement('div');

    item.className = 'autocomplete-item';

    item.innerHTML = `
      <strong>${escapeHtml(product.sku || product.product_code || '-')}</strong>
      <span>${escapeHtml(product.description || product.name || product.product_name || '-')}</span>
    `;

    item.addEventListener('click', () => {
      selectedProduct = product;

      if (els.productSearch) {
        els.productSearch.value =
          product.description ||
          product.name ||
          product.product_name ||
          '';
      }

      if (els.productCost) {
        els.productCost.value = Number(
          product.cost_price ||
          product.preco_custo ||
          product.cost ||
          0,
        ).toFixed(2);
      }

      els.productAutocomplete.classList.add('hidden');
    });

    els.productAutocomplete.appendChild(item);
  }

  els.productAutocomplete.classList.remove('hidden');
}

function addProductToOrder() {
  if (!selectedProduct) {
    toast('Selecione um produto.', 'warning');
    return;
  }

  const quantity = Number(els.productQuantity?.value || 0);
  const cost = Number(els.productCost?.value || 0);

  if (!quantity || quantity <= 0) {
    toast('Quantidade inválida.', 'warning');
    return;
  }

  currentItems.push({
    product_stock_id: selectedProduct.product_stock_id || null,
    product_code: selectedProduct.product_code || selectedProduct.sku || null,
    sku: selectedProduct.sku || selectedProduct.product_code || null,
    description:
      selectedProduct.description ||
      selectedProduct.name ||
      selectedProduct.product_name ||
      '-',
    unit:
      selectedProduct.unit ||
      selectedProduct.unidade ||
      selectedProduct.um ||
      'UN',
    quantity,
    cost_price: cost,
    stock_qty: Number(selectedProduct.stock_qty || 0),
    stock_min: Number(selectedProduct.stock_min || 0),
    stock_max: Number(selectedProduct.stock_max || 0),
  });

  selectedProduct = null;

  if (els.productSearch) els.productSearch.value = '';
  if (els.productQuantity) els.productQuantity.value = 1;
  if (els.productCost) els.productCost.value = '';

  renderItems();
}

function renderItems() {
  if (!els.itemsTableBody) return;

  els.itemsTableBody.innerHTML = '';

  if (!currentItems.length) {
    els.itemsTableBody.innerHTML = `
      <tr>
        <td colspan="10" style="text-align:center;padding:30px;">
          Nenhum item adicionado.
        </td>
      </tr>
    `;

    updateModalTotal();
    return;
  }

  currentItems.forEach((item, index) => {
    const total = Number(item.quantity || 0) * Number(item.cost_price || 0);

    const tr = document.createElement('tr');

    tr.innerHTML = `
      <td>${escapeHtml(item.sku || item.product_code || '-')}</td>
      <td>${escapeHtml(item.description || '-')}</td>
      <td>${escapeHtml(item.unit || '-')}</td>
      <td>${numberBR(item.stock_qty)}</td>
      <td>${numberBR(item.stock_min)}</td>
      <td>${numberBR(item.stock_max)}</td>
      <td>${Number(item.quantity || 0)}</td>
      <td>${money(item.cost_price)}</td>
      <td><strong>${money(total)}</strong></td>
      <td>
        <button class="btn btn-toolbar btn-sm btn-danger-local" onclick="window.removeManufactureItem(${index})">
          <i class="fa-solid fa-trash"></i>
        </button>
      </td>
    `;

    els.itemsTableBody.appendChild(tr);
  });

  updateModalTotal();
}

function updateModalTotal() {
  const total = currentItems.reduce((sum, item) => {
    return sum + Number(item.quantity || 0) * Number(item.cost_price || 0);
  }, 0);

  if (els.modalTotalCost) {
    els.modalTotalCost.textContent = money(total);
  }
}

async function saveOrder() {
  try {
    if (!els.manufacturerName?.value.trim()) {
      toast('Informe o fabricante.', 'warning');
      return;
    }

    if (!currentItems.length) {
      toast('Adicione produtos.', 'warning');
      return;
    }

    showLoading(true);

    const payload = {
      manufacturer_id: selectedManufacture?.id || selectedManufacture?.manufacturer_id || currentOrder?.manufacturer_id || null,
      manufacturer_name: els.manufacturerName.value.trim(),
      status: els.orderStatus?.value || 'OPEN',
      notes: els.orderNotes?.value || '',
      items: currentItems,
    };

    const id =
      currentOrder?.manufacture_order_id ||
      currentOrder?.id ||
      currentOrder?.order_id;

    const isEdit = Boolean(id);

    await api(isEdit ? `${API_BASE}/${id}` : API_BASE, {
      method: isEdit ? 'PUT' : 'POST',
      body: JSON.stringify(payload),
    });

    toast('Pedido salvo com sucesso.', 'success');

    closeModal();
    await loadOrders();
  } catch (error) {
    console.error('[manufacturesOrders][saveOrder]', error);
    toast(error.message, 'error');
  } finally {
    showLoading(false);
  }
}

window.editManufactureOrder = async id => {
  try {
    showLoading(true);

    const response = await api(`${API_BASE}/${id}`);

    const order = response.data || response.row || response;

    currentOrder = order;
    currentItems = order.items || [];

    selectedManufacture = {
      id: order.manufacturer_id || null,
      name: order.manufacturer_name || '',
      raw: order,
    };

    if (els.orderNumber) els.orderNumber.value = order.order_number || '';
    if (els.orderStatus) els.orderStatus.value = order.status || 'OPEN';
    if (els.manufacturerName) els.manufacturerName.value = order.manufacturer_name || '';
    if (els.orderNotes) els.orderNotes.value = order.notes || '';
    if (els.manufacturerImportFilter) els.manufacturerImportFilter.value = 'all';

    if (els.productSearch) els.productSearch.value = '';
    if (els.productQuantity) els.productQuantity.value = 1;
    if (els.productCost) els.productCost.value = '';

    renderItems();
    openModal();
  } catch (error) {
    console.error('[manufacturesOrders][editManufactureOrder]', error);
    toast(error.message, 'error');
  } finally {
    showLoading(false);
  }
};

window.deleteManufactureOrder = async id => {
  const confirmed = confirm('Deseja realmente excluir este pedido?');
  if (!confirmed) return;

  try {
    showLoading(true);

    await api(`${API_BASE}/${id}`, {
      method: 'DELETE',
    });

    toast('Pedido excluído.', 'success');

    await loadOrders();
  } catch (error) {
    console.error('[manufacturesOrders][deleteManufactureOrder]', error);
    toast(error.message, 'error');
  } finally {
    showLoading(false);
  }
};

window.removeManufactureItem = index => {
  currentItems.splice(index, 1);
  renderItems();
};

window.printManufactureOrder = id => {
  window.open(`${API_BASE}/${id}/pdf`, '_blank');
};

function exportExcel() {
  window.open(`${API_BASE}/excel`, '_blank');
}

function exportPdf() {
  window.open(`${API_BASE}/pdf`, '_blank');
}

window.excelManufactureOrder = id => {
  window.open(`${API_BASE}/${id}/excel`, '_blank');
};

window.printManufactureOrderManufacturer = id => {
  window.open(`${API_BASE}/${id}/pdf-manufacturer`, '_blank');
};