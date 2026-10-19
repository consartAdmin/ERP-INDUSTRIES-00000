// ╔══════════════════════════════════════════════════════════════════════╗
// ║ budgets.nfePreview.js — Renderização DANFE com PDF.js               ║
// ║ ✅ Renderiza PDF em canvas                                          ║
// ║ ✅ Não utiliza iframe                                               ║
// ║ ✅ Não inicia download                                              ║
// ║ ✅ Envia autenticação JWT                                           ║
// ║ ✅ Scroll interno horizontal e vertical                             ║
// ║ ✅ Zoom: aumentar, diminuir, 100% e ajustar                          ║
// ║ ✅ Atalhos Ctrl +, Ctrl -, Ctrl 0                                   ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import {
    authHeaders,
    toast,
} from './budgets.infra.js';

import * as pdfjsLib
    from '/public/vendor/pdfjs/pdf.mjs';

import { showCenterModal } from '../../includes/js/centerAlertModal.js';

pdfjsLib.GlobalWorkerOptions.workerSrc =
    '/public/vendor/pdfjs/pdf.worker.mjs';

import {
    canIssueNfeFromBudget,
    applyNfeIssuanceModeUI,
} from './budgets.nfeIssuanceMode.js';

/* =========================================================
   State
========================================================= */

let currentLoadingTask = null;
let currentPdfDocument = null;
let activePageRenderTasks = [];
let renderVersion = 0;
let currentZoom = 1;
let issueRequestInProgress = false;

const NFE_AUTHORIZED_STATUSES = new Set([
    'AUTORIZADA',
    'AUTORIZADO',
]);

const NFE_PROCESSING_STATUSES = new Set([
    'PROCESSANDO',
    'PENDENTE',
    'ENVIADA',
    'EM_PROCESSAMENTO',
]);

const NFE_RETRYABLE_STATUSES = new Set([
    'REJEITADA',
    'REJEITADO',
    'DENEGADA',
    'DENEGADO',
    'CANCELADA',
    'CANCELADO',
    'ERRO',
]);

const NFE_STATUS_POLL_INTERVAL_MS = 3000;
// Aguarda por até 6 minutos. Alguns processamentos da SEFAZ/provedor
// ultrapassam 60 segundos, especialmente em homologação.
const NFE_STATUS_POLL_MAX_ATTEMPTS = 120;
// Falhas transitórias de rede não devem interromper a reconciliação.
const NFE_STATUS_POLL_MAX_CONSECUTIVE_ERRORS = 5;

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.25;
const BASE_SCALE = 1.25;

/* =========================================================
   DOM helper
========================================================= */

function $(selector) {
    return document.querySelector(
        selector
    );
}

function updatePreviewNfeNumber(
    value
) {
    const element =
        $('#nfePreviewSequenceNumber');

    if (!element) {
        console.warn(
            '[NFE PREVIEW] Elemento #nfePreviewSequenceNumber não encontrado.'
        );

        return;
    }

    const number =
        Number(value);

    element.textContent =
        Number.isSafeInteger(number) &&
            number > 0
            ? String(number)
            : '—';
}

function normalizeNfeStatus(value) {
    return String(value || '')
        .trim()
        .toUpperCase();
}

function configureIssueButton(statusValue = '') {
    const button = $('#btnIssueNfe');

    if (!button) return;

    const status = normalizeNfeStatus(statusValue);
    button.dataset.issueStatus = status;

    if (NFE_AUTHORIZED_STATUSES.has(status)) {
        button.disabled = true;
        button.innerHTML = '<i>✅</i><span>NF-e autorizada</span>';
        return;
    }

    if (NFE_PROCESSING_STATUSES.has(status)) {
        button.disabled = false;
        button.innerHTML = '<i>🔄</i><span>Consultar situação</span>';
        return;
    }

    if (NFE_RETRYABLE_STATUSES.has(status)) {
        button.disabled = false;
        button.innerHTML = '<i>♻️</i><span>Reemitir NF-e</span>';
        return;
    }

    button.disabled = false;
    button.innerHTML = '<i>🧾</i><span>Emitir NF-e</span>';
}

/* =========================================================
   Budget ID
========================================================= */

