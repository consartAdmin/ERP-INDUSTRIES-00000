// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: cancelarNfe.js                                                ║
// ║ MODULE: Cancelamento de NF-e                                       ║
// ║ PRODNEX ERP — ESM                                                  ║
// ║ Funções:                                                           ║
// ║  - Buscar NF-e emitida em public."invoicesIssued"                  ║
// ║  - Selecionar NF-e para cancelamento                               ║
// ║  - Consultar status da NF-e                                        ║
// ║  - Cancelar NF-e com justificativa                                 ║
// ║  - Exibir retorno detalhado                                        ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

const API_BASE =
  window.API_BASE ||
  window.apiBase ||
  'http://localhost:3000';

const INVOICES_ISSUED_ROUTES = [
  `${API_BASE}/api/invoices-issued`,
  `${API_BASE}/api/invoicesIssued`,
  `${API_BASE}/api/invoices/issued`,
];

const $ = (selector) => document.querySelector(selector);

const state = {
  nfesEmitidas: [],
  nfeSelecionada: null,
  invoicePickerOrigin: 'cancelamento',
};

const els = {
  btnAbrirCancelamento: $('#btnAbrirCancelamento'),
  btnAbrirConsultaStatus: $('#btnAbrirConsultaStatus'),
  modalCancelarNfe: $('#modalCancelarNfe'),
  modalConsultaStatus: $('#modalConsultaStatus'),
  btnBuscarNfeStatus: $('#btnBuscarNfeStatus'),
  statusNfeSelecionada: $('#statusNfeSelecionada'),

  modalNfSituacao: $('#modalNfSituacao'),
  modalNfNumero: $('#modalNfNumero'),
  modalNfChave: $('#modalNfChave'),
  modalNfProtocolo: $('#modalNfProtocolo'),
  modalNfCliente: $('#modalNfCliente'),
  modalNfDocumento: $('#modalNfDocumento'),

  idNota: $('#idNota'),
  nfeNumberSelecionada: $('#nfeNumberSelecionada'),
  orderIdSelecionado: $('#orderIdSelecionado'),

  justificativa: $('#justificativa'),
  contadorJustificativa: $('#contadorJustificativa'),

  btnConsultar: $('#btnConsultar'),
  btnCancelar: $('#btnCancelar'),
  btnLimpar: $('#btnLimpar'),
  btnVoltar: $('#btnVoltar'),

  btnBuscarNfeEmitida: $('#btnBuscarNfeEmitida'),
  modalBuscarNfeEmitida: $('#modalBuscarNfeEmitida'),
  buscaNfeEmitida: $('#buscaNfeEmitida'),
  btnExecutarBuscaNfeEmitida: $('#btnExecutarBuscaNfeEmitida'),
  tbodyNfesEmitidas: $('#tbodyNfesEmitidas'),
  nfesEmitidasInfo: $('#nfesEmitidasInfo'),

  statusBadge: $('#statusBadge'),
  loadingBox: $('#loadingBox'),
  retornoApi: $('#retornoApi'),

  nfSituacao: $('#nfSituacao'),
  nfNumero: $('#nfNumero'),
  nfChave: $('#nfChave'),
  nfProtocolo: $('#nfProtocolo'),
  nfCliente: $('#nfCliente'),
  nfDocumento: $('#nfDocumento'),

  toastContainer: $('#toastContainer'),
};

/* =========================================================================
 * Helpers gerais
 * ========================================================================= */

function normalizeText(value, fallback = '—') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function normalizeOptionalText(value) {
  return String(value ?? '').trim();
}

function onlyDigits(value) {
  return String(value ?? '').replace(/\D+/g, '');
}

