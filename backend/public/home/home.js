////////////////////////////////////////////////////////////////////////////////
// 📁 home.js – Home PRODNEX ERP                                            //
// ✅ Permissões por módulo                                                  //
// ✅ Tema Claro / Escuro                                                    //
// ✅ Atalho Ctrl + Z → Buscar Produto                                       //
// ✅ Atalho Ctrl + B → Abrir Orçamentos                                     //
// ✅ Atalho Ctrl + C → Buscar Cliente                                       //
// ✅ Reaproveita productsModalSearch.js                                     //
// ✅ Reaproveita customersModalSearch.js                                    //
// ✅ Card Posição de Estoque                                                //
////////////////////////////////////////////////////////////////////////////////

'use strict';

import { openProductsModalSearch } from '/public/modalsSearch/productsModalSearch.js';
import { openCustomersModalSearch } from '/public/modalsSearch/customersModalSearch.js';

////////////////////////////////////////////////////////////////////////////////
// 🔁 Navegação
////////////////////////////////////////////////////////////////////////////////

function abrirModulo(caminho) {
  window.location.href = caminho;
}

window.abrirModulo = abrirModulo;

////////////////////////////////////////////////////////////////////////////////
// 🔒 Logout
////////////////////////////////////////////////////////////////////////////////

function logout() {
  sessionStorage.clear();
  localStorage.removeItem('token');

  window.location.href = '/menu_entrada/menu_entrada.html';
}

window.logout = logout;

////////////////////////////////////////////////////////////////////////////////
// 🎯 CONFIG
////////////////////////////////////////////////////////////////////////////////

const PRODUCT_EDIT_BASE = '/public/editProducts/editProducts.html';

const CUSTOMER_EDIT_BASE = '/public/customersEdit/customersEdit.html';

const BUDGETS_PAGE = '/public/budgets/budgets.html';

const STOCK_POSITION_URLS = [
  '/api/products-stock/position',
  '/api/productsStock/position',
  '/api/stock/position',
];

const STOCK_POSITION_PAGE = '/public/reportsProductsStock/reportsProductsStock.html';

const ECOMMERCE_ORDERS_URL = '/api/ecommerce-orders?limit=1&offset=0';
const ECOMMERCE_ORDERS_PAGE = '/public/ecommerceOrders/ecommerceOrders.html';

let lastEcommerceOrderId =
  Number(localStorage.getItem('lastEcommerceOrderId') || 0);

////////////////////////////////////////////////////////////////////////////////
// ⌨️ Helpers
////////////////////////////////////////////////////////////////////////////////

function isTypingElement(el) {
  if (!el) return false;

  const tag = String(el.tagName || '').toLowerCase();

  return (
    tag === 'input' ||
    tag === 'textarea' ||
    tag === 'select' ||
    el.isContentEditable
  );
}

function getToken() {
  return localStorage.getItem('token') || '';
}

function authHeaders() {
  const token = getToken();

  return token
    ? { Authorization: `Bearer ${token}` }
    : {};
}

function toNumber(value) {
  const n = Number(value);

  return Number.isFinite(n) ? n : 0;
}

function formatNumberBR(value) {
  return toNumber(value).toLocaleString('pt-BR');
}

