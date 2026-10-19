// ╔══════════════════════════════════════════════════════════════════╗
// ║ nfceWebhookViewer.js — Painel Eventos Webhook NFC-e             ║
// ║ Path: backend/nfceWebhookViewer/nfceWebhookViewer.js            ║
// ╚══════════════════════════════════════════════════════════════════╝

const API_BASE = (window.apiBase || window.API_BASE || window.location.origin).replace(/\/$/, '');

const els = {
  form: document.getElementById('nfcew-filter-form'),
  status: document.getElementById('nfcew-status'),
  tipo: document.getElementById('nfcew-tipo'),
  cstat: document.getElementById('nfcew-cstat'),
  q: document.getElementById('nfcew-q'),
  dateFrom: document.getElementById('nfcew-date-from'),
  dateTo: document.getElementById('nfcew-date-to'),
  btnClear: document.getElementById('nfcew-clear'),

  importId: document.getElementById('nfcew-import-id'),
  btnImport: document.getElementById('nfcew-import-btn'),

  // botão de sync com PDV
  btnSyncPdv: document.getElementById('nfcew-sync-pdv-btn'),

  statusMsg: document.getElementById('nfcew-status-message'),
  results: document.getElementById('nfcew-results'),
  resultsCount: document.getElementById('nfcew-results-count'),
  resultsList: document.getElementById('nfcew-results-list'),
};

// -------------------------------------------------------------------
// Helpers de status
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

function showResults(show) {
  if (!els.results) return;
  if (show) els.results.classList.remove('hidden');
  else els.results.classList.add('hidden');
}

