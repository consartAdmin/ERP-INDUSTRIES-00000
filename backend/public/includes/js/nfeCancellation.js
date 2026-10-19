// ╔══════════════════════════════════════════════════════════════════════╗
// ║ nfeCancellation.js — Include reutilizável de cancelamento de NF-e  ║
// ║ PRODNEX ERP | ESM                                                   ║
// ║ Local: /public/includes/js/nfeCancellation.js                       ║
// ║                                                                     ║
// ║ Responsabilidades:                                                  ║
// ║  ✅ Injetar modal de cancelamento quando necessário                 ║
// ║  ✅ Abrir cancelamento diretamente a partir de invoicesIssued       ║
// ║  ✅ Validar NF-e AUTORIZADA e nfe_provider_id                       ║
// ║  ✅ Solicitar cancelamento                                          ║
// ║  ✅ Fazer polling assíncrono                                        ║
// ║  ✅ Tratar HTTP 400 "em processamento" como transitório             ║
// ║  ✅ Atualizar invoicesIssued somente após CONCLUIDO                  ║
// ║  ✅ Resolver nfe_status_id = CANCELADO via nfeStatusMap             ║
// ║  ✅ Alertar em todo resultado terminal                              ║
// ║  ✅ Fechar modal ao concluir/rejeitar/errar/timeout                 ║
// ║  ✅ Callback onCompleted/onError/onClose para a página chamadora    ║
// ║  ✅ Não depende do módulo /cancelarNFe                              ║
// ╚══════════════════════════════════════════════════════════════════════╝

const API_BASE =
    window.API_BASE ||
    window.apiBase ||
    '';

const ROUTES = Object.freeze({
    requestCancellation:
        `${API_BASE}/api/nfe/cancelar`,

    cancellationStatus: (id) =>
        `${API_BASE}/api/nfe/cancelamento/${encodeURIComponent(id)}/status`,

    invoiceById: (invoiceId) =>
        `${API_BASE}/api/invoices-issued/${encodeURIComponent(invoiceId)}`,

    nfeStatusMap:
        `${API_BASE}/api/nfe-status-map`,
});

const CONFIG = Object.freeze({
    minReasonLength: 15,
    maxReasonLength: 255,
    pollIntervalMs: 2000,
    pollTimeoutMs: 60000,
    initialDelayMs: 2000,
    transient400WindowMs: 10000,
});

const state = {
    initialized: false,
    invoice: null,
    options: {},
    processing: false,
    startedAt: null,
    lastResult: null,
    statusMap: [],
    statusByCode: new Map(),
};

const IDS = Object.freeze({
    modal: 'nfeCancellationModal',
    providerId: 'nfeCancellationProviderId',
    nfeNumber: 'nfeCancellationNumber',
    sourceReference: 'nfeCancellationSourceReference',
    customer: 'nfeCancellationCustomer',
    reason: 'nfeCancellationReason',
    counter: 'nfeCancellationCounter',
    loading: 'nfeCancellationLoading',
    statusText: 'nfeCancellationStatusText',
    btnCancel: 'nfeCancellationBtnCancel',
    btnClear: 'nfeCancellationBtnClear',
});

/* =========================================================================
 * Helpers
 * ========================================================================= */

function $(selector, root = document) {
    return root.querySelector(selector);
}

function normalizeText(value) {
    return String(value ?? '')
        .replace(/\s+/g, ' ')
        .trim();
}

function normalizeNfeStatusCode(value) {
    const status = String(value || '')
        .trim()
        .toUpperCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

    const aliases = {
        PENDENTE: 'PENDENTE',

        PROCESSANDO: 'PROCESSANDO',
        PROCESSAMENTO: 'PROCESSANDO',
        EM_PROCESSAMENTO: 'PROCESSANDO',

        AUTORIZADA: 'AUTORIZADO',
        AUTORIZADO: 'AUTORIZADO',
        CONCLUIDO: 'AUTORIZADO',
        CONCLUIDA: 'AUTORIZADO',

        REJEITADA: 'REJEITADO',
        REJEITADO: 'REJEITADO',

        CANCELADA: 'CANCELADO',
        CANCELADO: 'CANCELADO',

        DENEGADA: 'DENEGADO',
        DENEGADO: 'DENEGADO',

        INUTILIZADA: 'INUTILIZADO',
        INUTILIZADO: 'INUTILIZADO',

        ERRO: 'ERRO',
    };

    return aliases[status] || status || null;
}

