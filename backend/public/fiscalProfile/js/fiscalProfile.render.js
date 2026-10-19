// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: fiscalProfile.render.js                                       ║
// ║ MODULE: Fiscal Profile — Rendering                                  ║
// ║ PRODNEX ERP                                                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { dom, state } from './fiscalProfile.state.js';

function createCell(value) {
  const cell = document.createElement('td');
  cell.textContent = value ?? '';
  return cell;
}

function formatRate(value) {
  return value != null && value !== ''
    ? `${value}%`
    : '-';
}

function createActionButton({ text, className, onClick }) {
  const button = document.createElement('button');

  button.type = 'button';
  button.className = className;
  button.textContent = text;
  button.addEventListener('click', onClick);

  return button;
}

function setTableInfo(message) {
  if (dom.tableInfo) {
    dom.tableInfo.textContent = message;
  }
}

function setPageInfo(message) {
  if (dom.pageInfo) {
    dom.pageInfo.textContent = message;
  }
}

function setPaginationDisabled({ previous, next }) {
  if (dom.previousButton) {
    dom.previousButton.disabled = previous;
  }

  if (dom.nextButton) {
    dom.nextButton.disabled = next;
  }
}

export function renderTable(rows, { onEdit, onDelete }) {
  if (!dom.tableBody) return;

  dom.tableBody.innerHTML = '';

  if (!rows.length) {
    const row = document.createElement('tr');
    const cell = createCell('Nenhum perfil fiscal encontrado.');

    cell.colSpan = 8;
    row.appendChild(cell);
    dom.tableBody.appendChild(row);
    return;
  }

  const fragment = document.createDocumentFragment();

  rows.forEach((profile) => {
    const row = document.createElement('tr');

    const pisCofins =
      `PIS: ${profile.pis_cst || '-'} (${formatRate(profile.pis_rate)}) / ` +
      `COFINS: ${profile.cofins_cst || '-'} (${formatRate(profile.cofins_rate)})`;

    const actionsCell = document.createElement('td');
    actionsCell.className = 'btn-inline btn-gap-3';

    actionsCell.append(
      createActionButton({
        text: '✏️',
        className: 'btn btn-new btn-sm',
        onClick: () => onEdit(profile),
      }),
      createActionButton({
        text: 'Desativar',
        className: 'btn btn-new btn-sm',
        onClick: () => onDelete(profile),
      }),
    );

    row.append(
      createCell(profile.fiscal_profile_id),
      createCell(profile.profile_name || ''),
      createCell(
        `${profile.icms_cst || '-'} (${formatRate(profile.icms_rate)})`,
      ),
      createCell(pisCofins),
      createCell(
        `${profile.cfop_entry || '-'} / ${profile.cfop_exit || '-'}`,
      ),
      createCell(profile.origin_code ?? '-'),
      createCell(profile.is_active ? 'Sim' : 'Não'),
      actionsCell,
    );

    fragment.appendChild(row);
  });

  dom.tableBody.appendChild(fragment);
}

export function renderPagination() {
  const total = Math.max(0, Number(state.total) || 0);
  const pageSize = Math.max(1, Number(state.pageSize) || 1);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  if (state.page < 1) {
    state.page = 1;
  }

  if (state.page > totalPages) {
    state.page = totalPages;
  }

  const start = total === 0
    ? 0
    : (state.page - 1) * pageSize + 1;

  const end = Math.min(total, state.page * pageSize);
  const recordLabel = total === 1 ? 'registro' : 'registros';

  setTableInfo(
    `${start}–${end} de ${total} ${recordLabel}`,
  );

  setPageInfo(
    `Página ${state.page} de ${totalPages}`,
  );

  setPaginationDisabled({
    previous: state.page <= 1 || state.loading,
    next: state.page >= totalPages || state.loading,
  });
}

export function renderLoading() {
  setTableInfo('Carregando perfis fiscais...');
  setPageInfo('Página - de -');

  setPaginationDisabled({
    previous: true,
    next: true,
  });
}

export function renderListError() {
  setTableInfo('Erro ao carregar perfis fiscais.');
  setPageInfo('Página - de -');

  setPaginationDisabled({
    previous: true,
    next: true,
  });
}
