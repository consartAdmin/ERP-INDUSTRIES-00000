// orders.actions.js — Orders module
'use strict';

import { ROUTES } from './orders.config.js';
import { state } from './orders.state.js';
import { $, fmtMoney, normalizeStatus, toast } from './orders.utils.js';
import { openOrderDetailsModal } from './orders.modal.js';
import { closeEditorPedido } from './orders.form.js';
import { showCenterModal } from '/public/includes/js/centerAlertModal.js';

// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: orders.tabs.js                                                 ║
// ║ MODULE: Orders                                                       ║
// ║ PRODNEX ERP                                                          ║
// ║ Tab navigation controller                                            ║
// ╚══════════════════════════════════════════════════════════════════════╝


export function activateTab(which) {

  document.querySelectorAll('.tab').forEach(btn => {

    const active = btn.dataset.tab === which;

    btn.classList.toggle('is-active', active);

  });

  document.querySelectorAll('.tab-panel').forEach(panel => {

    const show = panel.dataset.panel === which;

    panel.classList.toggle('is-active', show);

  });

}

export function bindTabs() {

  document.querySelectorAll('.tab').forEach(btn => {

    btn.addEventListener('click', () => {

      activateTab(btn.dataset.tab);

    });

  });

}

// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: orders.nfe.js                                                  ║
// ║ MODULE: Orders                                                       ║
// ║ PRODNEX ERP                                                          ║
// ║ NF-e emission                                                        ║
// ╚══════════════════════════════════════════════════════════════════════╝


function sleepNFe(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getNFeStatus(payload = {}) {
  return String(
    payload?.nfe?.status ||
    payload?.status ||
    'PROCESSANDO'
  ).trim().toUpperCase();
}

async function aguardarAutorizacaoNFe(orderId, maxAttempts = 36) {
  const terminalErrors = new Set([
    'REJEITADA',
    'REJEITADO',
    'CANCELADA',
    'CANCELADO',
    'DENEGADA',
    'DENEGADO',
    'ERRO',
  ]);

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    await sleepNFe(5000);

    const response = await fetch(ROUTES.nfeStatus(orderId), {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok && response.status !== 202) {
      const message =
        result?.message ||
        result?.error?.message ||
        result?.error ||
        'Erro ao consultar o processamento da NF-e.';

      throw new Error(String(message));
    }

    const status = getNFeStatus(result);

    if (result?.authorized === true) {
      return result;
    }

    if (terminalErrors.has(status)) {
      const detail =
        result?.message ||
        result?.error?.message ||
        result?.error ||
        `NF-e finalizada com status ${status}.`;

      throw new Error(String(detail));
    }

    toast?.info?.(
      'Aguardando autorização da NF-e...',
      `Status: ${status} · tentativa ${attempt}/${maxAttempts}`
    );
  }

  throw new Error(
    'A NF-e continua em processamento. Aguarde alguns minutos e consulte o pedido novamente.'
  );
}

export async function emitirNFe(orderId) {
  const id = orderId || state.selectedId;

  if (!id) {
    throw new Error('Selecione um pedido para emitir a NF-e.');
  }

  const response = await fetch(ROUTES.nfeIssue(id), {
    method: 'POST',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });

  const emission = await response.json().catch(() => ({}));

  if (!response.ok && response.status !== 202) {
    const message =
      emission?.message ||
      emission?.error?.message ||
      emission?.error ||
      'Falha ao emitir NF-e.';

    throw new Error(String(message));
  }

  toast?.info?.(
    'NF-e enviada',
    'Documento recebido e aguardando autorização.'
  );

  return aguardarAutorizacaoNFe(id);
}

// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: orders.list.js                                                 ║
// ║ MODULE: Orders                                                       ║
// ║ PRODNEX ERP                                                          ║
// ║ Lista de pedidos + paginação + ações                                 ║
// ║ ✅ Busca pedidos                                                     ║
// ║ ✅ Paginação                                                         ║
// ║ ✅ Botão expand abre modal de detalhes                               ║
// ║ ✅ Botão "Retornar p/ Orçamento"                                     ║
// ║ ✅ Botão "Emitir NF-e" emite e depois redireciona                    ║
// ║ ✅ Botão "Preview NF-e"                                              ║
// ║ ✅ Botão "PDF Separação"                                             ║
// ║ ✅ Exibe data/hora da emissão da NF-e                                ║
// ║ ✅ Proteção contra clique duplo na emissão                           ║
// ╚══════════════════════════════════════════════════════════════════════╝


let isEmittingNFe = false;

export async function fetchPedidos() {
  const offset = (state.page - 1) * state.limit;

  const url = ROUTES.ordersSearch(
    state.q,
    state.limit,
    offset,
    state.dateFrom,
    state.dateTo,
    state.status
  );

  try {
    const r = await fetch(url, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });

    if (!r.ok) {
      throw new Error(`HTTP ${r.status} ao carregar pedidos.`);
    }

    const js = await r.json();

    state.list = Array.isArray(js?.rows) ? js.rows : [];
    state.total = Number(js?.total || 0);

    renderListPedidos();
    updatePagerInfo();
  } catch (err) {
    console.error('[orders.list] fetchPedidos:', err);

    state.list = [];
    state.total = 0;

    renderListPedidos();
    updatePagerInfo();

    toast?.error?.('Erro ao carregar pedidos', 'API /api/orders/search');
  }
}

