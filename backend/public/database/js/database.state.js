// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: backend/public/database/js/database.state.js                  ║
// ║ MODULE: Database Viewer / Editor                                    ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { DEFAULTS, TABS } from './database.config.js';

export const state = {
    schema: DEFAULTS.schema,
    tables: [],
    currentTable: null,
    activeTab: TABS.rows,
    columns: [],
    primaryKey: [],
    rows: [],
    page: 1,
    limit: DEFAULTS.limit,
    total: 0,
    search: '',
    editingRow: null,

    // Estrutura da tabela atual (colunas, PK, FKs, índices)
    structure: null,
    // Operação aberta no modal de estrutura: { type, fixed }
    structOp: null,
    // SQL já visualizado e liberado para executar
    structPreviewReady: false,
};

export function setTables(tables) {
    state.tables = tables || [];
}

export function setCurrentTable(tableName) {
    state.currentTable = tableName;
    state.page = 1;
    state.search = '';
    state.structure = null;
}

export function setRowsData(data) {
    state.columns = data.columns || [];
    state.primaryKey = data.primaryKey || [];
    state.rows = data.rows || [];
    state.total = Number(data.total || 0);
    state.page = Number(data.page || 1);
    state.limit = Number(data.limit || DEFAULTS.limit);
}

export function setEditingRow(row) {
    state.editingRow = row || null;
}

export function setActiveTab(tab) {
    state.activeTab = tab;
}

export function setStructure(structure) {
    state.structure = structure || null;
}

export function setStructOp(op) {
    state.structOp = op || null;
    state.structPreviewReady = false;
}

export function setStructPreviewReady(ready) {
    state.structPreviewReady = ready;
}