function pick(row, ...keys) {
  for (const key of keys) {
    const value = row?.[key];

    if (
      value !== undefined &&
      value !== null &&
      String(value).trim() !== ''
    ) {
      return value;
    }
  }

  return '';
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatCpfCnpj(value) {
  const digits = onlyDigits(value);

  if (digits.length === 11) {
    return digits.replace(
      /(\d{3})(\d{3})(\d{3})(\d{2})/,
      '$1.$2.$3-$4'
    );
  }

  if (digits.length === 14) {
    return digits.replace(
      /(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,
      '$1.$2.$3/$4-$5'
    );
  }

  return normalizeText(value);
}

function formatMoney(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return '—';
  }

  return number.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function formatDate(value) {
  if (!value) return '—';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleDateString('pt-BR');
}

function showToast(message, type = 'info') {
  if (!els.toastContainer) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;

  els.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(8px)';

    setTimeout(() => toast.remove(), 220);
  }, 3200);
}

function setLoading(isLoading) {
  els.loadingBox?.classList.toggle('hidden', !isLoading);

  if (els.btnConsultar) els.btnConsultar.disabled = isLoading;
  if (els.btnCancelar) els.btnCancelar.disabled = isLoading;
  if (els.btnLimpar) els.btnLimpar.disabled = isLoading;
  if (els.btnBuscarNfeEmitida) els.btnBuscarNfeEmitida.disabled = isLoading;
}

function setStatusBadge(
  statusText = 'Aguardando consulta',
  variant = 'neutral'
) {
  if (!els.statusBadge) return;

  els.statusBadge.textContent = statusText;
  els.statusBadge.className = `badge badge-${variant}`;
}

function setRetornoApi(data) {
  if (!els.retornoApi) return;

  try {
    els.retornoApi.textContent =
      typeof data === 'string'
        ? data
        : JSON.stringify(data, null, 2);
  } catch {
    els.retornoApi.textContent = String(data ?? '');
  }
}

/* =========================================================================
 * HTTP
 * ========================================================================= */

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const contentType = response.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');

  const payload = isJson
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const error = new Error(
      payload?.message ||
      payload?.error?.message ||
      payload?.error ||
      (typeof payload === 'string' ? payload : null) ||
      'Erro na requisição.'
    );

    error.status = response.status;
    error.payload = payload;

    throw error;
  }

  return payload;
}

/* =========================================================================
 * NF-e emitidas — public."invoicesIssued"
 * ========================================================================= */

function normalizeInvoicesIssuedPayload(data) {
  const candidates = [
    data?.data?.rows,
    data?.data?.items,
    data?.data?.invoices,
    data?.data,
    data?.rows,
    data?.items,
    data?.invoices,
    data,
  ];

  return candidates.find(Array.isArray) || [];
}

function normalizeInvoice(row) {
  return {
    invoice_id: pick(
      row,
      'invoice_id',
      'invoiceId',
      'id'
    ),

    order_id: pick(
      row,
      'order_id',
      'orderId'
    ),

    nfe_number: pick(
      row,
      'nfe_number',
      'nfeNumber',
      'numero'
    ),

    nfe_key: pick(
      row,
      'nfe_key',
      'nfeKey',
      'chave'
    ),

    nfe_status: pick(
      row,
      'nfe_status',
      'nfeStatus',
      'status'
    ),

    nfe_protocol: pick(
      row,
      'nfe_protocol',
      'nfeProtocol',
      'protocol',
      'protocolo'
    ),

    nfe_environment: pick(
      row,
      'nfe_environment',
      'nfeEnvironment',
      'environment'
    ),

    issued_at: pick(
      row,
      'issued_at',
      'issuedAt'
    ),

    issued_date: pick(
      row,
      'issued_date',
      'issuedDate'
    ),

    total_amount: pick(
      row,
      'total_amount',
      'totalAmount',
      'valorTotal'
    ),

    nfe_provider_id: pick(
      row,
      'nfe_provider_id',
      'nfeProviderId',
      'nfe_plugnotas_id',
      'nfePlugnotasId',
      'provider_id',
      'providerId'
    ),

    raw: row,
  };
}

