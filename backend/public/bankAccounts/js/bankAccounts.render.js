'use strict';
import { $ } from './bankAccounts.utils.js';
import { state } from './bankAccounts.state.js';
const LABELS = { ASAAS: 'Asaas', MANUAL: 'Manual', OTHER_API: 'Outra API', AUTOMATIC: 'Automático', NONE: 'Sem boleto' };
export function renderBankAccounts(items, handlers) {
  const tbody = $('#bankAccountsTableBody'); tbody.replaceChildren();
  const total = items.length;
  state.totalPages = Math.max(1, Math.ceil(total / state.pageSize));
  state.page = Math.min(Math.max(1, state.page), state.totalPages);
  const start = (state.page - 1) * state.pageSize;
  const visibleItems = items.slice(start, start + state.pageSize);
  if (!visibleItems.length) { const row = tbody.insertRow(); const cell = row.insertCell(); cell.colSpan = 10; cell.textContent = 'Nenhuma conta bancária encontrada.'; }
  for (const item of visibleItems) {
    const row = tbody.insertRow(); const account = [item.account_number, item.account_digit].filter(Boolean).join('-') || '—';
    [item.id, item.name, item.bank_name, item.agency || '—', account, LABELS[item.integration_provider] || item.integration_provider, LABELS[item.boleto_mode] || item.boleto_mode, item.is_default ? 'SIM' : 'NÃO', item.is_active ? 'ATIVA' : 'INATIVA'].forEach((value) => { const cell = row.insertCell(); cell.textContent = value; });
    const actions = row.insertCell(); const edit = document.createElement('button'); edit.type = 'button'; edit.className = 'btn btn-toolbar btn-sm'; edit.textContent = '✏️ Editar'; edit.addEventListener('click', () => handlers.edit(item)); actions.append(edit);
    if (item.is_active) { const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'btn btn-toolbar btn-sm'; remove.textContent = '🗑 Desativar'; remove.addEventListener('click', () => handlers.remove(item)); actions.append(remove); }
  }
  $('#apTableInfo').textContent = `${total} ${total === 1 ? 'registro' : 'registros'}`;
  $('#apPageInfo').textContent = `Página ${state.page} de ${state.totalPages}`;
  $('#btnPreviousPage').disabled = state.page <= 1;
  $('#btnNextPage').disabled = state.page >= state.totalPages;
  $('#apRowsPerPage').value = String(state.pageSize);
}
