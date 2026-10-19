/* ╔════════════════════════════════════════════════════════════════════╗
   ║ ecommerceOrders.js — UI Pedidos E-commerce BH3 — PRODNEX ERP      ║
   ║                                                                    ║
   ║ - Dashboard (cards topo)                                          ║
   ║ - Filtros + paginação                                             ║
   ║ - Lista de pedidos                                                ║
   ║ - Modal de detalhes (cabeçalho + itens)                           ║
   ╚════════════════════════════════════════════════════════════════════╝ */

const API_BASE = (window.apiBase || window.API_BASE || window.location.origin)
  .replace(/\/$/, '');

const ROUTES = {
  search: `${API_BASE}/api/ecommerce-orders`,
  find: (id) => `${API_BASE}/api/ecommerce-orders/${id}`,
};

let currentPage = 1;
let limit = 20;

/* =======================================================================
   Helpers
   ======================================================================= */

const fmtMoney = (v) =>
  Number(v || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const fmtDateTime = (str) => {
  if (!str) return '—';
  const d = new Date(str);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('pt-BR');
};

function asaasStatusLabel(status) {
  switch (status) {
    case 'PENDING': return 'Pendente';
    case 'AUTHORIZED': return 'Autorizado';
    case 'RECEIVED': return 'Recebido';
    case 'CONFIRMED': return 'Confirmado';
    case 'OVERDUE': return 'Vencido';
    case 'CANCELED': return 'Cancelado';
    case 'REFUNDED': return 'Estornado';
    case 'CHARGEBACK': return 'Chargeback';
    case 'IN_DISPUTE': return 'Em disputa';
    default: return status || '—';
  }
}

function renderStatusBadge(status) {
  if (!status) return '—';
  const slug = status.toLowerCase();
  const label = asaasStatusLabel(status);
  return `<span class="eo-status-badge eo-status-${slug}">${label}</span>`;
}

/* =======================================================================
   DOM
   ======================================================================= */

// Filtros
const $search = document.getElementById('eoFilterSearch');
const $billingType = document.getElementById('eoFilterBillingType');
const $status = document.getElementById('eoFilterStatus');
const $dateFrom = document.getElementById('eoFilterDateFrom');
const $dateTo = document.getElementById('eoFilterDateTo');

// Botões filtro/lista
const $btnSearch = document.getElementById('eoBtnSearch');
const $btnClear = document.getElementById('eoBtnClear');
const $btnPrev = document.getElementById('eoBtnPrevPage');
const $btnNext = document.getElementById('eoBtnNextPage');
const $btnRefresh = document.getElementById('eoBtnRefresh');

// Lista
const $tbody = document.getElementById('eoTableBody');
const $listCount = document.getElementById('eoListCount');
const $pageInfo = document.getElementById('eoPageInfo');

// Cards topo
const $sumTotalOrders = document.getElementById('eoTotalOrders');
const $sumSubtotal = document.getElementById('eoTotalSubtotal');
const $sumShipping = document.getElementById('eoTotalShipping');

// Modal
const $modalLayer = document.getElementById('eoOrderModal');
const $modalCloseBtn = document.getElementById('eoModalCloseBtn');

const $modalId = document.getElementById('eoModalId');
const $modalSubtitle = document.getElementById('eoModalSubtitle');
const $modalCreatedAt = document.getElementById('eoModalCreatedAt');
const $modalSubtotal = document.getElementById('eoModalSubtotal');
const $modalShippingValue = document.getElementById('eoModalShippingValue');
const $modalShippingFree = document.getElementById('eoModalShippingFree');

const $modalStatus = document.getElementById('eoModalStatus');
const $modalBillingType = document.getElementById('eoModalBillingType');
const $modalProvider = document.getElementById('eoModalProvider');
const $modalService = document.getElementById('eoModalService');

const $modalAsaasPaymentId = document.getElementById('eoModalAsaasPaymentId');
const $modalInvoiceUrl = document.getElementById('eoModalInvoiceUrl');

const $modalItemsCount = document.getElementById('eoModalItemsCount');
const $modalItemsBody = document.getElementById('eoModalItemsBody');

/* =======================================================================
   Carregar lista
   ======================================================================= */

async function loadOrders() {
  const params = new URLSearchParams();

  if ($search.value.trim()) params.set('q', $search.value.trim());
  if ($billingType.value) params.set('billingType', $billingType.value);
  if ($status.value) params.set('status', $status.value);
  if ($dateFrom.value) params.set('dateFrom', $dateFrom.value);
  if ($dateTo.value) params.set('dateTo', $dateTo.value);

  params.set('limit', String(limit));
  params.set('offset', String((currentPage - 1) * limit));

  const url = `${ROUTES.search}?${params.toString()}`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();

    if (!json.ok) throw new Error(json.error || 'Erro ao buscar pedidos');

    const rows = json.data || [];
    renderList(rows);
    updateSummary(rows);
  } catch (err) {
    console.error('[ecommerceOrders] Erro ao carregar pedidos:', err);
    showFallbackRow('Erro ao carregar pedidos. Verifique o backend.');
  }
}

