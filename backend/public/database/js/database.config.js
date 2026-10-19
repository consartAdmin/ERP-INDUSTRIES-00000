// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: backend/public/database/js/database.config.js                 ║
// ║ MODULE: Database Viewer / Editor                                    ║
// ╚══════════════════════════════════════════════════════════════════════╝

export const API = '/api/database';

export const DEFAULTS = Object.freeze({
    schema: 'public',
    limit: 50,
    searchDebounceMs: 350,
});

export const TABS = Object.freeze({
    rows: 'rows',
    structure: 'structure',
});

export const FK_ACTIONS = Object.freeze(['NO ACTION', 'RESTRICT', 'CASCADE', 'SET NULL', 'SET DEFAULT']);

// Sugestões do campo "Tipo" (o backend valida a lista completa)
export const COMMON_TYPES = Object.freeze([
    'integer', 'bigint', 'smallint', 'serial', 'bigserial',
    'numeric(14,2)', 'numeric(14,4)', 'boolean',
    'varchar(50)', 'varchar(150)', 'varchar(255)', 'text',
    'date', 'timestamp', 'timestamptz', 'time',
    'uuid', 'json', 'jsonb',
]);

export const STRUCTURE_TITLES = Object.freeze({
    'column.add': 'Nova coluna',
    'column.alter': 'Editar coluna',
    'column.drop': 'Excluir coluna',
    'pk.set': 'Definir chave primária',
    'pk.drop': 'Remover chave primária',
    'fk.add': 'Nova chave estrangeira',
    'unique.add': 'Nova constraint UNIQUE',
    'constraint.drop': 'Remover constraint',
    'index.create': 'Novo índice',
    'index.drop': 'Remover índice',
});

const $ = (sel) => document.querySelector(sel);

export const els = Object.freeze({
    tablesList: $('#tablesList'),
    tableSearch: $('#tableSearch'),
    rowSearch: $('#rowSearch'),
    limitSelect: $('#limitSelect'),
    currentTableTitle: $('#currentTableTitle'),
    currentTableSubtitle: $('#currentTableSubtitle'),
    totalRows: $('#totalRows'),
    primaryKeyInfo: $('#primaryKeyInfo'),
    tableHead: $('#tableHead'),
    tableBody: $('#tableBody'),
    btnReload: $('#btnReload'),
    btnNewRow: $('#btnNewRow'),
    btnPrev: $('#btnPrev'),
    btnNext: $('#btnNext'),
    paginationLabel: $('#paginationLabel'),

    // Abas
    tabList: $('#dbTabs'),
    rowsPanel: $('#rowsPanel'),
    structurePanel: $('#structurePanel'),

    // Estrutura
    structColumnsBody: $('#structColumnsBody'),
    structPkInfo: $('#structPkInfo'),
    structFksBody: $('#structFksBody'),
    structIndexesBody: $('#structIndexesBody'),
    structRefsBody: $('#structRefsBody'),

    // Modal de registro
    rowModal: $('#rowModal'),
    modalBackdrop: $('#modalBackdrop'),
    modalTitle: $('#modalTitle'),
    modalFields: $('#modalFields'),
    btnCloseModal: $('#btnCloseModal'),
    btnCancelModal: $('#btnCancelModal'),
    btnSaveRow: $('#btnSaveRow'),
    btnDeleteRow: $('#btnDeleteRow'),

    // Modal de estrutura
    structModal: $('#structModal'),
    structModalBackdrop: $('#structModalBackdrop'),
    structModalTitle: $('#structModalTitle'),
    structFields: $('#structFields'),
    structSqlPreview: $('#structSqlPreview'),
    btnCloseStructModal: $('#btnCloseStructModal'),
    btnCancelStructModal: $('#btnCancelStructModal'),
    btnStructPreview: $('#btnStructPreview'),
    btnStructApply: $('#btnStructApply'),
});
