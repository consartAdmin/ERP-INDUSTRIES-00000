// ╔══════════════════════════════════════════════════════════════════════╗
// ║ budgetsModal.js — Modal Pesquisa de Orçamentos                      ║
// ║ PRODNEX ERP | Uso e Consumo                                         ║
// ║ Layout: Modal Global CONSART                                        ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { getAuthToken } from '/public/includes/js/apiFetch.js';

const API_BASE = window.location.origin;

// /api/budgets ignora filtros; /search filtra por cliente, CNPJ/CPF, vendedor e nº
const BUDGETS_API = `${API_BASE}/api/budgets/search`;

const MODAL_ID = 'modalPesquisarOrcamentos';


// =====================================================================
// HELPERS
// =====================================================================

function safe(value, fallback = '-') {
    if (
        value === null ||
        value === undefined ||
        value === ''
    ) {
        return fallback;
    }

    return String(value);
}


function moneyBR(value) {
    return Number(value || 0).toLocaleString(
        'pt-BR',
        {
            style: 'currency',
            currency: 'BRL',
        }
    );
}


function dateBR(value) {
    if (!value) {
        return '-';
    }

    try {
        return new Date(value).toLocaleString('pt-BR');
    } catch {
        return '-';
    }
}


// =====================================================================
// MODAL
// =====================================================================

function getModal() {
    return document.getElementById(MODAL_ID);
}


function removeExistingModal() {
    const modal = getModal();

    if (modal) {
        modal.remove();
    }
}


function closeModal() {
    const modal = getModal();

    if (!modal) {
        return;
    }

    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');

    document.body.classList.remove('modal-open');

    document.removeEventListener(
        'keydown',
        handleEscGlobal
    );

    window.setTimeout(() => {
        modal.remove();
    }, 150);
}


function handleEscGlobal(event) {
    if (event.key === 'Escape') {
        closeModal();
    }
}


// =====================================================================
// API
// =====================================================================

