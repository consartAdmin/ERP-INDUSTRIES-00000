// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: backend/public/database/js/database.render.js                 ║
// ║ MODULE: Database Viewer / Editor                                    ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { els, TABS } from './database.config.js';
import { state } from './database.state.js';
import { describeFk, escapeHtml, formatValue, getColumnKeys, getFkByColumn } from './database.utils.js';

// ─── Lista de tabelas / cabeçalho ───────────────────────────────────

export function renderTablesMessage(message) {
    els.tablesList.innerHTML = `<div class="empty">${escapeHtml(message)}</div>`;
}

export function renderTables() {
    const term = els.tableSearch.value.trim().toLowerCase();

    const filtered = state.tables.filter((t) =>
        String(t.table_name || '').toLowerCase().includes(term)
    );

    if (!filtered.length) {
        renderTablesMessage('Nenhuma tabela encontrada.');
        return;
    }

    els.tablesList.innerHTML = filtered
        .map((t) => {
            const tableName = String(t.table_name || '');
            const active = state.currentTable === tableName ? 'active' : '';

            return `
                <button class="table-item ${active}" data-table="${escapeHtml(tableName)}">
                    ${escapeHtml(tableName)}
                </button>
            `;
        })
        .join('');
}

export function renderTableHeader() {
    els.currentTableTitle.textContent = state.currentTable;
    els.currentTableSubtitle.textContent = `Schema: ${state.schema}`;
    els.btnNewRow.disabled = false;
}

export function renderTabs() {
    const isRows = state.activeTab === TABS.rows;

    els.tabList.querySelectorAll('[data-tab]').forEach((tab) => {
        const active = tab.dataset.tab === state.activeTab;
        tab.classList.toggle('is-active', active);
        tab.setAttribute('aria-selected', String(active));
    });

    els.rowsPanel.classList.toggle('hidden', !isRows);
    els.structurePanel.classList.toggle('hidden', isRows);
    els.btnNewRow.classList.toggle('hidden', !isRows);
}

// ─── Registros ──────────────────────────────────────────────────────

export function renderRowsMessage(message, colspan = 1) {
    els.tableBody.innerHTML = `
        <tr>
            <td class="empty" colspan="${colspan}">${escapeHtml(message)}</td>
        </tr>
    `;
}

export function renderMeta() {
    els.totalRows.textContent = state.total;
    els.primaryKeyInfo.textContent = state.primaryKey.length
        ? state.primaryKey.join(', ')
        : 'Sem PK';

    els.paginationLabel.textContent = `Página ${state.page}`;
}

function columnHeader(columnName) {
    const { isPk, fk } = getColumnKeys(columnName);
    const icons = `${isPk ? '🔑 ' : ''}${fk ? '🔗 ' : ''}`;
    const title = [isPk && 'Chave primária', fk && `FK → ${describeFk(fk)}`].filter(Boolean).join(' | ');

    return `<th title="${escapeHtml(title)}">${icons}${escapeHtml(columnName)}</th>`;
}

export function renderTable() {
    if (!state.columns.length) {
        els.tableHead.innerHTML = '';
        renderRowsMessage('Nenhuma coluna encontrada.');
        return;
    }

    els.tableHead.innerHTML = `
        <tr>
            <th>Ações</th>
            ${state.columns.map((c) => columnHeader(c.column_name)).join('')}
        </tr>
    `;

    if (!state.rows.length) {
        renderRowsMessage('Nenhum registro encontrado.', state.columns.length + 1);
        return;
    }

    els.tableBody.innerHTML = state.rows
        .map((row, index) => {
            return `
                <tr>
                    <td>
                        <div class="row-actions">
                            <button type="button" class="btn btn-edit btn-sm" data-edit="${index}">Editar</button>
                        </div>
                    </td>

                    ${state.columns
                        .map((c) => {
                            const value = formatValue(row[c.column_name]);
                            return `<td title="${escapeHtml(value)}">${escapeHtml(value)}</td>`;
                        })
                        .join('')}
                </tr>
            `;
        })
        .join('');
}

// ─── Estrutura ──────────────────────────────────────────────────────

function emptyRow(colspan, message) {
    return `<tr><td class="empty" colspan="${colspan}">${escapeHtml(message)}</td></tr>`;
}

function actionButton(label, cls, attrs) {
    const data = Object.entries(attrs)
        .map(([key, value]) => `data-${key}="${escapeHtml(value)}"`)
        .join(' ');

    return `<button type="button" class="btn ${cls} btn-sm" ${data}>${label}</button>`;
}

