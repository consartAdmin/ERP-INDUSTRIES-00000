// ╔══════════════════════════════════════════════════════════════════════╗
// ║ cancelarNfe.actions.js — Ações e fluxo do módulo                   ║
// ║ PRODNEX ERP                                                         ║
// ║ ✅ Alert terminal para sucesso / rejeição / erro / timeout          ║
// ║ ✅ Fecha modal ao finalizar o fluxo                                 ║
// ║ ✅ Mantém 400 transitório como PROCESSANDO                          ║
// ║ ✅ Usa nfe_provider_id para cancelamento                            ║
// ╚══════════════════════════════════════════════════════════════════════╝

import {
  CANCELLATION,
  CANONICAL_STATUS,
} from './cancelarNfe.config.js';

import { state } from './cancelarNfe.state.js';

import {
  getCancellationStatus,
  getNfeStatus,
  listInvoicesIssued,
  listNfeStatusMap,
  requestNfeCancellation,
  updateInvoiceIssuedStatus,
} from './cancelarNfe.api.js';

import {
  clearCancellationForm,
  getIdNotaValue,
  getJustificativaValue,
  updateContadorJustificativa,
} from './cancelarNfe.form.js';

import {
  closeCancelamentoModal,
  closeConsultaStatusModal,
  closeNfeEmitidaModal,
  closeTopModal,
  openCancelamentoModal,
  openConsultaStatusModal,
  openNfeEmitidaModal,
} from './cancelarNfe.modal.js';

import {
  clearInfo,
  fillResumo,
  renderCancellationStatus,
  renderNfesEmitidas,
  setLoading,
  setStatusBadge,
} from './cancelarNfe.render.js';

import {
  $,
  normalizeOptionalText,
  pick,
  setRetornoApi,
  showToast,
  sleep,
} from './cancelarNfe.utils.js';

import {
  isAuthorizedStatus,
  normalizeNfeStatusCode,
  validateCancellationForm,
} from './cancelarNfe.validation.js';

// ======================================================================
// NORMALIZAÇÃO DA NF-e
// ======================================================================