async function fetchFirstOk(urls, options = {}) {
  let lastError = null;

  for (const url of urls) {
    try {
      const response = await fetch(url, options);

      if (!response.ok) {
        lastError = new Error(`HTTP ${response.status} em ${url}`);
        continue;
      }

      const json = await response.json();

      return {
        ok: true,
        url,
        json,
      };
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error('Nenhuma rota respondeu corretamente.');
}

function normalizeStockPositionPayload(json) {
  const data =
    json?.data ||
    json?.row ||
    json?.result ||
    json ||
    {};

  const totalProdutos =
    data.total_produtos ??
    data.totalProducts ??
    data.products_count ??
    data.productsCount ??
    data.qtd_produtos ??
    data.qtdProdutos ??
    0;

  const totalEstoque =
    data.total_estoque ??
    data.totalStock ??
    data.stock_total ??
    data.stockTotal ??
    data.saldo_total ??
    data.saldoTotal ??
    0;

  const abaixoMinimo =
    data.abaixo_minimo ??
    data.belowMin ??
    data.below_min ??
    data.stock_below_min ??
    data.critical_count ??
    data.criticalCount ??
    0;

  const semEstoque =
    data.sem_estoque ??
    data.outOfStock ??
    data.out_of_stock ??
    data.zero_stock ??
    data.zeroStock ??
    0;

  const valorEstoque =
    data.valor_estoque ??
    data.valorEstoque ??
    data.stock_value ??
    data.total_value ??
    0;

  return {
    totalProdutos: toNumber(totalProdutos),
    totalEstoque: toNumber(totalEstoque),
    abaixoMinimo: toNumber(abaixoMinimo),
    semEstoque: toNumber(semEstoque),
    valorEstoque: toNumber(valorEstoque),
  };
}

////////////////////////////////////////////////////////////////////////////////
// 🔎 Abrir busca de produtos
////////////////////////////////////////////////////////////////////////////////

function openShortcutProductSearch() {
  try {
    openProductsModalSearch({
      apiBase: window.location.origin,

      // ✅ tabela VAREJO padrão
      priceId: 1,

      onPick(product) {
        console.log('[HOME][PRODUCT_SELECTED]', product);

        // editProducts resolve o produto por product_code/SKU (inclusive ?id=),
        // então nunca enviar o ID interno — abriria outro produto.
        const productCode =
          product?.product_code ||
          product?.sku ||
          product?.codigo ||
          '';

        if (productCode) {
          const url =
            `${PRODUCT_EDIT_BASE}?product_code=${encodeURIComponent(productCode)}`;

          console.log('[HOME][OPEN_EDIT_PRODUCT]', url);

          window.location.href = url;
          return;
        }

        alert('Produto sem SKU para abrir edição.');
      },
    });
  } catch (err) {
    console.error('[HOME][SHORTCUT_PRODUCT_SEARCH]', err);

    alert('Erro ao abrir busca de produtos.');
  }
}

////////////////////////////////////////////////////////////////////////////////
// 🔎 Abrir busca de clientes
////////////////////////////////////////////////////////////////////////////////

function openShortcutCustomerSearch() {
  try {
    openCustomersModalSearch({
      apiBase: window.location.origin,

      onPick(customer) {
        console.log('[HOME][CUSTOMER_SELECTED]', customer);

        const customerId =
          customer?.customer_id ||
          customer?.id ||
          '';

        const taxId =
          customer?.tax_id ||
          customer?.cnpj_cpf ||
          customer?.cpf_cnpj ||
          '';

        if (customerId) {
          const url =
            `${CUSTOMER_EDIT_BASE}?id=${encodeURIComponent(customerId)}`;

          console.log('[HOME][OPEN_CUSTOMER]', url);

          window.location.href = url;
          return;
        }

        if (taxId) {
          const url =
            `${CUSTOMER_EDIT_BASE}?tax_id=${encodeURIComponent(taxId)}`;

          console.log('[HOME][OPEN_CUSTOMER]', url);

          window.location.href = url;
          return;
        }

        alert('Cliente selecionado, mas sem ID/CNPJ para abrir.');
      },
    });
  } catch (err) {
    console.error('[HOME][SHORTCUT_CUSTOMER_SEARCH]', err);

    alert('Erro ao abrir busca de clientes.');
  }
}

////////////////////////////////////////////////////////////////////////////////
// 🧾 Abrir Orçamentos
////////////////////////////////////////////////////////////////////////////////

function openBudgetsPage() {
  window.location.href = BUDGETS_PAGE;
}

////////////////////////////////////////////////////////////////////////////////
// 📊 POSIÇÃO DE ESTOQUE — CARD HOME
////////////////////////////////////////////////////////////////////////////////

async function carregarPosicaoEstoqueHome() {
  const card = document.getElementById('alert-stock-position');
  const badge = document.getElementById('alert-stock-position-count');
  const status = document.getElementById('alert-stock-position-status');

  if (!card || !badge || !status) {
    console.warn('[HOME][STOCK_POSITION] Elementos do card não encontrados.');
    return;
  }

  card.classList.remove(
    'dashboard-alert-danger',
    'dashboard-alert-warning',
    'dashboard-alert-success',
    'stock-position-card--error',
    'stock-position-card--warning',
    'stock-position-card--success'
  );

  badge.textContent = '...';
  status.textContent = 'Carregando posição...';

  try {
    const { json, url } = await fetchFirstOk(STOCK_POSITION_URLS, {
      method: 'GET',
      headers: {
        ...authHeaders(),
        Accept: 'application/json',
      },
    });

    console.log('[HOME][STOCK_POSITION][SOURCE]', url);
    console.log('[HOME][STOCK_POSITION][PAYLOAD]', json);

    const position = normalizeStockPositionPayload(json);

    badge.textContent = formatNumberBR(position.totalProdutos);

    const valorEstoqueBR = position.valorEstoque.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });

    const partes = [
      `${valorEstoqueBR} em estoque`,
    ];

    if (position.abaixoMinimo > 0) {
      partes.push(`${formatNumberBR(position.abaixoMinimo)} abaixo do mínimo`);
    }

    if (position.semEstoque > 0) {
      partes.push(`${formatNumberBR(position.semEstoque)} sem estoque`);
    }

    status.textContent = partes.join(' • ');

    if (position.abaixoMinimo > 0 || position.semEstoque > 0) {
      card.classList.add('dashboard-alert-warning', 'stock-position-card--warning');
    } else {
      card.classList.add('dashboard-alert-success', 'stock-position-card--success');
    }

    card.title = 'Clique para abrir a posição de estoque';

  } catch (err) {
    console.error('[HOME][STOCK_POSITION][ERROR]', err);

    badge.textContent = '!';
    status.textContent = 'Erro ao carregar posição de estoque';

    card.classList.add('dashboard-alert-danger', 'stock-position-card--error');
  }
}