function renderStructureColumns(s) {
    const fkByColumn = getFkByColumn();
    const pkColumns = s.primaryKey?.columns || [];

    els.structColumnsBody.innerHTML = s.columns
        .map((c) => {
            const fk = fkByColumn.get(c.column_name);
            const keys = [
                pkColumns.includes(c.column_name) && '<span class="db-badge db-badge--pk">PK</span>',
                fk && `<span class="db-badge db-badge--fk" title="${escapeHtml(fk.name)}">FK → ${escapeHtml(describeFk(fk))}</span>`,
            ].filter(Boolean).join(' ');

            return `
                <tr>
                    <td><strong>${escapeHtml(c.column_name)}</strong></td>
                    <td>${escapeHtml(c.data_type)}</td>
                    <td>${c.is_nullable ? 'Sim' : 'Não'}</td>
                    <td title="${escapeHtml(c.column_default)}">${escapeHtml(c.column_default)}</td>
                    <td>${keys}</td>
                    <td>
                        <div class="row-actions">
                            ${actionButton('Editar', 'btn-edit', { 'struct-op': 'column.alter', column: c.column_name })}
                            ${actionButton('Excluir', 'btn-delete', { 'struct-op': 'column.drop', column: c.column_name })}
                        </div>
                    </td>
                </tr>
            `;
        })
        .join('');
}

function renderStructurePk(s) {
    els.structPkInfo.innerHTML = s.primaryKey
        ? `<strong>${escapeHtml(s.primaryKey.name)}</strong> — ${escapeHtml(s.primaryKey.columns.join(', '))}`
        : '<span class="db-muted">Esta tabela não possui chave primária.</span>';
}

function renderStructureFks(s) {
    if (!s.foreignKeys.length) {
        els.structFksBody.innerHTML = emptyRow(6, 'Nenhuma chave estrangeira.');
        return;
    }

    els.structFksBody.innerHTML = s.foreignKeys
        .map((fk) => `
            <tr>
                <td>${escapeHtml(fk.name)}</td>
                <td>${escapeHtml(fk.columns.join(', '))}</td>
                <td>${escapeHtml(`${fk.refSchema}.${fk.refTable} (${fk.refColumns.join(', ')})`)}</td>
                <td>${escapeHtml(fk.onUpdate)}</td>
                <td>${escapeHtml(fk.onDelete)}</td>
                <td>${actionButton('Remover', 'btn-delete', { 'struct-op': 'constraint.drop', constraint: fk.name })}</td>
            </tr>
        `)
        .join('');
}

function renderStructureIndexes(s) {
    const indexRows = s.indexes.map((ix) => {
        let kind = 'ÍNDICE';
        if (ix.isPrimary) kind = 'PRIMARY KEY';
        else if (ix.constraintName) kind = 'UNIQUE (constraint)';
        else if (ix.isUnique) kind = 'ÍNDICE UNIQUE';

        // PK é gerenciada no bloco "Chave primária"
        let action = '';
        if (!ix.isPrimary) {
            action = ix.constraintName
                ? actionButton('Remover', 'btn-delete', { 'struct-op': 'constraint.drop', constraint: ix.constraintName })
                : actionButton('Remover', 'btn-delete', { 'struct-op': 'index.drop', index: ix.name });
        }

        return { name: ix.name, kind, definition: ix.definition, action };
    });

    const checkRows = s.checks.map((ck) => ({
        name: ck.name,
        kind: 'CHECK',
        definition: ck.definition,
        action: actionButton('Remover', 'btn-delete', { 'struct-op': 'constraint.drop', constraint: ck.name }),
    }));

    const rows = [...indexRows, ...checkRows];

    els.structIndexesBody.innerHTML = rows.length
        ? rows.map((r) => `
            <tr>
                <td>${escapeHtml(r.name)}</td>
                <td>${escapeHtml(r.kind)}</td>
                <td title="${escapeHtml(r.definition)}">${escapeHtml(r.definition)}</td>
                <td>${r.action}</td>
            </tr>
        `).join('')
        : emptyRow(4, 'Nenhum índice ou constraint.');
}

function renderStructureRefs(s) {
    els.structRefsBody.innerHTML = s.referencedBy.length
        ? s.referencedBy.map((r) => `
            <tr>
                <td>${escapeHtml(`${r.schema}.${r.table}`)}</td>
                <td>${escapeHtml(r.name)}</td>
                <td title="${escapeHtml(r.definition)}">${escapeHtml(r.definition)}</td>
            </tr>
        `).join('')
        : emptyRow(3, 'Nenhuma tabela referencia esta tabela.');
}

export function renderStructureMessage(message) {
    els.structColumnsBody.innerHTML = emptyRow(6, message);
    els.structFksBody.innerHTML = '';
    els.structIndexesBody.innerHTML = '';
    els.structRefsBody.innerHTML = '';
    els.structPkInfo.textContent = '';
}

export function renderStructure() {
    const s = state.structure;

    if (!s) {
        renderStructureMessage('Selecione uma tabela para ver a estrutura.');
        return;
    }

    renderStructureColumns(s);
    renderStructurePk(s);
    renderStructureFks(s);
    renderStructureIndexes(s);
    renderStructureRefs(s);
}
