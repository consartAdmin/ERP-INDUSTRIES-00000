// ╔══════════════════════════════════════════════════════════════════════╗
// ║ invoicesIssued.render.js — Tabela, KPIs, paginação e status         ║
// ║ PRODNEX ERP                                                         ║
// ║ ✅ KPIs via state.kpis                                               ║
// ║ ✅ Status canônico NF-e                                              ║
// ║ ✅ Download XML / DANFE / pacote                                     ║
// ║ ✅ E-mail                                                            ║
// ║ ✅ Sincronização                                                     ║
// ║ ✅ Cancelamento NF-e via include reutilizável                        ║
// ╚══════════════════════════════════════════════════════════════════════╝

import {
  $,
  setText,
  moneyBR,
  dateBR,
  safe,
  escapeHtml,
} from './invoicesIssued.utils.js';

import {
  state,
} from './invoicesIssued.state.js';

import {
  normalizeNfeStatusCode,
} from './invoicesIssued.validation.js';


// ======================================================================
// STATUS BADGE
// ======================================================================

function statusBadge(status) {
  const st =
    normalizeNfeStatusCode(status) ||
    'PENDENTE';

  const classByStatus = {
    AUTORIZADO: 'autorizada',
    CANCELADO: 'cancelada',
    REJEITADO: 'rejeitada',
    DENEGADO: 'rejeitada',
    INUTILIZADO: 'cancelada',
    PROCESSANDO: 'processando',
    PENDENTE: 'default',
    ERRO: 'rejeitada',
  };

  const cls =
    classByStatus[st] ||
    'default';

  return `
    <span class="badge ${cls}">
      ${escapeHtml(safe(st))}
    </span>
  `;
}


// ======================================================================
// KPIs
// ======================================================================

export function renderKpis() {
  const kpis =
    state.kpis &&
      typeof state.kpis === 'object'
      ? state.kpis
      : {};

  const total =
    Number(
      kpis.total || 0
    );

  const authorized =
    Number(
      kpis.authorized || 0
    );

  const cancelled =
    Number(
      kpis.cancelled || 0
    );

  const totalAmount =
    Number(
      kpis.total_amount || 0
    );

  setText(
    'kpiTotal',
    String(total)
  );

  setText(
    'kpiAuthorized',
    String(authorized)
  );

  setText(
    'kpiCancelled',
    String(cancelled)
  );

  setText(
    'kpiAmount',
    moneyBR(totalAmount)
  );
}


// ======================================================================
// BASE DOWNLOAD URL
// ======================================================================

const API_DOWNLOAD_BASE =
  '/api/invoices-issued';


// ======================================================================
// RECONCILE BUTTON
// ======================================================================

function buildReconcileButton({
  invoiceId,
}) {
  if (!invoiceId) {
    return '';
  }

  return `
    <button
      class="action-btn reconcile"
      type="button"
      data-reconcile="${escapeHtml(invoiceId)}"
      title="Sincronizar NF-e"
      aria-label="Sincronizar NF-e"
    >
      🔄
    </button>
  `;
}


// ======================================================================
// DOWNLOAD BUTTON
// ======================================================================

function buildDownloadButton({
  invoiceId,
  label,
  className,
  type,
}) {
  const icons = {
    xml:
      '/invoicesIssued/icons/xmlDanfe.png',

    danfe:
      '/invoicesIssued/icons/pdfDanfe.png',
  };

  const iconSrc =
    icons[className];

  if (!invoiceId) {
    return `
      <button
        class="action-btn disabled"
        type="button"
        disabled
      >
        Sem ${escapeHtml(label)}
      </button>
    `;
  }

  const url =
    `${API_DOWNLOAD_BASE}/${encodeURIComponent(
      invoiceId
    )}/${type}`;

  return `
    <button
      class="action-btn ${className}"
      type="button"
      data-open-url="${escapeHtml(url)}"
      title="Baixar ${escapeHtml(label)}"
      aria-label="Baixar ${escapeHtml(label)}"
    >
      <img
        src="${escapeHtml(iconSrc)}"
        alt="${escapeHtml(label)}"
        class="action-icon"
      />
    </button>
  `;
}


