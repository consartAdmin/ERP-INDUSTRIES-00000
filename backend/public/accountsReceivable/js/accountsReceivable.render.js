// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ accountsReceivable.render.js — Renderização de Contas a Receber         ║
// ║ Controla tabela, resumos financeiros, registros e paginação do módulo.   ║
// ╚══════════════════════════════════════════════════════════════════════════╝

import {
  $,
  dateBR,
  moneyBR
} from './accountsReceivable.utils.js';

import {
  state
} from './accountsReceivable.state.js';

/* ==========================================================================
   BOLETO
============================================================================ */

function effectiveBoletoLink(item) {
  return (
    item.invoice_url ||
    item.boleto_url ||
    item.bank_slip_url ||
    item.bankSlipUrl ||
    item.invoiceUrl ||
    null
  );
}

/* ==========================================================================
   LIMITES DE TEXTO
============================================================================ */

// Altere este número para controlar o máximo de caracteres.
const MAX_CUSTOMER_CHARACTERS = 28;
const MAX_BANK_CHARACTERS = 18;

function truncateText(value, maxCharacters) {
  const text = String(value ?? '').trim();
  const characters = Array.from(text);

  if (characters.length <= maxCharacters) {
    return text;
  }

  return `${characters.slice(0, maxCharacters).join('')}…`;
}

/* ==========================================================================
   BANCO DA FATURA
============================================================================ */

// Aceita os nomes mais comuns que o backend pode devolver para o banco
// da fatura emitida (snake_case, camelCase ou objeto aninhado).
function invoiceBank(item) {
  const value =
    item.account_bank ??
    item.accountBank ??
    item.invoice_account_bank ??
    item.invoice?.accountBank ??
    item.invoice?.account_bank ??
    '';

  return String(value).trim();
}

/* ==========================================================================
   STATUS
============================================================================ */

const STATUS_LABELS = Object.freeze({
  PENDING: 'Pendente',
  PAID: 'Pago',
  OVERDUE: 'Vencido',
  PARTIAL: 'Parcial',
  CANCELLED: 'Cancelado',
  CANCELED: 'Cancelado',
});

function normalizeStatus(value) {
  return String(value ?? '')
    .trim()
    .toUpperCase();
}

export function statusBR(value) {
  const status = normalizeStatus(value);

  return STATUS_LABELS[status] || value || '';
}

/* ==========================================================================
   RENDERIZAÇÃO DA TABELA
============================================================================ */

