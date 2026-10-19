import { showCenterModal } from './accountsReceivable.alert.js';
import { boletoUrl, cancelBoleto, excelUrl, listAccounts, pdfUrl, syncAsaasStream } from './accountsReceivable.api.js';
import { openEdit } from './accountsReceivable.form.js';
import { openReceiveModal } from './accountsReceivable.modal.js';
import { renderTable, statusBR, updatePagination, updateSummary } from './accountsReceivable.render.js';
import { state } from './accountsReceivable.state.js';
import { $, dateBR, moneyBR } from './accountsReceivable.utils.js';

function filterParams(withPaging = true) {
  const params = new URLSearchParams();

  if (withPaging) {
    params.set('page', String(state.page));
    params.set('pageSize', String(state.pageSize));

    params.set(
      'orderBy',
      state.orderBy || 'created_at'
    );

    params.set(
      'orderDirection',
      state.orderDirection || 'desc'
    );
  }

  const fields = {
    search: '#filterSearch',
    status: '#filterStatus',
    bankAccountId: '#filterBankAccount',
  };

  Object.entries(fields).forEach(([name, selector]) => {
    const value = $(selector)?.value?.trim();

    if (value) {
      params.set(name, value);
    }
  });

  const dateType = $('#filterDateType')?.value === 'issue_date'
    ? 'issue_date'
    : 'due_date';
  const fromDate = $('#filterFromDue')?.value?.trim();
  const toDate = $('#filterToDue')?.value?.trim();

  if (fromDate) {
    params.set(dateType === 'issue_date' ? 'fromIssueDate' : 'fromDueDate', fromDate);
  }

  if (toDate) {
    params.set(dateType === 'issue_date' ? 'toIssueDate' : 'toDueDate', toDate);
  }

  // Também informa explicitamente o campo escolhido para APIs que usam
  // um intervalo genérico (dateType/fromDate/toDate).
  params.set('dateType', dateType);
  if (fromDate) params.set('fromDate', fromDate);
  if (toDate) params.set('toDate', toDate);

  return params;
}

function responseItems(json) {
  return Array.isArray(json)
    ? json
    : (json?.items || json?.rows || json?.data || []);
}

function responseTotals(json) {
  return json?.totals ?? json?.summary ?? json?.resume ?? null;
}

const OPEN_STATUSES = new Set([
  'PENDING',
  'OVERDUE',
  'PARTIAL',
]);

function sumItems(items) {
  return items.reduce((totals, item) => {
    const total = Number(item.value ?? item.total ?? 0) || 0;
    const paid = Number(item.paid_value ?? item.received ?? 0) || 0;
    const status = String(item.status ?? '').trim().toUpperCase();

    totals.total += total;
    totals.paid += paid;

    // O saldo em aberto considera somente títulos ativos.
    // Pagos e cancelados não entram no valor a receber.
    if (OPEN_STATUSES.has(status)) {
      totals.balance += Math.max(0, total - paid);
    }

    return totals;
  }, { total: 0, paid: 0, balance: 0 });
}

async function loadFilteredTotals() {
  const params = filterParams(false);

  // Solicita o maior lote possível. Se a API limitar o tamanho,
  // as páginas restantes serão carregadas logo abaixo.
  params.set('page', '1');
  params.set('pageSize', '500');
  params.set('orderBy', 'created_at');
  params.set('orderDirection', 'desc');

  const firstJson = await listAccounts(params);
  const apiTotals = responseTotals(firstJson);

  // Quando o backend já entrega agregados globais, não faz chamadas extras.
  if (apiTotals) {
    return apiTotals;
  }

  const firstItems = responseItems(firstJson);
  const totalRecords = Number(
    firstJson?.total ??
    firstJson?.totalCount ??
    firstJson?.count ??
    firstItems.length
  );

  const effectivePageSize = Math.max(
    1,
    Number(firstJson?.pageSize ?? firstJson?.page_size ?? firstItems.length ?? 1)
  );

  const totalPages = Number(
    firstJson?.totalPages ??
    firstJson?.total_pages ??
    Math.max(1, Math.ceil(totalRecords / effectivePageSize))
  );

  const allItems = [...firstItems];

  if (totalPages > 1) {
    const requests = [];

    for (let page = 2; page <= totalPages; page += 1) {
      const pageParams = new URLSearchParams(params);
      pageParams.set('page', String(page));
      pageParams.set('pageSize', String(effectivePageSize));
      requests.push(listAccounts(pageParams));
    }

    const remainingPages = await Promise.all(requests);

    remainingPages.forEach((json) => {
      allItems.push(...responseItems(json));
    });
  }

  const totals = sumItems(allItems);

  return totals;
}

