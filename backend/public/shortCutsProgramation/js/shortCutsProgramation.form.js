// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: shortCutsProgramation.form.js                                 ║
// ║ MODULE: Programming Shortcuts — Form                                ║
// ║ DESCRIPTION: Categorias, subcategorias e dados do formulário        ║
// ║ PRODNEX ERP                                                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { shortcutsApi } from './shortCutsProgramation.api.js';
import { renderRows } from './shortCutsProgramation.render.js';
import { els, state } from './shortCutsProgramation.state.js';
import {
    asRows,
    escapeHtml,
    selectedText,
} from './shortCutsProgramation.utils.js';

export async function loadCategories() {
    try {
        const data = await shortcutsApi.categories();
        state.categories = asRows(data);
        const options = state.categories.map((row) => `
            <option value="${escapeHtml(row.category_id)}">
                ${escapeHtml(row.name)}
            </option>
        `).join('');

        if (els.category_id) {
            els.category_id.innerHTML = `
                <option value="">Selecione a categoria...</option>
                ${options}
            `;
        }
        if (els.filterCategoryId) {
            els.filterCategoryId.innerHTML = `
                <option value="">Todas categorias</option>
                ${options}
            `;
        }
    } catch (error) {
        console.error('[shortCutsProgramation.loadCategories]', error);
    }
}

export async function loadSubcategories(categoryId, selectedId = '') {
    state.subcategories = [];

    if (!els.subcategory_id) return;

    els.subcategory_id.innerHTML =
        '<option value="">Selecione a subcategoria...</option>';

    if (!categoryId) return;

    try {
        const data = await shortcutsApi.subcategories(categoryId);
        state.subcategories = asRows(data);
        els.subcategory_id.innerHTML = `
            <option value="">Selecione a subcategoria...</option>
            ${state.subcategories.map((row) => `
                <option value="${escapeHtml(row.subcategory_id)}">
                    ${escapeHtml(row.name)}
                </option>
            `).join('')}
        `;

        if (selectedId) els.subcategory_id.value = String(selectedId);
    } catch (error) {
        console.error('[shortCutsProgramation.loadSubcategories]', error);
        els.subcategory_id.innerHTML =
            '<option value="">Erro ao carregar subcategorias</option>';
    }
}

export async function clearForm() {
    state.selectedId = null;
    if (els.form) {
        els.form.reset();
    }
    if (els.shortcut_id) {
        els.shortcut_id.value = '';
    }

    await loadCategories();

    if (els.category_id) els.category_id.value = '';
    if (els.subcategory_id) {
        els.subcategory_id.innerHTML =
            '<option value="">Selecione a subcategoria...</option>';
    }
    if (els.category) els.category.value = '';
    if (els.subcategory) els.subcategory.value = '';
    if (els.difficulty) els.difficulty.value = '1';
    if (els.sort_order) els.sort_order.value = '0';
    if (els.active) els.active.checked = true;
    if (els.favorite) els.favorite.checked = false;
    if (els.formTitle) els.formTitle.textContent = 'Novo Shortcut';
    if (els.selectedId) els.selectedId.textContent = 'Nenhum selecionado';
    renderRows();
}

export async function fillForm(row) {
    state.selectedId = row.shortcut_id;
    if (els.shortcut_id) {
        els.shortcut_id.value = row.shortcut_id ?? '';
    }
    if (els.category_id) {
        els.category_id.value = row.category_id ? String(row.category_id) : '';
    }

    await loadSubcategories(row.category_id, row.subcategory_id);

    if (els.category) {
        els.category.value = row.category_name || row.category || '';
    }
    if (els.subcategory) {
        els.subcategory.value = row.subcategory_name || row.subcategory || '';
    }
    els.title.value = row.title ?? '';
    els.shortcut_key.value = row.shortcut_key ?? '';
    els.shortcut_type.value = row.shortcut_type ?? '';
    els.language.value = row.language ?? '';
    els.description.value = row.description ?? '';
    els.code.value = row.code ?? '';
    els.observations.value = row.observations ?? '';
    els.tags.value = row.tags ?? '';
    els.difficulty.value = row.difficulty ?? 1;
    els.favorite.checked = Boolean(row.favorite);
    els.active.checked = Boolean(row.active);
    els.sort_order.value = row.sort_order ?? 0;
    els.formTitle.textContent = 'Editar Shortcut';
    els.selectedId.textContent = `ID ${row.shortcut_id}`;
    renderRows();
}

export function getPayload() {
    return {
        category_id: els.category_id?.value || null,
        subcategory_id: els.subcategory_id?.value || null,
        category: selectedText(els.category_id),
        subcategory: selectedText(els.subcategory_id),
        title: els.title.value.trim(),
        shortcut_key: els.shortcut_key.value.trim(),
        shortcut_type: els.shortcut_type.value.trim(),
        language: els.language.value.trim(),
        description: els.description.value.trim(),
        code: els.code.value,
        observations: els.observations.value,
        tags: els.tags.value.trim(),
        difficulty: Number(els.difficulty.value || 1),
        favorite: els.favorite.checked,
        active: els.active.checked,
        sort_order: Number(els.sort_order.value || 0),
    };
}