function resolveBudgetId() {
    const button =
        $('#btnGenerateNfe');

    const editor =
        $('#editor');

    const numberInput =
        $('#numero');

    const rawValue =
        button?.dataset?.budgetId ||
        editor?.dataset?.budgetId ||
        numberInput?.dataset?.budgetId ||
        numberInput?.value ||
        '';

    const budgetId =
        Number(
            String(rawValue)
                .replace(/\D/g, '')
        );

    return (
        Number.isSafeInteger(budgetId) &&
        budgetId > 0
    )
        ? budgetId
        : null;
}

/* =========================================================
   Zoom helpers
========================================================= */

function clampZoom(value) {
    return Math.min(
        MAX_ZOOM,
        Math.max(
            MIN_ZOOM,
            Number(value) || 1
        )
    );
}

function updateZoomDisplay() {
    const element =
        $('#nfeZoomValue');

    if (element) {
        element.textContent =
            `${Math.round(currentZoom * 100)}%`;
    }

    const zoomOutButton =
        $('#btnNfeZoomOut');

    const zoomInButton =
        $('#btnNfeZoomIn');

    if (zoomOutButton) {
        zoomOutButton.disabled =
            currentZoom <= MIN_ZOOM;
    }

    if (zoomInButton) {
        zoomInButton.disabled =
            currentZoom >= MAX_ZOOM;
    }
}

/* =========================================================
   Modal
========================================================= */

function showModal() {
    const modal =
        $('#nfePreviewModal');

    const backdrop =
        $('#nfePreviewBackdrop');

    modal?.classList.remove(
        'hidden'
    );

    backdrop?.classList.remove(
        'hidden'
    );

    modal?.setAttribute(
        'aria-hidden',
        'false'
    );

    backdrop?.setAttribute(
        'aria-hidden',
        'false'
    );

    document.body.classList.add(
        'modal-open'
    );
}

function clearRenderedPages() {
    const container =
        $('#nfePreviewPages');

    if (container) {
        container.replaceChildren();
    }
}

function resetViewportScroll() {
    const viewport =
        $('#nfePreviewViewport');

    if (viewport) {
        viewport.scrollLeft = 0;
        viewport.scrollTop = 0;
    }
}

/* =========================================================
   PDF render cancellation
========================================================= */

function cancelActivePageRenders() {
    for (
        const renderTask
        of activePageRenderTasks
    ) {
        try {
            renderTask.cancel();
        } catch {
            // The page may already have finished rendering.
        }
    }

    activePageRenderTasks = [];
}

async function destroyCurrentPdf() {
    renderVersion += 1;

    cancelActivePageRenders();

    try {
        await currentLoadingTask
            ?.destroy?.();
    } catch {
        // PDF may already have been destroyed.
    }

    currentLoadingTask = null;
    currentPdfDocument = null;
}

async function closeModal() {
    const modal =
        $('#nfePreviewModal');

    const backdrop =
        $('#nfePreviewBackdrop');

    await destroyCurrentPdf();

    clearRenderedPages();

    currentZoom = 1;
    updateZoomDisplay();

    modal?.classList.add(
        'hidden'
    );

    backdrop?.classList.add(
        'hidden'
    );

    modal?.setAttribute(
        'aria-hidden',
        'true'
    );

    backdrop?.setAttribute(
        'aria-hidden',
        'true'
    );

    document.body.classList.remove(
        'modal-open'
    );
}

/* =========================================================
   API error handling
========================================================= */

async function readApiError(
    response
) {
    const contentType =
        response.headers
            .get('content-type') || '';

    if (
        contentType.includes(
            'application/json'
        )
    ) {
        const body =
            await response
                .json()
                .catch(() => null);

        return (
            body?.message ||
            body?.error ||
            `Erro HTTP ${response.status}`
        );
    }

    const message =
        await response
            .text()
            .catch(() => '');

    return (
        message ||
        `Erro HTTP ${response.status}`
    );
}

/* =========================================================
   Canvas rendering
========================================================= */

