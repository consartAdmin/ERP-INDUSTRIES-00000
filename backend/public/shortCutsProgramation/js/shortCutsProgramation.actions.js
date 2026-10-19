// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: shortCutsProgramation.actions.js                              ║
// ║ MODULE: Programming Shortcuts — Actions                             ║
// ║ DESCRIPTION: CRUD, carregamento, restauração e cópia de código      ║
// ║ PRODNEX ERP                                                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { showCenterModal } from '/public/includes/js/centerAlertModal.js';

import { shortcutsApi } from './shortCutsProgramation.api.js';
import { buildQuery } from './shortCutsProgramation.filters.js';

import {
    clearForm,
    fillForm,
    getPayload,
} from './shortCutsProgramation.form.js';

import {
    renderFooter,
    renderLoadError,
    renderLoading,
    renderRows,
} from './shortCutsProgramation.render.js';

import { els, state } from './shortCutsProgramation.state.js';
import { showError } from './shortCutsProgramation.utils.js';
import { validatePayload } from './shortCutsProgramation.validation.js';

/* =====================================================================
   HELPERS
===================================================================== */

async function showWarning(title, message) {
    return showCenterModal({
        variant: 'warning',
        title,
        message,
        timeoutMs: null,
        buttons: [
            {
                label: 'OK',
                variant: 'primary',
            },
        ],
    });
}

async function showSuccess(title, message, timeoutMs = 2500) {
    return showCenterModal({
        variant: 'success',
        title,
        message,
        timeoutMs,
    });
}

async function confirmAction({
    title,
    message,
    confirmText = 'Confirmar',
    cancelText = 'Cancelar',
}) {
    const result = await showCenterModal({
        variant: 'warning',
        title,
        message,
        timeoutMs: null,
        buttons: [
            {
                label: cancelText,
                variant: 'cancel',
                action: () => false,
            },
            {
                label: confirmText,
                variant: 'danger',
                action: () => true,
            },
        ],
    });

    return result === true;
}

function findRowById(id) {
    return state.rows.find(
        (row) => String(row.shortcut_id) === String(id)
    );
}

/* =====================================================================
   LOAD
===================================================================== */

export async function loadRows() {
    renderLoading();

    try {
        const data = await shortcutsApi.list(buildQuery());

        state.rows = Array.isArray(data.rows) ? data.rows : [];
        state.total = Number(data.total || 0);

        renderRows();
        renderFooter();
    } catch (error) {
        console.error('[shortCutsProgramation.loadRows]', error);
        renderLoadError(error);
    }
}

/* =====================================================================
   SAVE
===================================================================== */

export async function saveShortcut(event) {
    event?.preventDefault();

    try {
        const payload = getPayload();

        validatePayload(payload);

        const id = String(
            els.shortcut_id?.value || state.selectedId || ''
        ).trim();

        const data = id
            ? await shortcutsApi.update(id, payload)
            : await shortcutsApi.create(payload);

        if (data?.row?.shortcut_id) {
            state.selectedId = data.row.shortcut_id;
        }

        await loadRows();

        const selected = findRowById(state.selectedId);

        if (selected) {
            await fillForm(selected);
        }

        await showCenterModal({
            variant: 'success',
            title: 'Shortcut salvo',
            message: 'Shortcut salvo com sucesso.',
            timeoutMs: null,
            buttons: [
                {
                    label: 'OK',
                    variant: 'success',
                },
            ],
        });
    } catch (error) {
        showError(error, 'shortCutsProgramation.saveShortcut');
    }
}

/* =====================================================================
   DEACTIVATE
===================================================================== */

export async function deleteShortcut() {
    const id = String(
        els.shortcut_id?.value || state.selectedId || ''
    ).trim();

    if (!id) {
        await showWarning(
            'Shortcut não selecionado',
            'Selecione um shortcut para inativar.'
        );
        return;
    }

    const confirmed = await confirmAction({
        title: 'Inativar shortcut',
        message: 'Deseja realmente inativar este shortcut?',
        confirmText: 'Inativar',
        cancelText: 'Cancelar',
    });

    if (!confirmed) return;

    try {
        await shortcutsApi.deactivate(id);
        await loadRows();

        const selected = findRowById(id);

        if (selected) {
            state.selectedId = selected.shortcut_id;
            await fillForm(selected);
        } else {
            state.selectedId = null;
            await clearForm();
        }

        await showSuccess(
            'Shortcut inativado',
            'O shortcut foi inativado com sucesso.'
        );
    } catch (error) {
        showError(error, 'shortCutsProgramation.deleteShortcut');
    }
}

/* =====================================================================
   RESTORE
===================================================================== */

export async function restoreShortcut() {
    const id = String(
        els.shortcut_id?.value || state.selectedId || ''
    ).trim();

    if (!id) {
        await showWarning(
            'Shortcut não selecionado',
            'Selecione um shortcut para restaurar.'
        );
        return;
    }

    const confirmed = await confirmAction({
        title: 'Restaurar shortcut',
        message: 'Deseja realmente restaurar este shortcut?',
        confirmText: 'Restaurar',
        cancelText: 'Cancelar',
    });

    if (!confirmed) return;

    try {
        await shortcutsApi.restore(id);
        await loadRows();

        const selected = findRowById(id);

        if (selected) {
            state.selectedId = selected.shortcut_id;
            await fillForm(selected);
        }

        await showSuccess(
            'Shortcut restaurado',
            'O shortcut foi restaurado com sucesso.'
        );
    } catch (error) {
        showError(error, 'shortCutsProgramation.restoreShortcut');
    }
}

/* =====================================================================
   COPY CODE
===================================================================== */

export async function copyCode() {
    const code = String(els.code?.value || '');

    if (!code.trim()) {
        await showWarning(
            'Código não disponível',
            'Não existe código para copiar.'
        );
        return;
    }

    try {
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(code);
        } else {
            throw new Error('Clipboard API indisponível.');
        }
    } catch {
        if (!els.code) {
            await showWarning(
                'Não foi possível copiar',
                'O campo de código não foi encontrado.'
            );
            return;
        }

        els.code.focus();
        els.code.select();
        els.code.setSelectionRange(0, code.length);

        const copied = document.execCommand('copy');

        if (!copied) {
            await showWarning(
                'Não foi possível copiar',
                'Selecione o código e copie-o manualmente.'
            );
            return;
        }
    }

    await showSuccess(
        'Código copiado',
        'O código foi copiado para a área de transferência.',
        2000
    );
}