function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

function getModal() {
    return document.getElementById(IDS.modal);
}

function getReason() {
    return normalizeText(
        document.getElementById(IDS.reason)?.value
    );
}

function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = String(value ?? '');
}

function setValue(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = String(value ?? '');
}

function emitToast(message, type = 'info') {
    const text = normalizeText(message);
    if (!text) return;

    // Integra com toast global se existir.
    if (typeof window.showToast === 'function') {
        try {
            window.showToast(text, type);
            return;
        } catch {
            // fallback abaixo
        }
    }

    const event = new CustomEvent(
        'nfeCancellation:toast',
        {
            detail: {
                message: text,
                type,
            },
        }
    );

    window.dispatchEvent(event);
}

function terminalAlert(title, message) {
    window.alert(
        `${normalizeText(title) || 'Cancelamento de NF-e'}\n\n` +
        `${normalizeText(message) || 'Processamento finalizado.'}`
    );
}

function log(label, details = {}) {
    console.log(
        `[NFE][CANCELLATION_INCLUDE][${label}]`,
        details
    );
}

function warn(label, details = {}) {
    console.warn(
        `[NFE][CANCELLATION_INCLUDE][${label}]`,
        details
    );
}

function errorLog(label, details = {}) {
    console.error(
        `[NFE][CANCELLATION_INCLUDE][${label}]`,
        details
    );
}

/* =========================================================================
 * HTTP
 * ========================================================================= */

async function fetchJson(url, options = {}) {
    const response = await fetch(url, {
        ...options,
        headers: {
            Accept: 'application/json',

            ...(options.body
                ? { 'Content-Type': 'application/json' }
                : {}),

            ...(options.headers || {}),
        },
    });

    const contentType =
        response.headers.get('content-type') || '';

    const payload =
        contentType.includes('application/json')
            ? await response.json()
            : await response.text();

    if (!response.ok) {
        const err = new Error(
            payload?.message ||
            payload?.error?.message ||
            payload?.error ||
            (
                typeof payload === 'string'
                    ? payload
                    : null
            ) ||
            `Erro HTTP ${response.status}.`
        );

        err.status = response.status;
        err.payload = payload;

        throw err;
    }

    return payload;
}

/* =========================================================================
 * CSS / HTML do include
 * ========================================================================= */