export async function loadAccounts(options = {}) {
  const {
    page,
    orderBy,
    orderDirection,
  } = options;

  // Atualiza a página quando ela for informada
  if (Number.isInteger(Number(page)) && Number(page) > 0) {
    state.page = Number(page);
  }

  // Proteção no frontend: somente colunas autorizadas
  const allowedOrderColumns = [
    'id',
    'customer_id',
    'customer_name',
    'account_bank',
    'document_type_name',
    'invoice_number',
    'issue_date',
    'created_at',
    'due_date',
    'status',
    'total',
    'received',
    'balance',
  ];

  if (allowedOrderColumns.includes(orderBy)) {
    state.orderBy = orderBy;
  }

  // Aceita somente ASC ou DESC
  const normalizedDirection =
    String(orderDirection || '').toLowerCase();

  if (
    normalizedDirection === 'asc' ||
    normalizedDirection === 'desc'
  ) {
    state.orderDirection = normalizedDirection;
  }

  try {
    const json = await listAccounts(filterParams());

    const items = responseItems(json);

    const total = Number(
      json.total ??
      json.totalCount ??
      items.length
    );

    state.page = Number(
      json.page ?? state.page
    );

    state.pageSize = Number(
      json.pageSize ?? state.pageSize
    );

    state.totalPages = Number(
      json.totalPages ??
      Math.max(
        1,
        Math.ceil(total / state.pageSize)
      )
    );

    renderTable(items, {
      receive: openReceiveModal,
      boleto: openBoleto,
      cancelBoleto: cancelBoletoFromRow,
      edit: openEdit,
    });

    const totals = responseTotals(json) ?? await loadFilteredTotals();

    updateSummary(items, totals);
    updatePagination(total);
  } catch (error) {
    showCenterModal({
      type: 'error',
      title: 'Erro ao listar contas a receber',
      message:
        error.message ||
        'Falha na comunicação com a API.',
    });
  }
}

export function openBoleto(row) {
  const id = row?.dataset.id;
  if (!id) return showCenterModal({ type: 'error', title: 'Conta não identificada', message: 'ID da conta não localizado na linha.' });
  window.open(boletoUrl(id), '_blank', 'noopener');
}

export async function cancelBoletoFromRow(row, button) {
  const id = row?.dataset.id;
  if (!id) return showCenterModal({ type: 'error', title: 'Conta não identificada', message: 'ID da conta não localizado na linha.' });
  if (!confirm('Confirmar CANCELAMENTO do boleto?\n\n✅ Isso cancela a cobrança no ASAAS e marca como CANCELLED no ERP.\n⚠️ Não é reversível no ASAAS.')) return;
  const oldText = button.textContent;
  try {
    button.disabled = true; button.textContent = '⏳';
    const result = await cancelBoleto(id);
    showCenterModal({ type: 'success', title: 'Boleto cancelado', message: result?.message || 'Cobrança cancelada no Asaas e atualizada no ERP.' });
    await loadAccounts();
  } catch (error) { showCenterModal({ type: 'error', title: 'Falha ao cancelar boleto', message: error.message || 'Erro ao comunicar com a API.' }); }
  finally { button.disabled = false; button.textContent = oldText; }
}

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
}[c]));