async function renderCurrentPdf() {
    const pdf =
        currentPdfDocument;

    const container =
        $('#nfePreviewPages');

    if (!pdf || !container) {
        return;
    }

    renderVersion += 1;

    const thisRenderVersion =
        renderVersion;

    cancelActivePageRenders();
    clearRenderedPages();

    const pixelRatio =
        Math.min(
            window.devicePixelRatio || 1,
            2
        );

    for (
        let pageNumber = 1;
        pageNumber <= pdf.numPages;
        pageNumber += 1
    ) {
        if (
            thisRenderVersion !==
            renderVersion
        ) {
            return;
        }

        const page =
            await pdf.getPage(
                pageNumber
            );

        if (
            thisRenderVersion !==
            renderVersion
        ) {
            return;
        }

        const viewport =
            page.getViewport({
                scale:
                    BASE_SCALE *
                    currentZoom,
            });

        const canvas =
            document.createElement(
                'canvas'
            );

        canvas.className =
            'nfe-preview-page';

        canvas.dataset.pageNumber =
            String(pageNumber);

        canvas.setAttribute(
            'aria-label',
            `Página ${pageNumber} de ${pdf.numPages}`
        );

        canvas.width =
            Math.floor(
                viewport.width *
                pixelRatio
            );

        canvas.height =
            Math.floor(
                viewport.height *
                pixelRatio
            );

        canvas.style.width =
            `${Math.floor(viewport.width)}px`;

        canvas.style.height =
            `${Math.floor(viewport.height)}px`;

        const context =
            canvas.getContext(
                '2d',
                {
                    alpha: false,
                }
            );

        if (!context) {
            throw new Error(
                'Não foi possível criar o canvas do DANFE.'
            );
        }

        container.appendChild(
            canvas
        );

        const renderTask =
            page.render({
                canvasContext:
                    context,

                viewport,

                transform:
                    pixelRatio === 1
                        ? null
                        : [
                            pixelRatio,
                            0,
                            0,
                            pixelRatio,
                            0,
                            0,
                        ],

                background:
                    '#ffffff',
            });

        activePageRenderTasks.push(
            renderTask
        );

        try {
            await renderTask.promise;
        } catch (error) {
            if (
                error?.name ===
                'RenderingCancelledException'
            ) {
                return;
            }

            throw error;
        } finally {
            activePageRenderTasks =
                activePageRenderTasks.filter(
                    (task) =>
                        task !== renderTask
                );
        }
    }

    updateZoomDisplay();
}

/* =========================================================
   PDF loading
========================================================= */

async function loadPdfDocument(
    pdfBytes
) {
    await destroyCurrentPdf();

    clearRenderedPages();

    currentLoadingTask =
        pdfjsLib.getDocument({
            data:
                new Uint8Array(
                    pdfBytes
                ),
        });

    currentPdfDocument =
        await currentLoadingTask.promise;

    currentZoom = 1;

    updateZoomDisplay();
    resetViewportScroll();

    await renderCurrentPdf();
}

/* =========================================================
   Zoom actions
========================================================= */

async function setZoom(
    newZoom
) {
    if (!currentPdfDocument) {
        return;
    }

    const viewport =
        $('#nfePreviewViewport');

    const previousZoom =
        currentZoom;

    const normalizedZoom =
        clampZoom(
            newZoom
        );

    if (
        normalizedZoom ===
        previousZoom
    ) {
        return;
    }

    const previousCenterX =
        viewport
            ? viewport.scrollLeft +
            viewport.clientWidth / 2
            : 0;

    const previousCenterY =
        viewport
            ? viewport.scrollTop +
            viewport.clientHeight / 2
            : 0;

    currentZoom =
        normalizedZoom;

    updateZoomDisplay();

    await renderCurrentPdf();

    if (
        viewport &&
        previousZoom > 0
    ) {
        const ratio =
            currentZoom /
            previousZoom;

        viewport.scrollLeft =
            previousCenterX *
            ratio -
            viewport.clientWidth / 2;

        viewport.scrollTop =
            previousCenterY *
            ratio -
            viewport.clientHeight / 2;
    }
}

async function zoomIn() {
    await setZoom(
        currentZoom +
        ZOOM_STEP
    );
}

async function zoomOut() {
    await setZoom(
        currentZoom -
        ZOOM_STEP
    );
}

async function resetZoom() {
    if (!currentPdfDocument) {
        return;
    }

    currentZoom = 1;

    updateZoomDisplay();

    await renderCurrentPdf();

    resetViewportScroll();
}

async function fitZoomToWidth() {
    if (!currentPdfDocument) {
        return;
    }

    const viewportElement =
        $('#nfePreviewViewport');

    if (!viewportElement) {
        return;
    }

    const firstPage =
        await currentPdfDocument
            .getPage(1);

    const naturalViewport =
        firstPage.getViewport({
            scale:
                BASE_SCALE,
        });

    const availableWidth =
        Math.max(
            240,
            viewportElement.clientWidth - 56
        );

    currentZoom =
        clampZoom(
            availableWidth /
            naturalViewport.width
        );

    updateZoomDisplay();

    await renderCurrentPdf();

    resetViewportScroll();
}

