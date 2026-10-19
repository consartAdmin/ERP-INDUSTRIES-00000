// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: backend/public/database/js/database.modal.js                  ║
// ║ MODULE: Database Viewer / Editor                                    ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { COMMON_TYPES, els, FK_ACTIONS, STRUCTURE_TITLES } from './database.config.js';
import { setEditingRow, setStructOp, setStructPreviewReady, state } from './database.state.js';
import { describeFk, escapeHtml, formatValue, getColumnKeys } from './database.utils.js';

export function showMessage(message) {
    alert(message);
}

export function confirmAction(message) {
    return confirm(message);
}

function openModalEl(modal) {
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
}

function closeModalEl(modal) {
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');

    if (!document.querySelector('.modal.is-open')) {
        document.body.style.overflow = '';
    }
}

// ═══════════════════════════════════════════════════════════════════
// MODAL DE REGISTRO
// ═══════════════════════════════════════════════════════════════════

export function closeModal() {
    closeModalEl(els.rowModal);
    setEditingRow(null);
}

function fieldHelp(col, isNew) {
    const { isPk, fk } = getColumnKeys(col.column_name);

    return [
        col.data_type,
        isPk && 'PK',
        fk && `FK → ${describeFk(fk)}`,
        isNew && col.column_default && 'vazio = padrão do banco',
    ].filter(Boolean).join(' | ');
}

function renderModalFields(row, isNew) {
    els.modalFields.innerHTML = state.columns
        .map((col, index) => {
            const name = col.column_name;
            const value = formatValue(row[name]);
            const id = `dbField_${index}`;

            const input = col.data_type === 'text'
                ? `<textarea id="${id}" data-field="${escapeHtml(name)}">${escapeHtml(value)}</textarea>`
                : `<input id="${id}" type="text" data-field="${escapeHtml(name)}" value="${escapeHtml(value)}" />`;

            return `
                <div class="fields fields-h-6 fields-w-full fields-font-3">
                    <label for="${id}">${escapeHtml(name)}</label>
                    ${input}
                    <small class="fields-help">${escapeHtml(fieldHelp(col, isNew))}</small>
                </div>
            `;
        })
        .join('');
}

export function openNewModal() {
    if (!state.currentTable) return;

    setEditingRow(null);

    els.modalTitle.textContent = `Novo registro em ${state.currentTable}`;
    els.btnDeleteRow.classList.add('hidden');

    renderModalFields({}, true);
    openModalEl(els.rowModal);
}

export function openEditModal(row) {
    if (!row) return;

    setEditingRow(row);

    els.modalTitle.textContent = `Editar registro em ${state.currentTable}`;
    els.btnDeleteRow.classList.remove('hidden');

    renderModalFields(row, false);
    openModalEl(els.rowModal);
}

// ═══════════════════════════════════════════════════════════════════
// MODAL DE ESTRUTURA (DDL)
// Campos usam data-op="<chave da operação>":
//   data-array → valor vira [valor] | data-bool → "true"/"false" vira boolean
//   checkbox com data-multi → lista de valores marcados
// ═══════════════════════════════════════════════════════════════════

let fieldSeq = 0;

function field(label, control, { help = '', full = false } = {}) {
    return `
        <div class="fields fields-h-6 fields-w-full fields-font-3 ${full ? 'modal-field--span-full' : ''}">
            <label>${escapeHtml(label)}</label>
            ${control}
            ${help ? `<small class="fields-help">${escapeHtml(help)}</small>` : ''}
        </div>
    `;
}

function textInput(op, value = '', { placeholder = '', list = '' } = {}) {
    return `<input type="text" data-op="${op}" value="${escapeHtml(value)}"
        placeholder="${escapeHtml(placeholder)}" ${list ? `list="${list}"` : ''} autocomplete="off" />`;
}

function selectInput(op, options, selected = '', { array = false, bool = false } = {}) {
    const opts = options
        .map((o) => {
            const value = typeof o === 'object' ? o.value : o;
            const label = typeof o === 'object' ? o.label : o;
            return `<option value="${escapeHtml(value)}" ${String(value) === String(selected) ? 'selected' : ''}>${escapeHtml(label)}</option>`;
        })
        .join('');

    return `<select data-op="${op}" ${array ? 'data-array' : ''} ${bool ? 'data-bool' : ''}>${opts}</select>`;
}

function nullableSelect(nullable = true) {
    return selectInput('nullable', [
        { value: 'true', label: 'Sim (aceita NULL)' },
        { value: 'false', label: 'Não (NOT NULL)' },
    ], String(nullable), { bool: true });
}

function checkbox(op, label, checked = false) {
    const id = `structChk_${fieldSeq++}`;

    return `
        <label class="db-check" for="${id}">
            <input id="${id}" type="checkbox" data-op="${op}" ${checked ? 'checked' : ''} />
            ${escapeHtml(label)}
        </label>
    `;
}

function columnsCheckList(selected = []) {
    const items = state.structure.columns
        .map((c) => {
            const id = `structCol_${fieldSeq++}`;
            const checked = selected.includes(c.column_name) ? 'checked' : '';

            return `
                <label class="db-check" for="${id}">
                    <input id="${id}" type="checkbox" data-op="columns" data-multi
                        value="${escapeHtml(c.column_name)}" ${checked} />
                    ${escapeHtml(c.column_name)} <small>${escapeHtml(c.data_type)}</small>
                </label>
            `;
        })
        .join('');

    return `<div class="db-check-list">${items}</div>`;
}

