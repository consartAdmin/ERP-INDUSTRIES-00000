// ╔══════════════════════════════════════════════════════════════════╗
// ║ painelNfce.js — Front Painel NFC-e (Resumo PlugNotas)           ║
// ║ Path: backend/painelNfce/painelNfce.js                           ║
// ╚══════════════════════════════════════════════════════════════════╝

const API_BASE = (window.apiBase || window.API_BASE || window.location.origin).replace(/\/$/, '');

const els = {
  form: document.getElementById('nfce-search-form'),
  inputId: document.getElementById('nfce-id'),
  btnClear: document.getElementById('nfce-clear'),
  statusMsg: document.getElementById('nfce-status-message'),
  resultsSection: document.getElementById('nfce-results'),
  resultsCount: document.getElementById('nfce-results-count'),
  resultsList: document.getElementById('nfce-results-list'),
};

// -------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------
function setStatus(message, type = 'info') {
  if (!els.statusMsg) return;
  els.statusMsg.textContent = message || '';
  els.statusMsg.classList.remove('hidden', 'info', 'error');
  els.statusMsg.classList.add(type);
}

function clearStatus() {
  if (!els.statusMsg) return;
  els.statusMsg.textContent = '';
  els.statusMsg.classList.add('hidden');
  els.statusMsg.classList.remove('info', 'error');
}

function showResultsSection(show) {
  if (!els.resultsSection) return;
  if (show) els.resultsSection.classList.remove('hidden');
  else els.resultsSection.classList.add('hidden');
}