function renderListPedidos() {
  const tbody = document.querySelector('#corpoTabelaMovimentacoes');
  if (!tbody) return;

  tbody.innerHTML = '';

  if (!state.list.length) {
    const tr = document.createElement('tr');

    tr.innerHTML = `
      <td colspan="9" class="ta-center">
        Nenhum pedido encontrado.
      </td>
    `;

    tbody.appendChild(tr);
    return;
  }

  for (const o of state.list) {
    const id = o.order_id ?? o.id ?? o.number ?? '';
    const numero = o.number ?? o.order_number ?? o.numero ?? id;

    const data = formatDateCell(
      o.issue_date ?? o.created_at ?? ''
    );

    const cliente =
      o.customer_legal_name ??
      o.legal_name ??
      o.customer?.legal_name ??
      o.customer_name ??
      o.cliente_nome ??
      o.nome_cliente ??
      o.customer_trade_name ??
      o.trade_name ??
      '';

    const cnpj =
      o.cnpj_cpf ??
      o.customer_document ??
      o.customer_tax_id ??
      '';

    const total = o.total_amount ?? o.total ?? 0;
    const status = o.status ?? '';

    const nfeIssueAt = formatDateTimeCell(
      o.nfe_issue_datetime ??
      o.nfe_issue_date ??
      ''
    );

    const statusNorm = String(status).trim().toUpperCase();
    const isCanceled = statusNorm === 'CANCELADO';
    const isBilled = statusNorm === 'FATURADO';
    const hasNfe = hasNfeLinked(o);

    const tr = document.createElement('tr');

    tr.innerHTML = `
      <td class="col-expand">
        <button
          type="button"
          class="btn-expand"
          data-id="${escapeAttr(id)}"
          aria-label="Visualizar detalhes do pedido ${escapeAttr(numero)}"
          title="Visualizar detalhes"
        >›</button>
      </td>

      <td>${escapeHtml(numero)}</td>
      <td>${escapeHtml(data)}</td>
      <td class="col-cliente">${escapeHtml(cliente)}</td>
      <td>${escapeHtml(cnpj)}</td>
      <td class="ta-right">${fmtMoney(total)}</td>
      <td>${escapeHtml(status)}</td>
      <td>${escapeHtml(nfeIssueAt)}</td>

      <td class="col-acoes">
        <div class="page-orders__actions">

          <button
            type="button"
            class="btn btn-secondary btn-sm"
            data-preview-nfe="${escapeAttr(id)}"
            aria-label="Pré-visualizar NF-e do pedido ${escapeAttr(numero)}"
            title="Pré-visualizar NF-e"
          >
            👁 Preview
          </button>

          <button
            type="button"
            class="btn btn-secondary btn-sm"
            data-separation-pdf="${escapeAttr(id)}"
            aria-label="Baixar PDF de separação do pedido ${escapeAttr(numero)}"
            title="Baixar PDF de separação"
          >
            📦 PDF Sep.
          </button>

          <button
            type="button"
            class="btn btn-secondary btn-sm"
            data-emit-nfe="${escapeAttr(id)}"
            aria-label="Emitir NF-e do pedido ${escapeAttr(numero)}"
            title="Emitir NF-e"
            ${isCanceled || isBilled ? 'disabled' : ''}
          >
            🧾 Emitir NF-e
          </button>

          <button
            type="button"
            class="btn btn-secondary btn-sm"
            data-return-budget="${escapeAttr(id)}"
            aria-label="Retornar pedido ${escapeAttr(numero)} para orçamento"
            title="${hasNfe
              ? 'NF-e já gerada. Não é possível retornar para orçamento.'
              : 'Retornar pedido para orçamento'}"
            ${isCanceled || isBilled || hasNfe ? 'disabled' : ''}
          >
            ↩ Retornar p/ Orçamento
          </button>

        </div>
      </td>
    `;

    tbody.appendChild(tr);
  }
}