function injectStyles() {
    if (
        document.getElementById(
            'nfeCancellationIncludeStyles'
        )
    ) {
        return;
    }

    const style = document.createElement('style');
    style.id = 'nfeCancellationIncludeStyles';

    style.textContent = `
    body.nfe-cancellation-modal-open {
      overflow: hidden;
    }

    .nfe-cancellation-modal {
      position: fixed;
      inset: 0;
      z-index: 10050;
      display: none;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }

    .nfe-cancellation-modal.is-open {
      display: flex;
    }

    .nfe-cancellation-modal__backdrop {
      position: absolute;
      inset: 0;
      background: rgba(15, 23, 42, .48);
      backdrop-filter: blur(2px);
    }

    .nfe-cancellation-modal__dialog {
      position: relative;
      z-index: 1;
      width: min(980px, 96vw);
      max-height: 92vh;
      overflow: auto;
      border: 1px solid #cbd5e1;
      border-radius: 16px;
      background: #fff;
      box-shadow: 0 24px 70px rgba(15, 23, 42, .28);
    }

    .nfe-cancellation-modal__header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 18px;
      padding: 18px 20px 14px;
      border-bottom: 1px solid #dbeafe;
      background: #eff6ff;
    }

    .nfe-cancellation-modal__title {
      margin: 0 0 4px;
      font-size: 20px;
      font-weight: 700;
      color: #172033;
    }

    .nfe-cancellation-modal__warning {
      margin: 0;
      font-size: 13px;
      line-height: 1.4;
      color: #2563eb;
    }

    .nfe-cancellation-modal__close {
      border: 0;
      background: transparent;
      font-size: 25px;
      line-height: 1;
      cursor: pointer;
      color: #334155;
    }

    .nfe-cancellation-modal__body {
      padding: 20px;
    }

    .nfe-cancellation-grid {
      display: grid;
      grid-template-columns:
        minmax(220px, 1.5fr)
        minmax(110px, .6fr)
        minmax(120px, .7fr)
        minmax(220px, 1.4fr);
      gap: 12px;
      align-items: end;
    }

    .nfe-cancellation-field {
      display: flex;
      flex-direction: column;
      gap: 5px;
      min-width: 0;
    }

    .nfe-cancellation-field label {
      font-size: 12px;
      color: #334155;
    }

    .nfe-cancellation-field input,
    .nfe-cancellation-field textarea {
      width: 100%;
      box-sizing: border-box;
      border: 1px solid #94a3b8;
      border-radius: 7px;
      background: #fff;
      padding: 8px 10px;
      font: inherit;
      color: #172033;
    }

    .nfe-cancellation-field input[readonly] {
      background: #f8fafc;
      color: #475569;
    }

    .nfe-cancellation-reason {
      margin-top: 14px;
    }

    .nfe-cancellation-field textarea {
      min-height: 125px;
      resize: vertical;
    }

    .nfe-cancellation-footer-info {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 4px;
      font-size: 11px;
      color: #475569;
    }

    .nfe-cancellation-status {
      min-height: 26px;
      margin-top: 10px;
      font-size: 13px;
      color: #334155;
    }

    .nfe-cancellation-loading {
      display: none;
      align-items: center;
      gap: 8px;
      margin-top: 9px;
      font-size: 13px;
      color: #334155;
    }

    .nfe-cancellation-loading.is-visible {
      display: flex;
    }

    .nfe-cancellation-spinner {
      width: 15px;
      height: 15px;
      border: 2px solid #cbd5e1;
      border-top-color: #2563eb;
      border-radius: 50%;
      animation: nfeCancellationSpin .8s linear infinite;
    }

    @keyframes nfeCancellationSpin {
      to {
        transform: rotate(360deg);
      }
    }

    .nfe-cancellation-modal__footer {
      display: flex;
      justify-content: flex-end;
      gap: 9px;
      padding: 13px 20px;
      border-top: 1px solid #dbeafe;
      background: #eff6ff;
    }

    .nfe-cancellation-btn {
      min-height: 34px;
      padding: 7px 13px;
      border: 1px solid #94a3b8;
      border-radius: 7px;
      background: #fff;
      color: #172033;
      font-weight: 600;
      cursor: pointer;
    }

    .nfe-cancellation-btn:hover:not(:disabled) {
      background: #f8fafc;
    }

    .nfe-cancellation-btn--danger {
      border-color: #dc2626;
      color: #b91c1c;
    }

    .nfe-cancellation-btn:disabled {
      cursor: not-allowed;
      opacity: .55;
    }

    @media (max-width: 840px) {
      .nfe-cancellation-grid {
        grid-template-columns: 1fr 1fr;
      }
    }

    @media (max-width: 560px) {
      .nfe-cancellation-grid {
        grid-template-columns: 1fr;
      }

      .nfe-cancellation-modal {
        padding: 8px;
      }
    }
  `;

    document.head.appendChild(style);
}