/* =========================================================
   NF-e preview request
========================================================= */

async function openNfePreview(
    event
) {
    event?.preventDefault();
    event?.stopPropagation();

    if (!canIssueNfeFromBudget()) {
        return toast.warn(
            'Emissão de NF-e indisponível',
            'A configuração atual permite emissão de NF-e somente pelo módulo de Pedidos.'
        );
    }

    const budgetId =
        resolveBudgetId();

    if (!budgetId) {
        return toast.warn(
            'Pré-visualização da NF-e',
            'Salve o orçamento antes de gerar o DANFE.'
        );
    }

    const loading =
        $('#nfePreviewLoading');

    /*
     * Clears the number from any previously
     * opened budget.
     */
    updatePreviewNfeNumber(
        null
    );

    showModal();

    // Reconciles an existing attempt before allowing another transmission.
    // A failed consultation never unlocks a known PROCESSANDO attempt.
    void refreshIssueButtonState(budgetId);

    clearRenderedPages();
    resetViewportScroll();

    loading?.classList.remove(
        'hidden'
    );

    try {
        const response =
            await fetch(
                `/api/budgets-issued/${budgetId}/nfe-preview.pdf`,
                {
                    method:
                        'GET',

                    headers:
                        authHeaders({
                            Accept:
                                'application/pdf',
                        }),

                    cache:
                        'no-store',
                }
            );

        if (!response.ok) {
            throw new Error(
                await readApiError(
                    response
                )
            );
        }

        /*
         * Reads the probable NF-e number returned
         * by budgetsIssuedsController.js.
         */
        const previewNfeNumber =
            response.headers.get(
                'X-NFE-Preview-Number'
            );

        console.log(
            '[NFE PREVIEW][NUMBER]',
            {
                budgetId,
                previewNfeNumber,
            }
        );

        updatePreviewNfeNumber(
            previewNfeNumber
        );

        const contentType =
            response.headers
                .get('content-type') || '';

        if (
            !contentType
                .toLowerCase()
                .includes('application/pdf')
        ) {
            throw new Error(
                'O servidor não retornou um PDF.'
            );
        }

        const pdfBytes =
            await response
                .arrayBuffer();

        await loadPdfDocument(
            pdfBytes
        );
    } catch (error) {
        await closeModal();

        toast.error(
            'Pré-visualização da NF-e',
            error?.message ||
            'Não foi possível exibir o DANFE.'
        );
    } finally {
        loading?.classList.add(
            'hidden'
        );
    }
}

/* =========================================================
   Public budget ID setter
========================================================= */

export function setNfePreviewBudgetId(
    budgetId
) {
    const button =
        $('#btnGenerateNfe');

    if (!button) {
        return;
    }

    const id =
        Number(budgetId);

    if (
        Number.isSafeInteger(id) &&
        id > 0
    ) {
        button.dataset.budgetId =
            String(id);

        button.disabled =
            false;

        return;
    }

    delete button.dataset.budgetId;

    button.disabled =
        true;
}

/* =========================================================
   Initialization
========================================================= */