async function searchBudgets({
    q = '',
    customer = '',
} = {}) {

    const url = new URL(BUDGETS_API);

    // o endpoint aceita um único termo (q), que já busca pelo cliente
    const term = q || customer;

    if (term) {
        url.searchParams.set('q', term);
    }

    url.searchParams.set('limit', 100);

    // /api/budgets exige JWT (requireAuth)
    const token = getAuthToken();

    const response = await fetch(url, {
        headers: {
            Accept: 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
    });

    let json;

    try {
        json = await response.json();
    } catch {
        json = {};
    }

    if (
        !response.ok ||
        json.ok === false
    ) {
        throw new Error(
            (response.status === 401
                ? 'Sessão expirada. Faça login novamente.'
                : null) ||
            json.message ||
            json.error ||
            'Erro ao pesquisar orçamentos.'
        );
    }

    return (
        json.data ||
        json.rows ||
        json.budgets ||
        []
    );
}


// =====================================================================
// ROW
// =====================================================================

function createRow(row, onSelect) {

    const tr = document.createElement('tr');

    const budgetId =
        row.budget_id ??
        row.id ??
        '-';

    const number =
        row.number ??
        row.budget_number ??
        '-';

    const customer =
        row.customer_name ??
        row.legal_name ??
        row.nome_fantasia ??
        row.trade_name ??
        row.customer ??
        '-';

    const seller =
        row.seller_name ??
        row.vendedor ??
        row.seller ??
        '-';

    const status =
        row.status ??
        '-';

    const total =
        row.total_amount ??
        row.total ??
        0;

    const createdAt =
        row.created_at ??
        row.issue_date ??
        row.date;


    tr.innerHTML = `
        <td>${safe(budgetId)}</td>

        <td>${safe(number)}</td>

        <td>${safe(customer)}</td>

        <td>${safe(seller)}</td>

        <td>${moneyBR(total)}</td>

        <td>
            <span class="status-badge">
                ${safe(status)}
            </span>
        </td>

        <td>${dateBR(createdAt)}</td>

        <td class="table-actions">
            <button
                class="btn btn-new btn-sm js-import-budget"
                type="button"
                title="Importar orçamento"
            >
                Importar
            </button>
        </td>
    `;


    const btn =
        tr.querySelector(
            '.js-import-budget'
        );


    btn?.addEventListener(
        'click',
        () => {

            onSelect?.(row);

            closeModal();
        }
    );


    return tr;
}


// =====================================================================
// RENDER
// =====================================================================

function renderRows(
    tbody,
    rows,
    onSelect
) {

    tbody.innerHTML = '';

    if (!Array.isArray(rows) || !rows.length) {

        tbody.innerHTML = `
            <tr>
                <td
                    colspan="8"
                    class="table-empty"
                    style="text-align:center;"
                >
                    Nenhum orçamento encontrado.
                </td>
            </tr>
        `;

        return;
    }


    rows.forEach((row) => {

        tbody.appendChild(
            createRow(
                row,
                onSelect
            )
        );

    });
}


// =====================================================================
// LOAD
// =====================================================================

async function loadRows({
    tbody,
    inputSearch,
    inputCustomer,
    onSelect,
}) {

    if (!tbody) {
        return;
    }


    try {

        tbody.innerHTML = `
            <tr>
                <td
                    colspan="8"
                    class="table-empty"
                    style="text-align:center;"
                >
                    Carregando orçamentos...
                </td>
            </tr>
        `;


        const rows =
            await searchBudgets({
                q:
                    inputSearch
                        ?.value
                        ?.trim() || '',

                customer:
                    inputCustomer
                        ?.value
                        ?.trim() || '',
            });


        renderRows(
            tbody,
            rows,
            onSelect
        );

    } catch (error) {

        console.error(
            '[budgetsModal][loadRows][ERROR]',
            error
        );


        tbody.innerHTML = `
            <tr>
                <td
                    colspan="8"
                    class="table-empty"
                    style="
                        text-align:center;
                        color:#b91c1c;
                    "
                >
                    ${safe(
            error?.message,
            'Erro ao carregar orçamentos.'
        )
            }
                </td>
            </tr>
        `;
    }
}


// =====================================================================
// OPEN MODAL
// =====================================================================

export function openBudgetsModal({
    onSelect,
    subtitle = 'Selecione um orçamento para importar no Uso e Consumo.',
} = {}) {

    removeExistingModal();


    document.removeEventListener(
        'keydown',
        handleEscGlobal
    );

    document.addEventListener(
        'keydown',
        handleEscGlobal
    );


    // -----------------------------------------------------------------
    // ROOT
    // -----------------------------------------------------------------

    const modal =
        document.createElement('div');


    modal.id = MODAL_ID;

    modal.className =
        'modal modal-width-18';

    modal.setAttribute(
        'aria-hidden',
        'true'
    );


    // -----------------------------------------------------------------
    // HTML
    // -----------------------------------------------------------------

    modal.innerHTML = `

        <!-- ========================================================= -->
        <!-- BACKDROP                                                  -->
        <!-- ========================================================= -->

        <div
            class="modal__backdrop"
            data-budgets-modal-close
        ></div>


        <!-- ========================================================= -->
        <!-- DIALOG                                                    -->
        <!-- ========================================================= -->

        <div class="modal__dialog">

            <section
                class="modal__panel"
                role="dialog"
                aria-modal="true"
                aria-labelledby="modalPesquisarOrcamentosTitle"
            >


                <!-- ================================================= -->
                <!-- HEADER                                            -->
                <!-- ================================================= -->

                <header
                    class="modal__header modal-header-color-3"
                >

                    <div class="modal-cancel-header-content">

                        <div>

                            <h2
                                id="modalPesquisarOrcamentosTitle"
                                class="modal__title"
                            >
                                Pesquisar Orçamentos
                            </h2>

                            <p class="modal__subtitle">
                                ${safe(subtitle, '')}
                            </p>

                        </div>

                    </div>


                    <button
                        class="modal__close"
                        type="button"
                        aria-label="Fechar"
                        title="Fechar"
                        data-budgets-modal-close
                    >
                        &times;
                    </button>

                </header>


                <!-- ================================================= -->
                <!-- BODY                                              -->
                <!-- ================================================= -->

                <div class="modal__body">
    <section class="table-layout-integrated">
      <div class="table-layout-integrated__filter table-max-height-500">


                    <!-- ============================================= -->
                    <!-- FILTROS                                       -->
                    <!-- ============================================= -->

                    <div
                        class="
                            fields-inline
                            fields-gap-3
                            fields-align-end
                        "
                    >


                        <!-- Pesquisa -->

                        <div
                            class="
                                fields
                                fields-w-15
                                fields-h-6
                                fields-font-3
                            "
                        >

                            <label for="budgetsModalSearch">
                                Pesquisar
                            </label>

                            <input
                                id="budgetsModalSearch"
                                type="text"
                                placeholder="Número, ID..."
                                autocomplete="off"
                            />

                        </div>


                        <!-- Cliente -->

                        <div
                            class="
                                fields
                                fields-w-20
                                fields-h-6
                                fields-font-3
                            "
                        >

                            <label for="budgetsModalCustomer">
                                Cliente
                            </label>

                            <input
                                id="budgetsModalCustomer"
                                type="text"
                                placeholder="Nome do cliente..."
                                autocomplete="off"
                            />

                        </div>


                        <!-- Pesquisar -->

                        <div class="buttons-inline fields-gap-3">

                            <button
                                id="budgetsModalBtnSearch"
                                class="btn btn-toolbar btn-sm"
                                type="button"
                            >
                                Buscar
                            </button>

                        <!-- Limpar -->

                            <button
                                id="budgetsModalBtnClear"
                                class="btn btn-clear btn-sm"
                                type="button"
                            >
                                Limpar
                            </button>

                        </div>

                    </div>


                    <!-- ============================================= -->
                    <!-- TABELA                                        -->
                    <!-- ============================================= -->

      <!-- scroll interno: a tabela rola dentro do modal (cabeçalho fixo) -->
      <div class="table-scroll table-scroll--rounded table-row-h-28" style="--table-scroll-max-height: 55vh;">
        <table class="table table-zebra table-zebra-hover table-sticky-head">
                            <thead>

                                <tr>

                                    <th>ID</th>

                                    <th>Número</th>

                                    <th>Cliente</th>

                                    <th>Vendedor</th>

                                    <th>Total</th>

                                    <th>Status</th>

                                    <th>Data</th>

                                    <th>Ações</th>

                                </tr>

                            </thead>


                            <tbody id="budgetsModalRows">

                                <tr>

                                    <td
                                        colspan="8"
                                        class="table-empty"
                                        style="text-align:center;"
                                    >
                                        Carregando orçamentos...
                                    </td>

                                </tr>

                            </tbody>

                        </table>

                    </div>

                </div>


                <!-- ================================================= -->
                <!-- FOOTER                                            -->
                <!-- ================================================= -->

                <footer class="modal__footer">

                    <button
                        type="button"
                        class="btn btn-close btn-sm"
                        data-budgets-modal-close
                    >
                        Fechar
                    </button>

                </footer>


            </section>

        </div>
    `;


    document.body.appendChild(modal);


    // =================================================================
    // ELEMENTOS
    // =================================================================

    const tbody =
        modal.querySelector(
            '#budgetsModalRows'
        );


    const inputSearch =
        modal.querySelector(
            '#budgetsModalSearch'
        );


    const inputCustomer =
        modal.querySelector(
            '#budgetsModalCustomer'
        );


    const btnSearch =
        modal.querySelector(
            '#budgetsModalBtnSearch'
        );


    const btnClear =
        modal.querySelector(
            '#budgetsModalBtnClear'
        );


    const closeButtons =
        modal.querySelectorAll(
            '[data-budgets-modal-close]'
        );


    // =================================================================
    // CLOSE
    // =================================================================

    closeButtons.forEach((element) => {

        element.addEventListener(
            'click',
            closeModal
        );

    });


    // =================================================================
    // SEARCH
    // =================================================================

    btnSearch?.addEventListener(
        'click',
        () => {

            loadRows({
                tbody,
                inputSearch,
                inputCustomer,
                onSelect,
            });

        }
    );


    // =================================================================
    // CLEAR
    // =================================================================

    btnClear?.addEventListener(
        'click',
        () => {

            if (inputSearch) {
                inputSearch.value = '';
            }

            if (inputCustomer) {
                inputCustomer.value = '';
            }


            loadRows({
                tbody,
                inputSearch,
                inputCustomer,
                onSelect,
            });


            inputSearch?.focus();
        }
    );


    // =================================================================
    // ENTER
    // =================================================================

    const handleEnter = (event) => {

        if (event.key !== 'Enter') {
            return;
        }

        event.preventDefault();

        btnSearch?.click();
    };


    inputSearch?.addEventListener(
        'keydown',
        handleEnter
    );


    inputCustomer?.addEventListener(
        'keydown',
        handleEnter
    );


    // =================================================================
    // OPEN
    // =================================================================

    requestAnimationFrame(() => {

        modal.classList.add('is-open');

        modal.setAttribute(
            'aria-hidden',
            'false'
        );

        document.body.classList.add(
            'modal-open'
        );

    });


    // =================================================================
    // INITIAL LOAD
    // =================================================================

    loadRows({
        tbody,
        inputSearch,
        inputCustomer,
        onSelect,
    });


    // =================================================================
    // FOCUS
    // =================================================================

    window.setTimeout(() => {
        inputSearch?.focus();
    }, 120);
}