async function listarNfesEmitidas(search = '') {
  let lastError = null;

  for (const baseUrl of INVOICES_ISSUED_ROUTES) {
    try {
      const url = new URL(baseUrl);

      url.searchParams.set('limit', '100');

      if (search) {
        url.searchParams.set('search', search);
      }

      const data = await fetchJson(url.toString());

      return normalizeInvoicesIssuedPayload(data);
    } catch (error) {
      lastError = error;
    }
  }

  throw (
    lastError ||
    new Error('Não foi possível consultar as NF-e emitidas.')
  );
}

function renderNfesEmitidas(rows = []) {
  if (!els.tbodyNfesEmitidas) return;

  if (!rows.length) {
    els.tbodyNfesEmitidas.innerHTML = `
      <tr>
        <td colspan="8" class="text-center">
          Nenhuma NF-e emitida encontrada.
        </td>
      </tr>
    `;

    if (els.nfesEmitidasInfo) {
      els.nfesEmitidasInfo.textContent = '0 NF-e encontrada';
    }

    return;
  }

  els.tbodyNfesEmitidas.innerHTML = rows
    .map((row, index) => `
      <tr>
        <td>${escapeHtml(row.invoice_id || '—')}</td>
        <td>${escapeHtml(row.nfe_number || '—')}</td>
        <td>${escapeHtml(row.order_id || '—')}</td>
        <td title="${escapeHtml(row.nfe_key)}">
          ${escapeHtml(row.nfe_key || '—')}
        </td>
        <td>${escapeHtml(row.nfe_status || '—')}</td>
        <td>${escapeHtml(formatDate(row.issued_at || row.issued_date))}</td>
        <td>${escapeHtml(formatMoney(row.total_amount))}</td>
        <td>
          <button
            type="button"
            class="btn btn-new btn-sm"
            data-select-invoice-index="${index}"
          >
            Selecionar
          </button>
        </td>
      </tr>
    `)
    .join('');

  if (els.nfesEmitidasInfo) {
    els.nfesEmitidasInfo.textContent =
      `${rows.length} NF-e(s) encontrada(s)`;
  }
}

async function onBuscarNfesEmitidas() {
  try {
    const search = normalizeOptionalText(
      els.buscaNfeEmitida?.value
    );

    if (els.nfesEmitidasInfo) {
      els.nfesEmitidasInfo.textContent = 'Carregando...';
    }

    const rows = await listarNfesEmitidas(search);

    state.nfesEmitidas = rows.map(normalizeInvoice);

    renderNfesEmitidas(state.nfesEmitidas);
  } catch (error) {
    state.nfesEmitidas = [];
    renderNfesEmitidas([]);

    showToast(
      error?.message ||
      'Falha ao carregar as NF-e emitidas.',
      'error'
    );
  }
}

/* =========================================================================
 * Modal NF-e emitida
 * ========================================================================= */

function syncBodyModalState() {
  const hasOpenModal = document.querySelector('.modal.is-open');
  document.body.classList.toggle('modal-open', Boolean(hasOpenModal));
}

function openModal(modal, focusElement = null) {
  if (!modal) return;

  modal.classList.add('is-open');
  modal.setAttribute('aria-hidden', 'false');
  syncBodyModalState();

  requestAnimationFrame(() => {
    focusElement?.focus();
  });
}

function closeModal(modal) {
  if (!modal) return;

  modal.classList.remove('is-open');
  modal.setAttribute('aria-hidden', 'true');
  syncBodyModalState();
}

function openCancelamentoModal() {
  openModal(els.modalCancelarNfe, els.btnBuscarNfeEmitida);
}

function closeCancelamentoModal() {
  closeModal(els.modalCancelarNfe);
}

function openConsultaStatusModal() {
  openModal(els.modalConsultaStatus, els.btnBuscarNfeStatus);
}

function closeConsultaStatusModal() {
  closeModal(els.modalConsultaStatus);
}

function openNfeEmitidaModal(origin = 'cancelamento') {
  state.invoicePickerOrigin = origin;

  openModal(
    els.modalBuscarNfeEmitida,
    els.buscaNfeEmitida
  );

  onBuscarNfesEmitidas();
}