function typeDatalist() {
    return `<datalist id="dbTypeList">${COMMON_TYPES.map((t) => `<option value="${t}"></option>`).join('')}</datalist>`;
}

function warning(text) {
    return `<p class="db-warning modal-field--span-full">${escapeHtml(text)}</p>`;
}

const DEFAULT_HELP = 'Aceita now(), CURRENT_DATE, gen_random_uuid(), true/false, números e nextval(...). '
    + 'Qualquer outro valor vira texto. Vazio = sem DEFAULT.';

const STRUCTURE_FORMS = {
    'column.add': () => [
        field('Nome da coluna', textInput('column', '', { placeholder: 'ex.: created_at' })),
        field('Tipo', textInput('dataType', '', { placeholder: 'ex.: varchar(150)', list: 'dbTypeList' }) + typeDatalist()),
        field('Aceita nulo?', nullableSelect(true)),
        field('Default', textInput('default'), { help: DEFAULT_HELP }),
    ],

    'column.alter': ({ column }) => {
        const c = state.structure.columns.find((col) => col.column_name === column);

        return [
            field('Nome da coluna', textInput('newName', c.column_name)),
            field('Tipo', textInput('dataType', c.data_type, { list: 'dbTypeList' }) + typeDatalist(),
                { help: 'Alterar o tipo converte os dados existentes (USING coluna::tipo).' }),
            field('Aceita nulo?', nullableSelect(c.is_nullable)),
            field('Default', textInput('default', c.column_default ?? ''), { help: DEFAULT_HELP }),
        ];
    },

    'column.drop': ({ column }) => [
        warning(`A coluna "${column}" e TODOS os seus dados serão excluídos.`),
        field('Opções', checkbox('cascade', 'CASCADE — remover também views/constraints que dependem da coluna'), { full: true }),
    ],

    'pk.set': () => {
        const pk = state.structure.primaryKey;

        return [
            ...(pk ? [warning(`A PK atual "${pk.name}" (${pk.columns.join(', ')}) será substituída.`)] : []),
            field('Colunas da chave primária', columnsCheckList(pk?.columns || []), { full: true }),
            field('Nome da constraint', textInput('constraintName', pk?.name || '', { placeholder: `${state.currentTable}_pkey` }),
                { help: 'Opcional.' }),
        ];
    },

    'pk.drop': () => [
        warning(`A chave primária "${state.structure.primaryKey?.name}" será removida. `
            + 'FKs de outras tabelas que dependem dela impedirão a remoção.'),
    ],

    'fk.add': () => {
        const columns = state.structure.columns.map((c) => c.column_name);
        const tables = [{ value: '', label: '— selecione —' }, ...state.tables.map((t) => t.table_name)];

        return [
            field('Coluna local', selectInput('columns', columns, '', { array: true })),
            field('Tabela referenciada', selectInput('refTable', tables)),
            field('Coluna referenciada', `<select data-op="refColumns" data-array><option value="">— selecione a tabela —</option></select>`),
            field('Nome da constraint', textInput('constraintName', '', { placeholder: 'automático' }), { help: 'Opcional.' }),
            field('ON UPDATE', selectInput('onUpdate', FK_ACTIONS, 'NO ACTION')),
            field('ON DELETE', selectInput('onDelete', FK_ACTIONS, 'NO ACTION')),
        ];
    },

    'unique.add': () => [
        field('Colunas', columnsCheckList(), { full: true }),
        field('Nome da constraint', textInput('constraintName', '', { placeholder: 'automático' }), { help: 'Opcional.' }),
    ],

    'constraint.drop': ({ constraintName }) => [
        warning(`A constraint "${constraintName}" será removida.`),
    ],

    'index.create': () => [
        field('Colunas', columnsCheckList(), { full: true }),
        field('Nome do índice', textInput('indexName', '', { placeholder: 'automático' }), { help: 'Opcional.' }),
        field('Opções', checkbox('unique', 'UNIQUE — não permitir valores repetidos')),
    ],

    'index.drop': ({ indexName }) => [
        warning(`O índice "${indexName}" será removido.`),
    ],
};

export function hideStructPreview() {
    setStructPreviewReady(false);
    els.structSqlPreview.textContent = '';
    els.structSqlPreview.classList.add('hidden');
    els.btnStructApply.classList.add('hidden');
}

export function showStructPreview(statements) {
    els.structSqlPreview.textContent = `${statements.join(';\n\n')};`;
    els.structSqlPreview.classList.remove('hidden');
    els.btnStructApply.classList.remove('hidden');
    setStructPreviewReady(true);
}

export function renderRefColumnOptions(columns) {
    const select = els.structFields.querySelector('[data-op="refColumns"]');
    if (!select) return;

    const options = columns.length
        ? columns.map((c) => `<option value="${escapeHtml(c.column_name)}">${escapeHtml(c.column_name)} (${escapeHtml(c.data_type)})</option>`)
        : ['<option value="">— selecione a tabela —</option>'];

    select.innerHTML = options.join('');
}

export function openStructureModal(type, fixed = {}) {
    const form = STRUCTURE_FORMS[type];
    if (!form || !state.structure) return;

    setStructOp({ type, fixed });

    els.structModalTitle.textContent = `${STRUCTURE_TITLES[type]} — ${state.currentTable}`;
    els.structFields.innerHTML = form(fixed).join('');

    hideStructPreview();
    openModalEl(els.structModal);
}

export function closeStructureModal() {
    closeModalEl(els.structModal);
    setStructOp(null);
}
