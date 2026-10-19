import { elements } from './manufacturers.config.js';
import { setPagination } from './manufacturers.state.js';
import { totalPages, valorOuVazio } from './manufacturers.utils.js';

function criarCelula(value) {
  const td = document.createElement('td');
  td.textContent = valorOuVazio(value);
  return td;
}

function criarBotao(texto, className, onClick) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.textContent = texto;
  button.addEventListener('click', onClick);
  return button;
}

export function renderTable(rows = [], handlers) {
  elements.tableBody.innerHTML = '';
  if (!rows.length) {
    const tr = document.createElement('tr');
    const td = criarCelula('Nenhum fabricante encontrado.');
    td.colSpan = 8;
    td.className = 'text-center text-muted';
    tr.appendChild(td);
    elements.tableBody.appendChild(tr);
    return;
  }

  rows.forEach((manufacturer) => {
    const tr = document.createElement('tr');
    const actions = document.createElement('td');
    actions.className = 'col-actions';
    actions.style.whiteSpace = 'nowrap';
    const edit = criarBotao('Editar', 'btn btn-toolbar btn-sm', () =>
      handlers.edit(manufacturer.manufacturer_id)
    );
    const remove = criarBotao('Excluir', 'btn btn-pastel-danger btn-sm', () =>
      handlers.remove(manufacturer.manufacturer_id, manufacturer.trade_name)
    );
    remove.style.marginLeft = '6px';
    actions.append(edit, remove);
    tr.append(
      criarCelula(manufacturer.manufacturer_id),
      criarCelula(manufacturer.trade_name),
      criarCelula(manufacturer.tax_id),
      criarCelula(manufacturer.city),
      criarCelula(manufacturer.state),
      criarCelula(manufacturer.phone),
      criarCelula(manufacturer.email),
      actions
    );
    elements.tableBody.appendChild(tr);
  });
}

export function updatePaginationControls(page, limit, total) {
  setPagination({ page, limit, total });
  const pages = totalPages(total, limit);
  if (elements.pageInfo) elements.pageInfo.textContent = `Page ${page} of ${pages}`;
  if (elements.tableInfo) {
    const shown = Math.min(total, page * limit);
    elements.tableInfo.textContent = `Showing ${shown} of ${total} manufacturers`;
  }
  if (elements.prevPageBtn) elements.prevPageBtn.disabled = page <= 1;
  if (elements.nextPageBtn) elements.nextPageBtn.disabled = page >= pages;
}