function configurarCliquePosicaoEstoque() {
  const card = document.getElementById('alert-stock-position');

  if (!card) return;

  card.addEventListener('click', () => {
    window.location.href = STOCK_POSITION_PAGE;
  });
}

////////////////////////////////////////////////////////////////////////////////
// 🛒 ALERTA PEDIDOS E-COMMERCE
////////////////////////////////////////////////////////////////////////////////

async function carregarAlertaPedidosEcommerce({ firstLoad = false } = {}) {
  const card = document.getElementById('alert-ecommerce-orders');
  const badge = document.getElementById('alert-ecommerce-orders-count');
  const status = document.getElementById('alert-ecommerce-orders-status');

  if (!card || !badge || !status) return;

  try {
    const response = await fetch(ECOMMERCE_ORDERS_URL, {
      headers: {
        ...authHeaders(),
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const json = await response.json();
    const latestOrder = Array.isArray(json?.data) ? json.data[0] : null;

    if (!latestOrder?.id) {
      badge.textContent = '0';
      status.textContent = 'Nenhum pedido encontrado';
      return;
    }

    const latestId = Number(latestOrder.id);

    if (firstLoad && !lastEcommerceOrderId) {
      lastEcommerceOrderId = latestId;
      localStorage.setItem('lastEcommerceOrderId', String(latestId));

      badge.textContent = '0';
      status.textContent = 'Nenhum pedido novo';
      return;
    }

    if (latestId > lastEcommerceOrderId) {
      badge.textContent = '1';
      status.textContent = `Novo pedido #${latestId} recebido`;

      card.classList.add('dashboard-alert-warning');

      try {
        new Audio('/public/sounds/notification.mp3').play().catch(() => { });
      } catch (_) { }
    } else {
      badge.textContent = '0';
      status.textContent = 'Nenhum pedido novo';
      card.classList.remove('dashboard-alert-warning');
    }
  } catch (err) {
    console.error('[HOME][ECOMMERCE_ORDERS_ALERT][ERROR]', err);

    badge.textContent = '!';
    status.textContent = 'Erro ao verificar pedidos';
    card.classList.add('dashboard-alert-danger');
  }
}

function configurarCliquePedidosEcommerce() {
  const card = document.getElementById('alert-ecommerce-orders');

  if (!card) return;

  card.addEventListener('click', () => {
    const badge = document.getElementById('alert-ecommerce-orders-count');

    lastEcommerceOrderId =
      Number(localStorage.getItem('lastEcommerceOrderId') || lastEcommerceOrderId);

    localStorage.setItem('lastEcommerceOrderId', String(lastEcommerceOrderId));

    if (badge) badge.textContent = '0';

    window.location.href = ECOMMERCE_ORDERS_PAGE;
  });
}

////////////////////////////////////////////////////////////////////////////////
// ⌨️ Atalho Global
////////////////////////////////////////////////////////////////////////////////

document.addEventListener('keydown', (event) => {
  try {
    const key = String(event.key || '').toLowerCase();

    const isCtrlOnly =
      event.ctrlKey &&
      !event.shiftKey &&
      !event.altKey &&
      !event.metaKey;

    if (!isCtrlOnly) return;

    if (isTypingElement(document.activeElement)) {
      return;
    }

    if (key === 'z') {
      console.log('[HOME][CTRL_Z_TRIGGERED]');

      event.preventDefault();
      event.stopPropagation();

      openShortcutProductSearch();
      return;
    }

    if (key === 'b') {
      console.log('[HOME][CTRL_B_TRIGGERED]');

      event.preventDefault();
      event.stopPropagation();

      openBudgetsPage();
      return;
    }

    if (key === 'c') {
      console.log('[HOME][CTRL_C_TRIGGERED]');

      event.preventDefault();
      event.stopPropagation();

      openShortcutCustomerSearch();
    }

  } catch (err) {
    console.error('[HOME][SHORTCUT_ERROR]', err);
  }
}, true);

////////////////////////////////////////////////////////////////////////////////
// ⏳ Carrega permissões
////////////////////////////////////////////////////////////////////////////////

document.addEventListener('DOMContentLoaded', async () => {
  const token = localStorage.getItem('token');

  if (!token) {
    console.error('[LOGIN] Token não encontrado');

    logout();
    return;
  }

  try {
    const payloadBase64 = token.split('.')[1];

    const payload = JSON.parse(atob(payloadBase64));

    const usuarioId =
      payload.userId ||
      payload.usuarioId ||
      payload.id;

    console.log('[HOME][USER_ID]', usuarioId);

    document.querySelectorAll('[data-modulo-id]').forEach((el) => {
      el.style.display = 'none';
    });

    const resposta =
      await fetch(`/api/usuarios-modulos/${usuarioId}/modulos`, {
        headers: {
          ...authHeaders(),
          Accept: 'application/json',
        },
      });

    if (!resposta.ok) {
      throw new Error(`HTTP ${resposta.status}`);
    }

    const modulos = await resposta.json();

    console.log('[HOME][MODULOS]', modulos);

    modulos
      .filter((m) => m?.pode_acessar)
      .forEach((m) => {
        document
          .querySelectorAll(`[data-modulo-id="${m.id}"]`)
          .forEach((el) => {
            el.style.display = '';
          });
      });

  } catch (erro) {
    console.error('[MENU] Erro ao buscar módulos:', erro);
  }
});

////////////////////////////////////////////////////////////////////////////////
// 🎨 Tema Claro / Escuro
////////////////////////////////////////////////////////////////////////////////

document.addEventListener('DOMContentLoaded', () => {
  const botaoTema =
    document.getElementById('alternarTema');

  const temaSalvo =
    localStorage.getItem('tema');

  if (temaSalvo === 'dark') {
    document.body.classList.add('dark-mode');
  }

  if (botaoTema) {
    botaoTema.addEventListener('click', () => {
      document.body.classList.toggle('dark-mode');

      const temaAtual =
        document.body.classList.contains('dark-mode')
          ? 'dark'
          : 'light';

      localStorage.setItem('tema', temaAtual);

      console.log('[HOME][THEME]', temaAtual);
    });
  }
});

////////////////////////////////////////////////////////////////////////////////
// 🚀 INIT HOME
////////////////////////////////////////////////////////////////////////////////

document.addEventListener('DOMContentLoaded', () => {
  configurarCliquePosicaoEstoque();
  carregarPosicaoEstoqueHome();

  configurarCliquePedidosEcommerce();
  carregarAlertaPedidosEcommerce({ firstLoad: true });

  setInterval(() => {
    carregarAlertaPedidosEcommerce();
  }, 30000);
});

////////////////////////////////////////////////////////////////////////////////
// 🧪 Debug
////////////////////////////////////////////////////////////////////////////////

console.log('[HOME] home.js carregado com sucesso');