// ╔══════════════════════════════════════════════════════════════════════╗
// ║ salesCommissionsFromInvoices.js — Frontend Comissões por NF-e        ║
// ║ PRODNEX ERP | ESM                                                    ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { openSellersModalSearch } from '/public/modalsSearch/sellersModalSearch.js';
import { openPricesModalSearch } from '/public/modalsSearch/pricesModalSearch.js';
import { showCenterModal } from '/public/includes/js/centerAlertModal.js';
import '/public/includes/js/date-range-field.js'; // registra <date-range-field>

const API_BASE = '/api/sales-commissions-from-invoices';

const state = {
    rows: [],
    total: 0,
    limit: 100,
    offset: 0,
    diagnostics: null,
};

const $ = (id) => document.getElementById(id);

const els = {
    dateRange: $('dateRange'),
    salesperson: $('salesperson'),
    sellerId: $('sellerId'),
    priceId: $('priceId'),
    priceName: $('priceName'),

    btnSellerSearch: $('btnSellerSearch'),
    btnPriceSearch: $('btnPriceSearch'),

    btnGenerate: $('btnGenerate'),
    btnRecalc: $('btnRecalc'),
    btnRefresh: $('btnRefresh'),
    btnPdf: $('btnPdf'),
    btnExcel: $('btnExcel'),
    btnSearch: $('btnSearch'),
    btnClear: $('btnClear'),
    btnPrev: $('btnPrev'),
    btnNext: $('btnNext'),
    pageSize: $('pageSize'),
    filtersForm: $('filtersForm'),

    tableBody: $('tableBody'),
    statusText: $('statusText'),
    pageInfo: $('pageInfo'),

    kpiRevenue: $('kpiRevenue'),
    kpiCommission: $('kpiCommission'),
    kpiMissingRule: $('kpiMissingRule'),
};

function pickSellerId(seller) {
    return seller?.seller_id
        ?? seller?.id
        ?? seller?.sellerId
        ?? seller?.vendedor_id
        ?? seller?.vendedorId
        ?? '';
}

function pickSellerName(seller) {
    return seller?.name
        ?? seller?.nome
        ?? seller?.full_name
        ?? seller?.fullName
        ?? seller?.apelido
        ?? seller?.nickname
        ?? '';
}

function openSellerSearch() {
    openSellersModalSearch({
        apiBase: window.location.origin,
        onPick: (seller) => {
            const id = pickSellerId(seller);
            const name = pickSellerName(seller);

            els.sellerId.value = id || '';
            els.salesperson.value = name || id || '';

            state.offset = 0;
            loadItems();
        },
        opts: {
            title: '🔎 Buscar Vendedor',
            placeholder: 'Digite nome, ID ou documento do vendedor...',
            limit: 50,
        },
    });
}

function openPriceSearch() {
    openPricesModalSearch({
        apiBase: window.location.origin,
        onPick: (price) => {
            const id = price?.price_id ?? price?.id ?? '';

            els.priceId.value = id;
            els.priceName.value = price?.name ? `${id} - ${price.name}` : String(id);

            state.offset = 0;
            refreshAll();
        },
    });
}

function money(value) {
    return Number(value || 0).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    });
}

function number(value, digits = 2) {
    return Number(value || 0).toLocaleString('pt-BR', {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
    });
}

function dateBR(value) {
    if (!value) return '-';

    const s = String(value).slice(0, 10);
    const [y, m, d] = s.split('-');

    if (!y || !m || !d) return value;

    return `${d}/${m}/${y}`;
}

// Período (De/Até) do <date-range-field>, em YYYY-MM-DD
function getPeriod() {
    const range = els.dateRange?.value || {};

    return {
        dateStart: range.startDate || '',
        dateEnd: range.endDate || '',
    };
}

function getFilters() {
    const params = new URLSearchParams();

    const { dateStart, dateEnd } = getPeriod();

    if (dateStart) params.set('dateStart', dateStart);
    if (dateEnd) params.set('dateEnd', dateEnd);
    if (els.sellerId.value.trim()) {
        params.set('salesperson', els.sellerId.value.trim());
    } else if (els.salesperson.value.trim()) {
        params.set('salesperson', els.salesperson.value.trim());
    }
    if (els.priceId.value.trim()) params.set('priceId', els.priceId.value.trim());

    params.set('limit', String(state.limit));
    params.set('offset', String(state.offset));

    return params;
}