function fmtMoney(v) {
  const n = Number(v || 0);
  return n.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtDate(d) {
  // PlugNotas já manda DD/MM/YYYY, então só devolve; mas se vier vazio, evita "undefined"
  return d || '—';
}

function mapStatus(statusRaw) {
  const status = (statusRaw || '').toUpperCase();
  switch (status) {
    case 'CONCLUIDO':
      return { label: 'CONCLUÍDO', css: 'concluido' };
    case 'REJEITADO':
      return { label: 'REJEITADO', css: 'rejeitado' };
    case 'DENEGADO':
      return { label: 'DENEGADO', css: 'denegado' };
    case 'CANCELADO':
      return { label: 'CANCELADO', css: 'cancelado' };
    default:
      return { label: status || 'DESCONHECIDO', css: '' };
  }
}

// -------------------------------------------------------------------
// Render de cards
// -------------------------------------------------------------------
function renderResults(list) {
  if (!els.resultsList) return;

  els.resultsList.innerHTML = '';

  if (!list || !list.length) {
    els.resultsCount.textContent = 'Nenhum resultado encontrado para o identificador informado.';
    showResultsSection(true);
    return;
  }

  els.resultsCount.textContent =
    list.length === 1 ? '1 resultado encontrado.' : `${list.length} resultados encontrados.`;

  for (const item of list) {
    const {
      id,
      idIntegracao,
      codigo,
      emissao,
      status,
      destinada,
      emitente,
      destinatario,
      valor,
      numero,
      serie,
      chave,
      protocolo,
      dataAutorizacao,
      mensagem,
      pdf,
      xml,
      dataCancelamento,
      erro,
      protocoloCancelamento,
      cStat,
      xmlCancelamento,
    } = item;

    const statusInfo = mapStatus(status);

    const card = document.createElement('article');
    card.className = 'nfce-card';

    card.innerHTML = `
      <header class="nfce-card-header">
        <div>
          <h3 class="nfce-card-title">NFCE ${numero || '—'} · Série ${serie || '—'}</h3>
          <p class="nfce-card-subtitle">
            Emissão: ${fmtDate(emissao)}
            · Valor: R$ ${fmtMoney(valor)}
          </p>
        </div>
        <span class="nfce-status-badge ${statusInfo.css}">
          ${statusInfo.label}
          ${typeof cStat === 'number' ? `· cStat ${cStat}` : ''}
        </span>
      </header>

      <div class="nfce-details-grid">
        <div>
          <span class="nfce-detail-label">Chave</span>
          <span class="nfce-detail-value">${chave || '—'}</span>
        </div>

        <div>
          <span class="nfce-detail-label">Protocolo</span>
          <span class="nfce-detail-value">${protocolo || '—'}</span>
        </div>

        <div>
          <span class="nfce-detail-label">Data Autorização</span>
          <span class="nfce-detail-value">${fmtDate(dataAutorizacao)}</span>
        </div>

        <div>
          <span class="nfce-detail-label">Emitente</span>
          <span class="nfce-detail-value">${emitente || '—'}</span>
        </div>

        <div>
          <span class="nfce-detail-label">Destinatário</span>
          <span class="nfce-detail-value">${destinatario || '—'}</span>
        </div>

        <div>
          <span class="nfce-detail-label">Destinada?</span>
          <span class="nfce-detail-value">${destinada ? 'Sim' : 'Não'}</span>
        </div>

        <div>
          <span class="nfce-detail-label">ID PlugNotas</span>
          <span class="nfce-detail-value">${id || '—'}</span>
        </div>

        <div>
          <span class="nfce-detail-label">ID Integração</span>
          <span class="nfce-detail-value">${idIntegracao || '—'}</span>
        </div>

        <div>
          <span class="nfce-detail-label">Código NFe</span>
          <span class="nfce-detail-value">${codigo || '—'}</span>
        </div>
      </div>

      <div class="nfce-message-block">
        <div>
          <span class="label">Mensagem SEFAZ:</span>
          <span>${mensagem || '—'}</span>
        </div>
        ${
          erro
            ? `<div style="margin-top:4px;">
                 <span class="label">Erro PlugNotas:</span>
                 <span>${erro}</span>
               </div>`
            : ''
        }
      </div>

      <div class="nfce-links">
        ${
          pdf
            ? `<a class="nfce-link" href="${pdf}" target="_blank" rel="noopener noreferrer">
                PDF
               </a>`
            : ''
        }
        ${
          xml
            ? `<a class="nfce-link" href="${xml}" target="_blank" rel="noopener noreferrer">
                XML destinatário
               </a>`
            : ''
        }
        ${
          xmlCancelamento
            ? `<a class="nfce-link" href="${xmlCancelamento}" target="_blank" rel="noopener noreferrer">
                XML cancelamento
               </a>`
            : ''
        }
      </div>

      ${
        dataCancelamento || protocoloCancelamento
          ? `
          <div class="nfce-cancel-block">
            <div><strong>Cancelamento:</strong></div>
            <div>Data: ${fmtDate(dataCancelamento)}</div>
            <div>Protocolo: ${protocoloCancelamento || '—'}</div>
          </div>
        `
          : ''
      }
    `;

    els.resultsList.appendChild(card);
  }

  showResultsSection(true);
}

// -------------------------------------------------------------------
// Fetch
// -------------------------------------------------------------------
async function fetchResumoNfce(idRaw) {
  const id = (idRaw || '').trim();
  if (!id) {
    setStatus('Informe o ID, chave ou protocolo da NFC-e para consultar.', 'error');
    showResultsSection(false);
    return;
  }

  try {
    setStatus('Consultando resumo da NFC-e na PlugNotas…', 'info');
    showResultsSection(false);

    const url = `${API_BASE}/api/painel-nfce/resumo/${encodeURIComponent(id)}`;
    const res = await fetch(url);

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error('[painelNfce] erro HTTP:', res.status, text);

      if (res.status === 404) {
        setStatus('NFC-e não encontrada para o identificador informado.', 'error');
      } else {
        setStatus('Erro ao consultar resumo da NFC-e no servidor.', 'error');
      }
      return;
    }

    const json = await res.json();
    if (!json.ok) {
      setStatus(json.message || 'Erro na resposta do servidor ao consultar NFC-e.', 'error');
      return;
    }

    clearStatus();
    renderResults(json.data || []);
  } catch (err) {
    console.error('[painelNfce] erro geral:', err);
    setStatus('Falha de comunicação com o backend ao consultar a NFC-e.', 'error');
  }
}

// -------------------------------------------------------------------
// Eventos
// -------------------------------------------------------------------
if (els.form) {
  els.form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const id = els.inputId?.value;
    fetchResumoNfce(id);
  });
}

if (els.btnClear) {
  els.btnClear.addEventListener('click', () => {
    if (els.inputId) els.inputId.value = '';
    clearStatus();
    showResultsSection(false);
    els.resultsList.innerHTML = '';
    els.resultsCount.textContent = '';
    els.inputId?.focus();
  });
}

// Ao carregar, foca no input
window.addEventListener('DOMContentLoaded', () => {
  els.inputId?.focus();
});