function closeNfeEmitidaModal() {
  closeModal(els.modalBuscarNfeEmitida);
}

function applyInvoiceToCancellation(invoice) {
  if (!invoice) return;

  state.nfeSelecionada = invoice;

  /*
   * O endpoint atual de cancelamento recebe `idNota`.
   * Priorizamos o ID do provedor, pois ele é o identificador nativo
   * da PlugNotas. Como fallback usamos a chave de acesso e o protocolo.
   */
  const identifier = normalizeOptionalText(
    invoice.nfe_provider_id ||
    invoice.nfe_key ||
    invoice.nfe_protocol
  );

  if (els.idNota) {
    els.idNota.value = identifier;
  }

  if (els.nfeNumberSelecionada) {
    els.nfeNumberSelecionada.value =
      invoice.nfe_number || '';
  }

  if (els.orderIdSelecionado) {
    els.orderIdSelecionado.value =
      invoice.order_id || '';
  }

  if (els.statusNfeSelecionada) {
    els.statusNfeSelecionada.value =
      invoice.nfe_number
        ? `NF-e ${invoice.nfe_number}`
        : (invoice.nfe_key || identifier);
  }

  closeNfeEmitidaModal();

  clearInfo();

  if (state.invoicePickerOrigin === 'status') {
    showToast(
      `NF-e ${invoice.nfe_number || invoice.invoice_id || ''} selecionada para consulta.`,
      'success'
    );
    els.btnConsultar?.focus();
  } else {
    showToast(
      `NF-e ${invoice.nfe_number || invoice.invoice_id || ''} selecionada para cancelamento.`,
      'success'
    );
    els.justificativa?.focus();
  }
}

function onTabelaNfesEmitidasClick(event) {
  const button = event.target.closest(
    '[data-select-invoice-index]'
  );

  if (!button) return;

  event.preventDefault();
  event.stopPropagation();

  const index = Number(
    button.dataset.selectInvoiceIndex
  );

  const invoice = state.nfesEmitidas[index];

  if (!invoice) return;

  applyInvoiceToCancellation(invoice);
}

function clearSelectedInvoice() {
  state.nfesEmitidas = [];
  state.nfeSelecionada = null;

  if (els.idNota) {
    els.idNota.value = '';
  }

  if (els.nfeNumberSelecionada) {
    els.nfeNumberSelecionada.value = '';
  }

  if (els.orderIdSelecionado) {
    els.orderIdSelecionado.value = '';
  }

  if (els.buscaNfeEmitida) {
    els.buscaNfeEmitida.value = '';
  }

  if (els.statusNfeSelecionada) {
    els.statusNfeSelecionada.value = '';
  }

  renderNfesEmitidas([]);
}

/* =========================================================================
 * Status / resumo
 * ========================================================================= */

function clearInfo() {
  if (els.nfSituacao) els.nfSituacao.textContent = '—';
  if (els.nfNumero) els.nfNumero.textContent = '—';
  if (els.nfChave) els.nfChave.textContent = '—';
  if (els.nfProtocolo) els.nfProtocolo.textContent = '—';
  if (els.nfCliente) els.nfCliente.textContent = '—';
  if (els.nfDocumento) els.nfDocumento.textContent = '—';

  if (els.modalNfSituacao) els.modalNfSituacao.textContent = '—';
  if (els.modalNfNumero) els.modalNfNumero.textContent = '—';
  if (els.modalNfChave) els.modalNfChave.textContent = '—';
  if (els.modalNfProtocolo) els.modalNfProtocolo.textContent = '—';
  if (els.modalNfCliente) els.modalNfCliente.textContent = '—';
  if (els.modalNfDocumento) els.modalNfDocumento.textContent = '—';

  setStatusBadge(
    'Aguardando consulta',
    'neutral'
  );

  setRetornoApi(
    'Nenhuma operação executada ainda.'
  );
}