async function issueNfeFromBudget(event) {
    event?.preventDefault();
    event?.stopPropagation();

    if (!canIssueNfeFromBudget()) {
        return toast.warn(
            'Emissão de NF-e indisponível',
            'A configuração atual não permite emitir NF-e diretamente pelo orçamento.'
        );
    }

    if (issueRequestInProgress) return;

    const budgetId = resolveBudgetId();

    if (!budgetId) {
        return toast.warn(
            'Emissão da NF-e',
            'Salve o orçamento antes de emitir a NF-e.'
        );
    }

    const button = $('#btnIssueNfe');
    const currentStatus = normalizeNfeStatus(
        button?.dataset?.issueStatus
    );

    if (NFE_AUTHORIZED_STATUSES.has(currentStatus)) {
        return toast.info?.(
            'Emissão da NF-e',
            'Esta NF-e já foi autorizada.'
        );
    }

    if (NFE_PROCESSING_STATUSES.has(currentStatus)) {
        return consultBudgetNfeStatus(budgetId, button);
    }

    const isRetry = NFE_RETRYABLE_STATUSES.has(currentStatus);

    const confirmed =
        await showCenterModal({
            variant: 'warning',

            title:
                isRetry
                    ? 'Confirmar reemissão da NF-e'
                    : 'Confirmar emissão da NF-e',

            message: `
            <p>
                Confirma a ${isRetry ? 'reemissão' : 'emissão'} fiscal da NF-e do
                orçamento <strong>${budgetId}</strong>?
            </p>

            <p>
                Esta operação transmitirá o documento
                ao provedor fiscal.
            </p>
        `,

            className: 'center-modal-compact',

            timeoutMs: null,
            closeOnEscape: true,
            closeText: 'Cancelar',
            okText: isRetry ? 'Reemitir NF-e' : 'Emitir NF-e',
        });

    if (confirmed !== true) {
        return;
    }

    const originalHtml = button?.innerHTML || '';

    issueRequestInProgress = true;

    if (button) {
        button.disabled = true;
        button.innerHTML = '<i>⏳</i><span>Emitindo...</span>';
    }

    try {
        const response = await fetch(
            `/api/budgets-issued/${budgetId}/issue`,
            {
                method: 'POST',
                headers: authHeaders({
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                }),
                body: JSON.stringify({
                    confirm: true,
                    retry: isRetry,
                }),
                cache: 'no-store',
            }
        );

        const result = await response.json().catch(() => null);

        if (!response.ok || !result?.ok) {
            throw new Error(
                result?.message ||
                result?.error ||
                `Erro HTTP ${response.status}`
            );
        }

        // =========================================================
        // STATUS INICIAL DA EMISSÃO
        // =========================================================

        const status = String(
            result?.data?.status ||
            'PROCESSANDO'
        )
            .trim()
            .toUpperCase();


        console.log(
            '[BUDGET NFE][ISSUE][STATUS INICIAL]',
            {
                budgetId,
                status,
                data: result?.data,
            }
        );


        if (button) {
            button.dataset.issueStatus =
                status;
        }


        // =========================================================
        // NF-e JÁ AUTORIZADA
        // =========================================================

        if (NFE_AUTHORIZED_STATUSES.has(status)) {

            if (button) {
                button.disabled = true;

                button.innerHTML =
                    '<i>✅</i><span>NF-e autorizada</span>';
            }


            toast.success(
                'Emissão da NF-e',
                'NF-e autorizada pela SEFAZ. Redirecionando para NF-e Emitidas...'
            );


            console.log(
                '[BUDGET NFE][AUTORIZADA][REDIRECT DIRETO]',
                {
                    budgetId,
                    data: result?.data,
                }
            );


            await wait(1000);


            window.location.href =
                '/public/invoicesIssued/invoicesIssued.html';


            return;
        }


        // =========================================================
        // NF-e REJEITADA / NÃO AUTORIZADA
        // =========================================================

        if (NFE_RETRYABLE_STATUSES.has(status)) {

            if (button) {
                configureIssueButton(status);
            }


            throw new Error(
                result?.data?.message ||
                result?.message ||
                `A NF-e terminou com a situação ${status}.`
            );
        }


        // =========================================================
        // NF-e EM PROCESSAMENTO
        // =========================================================

        toast.success(
            'Emissão da NF-e',
            `${result.message || 'NF-e enviada.'} Status: ${status}.`
        );


        if (button) {
            button.disabled = true;

            button.innerHTML =
                '<i>⏳</i><span>Aguardando SEFAZ...</span>';
        }


        await pollBudgetNfeStatus(
            budgetId,
            button
        );
    } catch (error) {
        toast.error(
            'Emissão da NF-e',
            error?.message || 'Não foi possível emitir a NF-e.'
        );

        if (button) {
            const currentStatus = String(
                button.dataset.issueStatus || ''
            ).toUpperCase();

            // Se a NF-e já foi transmitida, nunca liberar o botão para uma
            // segunda emissão apenas porque a consulta de status falhou.
            if (NFE_PROCESSING_STATUSES.has(currentStatus)) {
                configureIssueButton('PROCESSANDO');
            } else if (NFE_RETRYABLE_STATUSES.has(currentStatus)) {
                configureIssueButton(currentStatus);
            } else {
                button.disabled = false;
                button.innerHTML = originalHtml;
            }
        }
    } finally {
        issueRequestInProgress = false;
    }
}

function wait(milliseconds) {
    return new Promise((resolve) => {
        window.setTimeout(resolve, milliseconds);
    });
}

