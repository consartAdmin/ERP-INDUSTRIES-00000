/* ╔══════════════════════════════════════════════════════════════════╗
 * ║ nfeInbox.render.js — Renderização | PRODNEX ERP (ESM)           ║
 * ╚══════════════════════════════════════════════════════════════════╝ */
'use strict';

import { formatDateOnly, formatMoney, getManifestLabel, shortenKey } from './nfeInbox.utils.js';

export function setSelected(dom, state, row = null) {
  state.selectedRowEl = row;
  state.selectedId = row?.dataset.id || null;
  const hasSelection = Boolean(state.selectedId);
  [dom.$btnEntradaNF, dom.$btnDownloadXml, dom.$btnDownloadPdf, dom.$btnManifest]
    .forEach((button) => { if (button) button.disabled = !hasSelection; });

  if (dom.$btnDownloadXmlLote) {
    dom.$btnDownloadXmlLote.disabled = !state.currentRows.length;
  }
}

export function selectRow(dom, state, row) {
  if (!row?.parentElement) return;

  row.parentElement
    .querySelectorAll('tr')
    .forEach((item) => {
      item.classList.remove('nfi-row-selected');
      item.setAttribute('aria-selected', 'false');
    });

  row.classList.add('nfi-row-selected');
  row.setAttribute('aria-selected', 'true');

  setSelected(dom, state, row);
}

function createCell(text = '', className = '') {
  const cell = document.createElement('td');
  cell.textContent = text;
  if (className) cell.className = className;
  return cell;
}

function createPill(text, className) {
  const pill = document.createElement('span');
  pill.textContent = text;
  pill.classList.add('nfi-pill', className);
  return pill;
}

export function renderTable(dom, state, rows = [], handlers = {}) {
  if (!dom.$tbody) return;
  const safeRows = Array.isArray(rows) ? rows : [];
  const countLabel = `${safeRows.length} ${safeRows.length === 1 ? 'registro' : 'registros'}`;
  if (dom.$tableInfo) dom.$tableInfo.textContent = countLabel;
  if (dom.$emptyState) dom.$emptyState.hidden = safeRows.length > 0;
  dom.$tbody.innerHTML = '';

  const fragment = document.createDocumentFragment();
  safeRows.forEach((item) => {
    const row = document.createElement('tr');
    Object.assign(row.dataset, {
      id: item.id || '',
      accessKey: item.chave_nfe || '',
      emitente: item.emitente_razao || item.emitente_cnpj || '',
      valorTotal: item.valor_total == null ? '' : String(item.valor_total),
      emitenteCnpj: item.emitente_cnpj || '',
      destCnpj: item.destinatario_cnpj || '',
    });

    const date = item.data_autorizacao || item.data_emissao;
    row.append(createCell(date ? formatDateOnly(date) : ''));
    const keyCell = createCell(shortenKey(item.chave_nfe));
    keyCell.title = item.chave_nfe || '';
    row.append(keyCell);
    row.append(createCell(item.numero || '', 'nfi-col-numero'));
    row.append(createCell(item.emitente_razao || item.emitente_cnpj || ''));
    row.append(createCell(item.destinatario_razao || item.destinatario_cnpj || ''));
    row.append(createCell(formatMoney(item.valor_total), 'nfi-col-right'));

    const statusCell = createCell();
    statusCell.append(createPill(
      item.entrada_criada ? 'Entrada Concluída' : 'Entrada Pendente',
      item.entrada_criada ? 'nfi-pill-entry-completed' : 'nfi-pill-entry-pending',
    ));
    row.append(statusCell);

    // Mesma classe do <th>: a coluna inteira é ocultada por CSS.
    const manifestCell = createCell('', 'nfi-col-manifest');
    const manifest = getManifestLabel(item.manifestacao);
    if (manifest) manifestCell.append(createPill(manifest, 'nfi-pill-manifest'));
    else manifestCell.textContent = '-';
    row.append(manifestCell);

    row.addEventListener('click', () => handlers.onSelect?.(row, item));
    row.addEventListener('dblclick', () => handlers.onOpenDetail?.(row, item));

    // Teclado: a linha entra na ordem de tabulação, Espaço seleciona e
    // Enter abre o detalhe — o equivalente ao clique e ao duplo clique.
    row.tabIndex = 0;
    row.setAttribute('aria-selected', 'false');
    row.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        handlers.onOpenDetail?.(row, item);
      } else if (event.key === ' ' || event.key === 'Spacebar') {
        event.preventDefault();
        handlers.onSelect?.(row, item);
      }
    });

    fragment.append(row);
  });
  dom.$tbody.append(fragment);
  if (!safeRows.length) setSelected(dom, state, null);
}