function inferStatusVariant(status) {
  const s = String(status || '').toUpperCase();

  if (!s) return 'neutral';
  if (s.includes('AUTORIZ')) return 'success';
  if (s.includes('CONCLUID')) return 'success';
  if (s.includes('CANCEL')) return 'danger';
  if (s.includes('REJEI')) return 'danger';
  if (s.includes('PROCESS')) return 'primary';

  return 'neutral';
}

function fillResumo(resumo = {}) {
  const destinatario =
    resumo?.destinatario ||
    resumo?.cliente ||
    resumo?.dest ||
    {};

  const situacao =
    resumo?.situacao ||
    resumo?.status ||
    resumo?.situacaoNfe ||
    resumo?.descricaoSituacao ||
    'NÃO INFORMADO';

  const numero =
    resumo?.numero ||
    resumo?.numeroNfe ||
    resumo?.nfe_number ||
    resumo?.numNfe ||
    '—';

  const chave =
    resumo?.chaveAcesso ||
    resumo?.chave_acesso ||
    resumo?.chave ||
    resumo?.chaveNfe ||
    resumo?.chaveNFe ||
    state.nfeSelecionada?.nfe_key ||
    '—';

  const protocolo =
    resumo?.protocolo ||
    resumo?.protocoloAutorizacao ||
    resumo?.protocoloSefaz ||
    state.nfeSelecionada?.nfe_protocol ||
    '—';

  const cliente =
    destinatario?.razaoSocial ||
    destinatario?.nome ||
    resumo?.clienteNome ||
    resumo?.razaoSocial ||
    '—';

  const documento =
    destinatario?.cpfCnpj ||
    destinatario?.documento ||
    resumo?.cpfCnpj ||
    resumo?.cnpjCpf ||
    '—';

  if (els.nfSituacao) {
    els.nfSituacao.textContent = normalizeText(situacao);
  }

  if (els.nfNumero) {
    els.nfNumero.textContent = normalizeText(
      numero !== '—'
        ? numero
        : state.nfeSelecionada?.nfe_number
    );
  }

  if (els.nfChave) {
    els.nfChave.textContent = normalizeText(chave);
  }

  if (els.nfProtocolo) {
    els.nfProtocolo.textContent = normalizeText(protocolo);
  }

  if (els.nfCliente) {
    els.nfCliente.textContent = normalizeText(cliente);
  }

  if (els.nfDocumento) {
    els.nfDocumento.textContent = formatCpfCnpj(documento);
  }

  if (els.modalNfSituacao) els.modalNfSituacao.textContent = normalizeText(situacao);
  if (els.modalNfNumero) {
    els.modalNfNumero.textContent = normalizeText(
      numero !== '—' ? numero : state.nfeSelecionada?.nfe_number
    );
  }
  if (els.modalNfChave) els.modalNfChave.textContent = normalizeText(chave);
  if (els.modalNfProtocolo) els.modalNfProtocolo.textContent = normalizeText(protocolo);
  if (els.modalNfCliente) els.modalNfCliente.textContent = normalizeText(cliente);
  if (els.modalNfDocumento) els.modalNfDocumento.textContent = formatCpfCnpj(documento);

  setStatusBadge(
    normalizeText(situacao, 'Status indefinido'),
    inferStatusVariant(situacao)
  );
}

/* =========================================================================
 * Form
 * ========================================================================= */

function getIdNotaValue() {
  return normalizeOptionalText(
    els.idNota?.value
  );
}

function getJustificativaValue() {
  return String(
    els.justificativa?.value || ''
  )
    .replace(/\s+/g, ' ')
    .trim();
}

function validateConsulta() {
  const idNota = getIdNotaValue();

  if (!idNota) {
    showToast(
      'Selecione uma NF-e emitida.',
      'error'
    );

    els.btnBuscarNfeEmitida?.focus();

    return false;
  }

  return true;
}