function normalizeInvoice(row) {
  return {
    invoice_id: pick(row, 'invoice_id', 'invoiceId', 'id'),
    order_id: pick(row, 'order_id', 'orderId'),
    order_number: pick(row, 'order_number', 'orderNumber'),
    budget_id: pick(row, 'budget_id', 'budgetId'),
    bonus_id: pick(row, 'bonus_id', 'bonusId'),
    source_type: pick(row, 'source_type', 'sourceType'),

    nfe_number: pick(row, 'nfe_number', 'nfeNumber', 'numero'),
    nfe_key: pick(row, 'nfe_key', 'nfeKey', 'chave'),
    nfe_status_id: pick(row, 'nfe_status_id', 'nfeStatusId'),

    nfe_status: normalizeNfeStatusCode(
      pick(row, 'nfe_status', 'nfeStatus', 'status')
    ),

    nfe_status_name: pick(row, 'nfe_status_name', 'nfeStatusName'),
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

    issued_at: pick(row, 'issued_at', 'issuedAt'),
    issued_date: pick(row, 'issued_date', 'issuedDate'),
    total_amount: pick(row, 'total_amount', 'totalAmount', 'valorTotal'),
    customer_name: pick(row, 'customer_name', 'customerName'),
    customer_tax_id: pick(row, 'customer_tax_id', 'customerTaxId'),

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

// ======================================================================
// ALERTA TERMINAL + FECHAMENTO DO MODAL
// ======================================================================

function finishCancellationUi({
  type = 'info',
  title = 'Cancelamento de NF-e',
  message = '',
  closeModal = true,
  clearForm = true,
} = {}) {
  state.cancellation.processing = false;

  const finalMessage =
    String(message || '').trim() ||
    'Processamento finalizado.';

  showToast(finalMessage, type);

  // Alert solicitado para qualquer resultado terminal.
  window.alert(`${title}\n\n${finalMessage}`);

  if (closeModal) {
    closeCancelamentoModal();
  }

  if (clearForm) {
    clearCancellationForm();
  }
}

function isTransientProcessingError(error, elapsedMs) {
  if (Number(error?.status) !== 400) {
    return false;
  }

  if (elapsedMs > CANCELLATION.transient400WindowMs) {
    return false;
  }

  const message = String(
    error?.payload?.error?.message ||
    error?.payload?.message ||
    error?.message ||
    ''
  )
    .trim()
    .toLowerCase();

  return (
    message.includes('processamento') ||
    message.includes('processando') ||
    message.includes('aguarde')
  );
}

// ======================================================================
// STATUS MAP
// ======================================================================

async function loadStatusMap() {
  try {
    const statuses = await listNfeStatusMap();

    state.statusMap = statuses;
    state.statusByCode = new Map(
      statuses.map((item) => [
        normalizeNfeStatusCode(item.code),
        item,
      ])
    );
  } catch (error) {
    console.warn('[cancelarNfe.statusMap]', error);

    state.statusMap = [];
    state.statusByCode = new Map();
  }
}

// ======================================================================
// BUSCA DE NF-e EMITIDAS
// ======================================================================

async function buscarNfesEmitidas() {
  try {
    const search = normalizeOptionalText(
      $('#buscaNfeEmitida')?.value
    );

    const info = $('#nfesEmitidasInfo');
    if (info) info.textContent = 'Carregando...';

    const rows = await listInvoicesIssued({
      search,
      limit: 100,
    });

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

function openInvoicePicker(origin) {
  state.invoicePickerOrigin = origin;
  openNfeEmitidaModal();
  buscarNfesEmitidas();
}

function applyInvoice(invoice) {
  if (!invoice) return;

  if (
    state.invoicePickerOrigin === 'cancelamento' &&
    !isAuthorizedStatus(invoice.nfe_status)
  ) {
    showToast(
      'Somente NF-e AUTORIZADA pode ser cancelada.',
      'error'
    );
    return;
  }

  // Para cancelamento não usa mais chave/protocolo como fallback.
  const providerId = normalizeOptionalText(
    invoice.nfe_provider_id
  );

  if (
    state.invoicePickerOrigin === 'cancelamento' &&
    !providerId
  ) {
    const message =
      'Esta NF-e não possui o ID da PlugNotas necessário para o cancelamento.';

    console.error(
      '[NFE][CANCELAMENTO] nfe_provider_id ausente',
      {
        invoice_id: invoice.invoice_id,
        source_type: invoice.source_type,
        order_id: invoice.order_id,
        budget_id: invoice.budget_id,
        nfe_number: invoice.nfe_number,
        nfe_key: invoice.nfe_key,
      }
    );

    showToast(message, 'error');
    window.alert(`Não é possível cancelar esta NF-e\n\n${message}`);
    return;
  }

  state.nfeSelecionada = invoice;

  // Consulta de status ainda pode usar provider ID; caso não exista,
  // usa chave/protocolo apenas para CONSULTA, nunca para cancelamento.
  const identifier =
    state.invoicePickerOrigin === 'cancelamento'
      ? providerId
      : normalizeOptionalText(
          invoice.nfe_provider_id ||
          invoice.nfe_key ||
          invoice.nfe_protocol
        );

  const idNota = $('#idNota');
  if (idNota) idNota.value = identifier;

  const number = $('#nfeNumberSelecionada');
  if (number) {
    number.value = invoice.nfe_number || '';
  }

  const order = $('#orderIdSelecionado');
  if (order) {
    order.value =
      invoice.order_number ||
      invoice.order_id ||
      invoice.budget_id ||
      '';
  }

  const statusNfe = $('#statusNfeSelecionada');
  if (statusNfe) {
    statusNfe.value =
      invoice.nfe_number
        ? `NF-e ${invoice.nfe_number}`
        : invoice.nfe_key || identifier;
  }

  closeNfeEmitidaModal();
  clearInfo();

  if (state.invoicePickerOrigin === 'status') {
    showToast(
      `NF-e ${invoice.nfe_number || invoice.invoice_id || ''} selecionada para consulta.`,
      'success'
    );

    $('#btnConsultar')?.focus();
  } else {
    showToast(
      `NF-e ${invoice.nfe_number || invoice.invoice_id || ''} selecionada para cancelamento.`,
      'success'
    );

    $('#justificativa')?.focus();
  }
}

function onTabelaNfesEmitidasClick(event) {
  const button = event.target.closest(
    '[data-select-invoice-index]'
  );

  if (!button || button.disabled) return;

  const index = Number(
    button.dataset.selectInvoiceIndex
  );

  applyInvoice(state.nfesEmitidas[index]);
}

// ======================================================================
// CONSULTA DE STATUS DA NF-e
// ======================================================================

export async function consultarStatusNfe() {
  const idNota = getIdNotaValue();

  if (!idNota) {
    showToast(
      'Selecione uma NF-e emitida.',
      'error'
    );
    return;
  }

  setLoading(true);

  try {
    const data = await getNfeStatus(idNota);

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

    const message =
      error?.payload?.message ||
      error.message ||
      'Erro ao consultar status da NF-e.';

    showToast(message, 'error');
  } finally {
    setLoading(false);
  }
}

// ======================================================================
// PERSISTÊNCIA EM invoicesIssued
// ======================================================================

async function persistCancellationInInvoicesIssued({
  cancellationResult,
  reason,
}) {
  const invoice = state.nfeSelecionada;

  if (!invoice?.invoice_id) {
    throw new Error(
      'NF-e cancelada na SEFAZ, mas invoice_id não está disponível para atualizar invoicesIssued.'
    );
  }

  let cancelledStatus =
    state.statusByCode.get(
      CANONICAL_STATUS.CANCELADO
    );

  if (!cancelledStatus) {
    await loadStatusMap();

    cancelledStatus =
      state.statusByCode.get(
        CANONICAL_STATUS.CANCELADO
      );
  }

  if (!cancelledStatus?.nfe_status_id) {
    throw new Error(
      'Status CANCELADO não encontrado em nfeStatusMap.'
    );
  }

  console.log(
    '[NFE][CANCELAMENTO][ERP_SYNC] Atualizando invoicesIssued',
    {
      invoice_id: invoice.invoice_id,
      nfe_number: invoice.nfe_number,
      nfe_provider_id: invoice.nfe_provider_id,
      nfe_status_id: cancelledStatus.nfe_status_id,
      nfe_status: CANONICAL_STATUS.CANCELADO,
      cancelled_at:
        cancellationResult?.dataCancelamento ||
        null,
    }
  );

  const response = await updateInvoiceIssuedStatus({
    invoiceId: invoice.invoice_id,
    statusId: cancelledStatus.nfe_status_id,
    statusCode: CANONICAL_STATUS.CANCELADO,
    cancelledAt:
      cancellationResult?.dataCancelamento ||
      new Date().toISOString(),
    reason:
      cancellationResult?.justificativa ||
      reason,
  });

  console.log(
    '[NFE][CANCELAMENTO][ERP_SYNC] invoicesIssued atualizado',
    response
  );

  invoice.nfe_status_id =
    cancelledStatus.nfe_status_id;

  invoice.nfe_status =
    CANONICAL_STATUS.CANCELADO;

  return response;
}

// ======================================================================
// POLLING DO CANCELAMENTO
// ======================================================================

async function pollCancellationStatus(
  idNota,
  reason
) {
  const startedAt = Date.now();

  state.cancellation.processing = true;
  state.cancellation.startedAt =
    new Date().toISOString();

  if (CANCELLATION.initialDelayMs > 0) {
    await sleep(CANCELLATION.initialDelayMs);
  }

  while (
    Date.now() - startedAt <=
    CANCELLATION.pollTimeoutMs
  ) {
    let result;

    try {
      result = await getCancellationStatus(idNota);
    } catch (error) {
      const elapsedMs = Date.now() - startedAt;

      if (
        isTransientProcessingError(
          error,
          elapsedMs
        )
      ) {
        console.warn(
          '[NFE][CANCELAMENTO] Cancelamento ainda em processamento. Nova tentativa...',
          {
            idNota,
            elapsedMs,
            status: error?.status,
            message:
              error?.payload?.error?.message ||
              error?.message ||
              null,
          }
        );

        setStatusBadge(
          'Cancelamento em processamento',
          'primary'
        );

        await sleep(
          CANCELLATION.pollIntervalMs
        );

        continue;
      }

      throw error;
    }

    state.cancellation.lastResult = result;

    renderCancellationStatus(result);

    // --------------------------------------------------------------
    // SUCESSO TERMINAL
    // --------------------------------------------------------------
    if (result?.cancellationCompleted) {
      state.cancellation.completed = true;
      state.cancellation.processing = false;

      await persistCancellationInInvoicesIssued({
        cancellationResult: result,
        reason,
      });

      setStatusBadge(
        'CANCELADO',
        'danger'
      );

      setRetornoApi(result);

      const protocolLine = result?.protocolo
        ? `\nProtocolo: ${result.protocolo}`
        : '';

      const sefazLine = result?.respostaSefaz
        ? `\nSEFAZ: ${result.respostaSefaz}`
        : '';

      finishCancellationUi({
        type: 'success',
        title: 'NF-e cancelada com sucesso',
        message:
          `O cancelamento foi concluído e o ERP foi atualizado.${protocolLine}${sefazLine}`,
        closeModal: true,
        clearForm: true,
      });

      return result;
    }

    // --------------------------------------------------------------
    // REJEIÇÃO TERMINAL
    // --------------------------------------------------------------
    if (result?.cancellationRejected) {
      state.cancellation.rejected = true;
      state.cancellation.processing = false;

      setRetornoApi(result);

      finishCancellationUi({
        type: 'error',
        title: 'Cancelamento rejeitado',
        message:
          result?.respostaSefaz ||
          'O cancelamento da NF-e foi rejeitado.',
        closeModal: true,
        clearForm: true,
      });

      return result;
    }

    // --------------------------------------------------------------
    // ERRO TERMINAL DO PROVEDOR
    // --------------------------------------------------------------
    if (result?.cancellationError) {
      state.cancellation.error = true;
      state.cancellation.processing = false;

      setRetornoApi(result);

      finishCancellationUi({
        type: 'error',
        title: 'Erro no cancelamento',
        message:
          result?.respostaSefaz ||
          'O processamento do cancelamento retornou erro.',
        closeModal: true,
        clearForm: true,
      });

      return result;
    }

    await sleep(
      CANCELLATION.pollIntervalMs
    );
  }

  // ----------------------------------------------------------------
  // TIMEOUT TERMINAL NO FRONTEND
  // ----------------------------------------------------------------
  state.cancellation.processing = false;

  finishCancellationUi({
    type: 'info',
    title: 'Cancelamento ainda em processamento',
    message:
      'O provedor ainda está processando o cancelamento. Consulte novamente o status da NF-e em alguns instantes.',
    closeModal: true,
    clearForm: true,
  });

  return null;
}

// ======================================================================
// SOLICITAR CANCELAMENTO
// ======================================================================

export async function cancelarNfe() {
  const validation =
    validateCancellationForm({
      idNota: getIdNotaValue(),
      justificativa:
        getJustificativaValue(),
      invoice: state.nfeSelecionada,
    });

  if (!validation.ok) {
    showToast(
      validation.errors[0],
      'error'
    );
    return;
  }

  const numero =
    state.nfeSelecionada?.nfe_number ||
    '';

  const confirmed = window.confirm(
    numero
      ? `Confirma o cancelamento da NF-e ${numero}?\n\nEssa operação pode ser irreversível.`
      : 'Confirma o cancelamento desta NF-e?\n\nEssa operação pode ser irreversível.'
  );

  if (!confirmed) return;

  setLoading(true);

  try {
    const requestResult =
      await requestNfeCancellation({
        idNota: validation.idNota,
        justificativa:
          validation.justificativa,
      });

    state.cancellation.requested = true;
    state.cancellation.completed = false;
    state.cancellation.rejected = false;
    state.cancellation.error = false;

    setStatusBadge(
      'Cancelamento solicitado',
      'primary'
    );

    setRetornoApi(requestResult);

    showToast(
      requestResult?.message ||
      'Cancelamento solicitado. Aguardando confirmação da SEFAZ.',
      'success'
    );

    await pollCancellationStatus(
      validation.idNota,
      validation.justificativa
    );
  } catch (error) {
    state.cancellation.processing = false;
    state.cancellation.error = true;

    setRetornoApi(
      error.payload ||
      error.message ||
      error
    );

    setStatusBadge(
      'Falha no cancelamento',
      'danger'
    );

    const message =
      error?.payload?.error?.message ||
      error?.payload?.message ||
      error?.message ||
      'Erro ao cancelar NF-e.';

    finishCancellationUi({
      type: 'error',
      title: 'Falha no cancelamento da NF-e',
      message,
      closeModal: true,
      clearForm: true,
    });
  } finally {
    setLoading(false);
  }
}

// ======================================================================
// LIMPEZA
// ======================================================================

export function limparFormulario() {
  clearCancellationForm();
  clearInfo();

  state.cancellation = {
    requested: false,
    processing: false,
    completed: false,
    rejected: false,
    error: false,
    startedAt: null,
    lastResult: null,
  };

  renderNfesEmitidas([]);
  $('#btnBuscarNfeEmitida')?.focus();
}

function voltarPagina() {
  if (window.history.length > 1) {
    window.history.back();
    return;
  }

  window.location.href =
    '/public/index/index.html';
}

// ======================================================================
// EVENTOS
// ======================================================================

export function bindEvents() {
  $('#btnConsultar')?.addEventListener(
    'click',
    consultarStatusNfe
  );

  $('#btnCancelar')?.addEventListener(
    'click',
    cancelarNfe
  );

  $('#btnLimpar')?.addEventListener(
    'click',
    limparFormulario
  );

  $('#btnVoltar')?.addEventListener(
    'click',
    voltarPagina
  );

  $('#btnAbrirCancelamento')?.addEventListener(
    'click',
    openCancelamentoModal
  );

  $('#btnAbrirConsultaStatus')?.addEventListener(
    'click',
    openConsultaStatusModal
  );

  $('#btnBuscarNfeEmitida')?.addEventListener(
    'click',
    () => openInvoicePicker('cancelamento')
  );

  $('#btnBuscarNfeStatus')?.addEventListener(
    'click',
    () => openInvoicePicker('status')
  );

  $('#btnExecutarBuscaNfeEmitida')
    ?.addEventListener(
      'click',
      buscarNfesEmitidas
    );

  $('#tbodyNfesEmitidas')
    ?.addEventListener(
      'click',
      onTabelaNfesEmitidasClick
    );

  $('#justificativa')?.addEventListener(
    'input',
    updateContadorJustificativa
  );

  $('#buscaNfeEmitida')?.addEventListener(
    'keydown',
    (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        buscarNfesEmitidas();
      }
    }
  );

  $('#modalBuscarNfeEmitida')
    ?.querySelectorAll(
      '[data-modal-nfe-emitida-close]'
    )
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

  $('#modalCancelarNfe')
    ?.querySelectorAll(
      '[data-modal-cancelar-close]'
    )
    .forEach((element) => {
      element.addEventListener(
        'click',
        (event) => {
          event.preventDefault();
          event.stopPropagation();
          closeCancelamentoModal();
        }
      );
    });

  $('#modalConsultaStatus')
    ?.querySelectorAll(
      '[data-modal-status-close]'
    )
    .forEach((element) => {
      element.addEventListener(
        'click',
        (event) => {
          event.preventDefault();
          event.stopPropagation();
          closeConsultaStatusModal();
        }
      );
    });

  document.addEventListener(
    'keydown',
    (event) => {
      if (event.key !== 'Escape') return;

      if (closeTopModal()) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    },
    true
  );
}

// ======================================================================
// INIT
// ======================================================================

export async function initCancelNfeActions() {
  clearCancellationForm();
  clearInfo();
  updateContadorJustificativa();
  bindEvents();

  await loadStatusMap();
}
