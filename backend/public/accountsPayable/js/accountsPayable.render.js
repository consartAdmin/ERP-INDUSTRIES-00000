'use strict';

import { state } from './accountsPayable.state.js';
import { formatDate, formatMoney, qs } from './accountsPayable.utils.js';
import { getAttachmentDownloadUrl } from './accountsPayable.api.js';

export function renderStatusTag(status) {
  const map = {
    PAID: ['Pago', 'ap-tag--paid'],
    OVERDUE: ['Vencido', 'ap-tag--overdue'],
    CANCELLED: ['Cancelado', 'ap-tag--cancelled'],
    PENDING: ['Pendente', 'ap-tag--pending'],
  };
  const [label, cssClass] = map[String(status || 'PENDING').toUpperCase()] || map.PENDING;
  return `<span class="ap-tag ${cssClass}">${label}</span>`;
}

export function renderTable(rows) {
  const body = qs('#apTableBody');
  if (!body) return;
  body.replaceChildren();
  let titles = 0;
  let paid = 0;
  let balance = 0;

  if (!rows.length) {
    const row = body.insertRow();
    const cell = row.insertCell();
    cell.colSpan = 11;
    cell.className = 'table-empty';
    cell.textContent = 'Nenhum registro encontrado.';
  }

  rows.forEach((item) => {
    const total = Number(item.total_value || 0);
    const amountPaid = Number(item.amount_paid || 0);
    const open = item.balance != null ? Number(item.balance) : total - amountPaid;
    titles += total;
    paid += amountPaid;
    balance += open;
    const row = body.insertRow();
    row.dataset.id = item.id;
    const canPay = !['PAID', 'CANCELLED']
      .includes(String(item.status || 'PENDING').toUpperCase());
    row.innerHTML = `
      <td>${item.id}</td>
      <td>${item.supplier_id ?? ''}</td>
      <td>${item.supplier_name ?? ''}</td>
      <td>${item.invoice_number ?? ''}</td>
      <td>${formatDate(item.issue_date)}</td>
      <td>${formatDate(item.due_date)}</td>
      <td>${renderStatusTag(item.status)}</td>
      <td>${formatMoney(total)}</td>
      <td>${formatMoney(amountPaid)}</td>
      <td>${formatMoney(open)}</td>
      <td class="ap-col-actions"><div class="ap-actions">
        ${canPay ? '<button type="button" class="ap-btn-pay" data-action="pay" title="Pagar">💰</button>' : ''}
        <button type="button" class="btn btn-sm btn-secondary" data-action="edit" title="Editar">✏️</button>
        <button type="button" class="btn btn-sm btn-danger" data-action="delete" title="Excluir">🗑️</button>
      </div></td>`;
  });

  const label = qs('#apTotalLabel');
  const totalEl = qs('#apTotalTitulos');
  const paidEl = qs('#apTotalPago');
  const balanceEl = qs('#apSaldoAberto');
  if (label) label.textContent = `${state.total} registro${state.total === 1 ? '' : 's'}`;
  if (totalEl) totalEl.textContent = `Total ${formatMoney(titles)}`;
  if (paidEl) paidEl.textContent = `Pago ${formatMoney(paid)}`;
  if (balanceEl) balanceEl.textContent = `Em Aberto ${formatMoney(balance)}`;
}

export function renderPagination() {
  const pages = Math.max(1, Math.ceil(state.total / state.pageSize));
  state.page = Math.min(Math.max(1, state.page), pages);
  const pageInfo = qs('#apPageInfo');
  const tableInfo = qs('#apTableInfo');
  const previous = qs('#btnPreviousPage');
  const next = qs('#btnNextPage');
  if (pageInfo) pageInfo.textContent = `Página ${state.page} de ${pages}`;
  if (tableInfo) {
    tableInfo.textContent =
      `${state.total} registro${state.total === 1 ? '' : 's'} ${state.total === 1 ? '' : ''}`;
  }
  if (previous) previous.disabled = state.page <= 1;
  if (next) next.disabled = state.page >= pages;
}