function injectModal() {
    if (getModal()) {
        return getModal();
    }

    const wrapper = document.createElement('div');

    wrapper.innerHTML = `
    <div
      id="${IDS.modal}"
      class="nfe-cancellation-modal"
      aria-hidden="true"
    >
      <div
        class="nfe-cancellation-modal__backdrop"
        data-nfe-cancellation-close
      ></div>

      <section
        class="nfe-cancellation-modal__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="nfeCancellationTitle"
      >
        <header class="nfe-cancellation-modal__header">
          <div>
            <h2
              id="nfeCancellationTitle"
              class="nfe-cancellation-modal__title"
            >
              Cancelar NF-e
            </h2>

            <p class="nfe-cancellation-modal__warning">
              Apenas notas fiscais em situação autorizada podem ser canceladas
              por este fluxo. O ERP só será atualizado para CANCELADO após a
              confirmação do evento pela SEFAZ / PlugNotas.
            </p>
          </div>

          <button
            type="button"
            class="nfe-cancellation-modal__close"
            aria-label="Fechar"
            data-nfe-cancellation-close
          >
            &times;
          </button>
        </header>

        <div class="nfe-cancellation-modal__body">
          <div class="nfe-cancellation-grid">
            <div class="nfe-cancellation-field">
              <label for="${IDS.providerId}">
                ID PlugNotas
              </label>

              <input
                id="${IDS.providerId}"
                type="text"
                readonly
              />
            </div>

            <div class="nfe-cancellation-field">
              <label for="${IDS.nfeNumber}">
                Nº NF-e
              </label>

              <input
                id="${IDS.nfeNumber}"
                type="text"
                readonly
              />
            </div>

            <div class="nfe-cancellation-field">
              <label for="${IDS.sourceReference}">
                Pedido / Orçamento
              </label>

              <input
                id="${IDS.sourceReference}"
                type="text"
                readonly
              />
            </div>

            <div class="nfe-cancellation-field">
              <label for="${IDS.customer}">
                Cliente
              </label>

              <input
                id="${IDS.customer}"
                type="text"
                readonly
              />
            </div>
          </div>

          <div class="nfe-cancellation-field nfe-cancellation-reason">
            <label for="${IDS.reason}">
              Justificativa do Cancelamento
            </label>

            <textarea
              id="${IDS.reason}"
              maxlength="${CONFIG.maxReasonLength}"
              placeholder="Descreva a justificativa do cancelamento com no mínimo ${CONFIG.minReasonLength} caracteres..."
            ></textarea>

            <div class="nfe-cancellation-footer-info">
              <span id="${IDS.counter}">
                0 caracteres
              </span>

              <span>
                Mínimo exigido:
                ${CONFIG.minReasonLength} caracteres
              </span>
            </div>
          </div>

          <div
            id="${IDS.loading}"
            class="nfe-cancellation-loading"
          >
            <span class="nfe-cancellation-spinner"></span>
            <span>Processando solicitação...</span>
          </div>

          <div
            id="${IDS.statusText}"
            class="nfe-cancellation-status"
          ></div>
        </div>

        <footer class="nfe-cancellation-modal__footer">
          <button
            id="${IDS.btnClear}"
            type="button"
            class="nfe-cancellation-btn"
          >
            Limpar
          </button>

          <button
            id="${IDS.btnCancel}"
            type="button"
            class="nfe-cancellation-btn nfe-cancellation-btn--danger"
          >
            🚫 Cancelar NF-e
          </button>

          <button
            type="button"
            class="nfe-cancellation-btn"
            data-nfe-cancellation-close
          >
            Fechar
          </button>
        </footer>
      </section>
    </div>
  `;

    const modal = wrapper.firstElementChild;
    document.body.appendChild(modal);

    return modal;
}

/* =========================================================================
 * Modal
 * ========================================================================= */

function setProcessing(value) {
    state.processing = Boolean(value);

    const loading =
        document.getElementById(IDS.loading);

    loading?.classList.toggle(
        'is-visible',
        state.processing
    );

    const buttons = [
        document.getElementById(IDS.btnCancel),
        document.getElementById(IDS.btnClear),
    ];

    for (const button of buttons) {
        if (button) {
            button.disabled = state.processing;
        }
    }

    const closeButtons =
        getModal()?.querySelectorAll(
            '[data-nfe-cancellation-close]'
        ) || [];

    closeButtons.forEach((button) => {
        button.disabled = state.processing;
    });
}

function setStatus(message = '') {
    setText(
        IDS.statusText,
        normalizeText(message)
    );
}

function updateCounter() {
    setText(
        IDS.counter,
        `${getReason().length} caracteres`
    );
}

function clearForm() {
    setValue(IDS.reason, '');
    updateCounter();
    setStatus('');
}

export function closeNfeCancellation({
    force = false,
    silent = false,
} = {}) {
    if (
        state.processing &&
        !force
    ) {
        return false;
    }

    const modal = getModal();

    if (!modal) {
        return true;
    }

    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');

    document.body.classList.remove(
        'nfe-cancellation-modal-open'
    );

    if (!silent) {
        try {
            state.options?.onClose?.({
                invoice: state.invoice,
                lastResult: state.lastResult,
            });
        } catch (callbackError) {
            errorLog('ON_CLOSE_CALLBACK_ERROR', {
                error:
                    callbackError?.message ||
                    callbackError,
            });
        }
    }

    return true;
}

function openModal() {
    const modal = getModal();

    if (!modal) return;

    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');

    document.body.classList.add(
        'nfe-cancellation-modal-open'
    );

    requestAnimationFrame(() => {
        document
            .getElementById(IDS.reason)
            ?.focus();
    });
}

/* =========================================================================
 * Status Map
 * ========================================================================= */

