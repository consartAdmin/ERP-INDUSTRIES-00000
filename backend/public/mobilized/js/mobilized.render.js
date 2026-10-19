'use strict';

import { API_BASE } from './mobilized.config.js';
import { dom, state } from './mobilized.state.js';
import { computeItemsTotal, escapeHtml, formatBRL, formatNumber, imageCandidates, setImageWithFallback, toNumber } from './mobilized.utils.js';

let handlers = { select: () => { }, editItem: () => { }, deleteItem: () => { } };
export const configureRender = (next) => { handlers = { ...handlers, ...next }; };

function resolveTotal(row) {
  const total = row.items_total ?? row.total_items_value ?? row.total_value_sum ?? row.items_total_value;
  if (total != null && total !== '') return toNumber(total);
  return String(row.mobilized_id) === String(state.selectedId) ? state.selectedItemsTotal : null;
}
export function renderList() {
  if (!dom.list) return;
  dom.list.innerHTML = '';
  if (!state.rows.length) {
    dom.list.innerHTML = `
      <tr class="mz-list-empty">
        <td colspan="6" class="mz-muted mz-center">Nenhum registro encontrado.</td>
      </tr>
    `;
    if (dom.listMeta) dom.listMeta.textContent = '0 registros'; return;
  }
  state.rows.forEach((row) => {
    const tableRow = document.createElement('tr');
    tableRow.className = String(row.mobilized_id) === String(state.selectedId) ? 'is-active' : '';
    tableRow.dataset.id = row.mobilized_id;
    tableRow.dataset.mobilizedId = row.mobilized_id;
    tableRow.tabIndex = 0;
    tableRow.setAttribute('role', 'button');
    tableRow.setAttribute('aria-label', `Abrir mobilizado ${row.title || row.mobilized_id}`);

    const total = resolveTotal(row);
    const acquiredAt = row.acquired_at
      ? new Date(row.acquired_at).toLocaleString('pt-BR')
      : '-';
    const hasPdf = Boolean(String(row.pdf_path || '').trim());

    tableRow.innerHTML = `
      <td class="mz-col-date">${escapeHtml(acquiredAt)}</td>
      <td class="mz-col-title" title="${escapeHtml(row.title || '')}">
        ${escapeHtml(row.title || '(sem título)')}
      </td>
      <td class="mz-col-status">
        <span class="mz-status mz-status--${escapeHtml(String(row.status || '').toLowerCase())}">
          ${escapeHtml(row.status || '-')}
        </span>
      </td>
      <td class="mz-col-items">${escapeHtml(row.items_count ?? 0)}</td>
      <td class="mz-col-total">${total == null ? '—' : escapeHtml(formatBRL(total))}</td>
      <td class="mz-col-pdf">
        <button
          type="button"
          class="btn btn-sm mz-btn-pdf"
          ${hasPdf ? '' : 'disabled'}
          title="${hasPdf ? 'Abrir PDF' : 'PDF não disponível'}"
          aria-label="${hasPdf ? 'Abrir PDF do mobilizado' : 'PDF não disponível'}"
        >📄</button>
      </td>
    `;

    const select = () => handlers.select(row.mobilized_id);
    tableRow.addEventListener('click', select);
    tableRow.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        select();
      }
    });

    tableRow.querySelector('.mz-btn-pdf')?.addEventListener('click', (event) => {
      event.stopPropagation();
      if (!hasPdf) return;
      const path = String(row.pdf_path).trim();
      const url = /^https?:\/\//i.test(path)
        ? path
        : `${API_BASE}${path.startsWith('/') ? '' : '/'}${path}`;
      window.open(url, '_blank', 'noopener,noreferrer');
    });

    dom.list.append(tableRow);
  });
  if (dom.listMeta) dom.listMeta.textContent = `${state.total} registros • exibindo ${state.rows.length} • offset ${state.offset}`;
}
async function loadItemImage(image, item) {
  const attachment = state.attachments.find((entry) =>
    Number(entry.mobilized_item_id) === Number(item.mobilized_item_id) &&
    entry.is_primary &&
    entry.status === 'ACTIVE'
  );
  setImageWithFallback(image, attachment?.public_url ? [attachment.public_url] : imageCandidates(item.sku));
}
export function renderItems() {
  if (!dom.itemsBody) return;
  if (!state.selectedId || !state.items.length) {
    const message = state.selectedId ? 'Nenhum item. Clique em “Adicionar item”.' : 'Selecione um mobilizado para ver os itens.';
    dom.itemsBody.innerHTML = `<tr><td colspan="11" class="mz-muted mz-center">${message}</td></tr>`; return;
  }
  dom.itemsBody.innerHTML = '';
  state.items.forEach((item) => {
    const quantity = toNumber(item.quantity); const price = toNumber(item.unit_price);
    const total = item.total_value == null || item.total_value === '' ? quantity * price : toNumber(item.total_value);
    const row = document.createElement('tr');
    row.innerHTML = `<td><img class="mz-thumb" alt="Imagem do item"></td><td>${escapeHtml(item.sku || '')}</td>
      <td>${escapeHtml(item.description || '')}</td><td>${escapeHtml(item.model || '')}</td>
      <td>${escapeHtml(item.serial_number || '')}</td><td>${escapeHtml(item.nfe_ref || '')}</td>
      <td>${escapeHtml(formatNumber(quantity, 4))}</td><td>${escapeHtml(item.unit || '')}</td>
      <td>${escapeHtml(formatBRL(price))}</td><td>${escapeHtml(formatBRL(total))}</td>
      <td><button type="button" class="btn btn-sm" data-action="edit">Editar</button>
      <button type="button" class="btn btn-sm btn-danger" data-action="delete">Excluir</button></td>`;
    row.querySelector('[data-action="edit"]').addEventListener('click', () => handlers.editItem(item));
    row.querySelector('[data-action="delete"]').addEventListener('click', () => handlers.deleteItem(item.mobilized_item_id));
    loadItemImage(row.querySelector('img'), item); dom.itemsBody.append(row);
  });
}
export function renderTotals() {
  const total = computeItemsTotal(state.items); state.selectedItemsTotal = total;
  if (dom.kpiItemsCount) dom.kpiItemsCount.textContent = String(state.items.length);
  if (dom.kpiItemsTotal) dom.kpiItemsTotal.textContent = formatBRL(total);
  if (dom.itemsFootTotal) dom.itemsFootTotal.textContent = formatBRL(total);
  renderList();
}