// ======================================================================
// DOWNLOAD ALL BUTTON
// ======================================================================

function buildDownloadAllButton({
  invoiceId,
}) {
  if (!invoiceId) {
    return '';
  }

  return `
    <button
      class="action-btn download-all"
      type="button"
      data-download-all="${escapeHtml(invoiceId)}"
      title="Baixar XML, DANFE e todos os boletos"
      aria-label="Baixar XML, DANFE e todos os boletos"
    >
      <span
        class="download-all-icon"
        aria-hidden="true"
      >
        ⇩
      </span>
    </button>
  `;
}


// ======================================================================
// EMAIL BUTTON
// ======================================================================

function buildEmailButton({
  invoiceId,
}) {
  if (!invoiceId) {
    return '';
  }

  return `
    <button
      class="action-btn email"
      type="button"
      data-email="${escapeHtml(invoiceId)}"
      title="Enviar NF-e por e-mail"
      aria-label="Enviar NF-e por e-mail"
    >
      <img
        src="/invoicesIssued/icons/email.png"
        alt="E-mail"
        class="action-icon"
      />
    </button>
  `;
}


// ======================================================================
// CANCEL NF-e BUTTON
// ======================================================================

function buildCancelNfeButton(row) {
  const invoiceId =
    row?.invoice_id;

  if (!invoiceId) {
    return '';
  }

  const status =
    normalizeNfeStatusCode(
      row?.nfe_status
    );

  // ------------------------------------------------------------
  // Somente NF-e AUTORIZADA pode entrar no fluxo normal
  // de cancelamento.
  // ------------------------------------------------------------

  if (status !== 'AUTORIZADO') {
    return '';
  }

  return `
    <button
      class="action-btn cancel-nfe"
      type="button"
      data-cancel-nfe="${escapeHtml(invoiceId)}"
      title="Cancelar NF-e"
      aria-label="Cancelar NF-e"
    >
      🚫
    </button>
  `;
}


// ======================================================================
// EDIT BUTTON
// ======================================================================

function buildEditButton({
  invoiceId,
}) {
  const SHOW_EDIT_BUTTON =
    false;

  if (!SHOW_EDIT_BUTTON) {
    return '';
  }

  if (!invoiceId) {
    return '';
  }

  return `
    <button
      class="action-btn edit"
      type="button"
      data-edit="${escapeHtml(invoiceId)}"
      title="Editar nota fiscal"
      aria-label="Editar nota fiscal"
    >
      <img
        src="/invoicesIssued/icons/editIcon.png"
        alt="Editar"
        class="action-icon"
      />
    </button>
  `;
}


// ======================================================================
// LOADING
// ======================================================================

export function renderLoading() {
  const tbody =
    $('tableBody');

  if (!tbody) {
    return;
  }

  tbody.innerHTML = `
    <tr>
      <td
        colspan="9"
        class="empty"
      >
        Carregando notas...
      </td>
    </tr>
  `;
}


// ======================================================================
// ERROR
// ======================================================================

export function renderError(message) {
  const tbody =
    $('tableBody');

  if (!tbody) {
    return;
  }

  tbody.innerHTML = `
    <tr>
      <td
        colspan="9"
        class="empty"
      >
        Erro ao carregar:
        ${escapeHtml(
    message ||
    'Erro desconhecido'
  )}
      </td>
    </tr>
  `;
}


// ======================================================================
// TABLE
// ======================================================================