function updatePagerInfo() {
  const totalInfo = $('#apTableInfo');
  const pageInfo = $('#infoPagina');

  const total = Number(state.total || 0);
  const limit = Number(state.limit || 50);
  const totalPages = Math.max(1, Math.ceil(total / limit));

  if (totalInfo) {
    totalInfo.textContent = `${total} pedido(s)`;
  }

  if (pageInfo) {
    pageInfo.textContent = `Página ${state.page} de ${totalPages}`;
  }

  const prevBtn = $('#pagAnterior');
  const nextBtn = $('#pagProxima');

  if (prevBtn) {
    prevBtn.disabled = state.page <= 1;
  }

  if (nextBtn) {
    nextBtn.disabled = state.page >= totalPages;
  }
}

function handleTableClick(event) {
  const expandBtn = event.target.closest('.btn-expand');
  if (expandBtn) {
    const orderId = expandBtn.dataset.id;
    openOrderDetailsModal(orderId);
    return;
  }

  const previewBtn = event.target.closest('[data-preview-nfe]');
  if (previewBtn) {
    const orderId = previewBtn.dataset.previewNfe;
    if (!orderId) return;

    const url = `${window.location.origin}/api/orders/${encodeURIComponent(orderId)}/preview-pdf`;
    window.open(url, '_blank', 'noopener,noreferrer');
    return;
  }

  const separationBtn = event.target.closest('[data-separation-pdf]');
  if (separationBtn) {
    const orderId = separationBtn.dataset.separationPdf;
    if (!orderId) return;

    downloadSeparationPdf(orderId);
    return;
  }

  const emitBtn = event.target.closest('[data-emit-nfe]');
  if (emitBtn) {
    const orderId = emitBtn.dataset.emitNfe;
    if (!orderId) return;

    emitirNFeEIrParaTela(orderId, emitBtn);
    return;
  }

  const returnBtn = event.target.closest('[data-return-budget]');
  if (returnBtn) {
    const orderId = returnBtn.dataset.returnBudget;
    if (!orderId) return;

    retornarPedidoParaOrcamento(orderId);
  }
}

async function emitirNFeEIrParaTela(orderId, buttonEl) {
  if (!orderId) return;
  if (isEmittingNFe) return;

  const confirmar = await showCenterModal({
    variant: 'warning',
    title: 'Emitir NF-e',
    message: `
      Deseja realmente emitir a NF-e deste pedido?
      <br><br>
      <strong>Pedido:</strong> #${orderId}
    `,
    buttons: [
      { label: 'Cancelar', variant: 'close', action: () => false },
      { label: 'Emitir NF-e', variant: 'success', action: () => true }
    ]
  });

  if (!confirmar) return;

  const btn = buttonEl instanceof HTMLButtonElement ? buttonEl : null;
  const textoOriginal = btn?.innerHTML || '';

  try {
    isEmittingNFe = true;

    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '⏳ Emitindo...';
    }

    toast?.info?.('Emitindo NF-e...', `Pedido ${orderId}`);

    const result = await emitirNFe(orderId);

    toast?.success?.('NF-e emitida com sucesso');

    const nfeId =
      result?.nfe_id ??
      result?.nfeId ??
      result?.id ??
      result?.nfe?.id ??
      '';

    const chave =
      result?.chave ??
      result?.access_key ??
      result?.nfe?.chave ??
      '';

    const url = new URL('/invoicesIssued/invoicesIssued.html', window.location.origin);

    url.searchParams.set('order_id', orderId);

    if (nfeId) {
      url.searchParams.set('nfe_id', nfeId);
    }

    if (chave) {
      url.searchParams.set('chave', chave);
    }

    window.location.href = url.toString();

  } catch (err) {
    console.error(err);

    await showCenterModal({
      variant: 'error',
      title: 'Erro ao emitir NF-e',
      message: err.message || 'Falha ao emitir NF-e.'
    });

  } finally {
    isEmittingNFe = false;

    if (btn) {
      btn.disabled = false;
      btn.innerHTML = textoOriginal || '🧾 Emitir NF-e';
    }
  }
}