/* =======================================================================
   Renderização da lista
   ======================================================================= */

function showFallbackRow(message) {
  $tbody.innerHTML = `
    <tr>
      <td colspan="11" style="text-align:center; color: var(--muted); padding:12px 8px;">
        ${message}
      </td>
    </tr>
  `;
  $listCount.textContent = '0 registros';
}

function renderList(rows) {
  $tbody.innerHTML = '';

  if (!rows.length) {
    showFallbackRow('Nenhum pedido encontrado para os filtros informados.');
    updateSummary([]);
    return;
  }

  let html = '';

  for (const r of rows) {
    html += `
      <tr class="eo-row" data-id="${r.id}">
        <td>${r.id}</td>
        <td>${fmtDateTime(r.created_at)}</td>
        <td class="text-right">R$ ${fmtMoney(r.subtotal)}</td>
        <td>${r.asaas_billing_type || '—'}</td>
        <td>${renderStatusBadge(r.asaas_status)}</td>
        <td class="text-right">R$ ${fmtMoney(r.shipping_value)}</td>
        <td>${r.shipping_free ? 'Sim' : 'Não'}</td>
        <td>${r.shipping_provider || '—'}</td>
        <td>${r.shipping_service || '—'}</td>
        <td>${r.asaas_payment_id || '—'}</td>
        <td style="text-align:center;">
          <button
            class="btn btn-flat btn-sm eo-btn-view"
            type="button"
            data-id="${r.id}"
          >
            Ver
          </button>
        </td>
      </tr>
    `;
  }

  $tbody.innerHTML = html;
  $listCount.textContent = `${rows.length} registros`;
  $pageInfo.textContent = `Página ${currentPage}`;

  // Eventos de clique para abrir modal
  document.querySelectorAll('.eo-btn-view').forEach((btn) => {
    btn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const id = btn.dataset.id;
      if (id) loadDetails(id);
    });
  });

  // Clique na linha também abre modal
  document.querySelectorAll('tr.eo-row').forEach((tr) => {
    tr.addEventListener('click', () => {
      const id = tr.dataset.id;
      if (id) loadDetails(id);
    });
  });
}

/* =======================================================================
   Resumo (cards)
   ======================================================================= */

function updateSummary(rows) {
  let totalSubtotal = 0;
  let totalShipping = 0;

  for (const r of rows) {
    totalSubtotal += Number(r.subtotal || 0);
    totalShipping += Number(r.shipping_value || 0);
  }

  $sumTotalOrders.textContent = rows.length;
  $sumSubtotal.textContent = 'R$ ' + fmtMoney(totalSubtotal);
  $sumShipping.textContent = 'R$ ' + fmtMoney(totalShipping);
}

/* =======================================================================
   Detalhes / Modal
   ======================================================================= */

async function loadDetails(id) {
  try {
    const res = await fetch(ROUTES.find(id));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();

    if (!json.ok) throw new Error(json.error || 'Erro ao buscar pedido');

    const { header, items } = json.data || {};
    openOrderModal(header, items || []);
  } catch (err) {
    console.error('[ecommerceOrders] Erro ao carregar detalhes:', err);
  }
}

