// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: backend/public/database/js/database.form.js                   ║
// ║ MODULE: Database Viewer / Editor                                    ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { loadRows, loadStructure } from './database.actions.js';
import {
    applyStructureChange,
    createRow,
    deleteRow,
    fetchColumns,
    previewStructureChange,
    updateRow,
} from './database.api.js';
import { els } from './database.config.js';
import {
    closeModal,
    closeStructureModal,
    confirmAction,
    hideStructPreview,
    renderRefColumnOptions,
    showMessage,
    showStructPreview,
} from './database.modal.js';
import { state } from './database.state.js';
import { getPkObject } from './database.utils.js';
import { validateStructureOperation } from './database.validation.js';

// ═══════════════════════════════════════════════════════════════════
// REGISTROS
// ═══════════════════════════════════════════════════════════════════

function collectModalData() {
    const data = {};
    const isNew = !state.editingRow;

    els.modalFields.querySelectorAll('[data-field]').forEach((input) => {
        const key = input.dataset.field;
        let value = input.value;

        // Em novo registro, campo vazio fica de fora para o banco aplicar o DEFAULT (ex.: serial)
        if (value === '' && isNew) return;
        if (value === '') value = null;

        data[key] = value;
    });

    return data;
}

async function saveRow() {
    if (!state.currentTable) return;

    const data = collectModalData();

    try {
        if (state.editingRow) {
            const pk = getPkObject(state.editingRow);
            const pkChanged = state.primaryKey.some((col) => String(data[col] ?? '') !== String(pk[col] ?? ''));

            if (pkChanged && !confirmAction(
                'Você alterou a chave primária deste registro. '
                + 'Registros de outras tabelas que apontam para ele podem impedir a alteração. Continuar?'
            )) return;

            await updateRow(state.schema, state.currentTable, pk, data);
        } else {
            await createRow(state.schema, state.currentTable, data);
        }

        closeModal();
        await loadRows();
    } catch (err) {
        showMessage(err.message);
    }
}

async function removeRow() {
    if (!state.editingRow) return;

    if (!confirmAction('Tem certeza que deseja excluir este registro?')) return;

    try {
        await deleteRow(state.schema, state.currentTable, getPkObject(state.editingRow));

        closeModal();
        await loadRows();
    } catch (err) {
        showMessage(err.message);
    }
}

// ═══════════════════════════════════════════════════════════════════
// ESTRUTURA (DDL)
// ═══════════════════════════════════════════════════════════════════

function collectStructureOperation() {
    const { type, fixed } = state.structOp;
    const op = { type, ...fixed };

    els.structFields.querySelectorAll('[data-op]').forEach((el) => {
        const key = el.dataset.op;

        if (el.type === 'checkbox' && 'multi' in el.dataset) {
            op[key] = op[key] || [];
            if (el.checked) op[key].push(el.value);
            return;
        }

        if (el.type === 'checkbox') {
            op[key] = el.checked;
            return;
        }

        const value = el.value.trim();

        if ('bool' in el.dataset) op[key] = value === 'true';
        else if ('array' in el.dataset) op[key] = value ? [value] : [];
        else op[key] = value;
    });

    return op;
}

async function previewStructure() {
    if (!state.structOp) return;

    const op = collectStructureOperation();
    const error = validateStructureOperation(op);

    if (error) {
        showMessage(error);
        return;
    }

    try {
        const { statements } = await previewStructureChange(state.schema, state.currentTable, op);
        showStructPreview(statements);
    } catch (err) {
        hideStructPreview();
        showMessage(err.message);
    }
}

async function applyStructure() {
    if (!state.structOp || !state.structPreviewReady) return;

    const op = collectStructureOperation();

    if (!confirmAction('Executar o SQL exibido no banco de dados? Esta ação altera a estrutura da tabela.')) return;

    els.btnStructApply.disabled = true;

    try {
        await applyStructureChange(state.schema, state.currentTable, op);

        closeStructureModal();
        await loadStructure();
        await loadRows();
        showMessage('Estrutura alterada com sucesso.');
    } catch (err) {
        showMessage(err.message);
    } finally {
        els.btnStructApply.disabled = false;
    }
}

async function handleStructFieldChange(event) {
    // Qualquer mudança invalida o SQL já visualizado
    hideStructPreview();

    if (event.target.dataset.op !== 'refTable') return;

    const refTable = event.target.value;
    renderRefColumnOptions([]);

    if (!refTable) return;

    try {
        const { columns } = await fetchColumns(state.schema, refTable);
        renderRefColumnOptions(columns || []);
    } catch (err) {
        showMessage(err.message);
    }
}

export function registerForm() {
    els.btnCloseModal.addEventListener('click', closeModal);
    els.btnCancelModal.addEventListener('click', closeModal);
    els.modalBackdrop.addEventListener('click', closeModal);
    els.btnSaveRow.addEventListener('click', saveRow);
    els.btnDeleteRow.addEventListener('click', removeRow);

    els.btnCloseStructModal.addEventListener('click', closeStructureModal);
    els.btnCancelStructModal.addEventListener('click', closeStructureModal);
    els.structModalBackdrop.addEventListener('click', closeStructureModal);
    els.btnStructPreview.addEventListener('click', previewStructure);
    els.btnStructApply.addEventListener('click', applyStructure);
    els.structFields.addEventListener('input', hideStructPreview);
    els.structFields.addEventListener('change', handleStructFieldChange);

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            closeModal();
            closeStructureModal();
        }
    });
}
