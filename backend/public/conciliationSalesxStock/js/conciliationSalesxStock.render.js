/* ╔══════════════════════════════════════════════════════════════════════╗
   ║ conciliationSalesxStock.render.js                                  ║
   ║ PRODNEX ERP                                                        ║
   ║ Renderização + cabeçalhos compatíveis com sortableTable             ║
   ╚══════════════════════════════════════════════════════════════════════╝ */

'use strict';

const number = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const integer = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

function dateBR(value) {
  if (!value) return '—';

  const parts = String(value).slice(0, 10).split('-');

  return parts.length === 3
    ? `${parts[2]}/${parts[1]}/${parts[0]}`
    : String(value);
}

function escapeHtml(value) {
  return String(value ?? '').replace(
    /[&<>'"]/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;',
      })[character],
  );
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function hasNumericValue(value) {
  return (
    value !== null &&
    value !== undefined &&
    value !== '' &&
    Number.isFinite(Number(value))
  );
}

function normalizeMovementType(value) {
  const normalized = String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();

  if (['ENTRADA', 'INBOUND', 'IN'].includes(normalized)) {
    return 'ENTRADA';
  }

  if (['SAIDA', 'OUTBOUND', 'OUT'].includes(normalized)) {
    return 'SAIDA';
  }

  return 'TODOS';
}

function getSelectedMovementType() {
  return normalizeMovementType(
    document.getElementById('csMovementType')?.value || 'TODOS',
  );
}

function filterRowsByMovement(rows = [], isTotal = false) {
  if (isTotal) return rows;

  const selectedMovement = getSelectedMovementType();

  if (selectedMovement === 'TODOS') return rows;

  return rows.filter(
    (row) =>
      normalizeMovementType(row.movement_type) === selectedMovement,
  );
}

function getMovementLabel(value) {
  return normalizeMovementType(value) === 'ENTRADA'
    ? 'Entrada'
    : 'Saída';
}

function getMovementClass(value) {
  return normalizeMovementType(value) === 'ENTRADA'
    ? 'entrada'
    : 'saida';
}

function setSortableHeaderLabel(headerId, label) {
  const header = document.getElementById(headerId);

  if (!header) return;

  const labelElement = header.querySelector('[data-sort-label]');

  if (labelElement) {
    labelElement.textContent = label;
  }
}

function renderHeaders(isTotal) {
  setSortableHeaderLabel('csMovementHeader', 'Movimento');

  setSortableHeaderLabel(
    'csInvoiceHeader',
    isTotal ? 'NF-es saída / entrada' : 'Nº NF-e',
  );

  setSortableHeaderLabel('csDateHeader', 'Data');

  setSortableHeaderLabel(
    'csQuantityHeader',
    isTotal ? 'Vendido / Recebido' : 'Quantidade por Operação',
  );
}

function createMovementCell(row, isTotal) {
  if (isTotal) {
    return `
      <span class="movement-badge movement-badge--total">
        Total
      </span>
    `;
  }

  return `
    <span class="movement-badge movement-badge--${getMovementClass(row.movement_type)}">
      ${escapeHtml(getMovementLabel(row.movement_type))}
    </span>
  `;
}

function createInvoiceCell(row, isTotal) {
  if (isTotal) {
    return `${integer.format(toNumber(row.invoices_count))} / ${integer.format(toNumber(row.inbound_invoices_count))}`;
  }

  return escapeHtml(row.invoice_number || '—');
}

function createQuantityCell(row, isTotal) {
  if (isTotal) {
    return `${number.format(toNumber(row.quantity_sold))} / ${number.format(toNumber(row.quantity_inbound))}`;
  }

  return number.format(toNumber(row.movement_quantity));
}

function createStockValueHtml(value, className) {
  if (!hasNumericValue(value)) {
    return `<span class="${className} muted">—</span>`;
  }

  const numericValue = toNumber(value);
  const negative = numericValue < 0;

  return `
    <span
      class="${className}${negative ? ' stock-flow__value--negative' : ''}"
      ${negative ? 'style="color:#c62828;font-weight:700;"' : ''}
    >
      ${escapeHtml(number.format(numericValue))}
    </span>
  `;
}