async function loadStatusMap() {
    try {
        const url = new URL(
            ROUTES.nfeStatusMap,
            window.location.origin
        );

        url.searchParams.set(
            'activeOnly',
            'true'
        );

        const result = await fetchJson(
            url.toString()
        );

        const statuses =
            Array.isArray(result?.data)
                ? result.data
                : Array.isArray(result)
                    ? result
                    : [];

        state.statusMap = statuses;

        state.statusByCode = new Map(
            statuses.map((item) => [
                normalizeNfeStatusCode(item?.code),
                item,
            ])
        );

        log('STATUS_MAP_LOADED', {
            count: statuses.length,
            cancelledStatus:
                state.statusByCode.get('CANCELADO') ||
                null,
        });
    } catch (err) {
        warn('STATUS_MAP_LOAD_FAILED', {
            status: err?.status || null,
            message: err?.message || err,
            payload: err?.payload || null,
        });

        state.statusMap = [];
        state.statusByCode = new Map();
    }
}

/* =========================================================================
 * Invoice
 * ========================================================================= */

function normalizeInvoice(row = {}) {
    return {
        ...row,

        invoice_id:
            row.invoice_id ??
            row.invoiceId ??
            row.id ??
            null,

        order_id:
            row.order_id ??
            row.orderId ??
            null,

        order_number:
            row.order_number ??
            row.orderNumber ??
            null,

        budget_id:
            row.budget_id ??
            row.budgetId ??
            null,

        bonus_id:
            row.bonus_id ??
            row.bonusId ??
            null,

        source_type:
            row.source_type ||
            row.sourceType ||
            (
                row.budget_id
                    ? 'BUDGET'
                    : row.bonus_id
                        ? 'BONUS'
                        : 'ORDER'
            ),

        nfe_provider_id:
            normalizeText(
                row.nfe_provider_id ||
                row.nfeProviderId ||
                row.nfe_plugnotas_id ||
                row.nfePlugnotasId ||
                row.provider_id ||
                row.providerId
            ) || null,

        nfe_number:
            row.nfe_number ??
            row.nfeNumber ??
            row.numero ??
            null,

        nfe_key:
            normalizeText(
                row.nfe_key ||
                row.nfeKey ||
                row.chave
            ) || null,

        nfe_status:
            normalizeNfeStatusCode(
                row.nfe_status ||
                row.nfeStatus ||
                row.status
            ),

        nfe_status_id:
            row.nfe_status_id ??
            row.nfeStatusId ??
            null,

        customer_name:
            normalizeText(
                row.customer_name ||
                row.customerName
            ) || null,
    };
}

async function loadInvoiceById(invoiceId) {
    const result = await fetchJson(
        ROUTES.invoiceById(invoiceId)
    );

    const invoice =
        result?.invoice ||
        result?.data?.invoice ||
        result?.data ||
        null;

    if (!invoice) {
        throw new Error(
            'A API não retornou os dados da NF-e.'
        );
    }

    return normalizeInvoice(invoice);
}

function sourceReference(invoice) {
    if (!invoice) return '';

    if (
        invoice.source_type === 'BUDGET'
    ) {
        return invoice.budget_id
            ? `Orçamento ${invoice.budget_id}`
            : 'Orçamento';
    }

    if (
        invoice.source_type === 'BONUS'
    ) {
        return invoice.bonus_id
            ? `Bonificação ${invoice.bonus_id}`
            : 'Bonificação';
    }

    const order =
        invoice.order_number ||
        invoice.order_id;

    return order
        ? `Pedido ${order}`
        : 'Pedido';
}

function fillInvoice(invoice) {
    setValue(
        IDS.providerId,
        invoice?.nfe_provider_id || ''
    );

    setValue(
        IDS.nfeNumber,
        invoice?.nfe_number || ''
    );

    setValue(
        IDS.sourceReference,
        sourceReference(invoice)
    );

    setValue(
        IDS.customer,
        invoice?.customer_name || ''
    );
}

/* =========================================================================
 * Validation
 * ========================================================================= */

function validateInvoice(invoice) {
    if (!invoice?.invoice_id) {
        throw new Error(
            'invoice_id não informado.'
        );
    }

    if (
        normalizeNfeStatusCode(
            invoice.nfe_status
        ) !== 'AUTORIZADO'
    ) {
        throw new Error(
            `Somente NF-e AUTORIZADA pode ser cancelada. Status atual: ${normalizeNfeStatusCode(
                invoice.nfe_status
            ) || 'NÃO INFORMADO'
            }.`
        );
    }

    if (!invoice.nfe_provider_id) {
        throw new Error(
            'Esta NF-e não possui nfe_provider_id da PlugNotas.'
        );
    }
}

