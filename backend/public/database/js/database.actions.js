// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: backend/public/database/js/database.actions.js                ║
// ║ MODULE: Database Viewer / Editor                                    ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { fetchRows, fetchStructure, fetchTables } from './database.api.js';
import { DEFAULTS, els, TABS } from './database.config.js';
import {
    closeModal,
    closeStructureModal,
    openEditModal,
    openNewModal,
    openStructureModal,
} from './database.modal.js';
import {
    renderMeta,
    renderRowsMessage,
    renderStructure,
    renderStructureMessage,
    renderTable,
    renderTableHeader,
    renderTables,
    renderTablesMessage,
    renderTabs,
} from './database.render.js';
import {
    setActiveTab,
    setCurrentTable,
    setRowsData,
    setStructure,
    setTables,
    state,
} from './database.state.js';
import { canGoNext, canGoPrev } from './database.validation.js';

let searchTimer = null;

export async function loadTables() {
    renderTablesMessage('Carregando tabelas...');

    try {
        setTables(await fetchTables(state.schema));
        renderTables();
    } catch (err) {
        renderTablesMessage(err.message);
    }
}

export async function loadRows() {
    if (!state.currentTable) return;

    renderRowsMessage('Carregando registros...');

    try {
        const data = await fetchRows(state.currentTable, {
            schema: state.schema,
            page: state.page,
            limit: state.limit,
            search: state.search,
        });

        setRowsData(data);
        renderMeta();
        renderTable();
    } catch (err) {
        renderRowsMessage(err.message);
    }
}

export async function loadStructure() {
    if (!state.currentTable) return;

    renderStructureMessage('Carregando estrutura...');

    try {
        setStructure(await fetchStructure(state.schema, state.currentTable));
        renderStructure();
    } catch (err) {
        setStructure(null);
        renderStructureMessage(err.message);
    }
}

async function selectTable(tableName) {
    closeModal();
    closeStructureModal();
    setCurrentTable(tableName);

    els.rowSearch.value = '';

    renderTableHeader();
    renderTables();

    // A estrutura alimenta os ícones 🔑/🔗 da grade de registros
    await loadStructure();
    await loadRows();
}

function selectTab(tab) {
    if (!Object.values(TABS).includes(tab)) return;

    setActiveTab(tab);
    renderTabs();
}

async function reload() {
    await loadTables();

    if (state.currentTable) {
        await loadStructure();
        await loadRows();
    }
}

function searchRows() {
    clearTimeout(searchTimer);

    searchTimer = setTimeout(async () => {
        state.search = els.rowSearch.value.trim();
        state.page = 1;
        await loadRows();
    }, DEFAULTS.searchDebounceMs);
}

async function changeLimit() {
    state.limit = Number(els.limitSelect.value || DEFAULTS.limit);
    state.page = 1;
    await loadRows();
}

async function goPrev() {
    if (!canGoPrev()) return;

    state.page -= 1;
    await loadRows();
}

async function goNext() {
    if (!canGoNext()) return;

    state.page += 1;
    await loadRows();
}

function handleStructureClick(event) {
    const btn = event.target.closest('[data-struct-op]');
    if (!btn) return;

    if (!state.structure) return;

    const { structOp, column, constraint, index } = btn.dataset;

    openStructureModal(structOp, {
        ...(column && { column }),
        ...(constraint && { constraintName: constraint }),
        ...(index && { indexName: index }),
    });
}

export function registerActions() {
    els.tableSearch.addEventListener('input', renderTables);
    els.rowSearch.addEventListener('input', searchRows);
    els.limitSelect.addEventListener('change', changeLimit);
    els.btnReload.addEventListener('click', reload);
    els.btnNewRow.addEventListener('click', openNewModal);
    els.btnPrev.addEventListener('click', goPrev);
    els.btnNext.addEventListener('click', goNext);

    els.tabList.addEventListener('click', (event) => {
        const tab = event.target.closest('[data-tab]');
        if (tab) selectTab(tab.dataset.tab);
    });

    els.tablesList.addEventListener('click', (event) => {
        const btn = event.target.closest('.table-item');
        if (btn) selectTable(btn.dataset.table);
    });

    els.tableBody.addEventListener('click', (event) => {
        const btn = event.target.closest('[data-edit]');
        if (btn) openEditModal(state.rows[Number(btn.dataset.edit)]);
    });

    els.structurePanel.addEventListener('click', handleStructureClick);
}