function fmtMoney(v) {
  const n = Number(v || 0);
  return n.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function mapStatus(statusRaw) {
  const s = (statusRaw || '').toUpperCase();

  switch (s) {
    // PlugNotas
    case 'CONCLUIDO':
      return { label: 'Concluído', css: 'concluido' };
    case 'REJEITADO':
      return { label: 'Rejeitado', css: 'rejeitado' };
    case 'DENEGADO':
      return { label: 'Denegado', css: 'denegado' };
    case 'CANCELADO':
      return { label: 'Cancelado', css: 'cancelado' };

    // PDV / Tecnospeed
    case 'AUTORIZADA':
      return { label: 'Autorizada', css: 'concluido' };
    case 'REJEITADA':
      return { label: 'Rejeitada', css: 'rejeitado' };
    case 'CANCELADA':
      return { label: 'Cancelada', css: 'cancelado' };
    case 'PENDENTE':
      return { label: 'Pendente', css: 'pendente' };
    case 'PROCESSANDO':
      return { label: 'Processando', css: 'processando' };

    default:
      return { label: s || 'Desconhecido', css: '' };
  }
}

// -------------------------------------------------------------------
// Renderização dos eventos
// -------------------------------------------------------------------
function renderEvents(list) {
  if (!els.resultsList) return;

  els.resultsList.innerHTML = '';

  if (!list || !list.length) {
    els.resultsCount.textContent = 'Nenhum evento encontrado para os filtros informados.';
    showResults(true);
    return;
  }

  els.resultsCount.textContent =
    list.length === 1 ? '1 evento encontrado.' : `${list.length} eventos encontrados.`;

  for (const ev of list) {
    const {
      id,
      plugnotas_id,
      id_integracao,
      tipo_evento,
      status,
      cstat,
      mensagem,
      chave,
      numero,
      serie,
      protocolo,
      emitente,
      destinatario,
      valor,
      emissao,
      data_autorizacao,
      data_cancelamento,
      protocolo_cancelamento,
      xml_url,              // ainda pode existir, mas não usamos mais direto
      pdf_url,              // idem: fica como “fonte” no backend
      xml_cancelamento_url,
      created_at,
    } = ev;

    const statusInfo = mapStatus(status);

    // XML: usa plugnotas_id ou chave/id_integracao → backend faz proxy
    const xmlDownloadId = plugnotas_id || chave || id_integracao || null;
    const xmlProxyUrl = xmlDownloadId
      ? `${API_BASE}/api/webhooks/plugnotas/nfce/${encodeURIComponent(xmlDownloadId)}/xml`
      : null;

    // PDF: usa SEMPRE o ID do evento (PK da tabela nfceWebhookEvents)
    const pdfProxyUrl = id
      ? `${API_BASE}/api/webhooks/plugnotas/nfce/${encodeURIComponent(id)}/pdf`
      : null;

    const card = document.createElement('article');
    card.className = 'nfcew-card';

    card.innerHTML = `
      <header class="nfcew-card-header">
        <div>
          <h3 class="nfcew-card-title">
            Evento #${id} · ${tipo_evento || 'Tipo não informado'}
          </h3>
          <p class="nfcew-card-subtitle">
            Recebido em ${created_at ? new Date(created_at).toLocaleString('pt-BR') : '—'}
          </p>
        </div>
        <span class="nfcew-status-badge ${statusInfo.css}">
          ${statusInfo.label}
          ${typeof cstat === 'number' ? `· cStat ${cstat}` : ''}
        </span>
      </header>

      <div class="nfcew-details-grid">
        <div>
          <span class="nfcew-detail-label">Chave</span>
          <span class="nfcew-detail-value">${chave || '—'}</span>
        </div>

        <div>
          <span class="nfcew-detail-label">Nº / Série</span>
          <span class="nfcew-detail-value">Nº ${numero || '—'} · Série ${serie || '—'}</span>
        </div>

        <div>
          <span class="nfcew-detail-label">Valor</span>
          <span class="nfcew-detail-value">R$ ${fmtMoney(valor)}</span>
        </div>

        <div>
          <span class="nfcew-detail-label">Emissão</span>
          <span class="nfcew-detail-value">${emissao || '—'}</span>
        </div>

        <div>
          <span class="nfcew-detail-label">Data Autorização</span>
          <span class="nfcew-detail-value">${data_autorizacao || '—'}</span>
        </div>

        <div>
          <span class="nfcew-detail-label">Data Cancelamento</span>
          <span class="nfcew-detail-value">${data_cancelamento || '—'}</span>
        </div>

        <div>
          <span class="nfcew-detail-label">Protocolo</span>
          <span class="nfcew-detail-value">${protocolo || '—'}</span>
        </div>

        <div>
          <span class="nfcew-detail-label">Protocolo Cancelamento</span>
          <span class="nfcew-detail-value">${protocolo_cancelamento || '—'}</span>
        </div>

        <div>
          <span class="nfcew-detail-label">Emitente</span>
          <span class="nfcew-detail-value">${emitente || '—'}</span>
        </div>

        <div>
          <span class="nfcew-detail-label">Destinatário</span>
          <span class="nfcew-detail-value">${destinatario || '—'}</span>
        </div>

        <div>
          <span class="nfcew-detail-label">ID PlugNotas</span>
          <span class="nfcew-detail-value">${plugnotas_id || '—'}</span>
        </div>

        <div>
          <span class="nfcew-detail-label">ID Integração</span>
          <span class="nfcew-detail-value">${id_integracao || '—'}</span>
        </div>
      </div>

      <div class="nfcew-message-block">
        <div>
          <span class="label">Mensagem:</span>
          <span>${mensagem || '—'}</span>
        </div>
      </div>

      <div class="nfcew-links">
        ${
          pdfProxyUrl
            ? `<a class="nfcew-link" href="${pdfProxyUrl}" target="_blank" rel="noopener noreferrer">
                 PDF
               </a>`
            : ''
        }
        ${
          xmlProxyUrl
            ? `<a class="nfcew-link" href="${xmlProxyUrl}" target="_blank" rel="noopener noreferrer">
                 XML
               </a>`
            : ''
        }
        ${
          xml_cancelamento_url
            ? `<a class="nfcew-link" href="${xml_cancelamento_url}" target="_blank" rel="noopener noreferrer">
                 XML Cancelamento
               </a>`
            : ''
        }
      </div>
    `;

    els.resultsList.appendChild(card);
  }

  showResults(true);
}

// -------------------------------------------------------------------
// Fetch dos eventos
// -------------------------------------------------------------------
async function fetchEvents() {
  try {
    setStatus('Carregando eventos do webhook NFC-e…', 'info');
    showResults(false);

    const params = new URLSearchParams();
    if (els.status?.value) params.set('status', els.status.value);
    if (els.tipo?.value) params.set('tipo_evento', els.tipo.value.trim());
    if (els.cstat?.value) params.set('cstat', els.cstat.value.trim());
    if (els.q?.value) params.set('q', els.q.value.trim());
    if (els.dateFrom?.value) params.set('dateFrom', els.dateFrom.value);
    if (els.dateTo?.value) params.set('dateTo', els.dateTo.value);
    params.set('limit', '100');

    const url = `${API_BASE}/api/webhooks/plugnotas/nfce-events?${params.toString()}`;
    const res = await fetch(url);

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error('[nfceWebhookViewer] HTTP error:', res.status, text);
      setStatus('Erro ao carregar eventos do webhook no servidor.', 'error');
      return;
    }

    const json = await res.json();
    if (!json.ok) {
      setStatus(json.error || 'Erro ao carregar eventos do webhook.', 'error');
      return;
    }

    clearStatus();
    renderEvents(json.data || []);
  } catch (err) {
    console.error('[nfceWebhookViewer] Erro geral:', err);
    setStatus('Falha na comunicação com o backend ao carregar eventos.', 'error');
  }
}