export function renderAttachments(attachments) {
  const box = qs('#pay_attachmentsBox');
  if (!box) return;
  box.replaceChildren();
  attachments.forEach((attachment) => {
    const attachmentId = attachment.id ?? attachment.attachment_id ?? attachment.anexo_id;
    const accountPayableId = attachment.account_payable_id;
    const name = attachment.file_name || attachment.original_name || attachment.filename ||
      attachment.nome || attachment.name || 'Arquivo';
    const type = String(attachment.file_type || attachment.document_type ||
      attachment.tipo || 'OUTRO').toUpperCase();
    const icon = type === 'XML' ? '📄' : type === 'IMAGE' ? '🖼️' : '📕';
    const card = document.createElement('article');
    card.className = 'modal-attachment-card';
    card.setAttribute('role', 'listitem');
    card.style.cssText = 'box-sizing:border-box;position:relative;display:flex;flex-direction:column;align-items:flex-start;min-width:0;height:100px;padding:10px;margin:0;overflow:hidden;background:#fff;border:1px solid #d1d5db;border-radius:8px;';
    const iconBox = document.createElement('div');
    iconBox.className = 'modal-attachment-card__icon';
    iconBox.textContent = icon;
    iconBox.style.cssText = 'display:block!important;flex:0 0 auto!important;width:auto!important;min-width:0!important;height:15px!important;min-height:15px!important;padding:0!important;margin:0 0 3px 0!important;background:transparent!important;border:0!important;font-size:15px!important;line-height:15px!important;';
    const content = document.createElement('div');
    content.className = 'modal-attachment-card__content';
    content.style.cssText = 'display:block!important;flex:0 0 auto!important;width:100%!important;min-width:0!important;height:27px!important;min-height:27px!important;margin:0!important;padding:0!important;overflow:hidden!important;';
    const strong = document.createElement('strong');
    strong.className = 'modal-attachment-card__type';
    strong.textContent = type;
    strong.style.cssText = 'display:block!important;height:13px!important;margin:0!important;padding:0!important;overflow:hidden!important;font-size:11px!important;line-height:13px!important;';
    const span = document.createElement('span');
    span.className = 'modal-attachment-card__name';
    span.textContent = name;
    span.title = name;
    span.style.cssText = 'display:block!important;width:100%!important;height:12px!important;margin:1px 0 0 0!important;padding:0!important;overflow:hidden!important;font-size:10px!important;line-height:12px!important;text-overflow:ellipsis!important;white-space:nowrap!important;';
    content.append(strong, span);
    card.append(iconBox, content);
    if (attachmentId && accountPayableId) {
      const button = document.createElement('button');
      Object.assign(button, {
        className: 'modal-attachment-card__open',
        type: 'button',
        textContent: 'Abrir',
      });
      button.title = `Abrir ${name}`;
      button.style.cssText = 'position:static!important;display:inline-flex!important;flex:0 0 auto!important;align-items:center!important;justify-content:center!important;box-sizing:border-box!important;width:100%!important;height:21px!important;min-height:21px!important;padding:2px 7px!important;margin:auto 0 0 0!important;color:#1d4ed8!important;font-size:10px!important;line-height:15px!important;text-decoration:none!important;background:#eff6ff!important;border:1px solid #bfdbfe!important;border-radius:5px!important;';
      button.addEventListener('click', async () => {
        const previewWindow = window.open('', '_blank');
        if (previewWindow) previewWindow.opener = null;
        try {
          const url = await getAttachmentDownloadUrl(accountPayableId, attachmentId);
          if (previewWindow) previewWindow.location.replace(url);
          else window.open(url, '_blank', 'noopener,noreferrer');
        } catch (error) {
          if (previewWindow) previewWindow.close();
          console.error('[accountsPayable] open attachment:', error);
          alert(error?.message || 'Erro ao abrir anexo.');
        }
      });
      card.appendChild(button);
    }
    box.appendChild(card);
  });
}