async function fetchBudgetNfeStatus(budgetId) {
    const response = await fetch(
        `/api/budgets-issued/${budgetId}/status`,
        {
            method: 'GET',
            headers: authHeaders({ Accept: 'application/json' }),
            cache: 'no-store',
        }
    );

    const result = await response.json().catch(() => null);

    if (!response.ok || !result?.ok) {
        const error = new Error(
            result?.message ||
            result?.error ||
            `Erro HTTP ${response.status}`
        );

        error.httpStatus = response.status;
        error.code = result?.code || result?.error_code || null;

        throw error;
    }

    return result.data || {};
}

async function consultBudgetNfeStatus(budgetId, button = $('#btnIssueNfe')) {
    if (issueRequestInProgress) return null;

    issueRequestInProgress = true;

    if (button) {
        button.disabled = true;
        button.innerHTML = '<i>⏳</i><span>Consultando...</span>';
    }

    try {
        const data = await fetchBudgetNfeStatus(budgetId);
        const status = normalizeNfeStatus(data.status);

        configureIssueButton(status || 'PROCESSANDO');

        if (NFE_AUTHORIZED_STATUSES.has(status)) {
            toast.success(
                'Emissão da NF-e',
                'NF-e autorizada pela SEFAZ. Redirecionando para NF-e Emitidas...'
            );

            await wait(1000);
            window.location.href =
                '/public/invoicesIssued/invoicesIssued.html';
        } else if (NFE_RETRYABLE_STATUSES.has(status)) {
            toast.warn(
                'Emissão da NF-e',
                data.message ||
                `A tentativa terminou como ${status}. Corrija os dados e clique em Reemitir NF-e.`
            );
        } else {
            toast.info?.(
                'Emissão da NF-e',
                'A NF-e continua em processamento. Nenhuma nova tentativa foi criada.'
            );
        }

        return data;
    } catch (error) {
        // Keep PROCESSANDO locked to consultation mode when reconciliation
        // fails, preventing an accidental duplicate transmission.
        configureIssueButton('PROCESSANDO');

        toast.error(
            'Consulta da NF-e',
            error?.message || 'Não foi possível consultar a situação da NF-e.'
        );

        return null;
    } finally {
        issueRequestInProgress = false;
    }
}

async function refreshIssueButtonState(budgetId) {
    const button = $('#btnIssueNfe');
    const previousStatus = normalizeNfeStatus(
        button?.dataset?.issueStatus
    );

    try {
        const data = await fetchBudgetNfeStatus(budgetId);
        configureIssueButton(data.status);
        return data;
    } catch (error) {
        console.debug(
            '[BUDGET NFE][STATUS][INITIAL]',
            error?.message || String(error)
        );

        const noAttempt =
            Number(error?.httpStatus) === 404 &&
            [
                '',
                'BUDGET_NFE_NOT_FOUND',
            ].includes(normalizeNfeStatus(error?.code));

        // Only a confirmed "no attempt" response permits a new issuance.
        // Network/provider/server failures keep the action in consultation
        // mode, preventing duplicate NF-e transmission.
        configureIssueButton(
            noAttempt
                ? ''
                : (
                    NFE_PROCESSING_STATUSES.has(previousStatus)
                        ? previousStatus
                        : 'PROCESSANDO'
                )
        );

        return null;
    }
}