function openOrderModal(header, items) {
  if (!header) return;

  $modalId.textContent = header.id;
  $modalSubtitle.textContent = `Pedido #${header.id} do e-commerce BH3`;

  $modalCreatedAt.textContent = fmtDateTime(header.created_at);
  $modalSubtotal.textContent = 'R$ ' + fmtMoney(header.subtotal);
  $modalShippingValue.textContent = 'R$ ' + fmtMoney(header.shipping_value);
  $modalShippingFree.textContent = header.shipping_free ? 'Sim' : 'Não';

  $modalStatus.textContent = asaasStatusLabel(header.asaas_status);
  $modalBillingType.textContent = header.asaas_billing_type || '—';
  $modalProvider.textContent = header.shipping_provider || '—';
  $modalService.textContent = header.shipping_service || '—';

  $modalAsaasPaymentId.textContent = header.asaas_payment_id || '—';

  if (header.asaas_invoice_url) {
    $modalInvoiceUrl.classList.remove('eo-modal-link-disabled');
    $modalInvoiceUrl.href = header.asaas_invoice_url;
    $modalInvoiceUrl.textContent = 'Abrir fatura / boleto';
  } else {
    $modalInvoiceUrl.classList.add('eo-modal-link-disabled');
    $modalInvoiceUrl.href = '#';
    $modalInvoiceUrl.textContent = 'Nenhum link disponível';
  }

  // Itens
  $modalItemsBody.innerHTML = '';
  if (!items.length) {
    $modalItemsBody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center; color: var(--muted); padding:8px 6px;">
          Nenhum item encontrado para este pedido.
        </td>
      </tr>
    `;
    $modalItemsCount.textContent = '0 itens';
  } else {
    let html = '';
    for (const it of items) {
      html += `
        <tr>
          <td>${it.product_code || '—'}</td>
          <td>${it.name || '—'}</td>
          <td>${it.unit || '—'}</td>
          <td style="text-align:right;">${fmtMoney(it.qty)}</td>
          <td style="text-align:right;">R$ ${fmtMoney(it.price)}</td>
          <td style="text-align:right;">R$ ${fmtMoney(it.total)}</td>
        </tr>
      `;
    }
    $modalItemsBody.innerHTML = html;
    $modalItemsCount.textContent = `${items.length} itens`;
  }

  // Abre modal
  $modalLayer.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeOrderModal() {
  $modalLayer.classList.add('hidden');
  document.body.style.overflow = '';
}

/* =======================================================================
   Eventos de UI
   ======================================================================= */

// Buscar
$btnSearch.addEventListener('click', () => {
  currentPage = 1;
  loadOrders();
});

// Enter no campo de busca
$search.addEventListener('keydown', (ev) => {
  if (ev.key === 'Enter') {
    ev.preventDefault();
    currentPage = 1;
    loadOrders();
  }
});

// Limpar filtros
$btnClear.addEventListener('click', () => {
  $search.value = '';
  $billingType.value = '';
  $status.value = '';
  $dateFrom.value = '';
  $dateTo.value = '';
  currentPage = 1;
  loadOrders();
});

// Paginação
$btnPrev.addEventListener('click', () => {
  if (currentPage > 1) {
    currentPage -= 1;
    loadOrders();
  }
});

$btnNext.addEventListener('click', () => {
  currentPage += 1;
  loadOrders();
});

// Atualizar
$btnRefresh.addEventListener('click', () => {
  loadOrders();
});

// Modal: fechar
$modalCloseBtn.addEventListener('click', () => {
  closeOrderModal();
});

// Fechar clicando no backdrop
$modalLayer.addEventListener('click', (ev) => {
  if (ev.target === $modalLayer || ev.target.classList.contains('eo-modal-backdrop')) {
    closeOrderModal();
  }
});

// Esc para fechar modal
document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape' && !$modalLayer.classList.contains('hidden')) {
    closeOrderModal();
  }
});

/* =======================================================================
   Inicialização
   ======================================================================= */

document.addEventListener('DOMContentLoaded', () => {
  loadOrders();
});
