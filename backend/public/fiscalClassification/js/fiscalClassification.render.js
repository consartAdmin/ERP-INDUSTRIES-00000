// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: fiscalClassification.render.js                               ║
// ║ MODULE: Fiscal Classification — Render                             ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { getFiscalProfileName } from './fiscalClassification.profiles.js';
import { state } from './fiscalClassification.state.js';
import { $, $$ } from './fiscalClassification.utils.js';

export function activateTab(name) {
  $$('.tab').forEach((button) => {
    const isActive = button.dataset.tab === name;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-selected', String(isActive));
  });

  $$('.tab-panel').forEach((panel) => {
    const isActive = panel.id === `painel-${name}`;
    panel.classList.toggle('is-active', isActive);
    panel.hidden = !isActive;
  });
}

function appendTextBlock(cell, primary, secondary = '') {
  const main = document.createElement('div');
  main.textContent = primary || '-';
  cell.appendChild(main);

  if (secondary) {
    const detail = document.createElement('small');
    detail.className = 'muted';
    detail.textContent = secondary;
    cell.appendChild(detail);
  }
}

export function renderClassificationTable(rows, { onEdit, onDelete }) {
  const tableBody = $('#bodyTable');
  if (!tableBody) return;
  tableBody.innerHTML = '';

  if (!rows.length) {
    const row = tableBody.insertRow();
    const cell = row.insertCell();
    cell.colSpan = 9;
    cell.textContent = 'Nenhuma classificação encontrada.';
    return;
  }

  const actionsTemplate = $('#actionButtons')?.firstElementChild;

  rows.forEach((classification) => {
    const row = tableBody.insertRow();
    row.insertCell().textContent = classification.fiscal_classification_id ?? '';

    appendTextBlock(
      row.insertCell(),
      classification.classification_name,
      classification.description,
    );
    appendTextBlock(
      row.insertCell(),
      classification.ncm_code,
      classification.ncm_description,
    );
    appendTextBlock(
      row.insertCell(),
      classification.cest_code,
      classification.cest_description,
    );

    appendTextBlock(
      row.insertCell(),
      classification.ibscbs_cst,
      classification.ibscbs_classification,
    );
    appendTextBlock(
      row.insertCell(),
      classification.is_cst,
      classification.is_classification,
    );

    row.insertCell().textContent =
      getFiscalProfileName(classification.fiscal_profile_id);
    row.insertCell().textContent = classification.is_active ? 'Sim' : 'Não';

    const actionsCell = row.insertCell();
    actionsCell.className = 'col-actions';

    if (!actionsTemplate) {
      actionsCell.textContent = 'Ações indisponíveis';
      return;
    }

    const actions = actionsTemplate.cloneNode(true);
    actions.querySelector('.btn-edit')
      ?.addEventListener('click', () => onEdit(classification));
    actions.querySelector('.btn-delete')
      ?.addEventListener('click', () => onDelete(classification));
    actionsCell.appendChild(actions);
  });
}

export function renderPagination() {
  const apTableInfo = $('#apTableInfo');
  const previousButton = $('#btnPrev');
  const btnNext = $('#btnNext');
  const totalPages = Math.max(1, Math.ceil(state.total / state.pageSize));

  if (state.page > totalPages) state.page = totalPages;

  const start =
    state.total === 0 ? 0 : (state.page - 1) * state.pageSize + 1;
  const end = Math.min(state.total, state.page * state.pageSize);

  if (apTableInfo) {
    apTableInfo.textContent =
      ` ${start}–${end}  ${state.total} Registros`;
  }
  if (previousButton) previousButton.disabled = state.page <= 1;
  if (btnNext) btnNext.disabled = state.page >= totalPages;
}

export function renderListLoading() {
  const pageInfo = $('#paginacaoInfo');
  if (pageInfo) pageInfo.textContent = 'Carregando...';
}

export function renderListError() {
  const pageInfo = $('#paginacaoInfo');
  if (pageInfo) {
    pageInfo.textContent = 'Erro ao carregar classificações fiscais.';
  }
}