export function renderTable(items, handlers) {
  const tbody = $('#tableBody');

  if (!tbody) {
    return;
  }

  tbody.replaceChildren();

  if (!items.length) {
    const row = tbody.insertRow();
    const cell = row.insertCell();

    cell.colSpan = 13;
    cell.textContent =
      'Nenhum registro encontrado para o filtro atual.';

    return;
  }

  for (const item of items) {
    const id =
      item.id ??
      item.account_id ??
      '';

    const customerId =
      item.customer_id ??
      item.asaas_customer_id ??
      '';

    const customerName =
      item.customer_name === customerId
        ? ''
        : (item.customer_name ?? '');

    const bankName =
      invoiceBank(item);

    const documentTypeName =
      String(
        item.document_type_name ??
        item.documentTypeName ??
        ''
      ).trim();

    const totalValue =
      Number(item.value || 0);

    const paidValue =
      Number(item.paid_value || 0);

    const balance =
      totalValue - paidValue;

    const boletoLink =
      effectiveBoletoLink(item);

    const status =
      normalizeStatus(item.status);

    const canReceive =
      ['PENDING', 'OVERDUE'].includes(status);

    const row =
      document.createElement('tr');

    row.dataset.id = id;

    if (boletoLink) {
      row.dataset.boletoUrl = boletoLink;
    }

    row.innerHTML = `
      <td>
        ${item.account_id ?? item.id ?? ''}
      </td>

      <td>
        ${customerId}
      </td>

      <td class="ar-col-customer"></td>

      <td class="ar-col-bank"></td>

      <td class="ar-col-doctype"></td>

      <td>
        ${item.invoice_number ?? ''}
      </td>

      <td>
        ${item.issue_date ? dateBR(item.issue_date) : ''}
      </td>

      <td>
        ${item.due_date ? dateBR(item.due_date) : ''}
      </td>
      
<td>
  ${statusBR(status)}
</td>

      <td class="col-valor">
        ${moneyBR(totalValue)}
      </td>

      <td class="col-valor">
        ${moneyBR(paidValue)}
      </td>

      <td class="col-valor">
        ${moneyBR(balance)}
      </td>

      <td class="ar-col-actions">
        <div class="menu-botoes ar-actions">

            <button
      type="button"
      class="btn btn-toolbar btn-sm"
      data-act="edit"
      title="Editar conta a receber"
      aria-label="Editar conta a receber"
    >
      ✏️
    </button>
      
          ${canReceive
        ? `
                <button
                  type="button"
                  class="btn btn-toolbar btn-sm"
                  data-act="receive"
                  title="Receber"
                  aria-label="Receber"
                >
                  💰
                </button>
              `
        : ''
      }

          ${boletoLink
        ? `
                <button
                  type="button"
                  class="btn btn-toolbar btn-sm"
                  data-act="boleto"
                  title="Abrir boleto"
                  aria-label="Abrir boleto"
                >
                  🧾
                </button>
              `
        : ''
      }

          ${boletoLink && canReceive
        ? `
                <button
                  type="button"
                  class="btn btn-toolbar btn-sm"
                  data-act="cancel-boleto"
                  title="Cancelar boleto"
                  aria-label="Cancelar boleto"
                >
                  🗑️
                </button>
              `
        : ''
      }
        </div>
      </td>
    `;

    const customerCell =
      row.querySelector('.ar-col-customer');

    if (customerCell) {
      customerCell.textContent = truncateText(
        customerName,
        MAX_CUSTOMER_CHARACTERS
      );

      // Exibe o nome completo quando o mouse fica sobre a célula.
      customerCell.title = customerName;
    }

    const bankCell =
      row.querySelector('.ar-col-bank');

    if (bankCell) {
      // textContent evita injeção de HTML vindo da fatura.
      bankCell.textContent = bankName
        ? truncateText(bankName, MAX_BANK_CHARACTERS)
        : '—';

      bankCell.title = bankName;
    }

    const documentTypeCell =
      row.querySelector('.ar-col-doctype');

    if (documentTypeCell) {
      documentTypeCell.textContent = documentTypeName || '—';
      documentTypeCell.title = documentTypeName;
    }

    row
      .querySelector('[data-act="edit"]')
      ?.addEventListener(
        'click',
        () => handlers.edit(id)
      );

    row
      .querySelector('[data-act="receive"]')
      ?.addEventListener(
        'click',
        () => handlers.receive(row, id)
      );

    row
      .querySelector('[data-act="boleto"]')
      ?.addEventListener(
        'click',
        () => handlers.boleto(row)
      );

    row
      .querySelector('[data-act="cancel-boleto"]')
      ?.addEventListener(
        'click',
        (event) => {
          handlers.cancelBoleto(
            row,
            event.currentTarget
          );
        }
      );

    tbody.appendChild(row);
  }
}

/* ==========================================================================
   RESUMO FINANCEIRO
============================================================================ */

export function updateSummary(items, totals) {
  const pageTotal = items.reduce(
    (sum, item) => sum + Number(item.value ?? item.total ?? 0),
    0
  );

  const pagePaid = items.reduce(
    (sum, item) => sum + Number(item.paid_value ?? item.received ?? 0),
    0
  );

  const total = Number(
    totals?.total ??
    totals?.value ??
    totals?.total_value ??
    totals?.total_amount ??
    pageTotal
  );

  const paid = Number(
    totals?.paid ??
    totals?.received ??
    totals?.paid_value ??
    totals?.received_value ??
    totals?.total_paid ??
    totals?.total_received ??
    pagePaid
  );

  const balance = Number(
    totals?.balance ??
    totals?.open ??
    totals?.open_value ??
    totals?.balance_value ??
    totals?.total_balance ??
    (total - paid)
  );

  const summaryTotal =
    $('#arSummaryTotal');

  const summaryPaid =
    $('#arSummaryPaid');

  const summaryBalance =
    $('#arSummaryBalance');

  if (summaryTotal) {
    summaryTotal.textContent =
      moneyBR(total);
  }

  if (summaryPaid) {
    summaryPaid.textContent =
      moneyBR(paid);
  }

  if (summaryBalance) {
    summaryBalance.textContent =
      moneyBR(balance);
  }
}

/* ==========================================================================
   PAGINAÇÃO E QUANTIDADE DE REGISTROS
============================================================================ */

export function updatePagination(total) {
  const normalizedTotal =
    Number.isFinite(Number(total))
      ? Number(total)
      : 0;

  const pageInfo =
    $('#apPageInfo');

  const tableInfo =
    $('#apTableInfo');

  const previousButton =
    $('#btnPreviousPage');

  const nextButton =
    $('#btnNextPage');

  if (pageInfo) {
    pageInfo.textContent =
      `Página ${state.page} de ${state.totalPages}`;
  }

  if (tableInfo) {
    tableInfo.textContent =
      `${normalizedTotal} ${normalizedTotal === 1
        ? 'registro'
        : 'registros'
      }`;
  }

  if (previousButton) {
    previousButton.disabled =
      state.page <= 1;
  }

  if (nextButton) {
    nextButton.disabled =
      state.page >= state.totalPages;
  }
}