export function renderTable() {
  const tbody =
    $('tableBody');

  if (!tbody) {
    return;
  }

  if (
    !Array.isArray(state.rows) ||
    !state.rows.length
  ) {
    tbody.innerHTML = `
      <tr>
        <td
          colspan="9"
          class="empty"
        >
          Nenhuma nota fiscal encontrada.
        </td>
      </tr>
    `;

    return;
  }

  tbody.innerHTML =
    state.rows
      .map((row) => {

        const invoiceId =
          row.invoice_id;

        // ----------------------------------------------------------
        // ACTION BUTTONS
        // ----------------------------------------------------------

        const reconcileBtn =
          buildReconcileButton({
            invoiceId,
          });

        const editBtn =
          buildEditButton({
            invoiceId,
          });

        const xmlBtn =
          buildDownloadButton({
            invoiceId,
            label: 'XML',
            className: 'xml',
            type: 'xml',
          });

        const danfeBtn =
          buildDownloadButton({
            invoiceId,
            label: 'DANFE',
            className: 'danfe',
            type: 'danfe',
          });

        const emailBtn =
          buildEmailButton({
            invoiceId,
          });

        const downloadAllBtn =
          buildDownloadAllButton({
            invoiceId,
          });

        const cancelNfeBtn =
          buildCancelNfeButton(
            row
          );

        // ----------------------------------------------------------
        // Source reference
        //
        // order_number normally already contains the correct
        // source reference returned by the backend.
        // The fallbacks keep BUDGET / ORDER rows usable.
        // ----------------------------------------------------------

        const sourceReference =
          row.order_number ||
          row.order_id ||
          row.budget_id ||
          row.bonus_id ||
          null;

        // ----------------------------------------------------------
        // ROW
        // ----------------------------------------------------------

        return `
          <tr
            data-invoice-id="${escapeHtml(
          invoiceId || ''
        )}"
          >

            <td>
              ${escapeHtml(
          safe(
            row.invoice_id
          )
        )}
            </td>

            <td>
              ${escapeHtml(
          safe(
            sourceReference
          )
        )}
            </td>

            <td>
              ${escapeHtml(
          safe(
            row.nfe_number
          )
        )}
            </td>

            <td class="customer-cell">
              ${escapeHtml(
          safe(
            row.customer_name
          )
        )}
            </td>

            <td>
              ${escapeHtml(
          safe(
            row.customer_tax_id
          )
        )}
            </td>

            <td>
              ${statusBadge(
          row.nfe_status
        )}
            </td>

            <td>
              ${escapeHtml(
          dateBR(
            row.issued_date ||
            row.issued_at
          )
        )}
            </td>

            <td class="money-cell">
              ${escapeHtml(
          moneyBR(
            row.total_amount
          )
        )}
            </td>

            <td>
              <div class="actions">

                ${reconcileBtn}

                ${editBtn}

                ${xmlBtn}

                ${danfeBtn}

                ${emailBtn}

                ${downloadAllBtn}

                ${cancelNfeBtn}

              </div>
            </td>

          </tr>
        `;
      })
      .join('');
}


// ======================================================================
// PAGINATION
// ======================================================================

export function renderPagination() {
  const totalRecords =
    Number(
      state.total ||
      state.rows?.length ||
      0
    );

  const limit =
    Number(
      state.limit
    ) || 50;

  const offset =
    Number(
      state.offset
    ) || 0;

  const page =
    Math.floor(
      offset / limit
    ) + 1;

  const totalPages =
    Math.max(
      Math.ceil(
        totalRecords / limit
      ),
      1
    );

  // ------------------------------------------------------------
  // TABLE INFO
  // ------------------------------------------------------------

  const tableInfo =
    $('apTableInfo');

  if (tableInfo) {
    tableInfo.textContent =
      `${totalRecords} ${totalRecords === 1
        ? 'Registro'
        : 'Registros'
      }`;
  }

  // ------------------------------------------------------------
  // PAGE INFO
  // ------------------------------------------------------------

  const pageInfo =
    $('pageInfo');

  if (pageInfo) {
    pageInfo.textContent =
      `Página ${page} de ${totalPages}`;
  }

  // ------------------------------------------------------------
  // PREVIOUS
  // ------------------------------------------------------------

  const previousButton =
    $('btnPreviousPage');

  if (previousButton) {
    previousButton.disabled =
      offset <= 0;
  }

  // ------------------------------------------------------------
  // NEXT
  // ------------------------------------------------------------

  const nextButton =
    $('btnNextPage');

  if (nextButton) {
    nextButton.disabled =
      offset + limit >=
      totalRecords;
  }

  // ------------------------------------------------------------
  // ROWS PER PAGE
  // ------------------------------------------------------------

  const rowsPerPage =
    $('apRowsPerPage');

  if (rowsPerPage) {
    rowsPerPage.value =
      String(limit);
  }
}