function validateCancelamento() {
  const idNota = getIdNotaValue();
  const justificativa = getJustificativaValue();

  if (!idNota) {
    showToast(
      'Selecione uma NF-e emitida.',
      'error'
    );

    els.btnBuscarNfeEmitida?.focus();

    return false;
  }

  if (!justificativa) {
    showToast(
      'Informe a justificativa do cancelamento.',
      'error'
    );

    els.justificativa?.focus();

    return false;
  }

  if (justificativa.length < 15) {
    showToast(
      'A justificativa deve conter ao menos 15 caracteres.',
      'error'
    );

    els.justificativa?.focus();

    return false;
  }

  return true;
}

/* =========================================================================
 * Consultar status
 * ========================================================================= */

async function consultarStatusNfe() {
  if (!validateConsulta()) return;

  const idNota = encodeURIComponent(
    getIdNotaValue()
  );

  setLoading(true);

  try {
    const data = await fetchJson(
      `${API_BASE}/api/nfe/status/${idNota}`,
      {
        method: 'GET',
      }
    );

    const resumo =
      Array.isArray(data?.data)
        ? data.data[0] || {}
        : data?.data || data;

    fillResumo(resumo);
    setRetornoApi(data);

    showToast(
      'Status da NF-e consultado com sucesso.',
      'success'
    );
  } catch (error) {
    setStatusBadge(
      'Falha na consulta',
      'danger'
    );

    setRetornoApi(
      error.payload ||
      error.message ||
      error
    );

    showToast(
      error?.payload?.message ||
      error.message ||
      'Erro ao consultar status da NF-e.',
      'error'
    );
  } finally {
    setLoading(false);
  }
}

/* =========================================================================
 * Cancelar NF-e
 * ========================================================================= */

async function cancelarNfe() {
  if (!validateCancelamento()) return;

  const idNota = getIdNotaValue();
  const justificativa = getJustificativaValue();

  const numeroNfe =
    state.nfeSelecionada?.nfe_number ||
    '';

  const confirmed = window.confirm(
    numeroNfe
      ? `Confirma o cancelamento da NF-e ${numeroNfe}?\n\nEssa operação pode ser irreversível.`
      : 'Confirma o cancelamento desta NF-e?\n\nEssa operação pode ser irreversível.'
  );

  if (!confirmed) return;

  setLoading(true);

  try {
    const data = await fetchJson(
      `${API_BASE}/api/nfe/cancelar`,
      {
        method: 'POST',
        body: JSON.stringify({
          idNota,
          justificativa,
        }),
      }
    );

    const resumoAntes =
      data?.resumoAntes ||
      null;

    if (resumoAntes) {
      fillResumo(resumoAntes);
    }

    setStatusBadge(
      'Cancelamento solicitado',
      'primary'
    );

    setRetornoApi(data);

    showToast(
      data?.message ||
      'Solicitação de cancelamento enviada com sucesso.',
      'success'
    );

    /*
     * Não chama consultarStatusNfe() enquanto setLoading(true) está ativo
     * para evitar liberar/rebloquear a tela em cascata. A consulta é feita
     * diretamente aqui após a solicitação.
     */
    try {
      const statusData = await fetchJson(
        `${API_BASE}/api/nfe/status/${encodeURIComponent(idNota)}`,
        {
          method: 'GET',
        }
      );

      const resumo =
        Array.isArray(statusData?.data)
          ? statusData.data[0] || {}
          : statusData?.data || statusData;

      fillResumo(resumo);
      setRetornoApi(statusData);
    } catch {
      // Mantém o retorno do cancelamento caso o status ainda não esteja pronto.
    }
  } catch (error) {
    setRetornoApi(
      error.payload ||
      error.message ||
      error
    );

    const statusAtual =
      error?.payload?.resumo?.situacao ||
      error?.payload?.resumo?.status ||
      '';

    if (statusAtual) {
      fillResumo(
        error.payload.resumo
      );
    } else {
      setStatusBadge(
        'Falha no cancelamento',
        'danger'
      );
    }

    showToast(
      error?.payload?.message ||
      error.message ||
      'Erro ao cancelar NF-e.',
      'error'
    );
  } finally {
    setLoading(false);
  }
}