// O Asaas manda 'YYYY-MM-DD'; new Date() leria em UTC e mostraria o dia anterior.
function dueDateBR(value) {
  const match = String(value ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : (dateBR(value) || '—');
}

/** Modal com a lista das contas atualizadas na sincronização com o Asaas. */
function showSyncResultModal(result = {}) {
  const items = Array.isArray(result.items) ? result.items : [];
  const failed = items.filter((item) => !item.ok);
  const changed = items.filter((item) => item.ok && item.statusAfter !== item.statusBefore);

  const summary = `
    <div class="ar-sync-summary">
      <span><b>${result.synced ?? 0}</b> de <b>${result.total ?? items.length}</b> atualizada(s)</span>
      <span class="ar-sync-pill ar-sync-pill--changed"><b>${changed.length}</b> mudou(aram) de status</span>
      ${failed.length ? `<span class="ar-sync-pill ar-sync-pill--failed"><b>${failed.length}</b> falha(s)</span>` : ''}
    </div>
  `;

  if (!items.length) {
    showCenterModal({
      variant: 'info',
      title: 'Sincronização com Asaas',
      message: 'Nenhuma cobrança Pendente ou Vencida vinculada ao Asaas para atualizar.',
    });
    return;
  }

  const rows = items.map((item) => {
    const statusChanged = item.ok && item.statusAfter !== item.statusBefore;
    const status = !item.ok
      ? `<span class="ar-sync-error" title="${escapeHtml(item.error)}">Falhou</span>`
      : statusChanged
        ? `${escapeHtml(statusBR(item.statusBefore))} → <b>${escapeHtml(statusBR(item.statusAfter))}</b>`
        : escapeHtml(statusBR(item.statusAfter));

    return `
      <tr class="${!item.ok ? 'is-failed' : statusChanged ? 'is-changed' : ''}">
        <td>${escapeHtml(item.accountsReceivableId)}</td>
        <td>${escapeHtml(item.invoiceNumber || '—')}</td>
        <td class="ar-sync-customer">${escapeHtml(item.customerName || '—')}</td>
        <td>${escapeHtml(dueDateBR(item.dueDate))}</td>
        <td class="ar-sync-right">${escapeHtml(moneyBR(item.value))}</td>
        <td>${status}</td>
      </tr>
    `;
  }).join('');

  showCenterModal({
    variant: failed.length ? 'warning' : 'success',
    title: 'Sincronização com Asaas concluída',
    className: 'ar-sync-modal',
    timeoutMs: null,
    html: true, // conteúdo montado acima com escapeHtml

    message: `
      ${summary}
      <div class="ar-sync-table-wrap">
        <table class="ar-sync-table">
          <thead>
            <tr><th>ID</th><th>Nº Fatura</th><th>Cliente</th><th>Vencimento</th><th>Valor</th><th>Status</th></tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `,
  });
}

/** Modal de progresso: fica aberto e é atualizado a cada conta processada. */
function openSyncProgressModal() {
  showCenterModal({
    variant: 'info',
    title: 'Sincronizando com o Asaas',
    className: 'ar-sync-modal',
    timeoutMs: null,
    closeOnEscape: false,
    html: true,
    buttons: [{ label: 'Ocultar', variant: 'cancel' }],
    message: `
      <div class="ar-sync-progress">
        <div class="ar-sync-progress__head">
          <span id="arSyncProgressText">Buscando cobranças Pendentes e Vencidas…</span>
          <b id="arSyncProgressCount"></b>
        </div>
        <div class="ar-sync-progress__bar"><span id="arSyncProgressBar"></span></div>
        <ul id="arSyncProgressLog" class="ar-sync-progress__log"></ul>
        <small class="ar-sync-progress__hint">Pode ocultar esta janela: a sincronização continua e o resultado aparece ao final.</small>
      </div>
    `,
  });

  const el = (id) => document.getElementById(id);

  return {
    start(total) {
      el('arSyncProgressCount') && (el('arSyncProgressCount').textContent = `0 de ${total}`);
      el('arSyncProgressText') && (el('arSyncProgressText').textContent = total
        ? 'Consultando cobranças no Asaas…'
        : 'Nenhuma cobrança em aberto para atualizar.');
    },
    item({ index, total, item }) {
      const percent = total ? Math.round((index / total) * 100) : 100;
      el('arSyncProgressBar') && (el('arSyncProgressBar').style.width = `${percent}%`);
      el('arSyncProgressCount') && (el('arSyncProgressCount').textContent = `${index} de ${total}`);

      const log = el('arSyncProgressLog');
      if (!log || !item) return;

      const changed = item.ok && item.statusAfter !== item.statusBefore;
      const status = !item.ok
        ? `<span class="ar-sync-error">falhou</span>`
        : changed
          ? `${escapeHtml(statusBR(item.statusBefore))} → <b>${escapeHtml(statusBR(item.statusAfter))}</b>`
          : escapeHtml(statusBR(item.statusAfter));

      const li = document.createElement('li');
      li.className = !item.ok ? 'is-failed' : changed ? 'is-changed' : '';
      li.innerHTML = `
        <span class="ar-sync-progress__icon">${item.ok ? '✓' : '✕'}</span>
        <span class="ar-sync-progress__name">#${escapeHtml(item.accountsReceivableId)} · ${escapeHtml(item.invoiceNumber || '—')} · ${escapeHtml(item.customerName || '—')}</span>
        <span>${status}</span>
      `;
      log.prepend(li);
    },
  };
}

export async function syncWithAsaas() {
  const confirmed = await showCenterModal({
    variant: 'info',
    title: 'Sincronizar com o Asaas',
    message: 'Deseja atualizar com o Asaas as cobranças Pendentes e Vencidas?',
    okText: 'Sincronizar',
    closeText: 'Cancelar',
    timeoutMs: null,
  });
  if (confirmed !== true) return;

  const button = $('#btnSyncAsaas');
  const oldText = button?.textContent;
  try {
    if (button) { button.disabled = true; button.textContent = 'Sincronizando...'; }

    const progress = openSyncProgressModal();
    const result = await syncAsaasStream((event) => {
      if (event.type === 'start') progress.start(event.total);
      if (event.type === 'item') progress.item(event);
    });

    await loadAccounts();
    showSyncResultModal(result);
  } catch (error) {
    showCenterModal({ variant: 'error', title: 'Erro ao sincronizar com Asaas', message: error.message || 'Falha ao comunicar com a API do Asaas.' });
  } finally {
    if (button) { button.disabled = false; button.textContent = oldText; }
  }
}

export function exportExcel() { window.open(excelUrl(filterParams(false)), '_blank'); }
export function exportPdf() { window.open(pdfUrl(filterParams(false)), '_blank'); }