async function requestJson(url, options = {}) {
    const res = await fetch(url, {
        headers: {
            'Content-Type': 'application/json',
        },
        ...options,
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok || data.ok === false) {
        throw new Error(data.message || data.detail || `Erro HTTP ${res.status}`);
    }

    return data;
}

function setLoading(text = 'Carregando...') {
    els.statusText.textContent = text;
}

const COMMISSION_TYPE_LABELS = { PERCENT: 'PERCENTUAL', FIXED: 'FIXO' };
const commissionTypeLabel = (t) => COMMISSION_TYPE_LABELS[String(t || '').toUpperCase()] || t || '';

function renderRows() {
    if (!state.rows.length) {
        els.tableBody.innerHTML = `
      <tr>
        <td colspan="14" class="empty-row">Nenhuma comissão encontrada.</td>
      </tr>
    `;
        return;
    }

    els.tableBody.innerHTML = state.rows.map((r) => `
    <tr>
      <td>${dateBR(r.issue_date)}</td>
      <td>${r.invoice_id || '-'}</td>
      <td>${r.order_id || (r.budget_id ? `Orç. ${r.budget_id}` : '-')}</td>
      <td>${r.customer_name || '-'}</td>
      <td>${r.seller_name || r.seller_id || '-'}</td>
      <td>${r.sku || '-'}</td>
      <td>${r.product_code || r.product_id || '-'}</td>
      <td>${r.price_table_name || r.price_id || '-'}</td>
      <td class="text-right">${number(r.quantity, 3)}</td>
      <td class="text-right">${money(r.item_total)}</td>
      <td><span class="sci-badge">${commissionTypeLabel(r.commission_type) || '-'}</span></td>
      <td class="text-right">${r.percent_value ? number(r.percent_value, 4) : '-'}</td>
      <td class="text-right">${r.fixed_value ? money(r.fixed_value) : '-'}</td>
      <td class="text-right"><strong>${money(r.item_commission)}</strong></td>
    </tr>
  `).join('');
}

function renderPagination() {
    const page = Math.floor(state.offset / state.limit) + 1;
    const totalPages = Math.max(1, Math.ceil(state.total / state.limit));

    els.pageInfo.textContent = `Página ${page} de ${totalPages}`;
    els.btnPrev.disabled = state.offset <= 0;
    els.btnNext.disabled = state.offset + state.limit >= state.total;
}

function renderDiagnostics() {
    const d = state.diagnostics || {};

    els.kpiRevenue.textContent = money(d.total_faturado || 0);
    els.kpiCommission.textContent = money(d.total_comissao || 0);
    els.kpiMissingRule.textContent = Number(d.sem_commission_id || 0).toLocaleString('pt-BR');
}

async function loadDiagnostics() {
    const params = getFilters();
    params.delete('limit');
    params.delete('offset');

    const data = await requestJson(`${API_BASE}/diagnostics?${params.toString()}`);
    state.diagnostics = data;
    renderDiagnostics();
}

async function loadItems() {
    try {
        setLoading('Carregando comissões...');

        const params = getFilters();
        const data = await requestJson(`${API_BASE}/items?${params.toString()}`);

        state.rows = Array.isArray(data.rows) ? data.rows : [];
        state.total = Number(data.total || 0);

        renderRows();
        renderPagination();

        els.statusText.textContent = `${state.total.toLocaleString('pt-BR')} ${state.total === 1 ? 'registro' : 'registros'}`;
    } catch (err) {
        console.error('[SCI] loadItems:', err);
        els.statusText.textContent = 'Erro ao carregar.';
        els.tableBody.innerHTML = `
      <tr>
        <td colspan="14" class="empty-row">${err.message}</td>
      </tr>
    `;
    }
}

async function refreshAll() {
    await loadDiagnostics();
    await loadItems();
}

async function generateCommissions() {
    try {
        const confirmed = await showCenterModal({
            variant: 'warning',
            title: 'Gerar comissões',
            message: 'Deseja gerar as comissões com base nas NF-e emitidas dentro do período filtrado?',
            okText: 'Gerar',
            closeText: 'Cancelar',
        });

        if (!confirmed) return;

        setLoading('Gerando comissões...');

        const body = {
            dateStart: getPeriod().dateStart || null,
            dateEnd: getPeriod().dateEnd || null,
            forceRegenerate: false,
            recalcAfter: true,
        };

        const data = await requestJson(`${API_BASE}/generate`, {
            method: 'POST',
            body: JSON.stringify(body),
        });

        showCenterModal({
            variant: 'success',
            title: 'Comissões geradas',
            message: `Inseridas: ${data.generated?.inserted || 0}<br>Recalculadas: ${data.recalculated?.updated || 0}`,
        });

        state.offset = 0;
        await refreshAll();
    } catch (err) {
        console.error('[SCI] generateCommissions:', err);
        showCenterModal({ variant: 'error', title: 'Erro ao gerar comissões', message: err.message });
        setLoading('Erro ao gerar.');
    }
}

async function recalcCommissions() {
    try {
        const confirmed = await showCenterModal({
            variant: 'warning',
            title: 'Recalcular comissões',
            message: 'Deseja recalcular as regras de comissão das NF-e?',
            okText: 'Recalcular',
            closeText: 'Cancelar',
        });

        if (!confirmed) return;

        setLoading('Recalculando comissões...');

        const data = await requestJson(`${API_BASE}/recalc`, {
            method: 'POST',
            body: JSON.stringify({
                onlyMissing: false,
            }),
        });

        showCenterModal({ variant: 'success', title: 'Recálculo concluído', message: `Atualizadas: ${data.updated || 0}` });

        await refreshAll();
    } catch (err) {
        console.error('[SCI] recalcCommissions:', err);
        showCenterModal({ variant: 'error', title: 'Erro ao recalcular', message: err.message });
        setLoading('Erro ao recalcular.');
    }
}

function generatePdf() {
    const params = getFilters();

    params.delete('limit');
    params.delete('offset');

    const url = `${API_BASE}/pdf?${params.toString()}`;

    window.open(url, '_blank');
}

function exportExcel() {
    const params = getFilters();

    params.delete('limit');
    params.delete('offset');

    window.open(`${API_BASE}/excel?${params.toString()}`, '_blank');
}

function clearFilters() {
    els.dateRange.value = { startDate: '', endDate: '' };
    els.salesperson.value = '';
    els.sellerId.value = '';
    els.priceId.value = '';
    els.priceName.value = '';

    state.offset = 0;
    loadItems();
}

function bindEvents() {
    els.btnSellerSearch.addEventListener('click', openSellerSearch);
    els.salesperson.addEventListener('click', openSellerSearch);
    els.btnPriceSearch.addEventListener('click', openPriceSearch);
    els.priceName.addEventListener('click', openPriceSearch);

    els.dateRange.addEventListener('range-change', () => {
        state.offset = 0;
        refreshAll();
    });

    els.btnGenerate.addEventListener('click', generateCommissions);
    els.btnRecalc.addEventListener('click', recalcCommissions);
    els.btnRefresh.addEventListener('click', refreshAll);
    els.btnPdf.addEventListener('click', generatePdf);
    els.btnExcel.addEventListener('click', exportExcel);

    els.filtersForm.addEventListener('submit', (event) => {
        event.preventDefault();
        state.offset = 0;
        refreshAll();
    });

    els.pageSize.addEventListener('change', () => {
        state.limit = Number(els.pageSize.value) || 100;
        state.offset = 0;
        loadItems();
    });

    els.btnClear.addEventListener('click', clearFilters);

    els.btnPrev.addEventListener('click', () => {
        state.offset = Math.max(0, state.offset - state.limit);
        loadItems();
    });

    els.btnNext.addEventListener('click', () => {
        if (state.offset + state.limit < state.total) {
            state.offset += state.limit;
            loadItems();
        }
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    bindEvents();
    await refreshAll();
});