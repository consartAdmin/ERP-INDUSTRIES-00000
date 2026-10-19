// ╔══════════════════════════════════════════════════════════════════════╗
// ║ webhookPlugNotas.js — Monitor NF-e Webhook (PlugNotas)              ║
// ║ PRODNEX ERP (Frontend ESM)                                          ║
// ║                                                                      ║
// ║ - Consome GET  /api/nfe/webhooks                                     ║
// ║ - Consome POST /api/nfe/webhooks/reprocess                           ║
// ║ - Atualiza cards de resumo + tabela + paginação                      ║
// ╚══════════════════════════════════════════════════════════════════════╝

// ---------------------------------------------------------------------
// Config API
// ---------------------------------------------------------------------
const ROOT_API =
  (typeof window !== 'undefined' && (window.API_BASE || window.apiBase)) ||
  window.location.origin;

const API_BASE = `${ROOT_API}/api/nfe`;
const PAGE_SIZE = 20;

// Fallback simples de modal (usa centerAlertModal se existir)
const showCenterModal =
  (typeof window !== 'undefined' && window.showCenterModal) ||
  ((opts = {}) => {
    const msg = `${opts.title ? opts.title + '\n\n' : ''}${opts.message || ''}`;
    // eslint-disable-next-line no-alert
    alert(msg);
  });

// ---------------------------------------------------------------------
// DOM helper
// ---------------------------------------------------------------------
const $ = (sel) => document.querySelector(sel);

// Campos principais
const empresaInput = $('#empresa');
const periodoSelect = $('#periodo');
const statusSelect = $('#status');
const buscarInput = $('#buscar');

const btnPesquisar = $('#btnPesquisar');
const btnLimpar = $('#btnLimpar');
const btnSync = $('#btnSync');
const btnBuscar = $('#btnBuscar') || btnPesquisar;

const totalPendenteEl = $('#totalPendente');
const totalProcessandoEl = $('#totalProcessando');
const totalAutorizadoEl = $('#totalAutorizado');
const totalRejeitadoEl = $('#totalRejeitado');
const totalCanceladoEl = $('#totalCancelado');
const totalSubstituidoEl = $('#totalSubstituido');
const totalNotasEl = $('#totalNotas');

const tableBody = $('#tableBody');
const resultInfoEl = $('#resultInfo');
const pageInfoEl = $('#pageInfo');
const btnPagePrev = $('#btnPagePrev');
const btnPageNext = $('#btnPageNext');

let currentPage = 1;
let totalPages = 1;

// ---------------------------------------------------------------------
// Utils
// ---------------------------------------------------------------------
function sanitizeCnpj(str = '') {
  return (str || '').replace(/\D/g, '');
}

function formatDateTime(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('pt-BR');
}

