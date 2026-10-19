/* ╔══════════════════════════════════════════════════════════════════════╗
   ║ FILE: nfeCce.modal.js                                              ║
   ║ MODULE: NF-e | Carta de Correção Eletrônica (CC-e)                 ║
   ║ DESCRIPTION: Modais de emissão e consulta da Carta de Correção     ║
   ╚══════════════════════════════════════════════════════════════════════╝ */

'use strict';

const MODALS = Object.freeze({
    emissao: {
        modalId: 'modalNovaCce',
        openButtonId: 'btnNovaCce',
        closeSelector: '[data-modal-cce-close]',
        initialFocusSelector: '#correcao',
    },

    nfeEmitida: {
        modalId: 'modalBuscarNfeEmitida',
        openButtonId: 'btnBuscarNfeEmitida',
        closeSelector: '[data-modal-nfe-emitida-close]',
        initialFocusSelector: '#buscaNfeEmitida',
        isChildModal: true,
    },

    status: {
        modalId: 'modalConsultaStatus',
        openButtonId: 'btnAbrirConsultaStatus',
        closeSelector: '[data-modal-status-close]',
        initialFocusSelector: '#consultaIdentificador',
    },

    detalhes: {
        modalId: 'modalDetalhesEvento',
        openButtonId: null,
        closeSelector: '[data-modal-evento-close]',
        initialFocusSelector: '#btnAbrirPdfEvento',
    },
});

let lastFocusedElement = null;
let isBound = false;


/* =====================================================================
   GET MODAL
===================================================================== */

function getModal(config) {
    return document.getElementById(config.modalId);
}


/* =====================================================================
   GET OPEN MODALS
===================================================================== */

function getOpenModals() {
    return Object.values(MODALS)
        .map(getModal)
        .filter((modal) => modal?.classList.contains('is-open'));
}


function getOpenModal() {
    const openModals = getOpenModals();

    return openModals.length
        ? openModals[openModals.length - 1]
        : null;
}


export function isAnyCceModalOpen() {
    return getOpenModals().length > 0;
}


/* =====================================================================
   OPEN MODAL
===================================================================== */

function openModal(config) {
    const modal = getModal(config);

    if (!modal) return;

    /*
     * Modal de busca da NF-e é um modal filho.
     *
     * Portanto:
     *
     * Nova CC-e
     *      ↓
     * Buscar NF-e
     *
     * O modal Nova CC-e NÃO deve ser fechado.
     */
    if (!config.isChildModal) {
        closeOpenModal(false);
    }

    lastFocusedElement = document.activeElement;

    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');

    document.body.classList.add('modal-open');

    requestAnimationFrame(() => {
        modal
            .querySelector(config.initialFocusSelector)
            ?.focus();
    });
}


/* =====================================================================
   NF-e EMITIDA
===================================================================== */

export function openNfeEmitidaModal() {
    openModal(MODALS.nfeEmitida);
}


export function closeNfeEmitidaModal() {
    const modalBusca = getModal(MODALS.nfeEmitida);

    if (!modalBusca) return;

    /*
     * Fecha SOMENTE o modal de busca.
     */
    modalBusca.classList.remove('is-open');
    modalBusca.setAttribute('aria-hidden', 'true');

    /*
     * Verifica se Nova CC-e continua aberta.
     */
    const modalEmissao = getModal(MODALS.emissao);

    if (modalEmissao?.classList.contains('is-open')) {

        document.body.classList.add('modal-open');

        lastFocusedElement = null;

        requestAnimationFrame(() => {
            document
                .getElementById('correcao')
                ?.focus();
        });

        return;
    }

    /*
     * Se não existir nenhum outro modal aberto,
     * libera o body.
     */
    if (!getOpenModal()) {
        document.body.classList.remove('modal-open');
    }

    lastFocusedElement = null;
}


/* =====================================================================
   DETALHES EVENTO
===================================================================== */

export function openEventDetailsModal() {
    openModal(MODALS.detalhes);
}


/* =====================================================================
   CLOSE MODAL
===================================================================== */

function closeModal(modal, restoreFocus = true) {
    if (!modal) return;

    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');

    /*
     * Se outro modal ainda estiver aberto,
     * mantém o bloqueio do body.
     */
    const anotherModalOpen = getOpenModal();

    if (anotherModalOpen) {

        document.body.classList.add('modal-open');

    } else {

        document.body.classList.remove('modal-open');

    }

    /*
     * Restaura foco somente quando apropriado.
     */
    if (
        restoreFocus &&
        lastFocusedElement instanceof HTMLElement
    ) {
        lastFocusedElement.focus();
    }

    if (restoreFocus) {
        lastFocusedElement = null;
    }
}


/* =====================================================================
   CLOSE CURRENT MODAL
===================================================================== */

function closeOpenModal(restoreFocus = true) {
    const modal = getOpenModal();

    closeModal(modal, restoreFocus);
}


/* =====================================================================
   ESC
===================================================================== */

function onModalKeydown(event) {
    if (
        event.key !== 'Escape' ||
        !isAnyCceModalOpen()
    ) {
        return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();

    /*
     * Se a busca da NF-e estiver aberta,
     * fecha SOMENTE ela.
     */
    const modalBusca = getModal(MODALS.nfeEmitida);

    if (modalBusca?.classList.contains('is-open')) {
        closeNfeEmitidaModal();
        return;
    }

    closeOpenModal();
}


/* =====================================================================
   BIND
===================================================================== */

export function bindCceModal() {
    if (isBound) return;

    Object.values(MODALS).forEach((config) => {

        const modal = getModal(config);

        if (!modal) return;


        /* -------------------------------------------------------------
           OPEN BUTTON
        ------------------------------------------------------------- */

        if (config.openButtonId) {

            const openButton =
                document.getElementById(config.openButtonId);

            openButton?.addEventListener(
                'click',
                () => openModal(config)
            );
        }


        /* -------------------------------------------------------------
           CLOSE BUTTONS
        ------------------------------------------------------------- */

        modal
            .querySelectorAll(config.closeSelector)
            .forEach((element) => {

                element.addEventListener('click', (event) => {

                    event.preventDefault();
                    event.stopPropagation();

                    /*
                     * Busca NF-e:
                     * fecha apenas o modal filho.
                     */
                    if (config === MODALS.nfeEmitida) {
                        closeNfeEmitidaModal();
                        return;
                    }

                    closeModal(modal);
                });
            });
    });


    document.addEventListener(
        'keydown',
        onModalKeydown,
        true
    );

    isBound = true;
}