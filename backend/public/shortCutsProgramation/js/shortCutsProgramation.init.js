// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: shortCutsProgramation.init.js                                 ║
// ║ MODULE: Programming Shortcuts — Initialization                      ║
// ║ DESCRIPTION: Elementos DOM, eventos e inicialização da página       ║
// ║ PRODNEX ERP                                                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import {
    copyCode,
    deleteShortcut,
    loadRows,
    restoreShortcut,
    saveShortcut,
} from './shortCutsProgramation.actions.js';

import {
    clearForm,
    fillForm,
    loadCategories,
    loadSubcategories,
} from './shortCutsProgramation.form.js';

import { resetPagination } from './shortCutsProgramation.filters.js';

import {
    closeShortcutModal,
    ensureShortcutModal,
    openCategoriesModal,
    openShortcutModal,
} from './shortCutsProgramation.modal.js';

import { els, state } from './shortCutsProgramation.state.js';
import { $, selectedText } from './shortCutsProgramation.utils.js';

/* ==========================================================================
   DOM ELEMENTS
============================================================================ */

function bindElements() {
    Object.assign(els, {
        btnNew: $('#btnNew'),
        btnReload: $('#btnReload'),
        btnSearch: $('#btnSearch'),

        btnPreviousPage: $('#btnPreviousPage'),
        btnNextPage: $('#btnNextPage'),

        filterQ: $('#filterQ'),
        filterCategoryId: $('#filterCategoryId'),
        filterLanguage: $('#filterLanguage'),
        filterActive: $('#filterActive'),

        tbody: $('#tableBody'),

        apTableInfo: $('#apTableInfo'),
        apPageInfo: $('#apPageInfo'),
        apRowsPerPage: $('#apRowsPerPage'),

        form: $('#shortcutForm') || $('#formShortcut') || $('form'),
        formTitle: $('#formTitle'),
        selectedId: $('#selectedId'),

        shortcut_id: $('#shortcut_id'),

        // Accepts both ID patterns used in PRODNEX ERP.
        category_id: $('#category_id') || $('#categoryId'),
        subcategory_id: $('#subcategory_id') || $('#subcategoryId'),

        category: $('#category'),
        subcategory: $('#subcategory'),
        title: $('#title'),
        shortcut_key: $('#shortcut_key'),
        shortcut_type: $('#shortcut_type'),
        language: $('#language'),
        description: $('#description'),
        code: $('#code'),
        observations: $('#observations'),
        tags: $('#tags'),
        difficulty: $('#difficulty'),
        favorite: $('#favorite'),
        active: $('#active'),
        sort_order: $('#sort_order'),

        btnSave: $('#btnSave'),
        btnClear: $('#btnClear'),
        btnCopyCode: $('#btnCopyCode'),
        btnDelete: $('#btnDelete'),
        btnRestore: $('#btnRestore'),

        btnOpenCategoriesModal: $('#btnOpenCategoriesModal'),
    });
}

/* ==========================================================================
   PAGE EVENTS
============================================================================ */

function bindPageEvents() {
    els.btnNew?.addEventListener('click', async () => {
        await clearForm();
        openShortcutModal();
    });

    els.btnReload?.addEventListener('click', async () => {
        resetPagination();
        await loadCategories();
        await loadRows();
    });

    els.btnSearch?.addEventListener('click', async () => {
        resetPagination();
        await loadRows();
    });

    els.filterQ?.addEventListener('keydown', async (event) => {
        if (event.key !== 'Enter') return;

        event.preventDefault();

        resetPagination();
        await loadRows();
    });

    [
        els.filterCategoryId,
        els.filterLanguage,
        els.filterActive,
    ]
        .filter(Boolean)
        .forEach((element) => {
            element.addEventListener('change', async () => {
                resetPagination();
                await loadRows();
            });
        });
}

/* ==========================================================================
   PAGINATION EVENTS
============================================================================ */

function bindPaginationEvents() {
    els.btnPreviousPage?.addEventListener('click', async () => {
        if (state.page <= 1) return;

        state.page -= 1;
        await loadRows();
    });

    els.btnNextPage?.addEventListener('click', async () => {
        const totalPages = Math.max(
            Math.ceil(state.total / state.limit),
            1
        );

        if (state.page >= totalPages) return;

        state.page += 1;
        await loadRows();
    });

    els.apRowsPerPage?.addEventListener('change', async (event) => {
        const newLimit = Number.parseInt(event.target.value, 10);

        if (!Number.isFinite(newLimit) || newLimit <= 0) {
            return;
        }

        state.limit = newLimit;
        state.page = 1;

        await loadRows();
    });
}

/* ==========================================================================
   FORM EVENTS
============================================================================ */

function bindFormEvents() {
    els.category_id?.addEventListener('change', async () => {
        if (els.category) {
            els.category.value = selectedText(els.category_id) || '';
        }

        if (els.subcategory) {
            els.subcategory.value = '';
        }

        await loadSubcategories(els.category_id.value);
    });

    els.subcategory_id?.addEventListener('change', () => {
        if (els.subcategory) {
            els.subcategory.value =
                selectedText(els.subcategory_id) || '';
        }
    });

    if (els.form) {
        els.form.addEventListener('submit', saveShortcut);
    } else {
        els.btnSave?.addEventListener('click', saveShortcut);
    }

    els.btnClear?.addEventListener('click', clearForm);
    els.btnDelete?.addEventListener('click', deleteShortcut);
    els.btnRestore?.addEventListener('click', restoreShortcut);
    els.btnCopyCode?.addEventListener('click', copyCode);
}

/* ==========================================================================
   TABLE EVENTS
============================================================================ */

function bindTableEvents() {
    els.tbody?.addEventListener('click', async (event) => {
        const rowElement = event.target.closest('tr[data-id]');

        if (!rowElement) return;

        const row = state.rows.find(
            (item) =>
                String(item.shortcut_id) ===
                String(rowElement.dataset.id)
        );

        if (!row) return;

        await fillForm(row);
        openShortcutModal();
    });
}

/* ==========================================================================
   MODAL EVENTS
============================================================================ */

function bindModalEvents() {
    els.btnOpenCategoriesModal?.addEventListener(
        'click',
        openCategoriesModal
    );

    document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') return;

        closeShortcutModal();
    });
}

/* ==========================================================================
   EVENTS
============================================================================ */

function bindEvents() {
    bindPageEvents();
    bindPaginationEvents();
    bindFormEvents();
    bindTableEvents();
    bindModalEvents();
}

/* ==========================================================================
   INITIALIZATION
============================================================================ */

async function boot() {
    ensureShortcutModal();

    bindElements();
    bindEvents();

    /*
     * Makes the initial state use the value selected in the HTML.
     */
    if (els.apRowsPerPage) {
        const initialLimit = Number.parseInt(
            els.apRowsPerPage.value,
            10
        );

        if (Number.isFinite(initialLimit) && initialLimit > 0) {
            state.limit = initialLimit;
        }
    }

    await loadCategories();
    await clearForm();
    await loadRows();
}

document.addEventListener('DOMContentLoaded', boot);