async function pollBudgetNfeStatus(budgetId, button) {
    let consecutiveErrors = 0;

    for (
        let attempt = 1;
        attempt <= NFE_STATUS_POLL_MAX_ATTEMPTS;
        attempt += 1
    ) {
        await wait(NFE_STATUS_POLL_INTERVAL_MS);

        let data;

        try {
            data = await fetchBudgetNfeStatus(budgetId);
            consecutiveErrors = 0;
        } catch (error) {
            consecutiveErrors += 1;

            console.warn(
                '[BUDGET NFE][STATUS][RETRY]',
                {
                    budgetId,
                    attempt,
                    consecutiveErrors,
                    message: error?.message || String(error),
                }
            );

            if (button) {
                button.dataset.issueStatus = 'PROCESSANDO';
                button.disabled = true;
                button.innerHTML =
                    '<i>⏳</i><span>Reconectando...</span>';
            }

            if (
                consecutiveErrors >=
                NFE_STATUS_POLL_MAX_CONSECUTIVE_ERRORS
            ) {
                throw new Error(
                    'A NF-e foi enviada, mas não foi possível consultar o status após várias tentativas. Não emita novamente; aguarde e consulte o orçamento.'
                );
            }

            continue;
        }

        const status = normalizeNfeStatus(data.status);

        if (button) {
            button.dataset.issueStatus = status || 'PROCESSANDO';
            button.disabled = true;
        }

        if (NFE_AUTHORIZED_STATUSES.has(status)) {
            if (button) {
                button.innerHTML =
                    '<i>✅</i><span>NF-e autorizada</span>';
            }

            toast.success(
                'Emissão da NF-e',
                'NF-e autorizada pela SEFAZ. Redirecionando para NF-e Emitidas...'
            );

            console.log(
                '[BUDGET NFE][AUTORIZADA][REDIRECT]',
                {
                    budgetId,
                    data,
                }
            );

            // Pequeno delay apenas para o usuário visualizar o sucesso.
            await wait(1000);

            window.location.href =
                '/public/invoicesIssued/invoicesIssued.html';

            return data;
        }

        if (NFE_RETRYABLE_STATUSES.has(status)) {
            if (button) {
                configureIssueButton(status);
            }

            throw new Error(
                data.message ||
                `A NF-e terminou com a situação ${status}.`
            );
        }
    }

    toast.info?.(
        'Emissão da NF-e',
        'A NF-e continua em processamento no provedor. Não emita novamente; o status poderá ser consultado pelo orçamento.'
    );

    if (button) {
        configureIssueButton('PROCESSANDO');
    }

    return null;
}

export function initBudgetNfePreview() {
    const button =
        $('#btnGenerateNfe');

    if (!button) {
        console.warn(
            '[budgets.nfePreview] botão não encontrado.'
        );

        return;
    }

    if (
        button.dataset
            .nfePreviewBound === '1'
    ) {
        return;
    }

    button.dataset
        .nfePreviewBound = '1';

    /* Main button */

    button.addEventListener(
        'click',
        openNfePreview
    );

    /* Zoom buttons */

    $('#btnNfeZoomIn')
        ?.addEventListener(
            'click',
            () => {
                zoomIn();
            }
        );

    $('#btnNfeZoomOut')
        ?.addEventListener(
            'click',
            () => {
                zoomOut();
            }
        );

    $('#btnNfeZoomReset')
        ?.addEventListener(
            'click',
            () => {
                resetZoom();
            }
        );

    $('#btnNfeZoomFit')
        ?.addEventListener(
            'click',
            () => {
                fitZoomToWidth();
            }
        );

    /* Closing */

    $('#btnCloseNfePreview')
        ?.addEventListener(
            'click',
            () => {
                closeModal();
            }
        );

    $('#btnCloseNfePreviewFooter')
        ?.addEventListener(
            'click',
            () => {
                closeModal();
            }
        );

    $('#nfePreviewBackdrop')
        ?.addEventListener(
            'click',
            () => {
                closeModal();
            }
        );

    /* Keyboard shortcuts */

    document.addEventListener(
        'keydown',
        (event) => {
            const modal =
                $('#nfePreviewModal');

            const modalIsOpen =
                modal &&
                !modal.classList.contains(
                    'hidden'
                );

            if (!modalIsOpen) {
                return;
            }

            if (
                event.key ===
                'Escape'
            ) {
                event.preventDefault();

                closeModal();

                return;
            }

            if (
                (
                    event.ctrlKey ||
                    event.metaKey
                ) &&
                (
                    event.key === '+' ||
                    event.key === '='
                )
            ) {
                event.preventDefault();

                zoomIn();

                return;
            }

            if (
                (
                    event.ctrlKey ||
                    event.metaKey
                ) &&
                event.key === '-'
            ) {
                event.preventDefault();

                zoomOut();

                return;
            }

            if (
                (
                    event.ctrlKey ||
                    event.metaKey
                ) &&
                event.key === '0'
            ) {
                event.preventDefault();

                resetZoom();
            }
        }
    );

    /* Ctrl + mouse wheel zoom */

    $('#nfePreviewViewport')
        ?.addEventListener(
            'wheel',
            (event) => {
                if (
                    !event.ctrlKey &&
                    !event.metaKey
                ) {
                    return;
                }

                event.preventDefault();

                if (event.deltaY < 0) {
                    zoomIn();
                } else {
                    zoomOut();
                }
            },
            {
                passive: false,
            }
        );

    updateZoomDisplay();

    $('#btnIssueNfe')
        ?.addEventListener(
            'click',
            issueNfeFromBudget
        );

    applyNfeIssuanceModeUI();
}