function downloadSeparationPdf(orderId) {
  try {
    const base = window.API_BASE || window.location.origin;
    const url = `${base}/api/orders/${encodeURIComponent(orderId)}/separation-pdf`;

    const a = document.createElement('a');
    a.href = url;
    a.setAttribute('download', '');
    a.rel = 'noopener noreferrer';
    a.style.display = 'none';

    document.body.appendChild(a);
    a.click();
    a.remove();
  } catch (err) {
    console.error('[orders.list] downloadSeparationPdf:', err);
    toast?.error?.('Erro ao baixar PDF de separação');
  }
}

async function retornarPedidoParaOrcamento(orderId) {
  if (!orderId) return;

  const row = state.list.find((item) =>
    String(item.order_id ?? item.id ?? item.number) === String(orderId)
  );

  if (row && hasNfeLinked(row)) {
    toast?.warn?.(
      'Ação bloqueada',
      'Este pedido já possui NF-e gerada. Não é possível retornar para orçamento.'
    );
    return;
  }

  const status = normalizeStatus(row?.status ?? '');

  if (status === 'CANCELADO' || status === 'FATURADO') {
    toast?.warn?.(
      'Ação bloqueada',
      status === 'FATURADO'
        ? 'Este pedido está faturado e não pode retornar para orçamento.'
        : 'Este pedido já está cancelado.'
    );
    return;
  }

  const confirmar = await showCenterModal({
    variant: 'warning',
    title: 'Retornar para orçamento',
    message: `
      Deseja realmente retornar este pedido para orçamento?
      <br><br>
      <strong>Pedido:</strong> #${escapeHtml(orderId)}
      <br><br>
      O pedido será cancelado, o orçamento vinculado será reaberto
      e o estoque reservado será restaurado.
    `,
    buttons: [
      {
        label: 'Cancelar',
        variant: 'close',
        action: () => false
      },
      {
        label: 'Retornar p/ Orçamento',
        variant: 'success',
        action: () => true
      }
    ]
  });

  if (!confirmar) return;

  try {
    const base = window.API_BASE || window.location.origin;
    const url = `${base}/api/orders/${encodeURIComponent(orderId)}/return-to-budget`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok || !result?.ok) {
      throw new Error(result?.error || result?.message || `HTTP ${response.status}`);
    }

    const budgetId =
      result?.budget_id ??
      result?.budgetId ??
      null;

    toast?.success?.('Pedido retornado para orçamento com sucesso');

    if (budgetId) {
      const urlBudget = new URL('/budgets/budgets.html', window.location.origin);
      urlBudget.searchParams.set('budget_id', budgetId);
      urlBudget.searchParams.set('tab', 'editor');

      window.location.href = urlBudget.toString();
      return;
    }

    fetchPedidos();
  } catch (err) {
    console.error('[orders.list] retornarPedidoParaOrcamento:', err);
    toast?.error?.(err.message || 'Erro ao retornar pedido para orçamento');
  }
}

function syncPedidosDateRange() {
  const dateRange = $('#dtRangePedidos');
  const dateFromInput = $('#dtDePedidos');
  const dateToInput = $('#dtAtePedidos');

  const {
    startDate = '',
    endDate = ''
  } = dateRange?.value || {};

  if (dateFromInput) {
    dateFromInput.value = startDate;
  }

  if (dateToInput) {
    dateToInput.value = endDate;
  }

  return {
    startDate,
    endDate
  };
}