function validateReason(reason) {
    if (!reason) {
        throw new Error(
            'A justificativa do cancelamento é obrigatória.'
        );
    }

    if (
        reason.length <
        CONFIG.minReasonLength
    ) {
        throw new Error(
            `A justificativa deve conter no mínimo ${CONFIG.minReasonLength} caracteres.`
        );
    }
}

/* =========================================================================
 * Provider cancellation
 * ========================================================================= */

async function requestCancellation(
    invoice,
    reason
) {
    log('REQUEST_START', {
        invoice_id:
            invoice.invoice_id,

        nfe_number:
            invoice.nfe_number,

        nfe_provider_id:
            invoice.nfe_provider_id,

        source_type:
            invoice.source_type,
    });

    return fetchJson(
        ROUTES.requestCancellation,
        {
            method: 'POST',

            body: JSON.stringify({
                idNota:
                    invoice.nfe_provider_id,

                justificativa:
                    reason,
            }),
        }
    );
}

async function getCancellationStatus(
    providerId
) {
    return fetchJson(
        ROUTES.cancellationStatus(
            providerId
        )
    );
}

function isTransientProcessingError(
    err,
    elapsedMs
) {
    if (
        Number(err?.status) !== 400 ||
        elapsedMs >
        CONFIG.transient400WindowMs
    ) {
        return false;
    }

    const message =
        normalizeText(
            err?.payload?.error?.message ||
            err?.payload?.message ||
            err?.message
        ).toLowerCase();

    return (
        message.includes('processamento') ||
        message.includes('processando') ||
        message.includes('aguarde')
    );
}

/* =========================================================================
 * ERP persistence
 * ========================================================================= */

async function persistCancellationInErp(
    invoice,
    result,
    reason
) {
    if (!invoice?.invoice_id) {
        throw new Error(
            'invoice_id ausente para atualizar invoicesIssued.'
        );
    }

    let cancelledStatus =
        state.statusByCode.get('CANCELADO');

    if (!cancelledStatus) {
        await loadStatusMap();

        cancelledStatus =
            state.statusByCode.get('CANCELADO');
    }

    if (!cancelledStatus?.nfe_status_id) {
        throw new Error(
            'Status CANCELADO não encontrado em nfeStatusMap.'
        );
    }

    const patch = {
        nfe_status_id:
            cancelledStatus.nfe_status_id,

        nfe_status:
            'CANCELADO',

        cancelled_at:
            result?.dataCancelamento ||
            new Date().toISOString(),

        cancellation_reason:
            result?.justificativa ||
            reason,
    };

    log('ERP_PATCH_START', {
        invoice_id:
            invoice.invoice_id,

        patch,
    });

    const response = await fetchJson(
        ROUTES.invoiceById(
            invoice.invoice_id
        ),
        {
            method: 'PATCH',
            body: JSON.stringify(patch),
        }
    );

    log('ERP_PATCH_DONE', {
        invoice_id:
            invoice.invoice_id,

        response,
    });

    invoice.nfe_status =
        'CANCELADO';

    invoice.nfe_status_id =
        cancelledStatus.nfe_status_id;

    invoice.cancelled_at =
        patch.cancelled_at;

    invoice.cancellation_reason =
        patch.cancellation_reason;

    return response;
}

/* =========================================================================
 * Terminal handling
 * ========================================================================= */

async function terminalSuccess(
    result,
    reason
) {
    state.processing = false;

    await persistCancellationInErp(
        state.invoice,
        result,
        reason
    );

    const protocol =
        result?.protocolo
            ? `\nProtocolo: ${result.protocolo}`
            : '';

    const sefaz =
        result?.respostaSefaz
            ? `\nSEFAZ: ${result.respostaSefaz}`
            : '';

    const message =
        `O cancelamento foi concluído com sucesso.${protocol}${sefaz}`;

    emitToast(
        'NF-e cancelada com sucesso.',
        'success'
    );

    terminalAlert(
        'NF-e cancelada com sucesso',
        message
    );

    closeNfeCancellation({
        force: true,
        silent: true,
    });

    try {
        await state.options?.onCompleted?.({
            invoice: state.invoice,
            cancellation: result,
        });
    } catch (callbackError) {
        errorLog(
            'ON_COMPLETED_CALLBACK_ERROR',
            {
                error:
                    callbackError?.message ||
                    callbackError,
            }
        );
    }

    return result;
}