function createStockFlowCell(row, isTotal) {
  if (isTotal) {
    return createStockValueHtml(
      row.current_available_stock,
      'stock-flow__after',
    );
  }

  const hasBefore = hasNumericValue(row.stock_before);
  const hasAfter = hasNumericValue(row.stock_after);

  if (!hasBefore && !hasAfter) {
    return `
      <span
        class="muted"
        title="Histórico de estoque não encontrado para esta operação"
      >
        —
      </span>
    `;
  }

  return `
    <span
      class="stock-flow"
      title="Estoque antes e depois da operação"
    >
      ${createStockValueHtml(row.stock_before, 'stock-flow__before')}

      <span class="stock-flow__arrow" aria-hidden="true">
        →
      </span>

      ${createStockValueHtml(row.stock_after, 'stock-flow__after')}
    </span>
  `;
}

function createRowHtml(row, isTotal) {
  const movementDate = isTotal
    ? '—'
    : dateBR(row.movement_date);

  return `
    <tr>
      <td>${escapeHtml(row.sku)}</td>

      <td>${escapeHtml(row.description)}</td>

      <td>${createMovementCell(row, isTotal)}</td>

      <td class="invoice-numbers-cell">
        ${createInvoiceCell(row, isTotal)}
      </td>

      <td>${escapeHtml(movementDate)}</td>

      <td class="number-cell">
        ${createQuantityCell(row, isTotal)}
      </td>

      <td class="number-cell stock-flow-cell">
        ${createStockFlowCell(row, isTotal)}
      </td>

      <td
        class="number-cell buy-cell"
        title="Quantidade necessária para levar o estoque até zero"
      >
        ${number.format(toNumber(row.quantity_to_buy))}
      </td>
    </tr>
  `;
}

function renderRows(rows, isTotal) {
  const body = document.getElementById('csTableBody');

  if (!body) return;

  if (!rows.length) {
    body.innerHTML = `
      <tr>
        <td colspan="8" class="empty-row">
          Nenhum movimento encontrado para os filtros selecionados.
        </td>
      </tr>
    `;
    return;
  }

  body.innerHTML = rows
    .map((row) => createRowHtml(row, isTotal))
    .join('');
}

function setText(id, value) {
  const element = document.getElementById(id);

  if (element) {
    element.textContent = value;
  }
}

function renderSummary(summary = {}) {
  setText(
    'csProductsCount',
    integer.format(toNumber(summary.products_count)),
  );

  setText(
    'csProductsToBuy',
    integer.format(toNumber(summary.products_to_buy)),
  );

  setText(
    'csQuantitySold',
    number.format(toNumber(summary.quantity_sold)),
  );

  setText(
    'csQuantityInbound',
    number.format(toNumber(summary.quantity_inbound)),
  );

  setText(
    'csAvailableStock',
    number.format(toNumber(summary.available_stock)),
  );

  setText(
    'csQuantityToBuy',
    number.format(toNumber(summary.quantity_to_buy)),
  );
}

function renderPagination(state, visibleRowsCount) {
  const total = Math.max(toNumber(state.total), 0);
  const pageSize = Math.max(toNumber(state.pageSize), 1);
  const page = Math.max(toNumber(state.page), 1);
  const pages = Math.max(Math.ceil(total / pageSize), 1);

  const start =
    total > 0
      ? ((page - 1) * pageSize) + 1
      : 0;

  const expectedEnd = Math.min(page * pageSize, total);
  const movementFilter = getSelectedMovementType();

  const end =
    movementFilter !== 'TODOS' &&
      visibleRowsCount < pageSize
      ? start + Math.max(visibleRowsCount - 1, 0)
      : expectedEnd;

  setText(
    'apTableInfo',
    `${total} registros`,
  );

  setText(
    'infoPagina',
    `Página ${page} de ${pages}`,
  );

  const previousButton = document.getElementById('pagAnterior');
  const nextButton = document.getElementById('pagProxima');

  if (previousButton) {
    previousButton.disabled = page <= 1;
  }

  if (nextButton) {
    nextButton.disabled = page >= pages;
  }
}

export function renderReport(payload = {}, state = {}) {
  const sourceRows = Array.isArray(payload.rows)
    ? payload.rows
    : [];

  const viewMode = String(
    payload.filters?.viewMode ||
    payload.filters?.view_mode ||
    '',
  )
    .trim()
    .toLowerCase();

  const isTotal =
    viewMode === 'total' ||
    viewMode === 'sum';

  const visibleRows = filterRowsByMovement(
    sourceRows,
    isTotal,
  );

  renderHeaders(isTotal);
  renderRows(visibleRows, isTotal);
  renderSummary(payload.summary || {});
  renderPagination(state, visibleRows.length);
}

export function showMessage(
  message = '',
  isError = false,
) {
  const element = document.getElementById('csMessage');

  if (!element) return;

  element.textContent = String(message || '');

  element.classList.toggle(
    'error',
    Boolean(isError),
  );
}