function readFiltersFromUI() {
  const {
    startDate,
    endDate
  } = syncPedidosDateRange();

  state.q =
    $('#qPedidos')?.value?.trim() || '';

  state.dateFrom =
    startDate ||
    $('#dtDePedidos')?.value ||
    '';

  state.dateTo =
    endDate ||
    $('#dtAtePedidos')?.value ||
    '';

  state.status =
    $('#statusFiltroPedidos')?.value ||
    'TODOS';

  state.limit =
    Number($('#apRowsPerPage')?.value || 50);
}

function handleBuscarClick() {
  state.page = 1;
  readFiltersFromUI();
  fetchPedidos();
}

function handlePrevPage() {
  if (state.page <= 1) return;

  state.page -= 1;
  fetchPedidos();
}

function handleNextPage() {
  const totalPages = Math.max(
    1,
    Math.ceil(Number(state.total || 0) / Number(state.limit || 50))
  );

  if (state.page >= totalPages) return;

  state.page += 1;
  fetchPedidos();
}

function handleAutoRefreshFilters() {
  state.page = 1;
  readFiltersFromUI();
  fetchPedidos();
}

function formatDateCell(value) {
  if (!value) return '';

  const raw = String(value).trim();
  if (!raw) return '';

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [yyyy, mm, dd] = raw.split('-');
    return `${dd}/${mm}/${yyyy}`;
  }

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    return raw.substring(0, 10);
  }

  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();

  return `${dd}/${mm}/${yyyy}`;
}

function formatDateTimeCell(value) {
  if (!value) return '-';

  const raw = String(value).trim();
  if (!raw) return '-';

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [yyyy, mm, dd] = raw.split('-');
    return `${dd}/${mm}/${yyyy}`;
  }

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    return raw;
  }

  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  const hh = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');

  return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function escapeAttr(value) {
  return escapeHtml(value);
}

export function bindListUI() {
  $('#btnBuscarPedidos')?.addEventListener('click', handleBuscarClick);
  $('#btnReloadPedidos')?.addEventListener('click', fetchPedidos);
  $('#pagAnterior')?.addEventListener('click', handlePrevPage);
  $('#pagProxima')?.addEventListener('click', handleNextPage);

  $('#qPedidos')?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleBuscarClick();
    }
  });

  $('#apRowsPerPage')?.addEventListener('change', handleAutoRefreshFilters);
  $('#statusFiltroPedidos')?.addEventListener('change', handleAutoRefreshFilters);
  $('#dtRangePedidos')?.addEventListener(
    'range-change',
    () => {
      syncPedidosDateRange();
      handleAutoRefreshFilters();
    }
  ); $('#dtAtePedidos')?.addEventListener('change', handleAutoRefreshFilters);

  $('#corpoTabelaMovimentacoes')?.addEventListener('click', handleTableClick);
}

// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: orders.return.js                                               ║
// ║ MODULE: Orders                                                       ║
// ║ PRODNEX ERP                                                          ║
// ║ Return Order (pedido → orçamento)                                    ║
// ╚══════════════════════════════════════════════════════════════════════╝


export function hasNfeLinked(o) {
  const cand = [
    o?.nfe_id, o?.nfeId,
    o?.nfe_key, o?.nfeKey, o?.chave_nfe, o?.chave,
    o?.nfe_number, o?.nfeNumber, o?.numero_nfe,
    o?.nfe_protocol, o?.nfeProtocol, o?.protocolo,
    o?.nfe_plugnotas_id, o?.nfePlugnotasId,
    o?.nfe_xml_url, o?.nfeXmlUrl,
    o?.nfe_danfe_url, o?.nfeDanfeUrl,
  ];

  if (cand.some(v => v !== undefined && v !== null && String(v).trim() !== '')) {
    return true;
  }

  const st = String(o?.nfe_status || o?.nfeStatus || '').toUpperCase().trim();

  if (st && !['SEM_NFE', 'SEM NF-E', 'SEM NFE', ''].includes(st)) {
    return true;
  }

  return false;
}

