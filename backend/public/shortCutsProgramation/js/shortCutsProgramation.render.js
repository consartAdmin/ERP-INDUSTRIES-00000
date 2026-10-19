// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: shortCutsProgramation.render.js                               ║
// ║ MODULE: Programming Shortcuts — Render                              ║
// ║ DESCRIPTION: Renderização da tabela, mensagens e paginação          ║
// ║ PRODNEX ERP                                                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { els, state } from './shortCutsProgramation.state.js';
import { escapeHtml } from './shortCutsProgramation.utils.js';

/* ==========================================================================
   LOADING
============================================================================ */

export function renderLoading() {
    if (!els.tbody) return;

    els.tbody.innerHTML = `
        <tr>
            <td colspan="7" class="sc-empty">
                Carregando...
            </td>
        </tr>
    `;
}

/* ==========================================================================
   LOAD ERROR
============================================================================ */

export function renderLoadError(error) {
    if (!els.tbody) return;

    els.tbody.innerHTML = `
        <tr>
            <td colspan="7" class="sc-empty">
                Erro: ${escapeHtml(
                    error?.message || 'Falha ao carregar'
                )}
            </td>
        </tr>
    `;
}

/* ==========================================================================
   TABLE ROWS
============================================================================ */

export function renderRows() {
    if (!els.tbody) return;

    if (!Array.isArray(state.rows) || state.rows.length === 0) {
        els.tbody.innerHTML = `
            <tr>
                <td colspan="7" class="sc-empty">
                    Nenhum shortcut encontrado.
                </td>
            </tr>
        `;

        return;
    }

    els.tbody.innerHTML = state.rows
        .map((row) => {
            const selected =
                String(row.shortcut_id) === String(state.selectedId)
                    ? 'selected'
                    : '';

            const categoryName =
                row.category_name ||
                row.category ||
                '';

            const subcategoryName =
                row.subcategory_name ||
                row.subcategory ||
                '';

            return `
                <tr
                    class="${selected}"
                    data-id="${escapeHtml(row.shortcut_id)}"
                >
                    <td>
                        ${escapeHtml(row.shortcut_id)}
                    </td>

                    <td title="${escapeHtml(row.title)}">
                        ${escapeHtml(row.title)}
                    </td>

                    <td>
                        ${escapeHtml(row.shortcut_key)}
                    </td>

                    <td>
                        ${escapeHtml(categoryName)}
                    </td>

                    <td>
                        ${escapeHtml(subcategoryName)}
                    </td>

                    <td>
                        ${escapeHtml(row.language)}
                    </td>

                    <td>
                        <span
                            class="badge ${
                                row.active ? 'active' : 'inactive'
                            }"
                        >
                            ${row.active ? 'Ativo' : 'Inativo'}
                        </span>
                    </td>
                </tr>
            `;
        })
        .join('');
}

/* ==========================================================================
   TABLE FOOTER
============================================================================ */

export function renderFooter() {
    const limit = Math.max(Number(state.limit) || 50, 1);
    const total = Math.max(Number(state.total) || 0, 0);
    const totalPages = Math.max(Math.ceil(total / limit), 1);

    /*
     * Keeps the current page within the valid interval.
     */
    state.page = Math.min(
        Math.max(Number(state.page) || 1, 1),
        totalPages
    );

    if (els.apPageInfo) {
        els.apPageInfo.textContent =
            `Página ${state.page} de ${totalPages}`;
    }

    if (els.apTableInfo) {
        els.apTableInfo.textContent =
            `${total} ${total === 1 ? 'registro' : 'registros'}`;
    }

    /*
     * Only changes the selected value.
     * It does not remove the <option> elements.
     */
    if (els.apRowsPerPage) {
        els.apRowsPerPage.value = String(limit);
    }

    if (els.btnPreviousPage) {
        els.btnPreviousPage.disabled = state.page <= 1;
    }

    if (els.btnNextPage) {
        els.btnNextPage.disabled =
            state.page >= totalPages || total === 0;
    }
}