// ---------------------------------------------------------------------
// Carregamento principal
// ---------------------------------------------------------------------
async function fetchWebhooks(page = 1) {
  try {
    currentPage = page;

    const emitterCnpj = sanitizeCnpj(empresaInput?.value || '');

    const params = new URLSearchParams({
      emitterCnpj,
      periodo: periodoSelect?.value || 'today',
      status: statusSelect?.value || 'all',
      q: (buscarInput?.value || '').trim(),
      page: String(currentPage),
      pageSize: String(PAGE_SIZE)
    });

    const resp = await fetch(`${API_BASE}/webhooks?${params.toString()}`, {
      headers: { Accept: 'application/json' }
    });

    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}`);
    }

    const data = await resp.json();
    renderSummary(data.summary || {});
    renderTable(data.rows || []);
    renderPagination(data.page, data.pages, data.total);
  } catch (err) {
    console.error('[WebhookPlugNotas] Erro ao buscar webhooks:', err);
    showCenterModal({
      title: 'Erro ao buscar registros',
      message:
        'Não foi possível carregar os registros de NF-e no momento.\n' +
        'Verifique a conexão com o servidor e tente novamente.'
    });
  }
}

function renderSummary(summary) {
  // Aceita tanto pt-BR quanto inglês, pra ser resiliente
  const pendente =
    summary.pendente ?? summary.pending ?? summary.PENDING ?? 0;
  const processando =
    summary.processando ?? summary.processing ?? summary.PROCESSING ?? 0;
  const autorizado =
    summary.autorizado ?? summary.authorized ?? summary.AUTHORIZED ?? 0;
  const rejeitado =
    summary.rejeitado ?? summary.rejected ?? summary.REJECTED ?? 0;
  const cancelado =
    summary.cancelado ?? summary.cancelled ?? summary.CANCELLED ?? 0;
  const substituido =
    summary.substituido ?? summary.substituted ?? summary.SUBSTITUTED ?? 0;

  const total =
    pendente +
    processando +
    autorizado +
    rejeitado +
    cancelado +
    substituido;

  if (totalPendenteEl) totalPendenteEl.textContent = pendente;
  if (totalProcessandoEl) totalProcessandoEl.textContent = processando;
  if (totalAutorizadoEl) totalAutorizadoEl.textContent = autorizado;
  if (totalRejeitadoEl) totalRejeitadoEl.textContent = rejeitado;
  if (totalCanceladoEl) totalCanceladoEl.textContent = cancelado;
  if (totalSubstituidoEl) totalSubstituidoEl.textContent = substituido;
  if (totalNotasEl) totalNotasEl.textContent = total;
}

function renderTable(rows) {
  if (!tableBody) return;

  tableBody.innerHTML = '';

  if (!rows.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 6;
    td.textContent = 'Nenhum registro encontrado para os filtros informados.';
    td.style.textAlign = 'center';
    td.style.padding = '12px 8px';
    tr.appendChild(td);
    tableBody.appendChild(tr);

    if (resultInfoEl) resultInfoEl.textContent = 'Exibindo 0 registros';
    return;
  }

  rows.forEach((row) => {
    const tr = document.createElement('tr');

    const tdId = document.createElement('td');
    tdId.textContent = row.id;
    tr.appendChild(tdId);

    const tdChave = document.createElement('td');
    tdChave.textContent = row.chave_acesso || '-';
    tr.appendChild(tdChave);

    const tdIntegracao = document.createElement('td');
    tdIntegracao.textContent = row.integration_id || '-';
    tr.appendChild(tdIntegracao);

    const tdStatus = document.createElement('td');
    tdStatus.textContent = (row.status || '').toString();
    tr.appendChild(tdStatus);

    const tdData = document.createElement('td');
    tdData.textContent = formatDateTime(row.created_at);
    tr.appendChild(tdData);

    const tdAcoes = document.createElement('td');
    tdAcoes.style.textAlign = 'right';

    const btnDetalhes = document.createElement('button');
    btnDetalhes.type = 'button';
    btnDetalhes.className = 'btn btn-flat btn-sm';
    btnDetalhes.textContent = 'Ver detalhes';
    btnDetalhes.addEventListener('click', () => {
      const lines = [
        `Status: ${row.status || '-'}`,
        row.cstat ? `cStat: ${row.cstat}` : '',
        row.motivo ? `Motivo: ${row.motivo}` : '',
        row.chave_acesso ? `Chave: ${row.chave_acesso}` : '',
        row.integration_id ? `ID Integração: ${row.integration_id}` : '',
        row.numero_nfe ? `Número: ${row.numero_nfe}` : '',
        row.serie ? `Série: ${row.serie}` : '',
        row.tipo_evento ? `Tipo de evento: ${row.tipo_evento}` : '',
        row.created_at ? `Criado em: ${formatDateTime(row.created_at)}` : ''
      ].filter(Boolean);

      showCenterModal({
        title: 'Detalhes da NF-e',
        message: lines.join('\n')
      });
    });

    tdAcoes.appendChild(btnDetalhes);
    tr.appendChild(tdAcoes);

    tableBody.appendChild(tr);
  });

  if (resultInfoEl) {
    resultInfoEl.textContent = `Exibindo ${rows.length} registro(s)`;
  }
}

function renderPagination(page, pages, total) {
  currentPage = Number(page) || 1;
  totalPages = Math.max(1, Number(pages) || 1);

  if (pageInfoEl) {
    pageInfoEl.textContent = `Página ${currentPage} de ${totalPages}`;
  }

  if (btnPagePrev) btnPagePrev.disabled = currentPage <= 1;
  if (btnPageNext) btnPageNext.disabled = currentPage >= totalPages;

  if (totalNotasEl && typeof total === 'number') {
    // se backend mandou "total", garante que Total de Notas reflita isto
    totalNotasEl.textContent = total;
  }
}

// ---------------------------------------------------------------------
// Ações
// ---------------------------------------------------------------------
async function handlePesquisarClick() {
  await fetchWebhooks(1);
}

function handleLimparClick() {
  if (periodoSelect) periodoSelect.value = 'today';
  if (statusSelect) statusSelect.value = 'all';
  if (buscarInput) buscarInput.value = '';
  fetchWebhooks(1);
}

async function handleReprocessClick() {
  const emitterCnpj = sanitizeCnpj(empresaInput?.value || '');
  if (!emitterCnpj) {
    showCenterModal({
      title: 'CNPJ não informado',
      message:
        'Não foi possível identificar o CNPJ do emitente.\n' +
        'Verifique o campo "Empresa (Emitente)".'
    });
    return;
  }

  try {
    const resp = await fetch(`${API_BASE}/webhooks/reprocess`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        emitterCnpj,
        // Por padrão, reprocessa REJEITADAS; o backend faz o mapeamento.
        status: 'REJECTED'
      })
    });

    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}`);
    }

    const data = await resp.json();

    showCenterModal({
      title: 'Reprocesso solicitado',
      message:
        `Notas processadas: ${data.reprocessed ?? 0}\n` +
        `Falhas: ${data.failed ?? 0}`
    });

    // Recarrega a grid para refletir novos eventos / status
    await fetchWebhooks(currentPage);
  } catch (err) {
    console.error('[WebhookPlugNotas] Erro no reprocesso:', err);
    showCenterModal({
      title: 'Erro ao reprocessar',
      message:
        'Não foi possível sincronizar com a PlugNotas.\n' +
        'Verifique sua PLUGNOTAS_API_KEY e a conexão com a API.'
    });
  }
}

// ---------------------------------------------------------------------
// Listeners
// ---------------------------------------------------------------------
if (btnPesquisar) btnPesquisar.addEventListener('click', handlePesquisarClick);
if (btnBuscar && btnBuscar !== btnPesquisar) {
  btnBuscar.addEventListener('click', handlePesquisarClick);
}
if (btnLimpar) btnLimpar.addEventListener('click', handleLimparClick);
if (btnSync) btnSync.addEventListener('click', handleReprocessClick);

if (btnPagePrev) {
  btnPagePrev.addEventListener('click', () => {
    if (currentPage > 1) fetchWebhooks(currentPage - 1);
  });
}
if (btnPageNext) {
  btnPageNext.addEventListener('click', () => {
    if (currentPage < totalPages) fetchWebhooks(currentPage + 1);
  });
}

// Enter no campo de busca
if (buscarInput) {
  buscarInput.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') {
      ev.preventDefault();
      handlePesquisarClick();
    }
  });
}

// Carrega inicial
fetchWebhooks(1).catch((err) =>
  console.error('[WebhookPlugNotas] Erro inicial:', err)
);