export function syncReturnOrderButtons({ listRow = null, header = null } = {}) {
  const btnEditor = $('#btnReturnOrder');
  if (!btnEditor) return;

  const hasNfe =
    hasNfeLinked(header) ||
    hasNfeLinked(listRow) ||
    hasNfeLinked(state.editing?.header) ||
    false;

  const hasOrderOpen = !!state.selectedId;

  const uiStatus = $('#statusPedido')?.value;

  const st = normalizeStatus(
    uiStatus ??
    header?.status ??
    listRow?.status ??
    state.editing?.header?.status ??
    ''
  );

  const isCanceled = st === 'CANCELADO';
  const isBilled = st === 'FATURADO';

  btnEditor.disabled = !hasOrderOpen || hasNfe || isCanceled || isBilled;

  btnEditor.title = !hasOrderOpen
    ? 'Abra um pedido existente para usar Return Order.'
    : hasNfe
      ? 'NF-e já gerada para este pedido. Não é possível retornar para orçamento.'
      : isCanceled
        ? 'Pedido já está CANCELADO. Não é possível retornar novamente.'
        : isBilled
          ? 'Pedido FATURADO. Não é possível retornar para orçamento.'
          : 'Cancelar pedido e retornar para orçamento (sem NF-e).';

  btnEditor.classList.toggle('is-disabled', btnEditor.disabled);
}

export async function returnOrder(orderId) {
  const id = orderId || state.selectedId;

  if (!id) {
    toast.warn(
      'Nenhum pedido selecionado',
      'Selecione um pedido da lista para retornar ao orçamento.'
    );
    return;
  }

  const row =
    state.list.find((x) =>
      String(x.order_id ?? x.id ?? x.number) === String(id)
    ) || null;

  if (row && hasNfeLinked(row)) {
    toast.warn(
      'Ação bloqueada',
      'Este pedido já possui NF-e gerada. Não é possível retornar para orçamento.'
    );
    syncReturnOrderButtons({ listRow: row, header: state.editing?.header });
    return;
  }

  if (state.editing?.header && hasNfeLinked(state.editing.header)) {
    toast.warn(
      'Ação bloqueada',
      'Este pedido já possui NF-e gerada. Não é possível retornar para orçamento.'
    );
    syncReturnOrderButtons({ listRow: row, header: state.editing.header });
    return;
  }

  const rowStatus = normalizeStatus(
    row?.status || state.editing?.header?.status || ''
  );

  if (rowStatus === 'CANCELADO') {
    toast.warn(
      'Ação bloqueada',
      'Este pedido já está CANCELADO. Não é possível retornar novamente.'
    );
    syncReturnOrderButtons({ listRow: row, header: state.editing?.header });
    return;
  }

  if (rowStatus === 'FATURADO') {
    toast.warn(
      'Ação bloqueada',
      'Este pedido está FATURADO. Não é possível retornar para orçamento.'
    );
    syncReturnOrderButtons({ listRow: row, header: state.editing?.header });
    return;
  }

  const ok = window.confirm(
    `Retornar o pedido #${id} para Orçamento?\n\n` +
    `Isso irá:\n` +
    `- Cancelar o pedido\n` +
    `- Reabrir o orçamento vinculado\n` +
    `- Restaurar o estoque (grades)\n\n` +
    `Continuar?`
  );

  if (!ok) return;

  const btnEditor = $('#btnReturnOrder');
  const prevTxt = btnEditor?.textContent;

  if (btnEditor) {
    btnEditor.disabled = true;
    btnEditor.textContent = '⏳ Returning...';
  }

  try {
    const r = await fetch(ROUTES.returnOrder(id), {
      method: 'POST',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });

    const js = await r.json().catch(() => ({}));

    if (!r.ok || js?.ok === false) {
      const message =
        js?.error ||
        js?.message ||
        `Falha ao retornar pedido (HTTP ${r.status})`;

      toast.error(
        'Erro ao retornar pedido',
        String(message).replace(/\n/g, '<br/>')
      );
      return;
    }

    toast.success(
      'Pedido retornado ao orçamento',
      `Pedido cancelado e orçamento #${js?.budget_id ?? '—'} reaberto.`
    );

    state.selectedId = null;
    state.editing = null;

    closeEditorPedido();

    await fetchPedidos();

    activateTab('list');

    syncReturnOrderButtons({});
  } catch (err) {
    console.error('[orders] exceção no Return Order:', err);

    toast.error(
      'Erro ao retornar pedido',
      String(err.message || err)
    );
  } finally {
    if (btnEditor) {
      btnEditor.textContent = prevTxt || '↩ Return Order';
    }

    syncReturnOrderButtons({ header: state.editing?.header || null });
  }
}