function terminalFailure({
    title,
    message,
    type = 'error',
    result = null,
}) {
    state.processing = false;
    state.lastResult = result;

    emitToast(
        message,
        type
    );

    terminalAlert(
        title,
        message
    );

    closeNfeCancellation({
        force: true,
        silent: true,
    });

    try {
        state.options?.onError?.({
            invoice: state.invoice,
            result,
            message,
        });
    } catch (callbackError) {
        errorLog(
            'ON_ERROR_CALLBACK_ERROR',
            {
                error:
                    callbackError?.message ||
                    callbackError,
            }
        );
    }

    return result;
}

/* =========================================================================
 * Polling
 * ========================================================================= */

async function pollCancellation(
    providerId,
    reason
) {
    const startedAt = Date.now();
    let attempt = 0;

    state.startedAt =
        new Date().toISOString();

    setStatus(
        'Cancelamento solicitado. Aguardando confirmação da SEFAZ...'
    );

    await sleep(
        CONFIG.initialDelayMs
    );

    while (
        Date.now() - startedAt <=
        CONFIG.pollTimeoutMs
    ) {
        attempt += 1;

        const elapsedMs =
            Date.now() - startedAt;

        log('POLL_ATTEMPT', {
            attempt,
            elapsedMs,
            providerId,
        });

        let result;

        try {
            result =
                await getCancellationStatus(
                    providerId
                );
        } catch (err) {
            if (
                isTransientProcessingError(
                    err,
                    elapsedMs
                )
            ) {
                setStatus(
                    'Cancelamento em processamento. Aguardando SEFAZ...'
                );

                warn('POLL_TRANSIENT_400', {
                    attempt,
                    elapsedMs,
                    status: err?.status,
                    message:
                        err?.message || null,
                    payload:
                        err?.payload || null,
                });

                await sleep(
                    CONFIG.pollIntervalMs
                );

                continue;
            }

            throw err;
        }

        state.lastResult = result;

        log('POLL_RESULT', {
            attempt,
            result,
        });

        if (
            result?.cancellationCompleted === true
        ) {
            return terminalSuccess(
                result,
                reason
            );
        }

        if (
            result?.cancellationRejected === true
        ) {
            return terminalFailure({
                title:
                    'Cancelamento rejeitado',

                message:
                    result?.respostaSefaz ||
                    'O cancelamento da NF-e foi rejeitado.',

                result,
            });
        }

        if (
            result?.cancellationError === true
        ) {
            return terminalFailure({
                title:
                    'Erro no cancelamento',

                message:
                    result?.respostaSefaz ||
                    'O processamento do cancelamento retornou erro.',

                result,
            });
        }

        setStatus(
            'Cancelamento em processamento. Aguardando SEFAZ...'
        );

        await sleep(
            CONFIG.pollIntervalMs
        );
    }

    return terminalFailure({
        title:
            'Cancelamento ainda em processamento',

        message:
            'O provedor ainda está processando o cancelamento. Consulte novamente o status da NF-e em alguns instantes.',

        type:
            'info',

        result:
            state.lastResult,
    });
}

/* =========================================================================
 * Main action
 * ========================================================================= */

async function executeCancellation() {
    if (state.processing) {
        return;
    }

    const invoice =
        state.invoice;

    const reason =
        getReason();

    try {
        validateInvoice(invoice);
        validateReason(reason);

        const confirmed =
            window.confirm(
                invoice?.nfe_number
                    ? `Confirma o cancelamento da NF-e ${invoice.nfe_number}?\n\nEssa operação pode ser irreversível.`
                    : 'Confirma o cancelamento desta NF-e?\n\nEssa operação pode ser irreversível.'
            );

        if (!confirmed) {
            return;
        }

        setProcessing(true);

        setStatus(
            'Solicitando cancelamento...'
        );

        const requestResult =
            await requestCancellation(
                invoice,
                reason
            );

        log('REQUEST_ACCEPTED', {
            invoice_id:
                invoice.invoice_id,

            requestResult,
        });

        setStatus(
            requestResult?.message ||
            'Cancelamento solicitado. Aguardando confirmação da SEFAZ...'
        );

        await pollCancellation(
            invoice.nfe_provider_id,
            reason
        );
    } catch (err) {
        setProcessing(false);

        errorLog('EXECUTION_ERROR', {
            invoice_id:
                invoice?.invoice_id || null,

            nfe_number:
                invoice?.nfe_number || null,

            status:
                err?.status || null,

            message:
                err?.message || err,

            payload:
                err?.payload || null,
        });

        terminalFailure({
            title:
                'Falha no cancelamento da NF-e',

            message:
                err?.payload?.message ||
                err?.payload?.error?.message ||
                err?.message ||
                'Erro ao cancelar NF-e.',

            result:
                err?.payload || null,
        });
    } finally {
        setProcessing(false);
    }
}