// -------------------------------------------------------------------
// Importar resumo da NFC-e via PlugNotas
// -------------------------------------------------------------------
async function importFromPlugnotas() {
  if (!els.importId) return;

  const id = els.importId.value.trim();
  if (!id) {
    setStatus('Informe a chave, ID PlugNotas ou protocolo da NFC-e para importar.', 'error');
    return;
  }

  try {
    if (els.btnImport) {
      els.btnImport.disabled = true;
      els.btnImport.textContent = 'Importando...';
    }

    setStatus('Importando resumo da NFC-e via PlugNotas…', 'info');

    const res = await fetch(
      `${API_BASE}/api/webhooks/plugnotas/nfce/import-resumo`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      }
    );

    const json = await res.json().catch(() => null);

    if (!res.ok || !json || !json.ok) {
      console.error('[nfceWebhookViewer] import-resumo error:', res.status, json);
      setStatus(
        (json && (json.message || json.error)) ||
          'Erro ao importar resumo da NFC-e via PlugNotas.',
        'error'
      );
      return;
    }

    const imported = json.imported || (json.data ? json.data.length : 0);
    setStatus(`Importação concluída: ${imported} evento(s) salvo(s).`, 'info');

    if (els.q) {
      els.q.value = id;
    }

    await fetchEvents();
  } catch (err) {
    console.error('[nfceWebhookViewer] Erro geral importFromPlugnotas:', err);
    setStatus('Falha ao comunicar com o backend na importação da NFC-e.', 'error');
  } finally {
    if (els.btnImport) {
      els.btnImport.disabled = false;
      els.btnImport.textContent = 'Importar da PlugNotas';
    }
  }
}

// -------------------------------------------------------------------
// Sincronizar com PDV (tabela pdvSales -> PlugNotas -> nfceWebhookEvents)
// -------------------------------------------------------------------
async function syncFromPdv() {
  try {
    if (els.btnSyncPdv) {
      els.btnSyncPdv.disabled = true;
      els.btnSyncPdv.textContent = 'Sincronizando...';
    }

    setStatus('Sincronizando NFC-e a partir do PDV (pdvSales → PlugNotas)…', 'info');

    const res = await fetch(
      `${API_BASE}/api/webhooks/plugnotas/nfce/sync-from-pdv`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: 50 }), // pode ajustar depois
      }
    );

    const json = await res.json().catch(() => null);

    if (!res.ok || !json || !json.ok) {
      console.error('[nfceWebhookViewer] sync-from-pdv error:', res.status, json);
      setStatus(
        (json && (json.message || json.error)) ||
          'Erro ao sincronizar NFC-e a partir do PDV.',
        'error'
      );
      return;
    }

    setStatus(
      `Sincronização concluída: ${json.processedCount || 0} venda(s) processada(s), ` +
        `${json.errorsCount || 0} com erro.`,
      'info'
    );

    await fetchEvents();
  } catch (err) {
    console.error('[nfceWebhookViewer] Erro geral syncFromPdv:', err);
    setStatus('Falha ao comunicar com o backend na sincronização com o PDV.', 'error');
  } finally {
    if (els.btnSyncPdv) {
      els.btnSyncPdv.disabled = false;
      els.btnSyncPdv.textContent = 'Sincronizar com PDV (nfce_id)';
    }
  }
}

// -------------------------------------------------------------------
// Eventos da UI
// -------------------------------------------------------------------
if (els.form) {
  els.form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    fetchEvents();
  });
}

if (els.btnClear) {
  els.btnClear.addEventListener('click', () => {
    if (els.status) els.status.value = '';
    if (els.tipo) els.tipo.value = '';
    if (els.cstat) els.cstat.value = '';
    if (els.q) els.q.value = '';
    if (els.dateFrom) els.dateFrom.value = '';
    if (els.dateTo) els.dateTo.value = '';
    clearStatus();
    showResults(false);
    if (els.resultsList) els.resultsList.innerHTML = '';
    if (els.resultsCount) els.resultsCount.textContent = '';
  });
}

if (els.btnImport) {
  els.btnImport.addEventListener('click', () => {
    importFromPlugnotas();
  });
}

if (els.btnSyncPdv) {
  els.btnSyncPdv.addEventListener('click', () => {
    syncFromPdv();
  });
}

// Carrega ao abrir a página (sem filtros)
window.addEventListener('DOMContentLoaded', () => {
  fetchEvents();
});
