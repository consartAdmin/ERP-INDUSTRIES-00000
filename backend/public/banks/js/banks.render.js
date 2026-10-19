'use strict';
import { $ } from './banks.utils.js';
import { state } from './banks.state.js';
export function renderBanks(items, handlers) {
  const tbody = $('#banksTableBody'); tbody.replaceChildren();
  const total = items.length;
  state.totalPages = Math.max(1, Math.ceil(total / state.pageSize));
  state.page = Math.min(Math.max(1, state.page), state.totalPages);
  const start = (state.page - 1) * state.pageSize;
  const visibleItems = items.slice(start, start + state.pageSize);
  if (!visibleItems.length) { const row = tbody.insertRow(); const cell = row.insertCell(); cell.colSpan = 5; cell.textContent = 'Nenhum banco encontrado.'; }
  for (const item of visibleItems) {
    const row = tbody.insertRow();
    [item.id, item.code || '—', item.name, item.is_active ? 'ATIVO' : 'INATIVO'].forEach((value) => { const cell = row.insertCell(); cell.textContent = value; });
    const actions = row.insertCell();
    const edit = document.createElement('button'); edit.type = 'button'; edit.className = 'btn btn-toolbar btn-sm'; edit.textContent = '✏️ Editar'; edit.addEventListener('click', () => handlers.edit(item)); actions.append(edit);
    if (item.is_active) { const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'btn btn-toolbar btn-sm'; remove.textContent = '🗑 Desativar'; remove.addEventListener('click', () => handlers.remove(item)); actions.append(remove); }
  }
  $('#apTableInfo').textContent = `${total} ${total === 1 ? 'registro' : 'registros'}`;
  $('#apPageInfo').textContent = `Página ${state.page} de ${state.totalPages}`;
  $('#btnPreviousPage').disabled = state.page <= 1;
  $('#btnNextPage').disabled = state.page >= state.totalPages;
  $('#apRowsPerPage').value = String(state.pageSize);
}