/* =========================================================================
 * Event bindings
 * ========================================================================= */

function bindEvents() {
    const modal = getModal();

    if (!modal) return;

    modal
        .querySelectorAll(
            '[data-nfe-cancellation-close]'
        )
        .forEach((element) => {
            element.addEventListener(
                'click',
                () => {
                    closeNfeCancellation();
                }
            );
        });

    document
        .getElementById(IDS.reason)
        ?.addEventListener(
            'input',
            updateCounter
        );

    document
        .getElementById(IDS.btnClear)
        ?.addEventListener(
            'click',
            () => {
                if (state.processing) return;
                clearForm();

                document
                    .getElementById(IDS.reason)
                    ?.focus();
            }
        );

    document
        .getElementById(IDS.btnCancel)
        ?.addEventListener(
            'click',
            executeCancellation
        );

    document.addEventListener(
        'keydown',
        (event) => {
            if (
                event.key !== 'Escape' ||
                !getModal()?.classList.contains(
                    'is-open'
                )
            ) {
                return;
            }

            if (state.processing) {
                return;
            }

            closeNfeCancellation();
        }
    );
}

/* =========================================================================
 * Public API
 * ========================================================================= */

export async function initNfeCancellation() {
    if (state.initialized) {
        return;
    }

    injectStyles();
    injectModal();
    bindEvents();

    await loadStatusMap();

    state.initialized = true;

    log('INITIALIZED', {
        statusMapCount:
            state.statusMap.length,
    });
}

export async function openNfeCancellation(
    invoiceOrId,
    options = {}
) {
    await initNfeCancellation();

    let invoice;

    if (
        typeof invoiceOrId === 'number' ||
        (
            typeof invoiceOrId === 'string' &&
            /^\d+$/.test(
                invoiceOrId.trim()
            )
        )
    ) {
        invoice =
            await loadInvoiceById(
                Number(invoiceOrId)
            );
    } else {
        invoice =
            normalizeInvoice(
                invoiceOrId || {}
            );

        // Se o objeto fornecido estiver incompleto,
        // recarrega a NF-e do backend usando invoice_id.
        if (
            invoice.invoice_id &&
            (
                !invoice.nfe_provider_id ||
                !invoice.nfe_status
            )
        ) {
            invoice =
                await loadInvoiceById(
                    invoice.invoice_id
                );
        }
    }

    validateInvoice(invoice);

    state.invoice = invoice;

    state.options = {
        onCompleted:
            typeof options.onCompleted === 'function'
                ? options.onCompleted
                : null,

        onError:
            typeof options.onError === 'function'
                ? options.onError
                : null,

        onClose:
            typeof options.onClose === 'function'
                ? options.onClose
                : null,
    };

    state.processing = false;
    state.startedAt = null;
    state.lastResult = null;

    fillInvoice(invoice);
    clearForm();
    setProcessing(false);

    openModal();

    log('OPENED', {
        invoice_id:
            invoice.invoice_id,

        source_type:
            invoice.source_type,

        nfe_number:
            invoice.nfe_number,

        nfe_status:
            invoice.nfe_status,

        nfe_provider_id:
            invoice.nfe_provider_id,
    });

    return invoice;
}

export function getNfeCancellationState() {
    return {
        initialized:
            state.initialized,

        processing:
            state.processing,

        invoice:
            state.invoice
                ? { ...state.invoice }
                : null,

        lastResult:
            state.lastResult,
    };
}

// API global opcional para páginas legadas sem import explícito.
window.NfeCancellation = Object.freeze({
    init:
        initNfeCancellation,

    open:
        openNfeCancellation,

    close:
        closeNfeCancellation,

    getState:
        getNfeCancellationState,
});

export default {
    initNfeCancellation,
    openNfeCancellation,
    closeNfeCancellation,
    getNfeCancellationState,
};
