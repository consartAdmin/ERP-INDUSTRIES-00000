// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: productsFiscal.render.js                                      ║
// ║ MODULE: Products Fiscal — Render                                    ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { byId, $ } from './productsFiscal.utils.js';

const field = (label, value, className = '') =>
  `<div class="info-field ${className}"><span>${label}</span><strong>${value ?? '—'}</strong></div>`;

export function renderClassificationCard(classification) {
  const grid = $('#fc_grid');
  if (!grid) return;

  if (!classification) {
    grid.innerHTML = field('Classificação', '—');
    return;
  }

  grid.innerHTML = [
    field('ID', classification.fiscal_classification_id ?? classification.fiscal_class_id ?? classification.id, 'fld-id'),
    field('Nome / Descrição', classification.classification_name ?? classification.description ?? classification.ncm_description, 'fld-nome'),
    field('Perfil Fiscal (ID)', classification.fiscal_profile_id ?? classification.fiscal_profile?.id, 'fld-perfil'),
    field('NCM', classification.ncm ?? classification.ncm_code, 'fld-ncm'),
    field('Desc. NCM', classification.ncm_description, 'fld-descncm'),
    field('CEST', classification.cest ?? classification.cest_code, 'fld-cest'),
    field('Desc. CEST', classification.cest_description, 'fld-desccest'),
    field('CST IBS/CBS', classification.ibscbs_cst, 'fld-ibscbs-cst'),
    field('Classificação IBS/CBS', classification.ibscbs_classification, 'fld-ibscbs-class'),
    field('CST IS', classification.is_cst, 'fld-is-cst'),
    field('Classificação IS', classification.is_classification, 'fld-is-class'),
  ].join('');
}

export function renderProfileCard(profile) {
  const grid = $('#fp_grid');
  if (!grid) return;

  grid.classList.add('info-grid--profile');
  if (!profile) {
    grid.innerHTML = field('Perfil Fiscal', '—');
    return;
  }

  grid.innerHTML = [
    field('ID', profile.fiscal_profile_id ?? profile.id, 'fld-id'),
    field('Nome', profile.profile_name ?? profile.nome, 'fld-nome'),
    field('Descrição', profile.description ?? profile.descricao, 'fld-descricao'),
    field('ICMS CST', profile.icms_cst, 'fld-icmscst'),
    field('% ICMS', profile.icms_rate, 'fld-icms'),
    field('CFOP Entrada', profile.cfop_entry, 'fld-cfopent'),
    field('CFOP Saída', profile.cfop_exit, 'fld-cfopsaida'),
    field('Origem', profile.origin_code, 'fld-origem'),
    field('PIS CST', profile.pis_cst, 'fld-piscst'),
    field('% PIS', profile.pis_rate, 'fld-pispct'),
    field('COFINS CST', profile.cofins_cst, 'fld-cofcst'),
    field('% COFINS', profile.cofins_rate, 'fld-cofpct'),
    field('Cód. Benefício', profile.benefit_code, 'fld-codben'),
    field('Ativo?', profile.is_active === false ? 'Não' : 'Sim', 'fld-ativo'),
  ].join('');
}

export function renderProductsFiscalTable(rows) {
  const tableBody = byId('tableBody');
  if (!tableBody) return;

  tableBody.innerHTML = '';
  rows.forEach((row) => {
    const tableRow = document.createElement('tr');
    const cell = (value) => {
      const element = document.createElement('td');
      element.textContent = value ?? '';
      return element;
    };

    tableRow.append(
      cell(row.products_fiscal_id ?? row.id),
      cell(row.product_code ?? ''),
      cell(row.classification_name ?? ''),
      cell(row.ncm_code ?? ''),
      cell(row.cest_code ?? ''),
      cell(row.profile_name ?? ''),
      cell(`${row.icms_cst ?? '-'} / ${row.icms_rate ?? 0}%`),
      cell(row.is_current ? 'Sim' : 'Não'),
      cell(row.version ?? ''),
      cell(row.updated_at ? new Date(row.updated_at).toLocaleString('pt-BR') : ''),
    );
    tableBody.appendChild(tableRow);
  });
}

export function renderPageInfo(offset, limit, rowCount) {
  const pageInfo = byId('pageInfo');
  if (pageInfo) {
    pageInfo.textContent = `Página ${Math.floor(offset / limit) + 1}`;
  }
  const tableInfo = byId('apTableInfo');
  if (tableInfo) {
    const start = rowCount ? offset + 1 : 0;
    tableInfo.textContent = `${start}–${offset + rowCount} registro(s)`;
  }
  const previous = byId('prevPage');
  const next = byId('nextPage');
  if (previous) previous.disabled = offset <= 0;
  if (next) next.disabled = rowCount < limit;
}