/* =========================================================================
 * Limpar
 * ========================================================================= */

function limparFormulario() {
  clearSelectedInvoice();

  if (els.justificativa) {
    els.justificativa.value = '';
  }

  updateContadorJustificativa();
  clearInfo();

  els.btnBuscarNfeEmitida?.focus();
}

function updateContadorJustificativa() {
  const total = getJustificativaValue().length;

  if (els.contadorJustificativa) {
    els.contadorJustificativa.textContent =
      `${total} caracteres`;
  }
}

function voltarPagina() {
  if (window.history.length > 1) {
    window.history.back();
    return;
  }

  window.location.href =
    '/public/index/index.html';
}

/* =========================================================================
 * Eventos
 * ========================================================================= */

function bindEvents() {
  els.btnConsultar?.addEventListener(
    'click',
    consultarStatusNfe
  );

  els.btnCancelar?.addEventListener(
    'click',
    cancelarNfe
  );

  els.btnLimpar?.addEventListener(
    'click',
    limparFormulario
  );

  els.btnVoltar?.addEventListener(
    'click',
    voltarPagina
  );

  els.btnAbrirCancelamento?.addEventListener(
    'click',
    openCancelamentoModal
  );

  els.btnAbrirConsultaStatus?.addEventListener(
    'click',
    openConsultaStatusModal
  );

  els.btnBuscarNfeEmitida?.addEventListener(
    'click',
    () => openNfeEmitidaModal('cancelamento')
  );

  els.btnBuscarNfeStatus?.addEventListener(
    'click',
    () => openNfeEmitidaModal('status')
  );

  els.btnExecutarBuscaNfeEmitida?.addEventListener(
    'click',
    onBuscarNfesEmitidas
  );

  els.tbodyNfesEmitidas?.addEventListener(
    'click',
    onTabelaNfesEmitidasClick
  );

  els.justificativa?.addEventListener(
    'input',
    updateContadorJustificativa
  );

  els.buscaNfeEmitida?.addEventListener(
    'keydown',
    (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        onBuscarNfesEmitidas();
      }
    }
  );

  els.modalBuscarNfeEmitida
    ?.querySelectorAll('[data-modal-nfe-emitida-close]')
    .forEach((element) => {
      element.addEventListener(
        'click',
        (event) => {
          event.preventDefault();
          event.stopPropagation();
          closeNfeEmitidaModal();
        }
      );
    });

  els.modalCancelarNfe
    ?.querySelectorAll('[data-modal-cancelar-close]')
    .forEach((element) => {
      element.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        closeCancelamentoModal();
      });
    });

  els.modalConsultaStatus
    ?.querySelectorAll('[data-modal-status-close]')
    .forEach((element) => {
      element.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        closeConsultaStatusModal();
      });
    });

  document.addEventListener(
    'keydown',
    (event) => {
      if (event.key !== 'Escape') return;

      if (els.modalBuscarNfeEmitida?.classList.contains('is-open')) {
        event.preventDefault();
        event.stopImmediatePropagation();
        closeNfeEmitidaModal();
        return;
      }

      if (els.modalConsultaStatus?.classList.contains('is-open')) {
        event.preventDefault();
        event.stopImmediatePropagation();
        closeConsultaStatusModal();
        return;
      }

      if (els.modalCancelarNfe?.classList.contains('is-open')) {
        event.preventDefault();
        event.stopImmediatePropagation();
        closeCancelamentoModal();
      }
    },
    true
  );
}

/* =========================================================================
 * Init
 * ========================================================================= */

function init() {
  clearSelectedInvoice();
  clearInfo();
  updateContadorJustificativa();
  bindEvents();
}

document.addEventListener(
  'DOMContentLoaded',
  init
);