export function updatePagination(dom, state) {
  const pageSize = Number(state.pageSize) || 50;
  const total = Number(state.total) || 0;

  state.totalPages = Math.max(
    1,
    Math.ceil(total / pageSize)
  );

  state.currentPage = Math.min(
    Math.max(1, Number(state.currentPage) || 1),
    state.totalPages
  );

  if (dom.$pageInfo) {
    dom.$pageInfo.textContent =
      `Página ${state.currentPage} de ${state.totalPages}`;
  }

  if (dom.$prevPage) {
    dom.$prevPage.disabled =
      state.currentPage <= 1;
  }

  if (dom.$nextPage) {
    dom.$nextPage.disabled =
      total === 0 ||
      state.currentPage >= state.totalPages;
  }
}

export function setLoading(dom, state, loading) {
  state.loading = loading;
  if (dom.$btnApplyFilters) {
    dom.$btnApplyFilters.disabled = loading;
    dom.$btnApplyFilters.textContent = loading ? '⏳ Filtrando...' : '🔍 Filtrar';
  }
}

const SYNC_LABELS = {
  never: 'Sem sincronização',
  running: 'Sincronizando...',
  ok: 'Sincronizado',
  error: 'Falha',
};

function formatSyncMoment(iso) {
  if (!iso) return null;

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

/**
 * Mostra a data/hora da última sincronização DF-e (bootstrap ou timer).
 * Recebe o objeto `data` de GET /api/nfe-inbox/sync-status.
 */
export function renderSyncInfo(dom, info = {}) {
  if (!dom.$syncInfo) return;

  const status = info.status || 'never';

  // Enquanto roda, o fim ainda não existe: usa o início.
  const moment =
    formatSyncMoment(info.finishedAt) ||
    formatSyncMoment(info.startedAt);

  const label = SYNC_LABELS[status] || SYNC_LABELS.never;

  dom.$syncInfo.textContent = moment
    ? `Última sincronização: ${moment}`
    : 'Nunca sincronizado nesta sessão do servidor';

  dom.$syncInfo.dataset.syncStatus = status;

  const details = [`Status: ${label}`];

  if (info.trigger) details.push(`Origem: ${info.trigger}`);
  if (status === 'ok') details.push(`Notas processadas: ${info.totalInseridas ?? 0}`);
  if (status === 'error' && info.message) details.push(info.message);

  if (info.autoSyncEnabled === false) {
    details.push('Sincronização automática desativada no .env');
  } else if (info.intervalMinutes) {
    details.push(`Intervalo: ${info.intervalMinutes} min`);
  }

  dom.$syncInfo.title = details.join(' • ');
}

/**
 * Estado otimista enquanto a sincronização roda: o backend só publica o
 * novo status em sync-status depois de terminar, então o indicador ficaria
 * parado no valor anterior durante toda a chamada.
 */
export function setSyncRunning(dom, message = 'Sincronizando...') {
  if (!dom.$syncInfo) return;
  dom.$syncInfo.dataset.syncStatus = 'running';
  dom.$syncInfo.textContent = message;
}
