// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: taxRegimes.render.js                                          ║
// ║ MODULE: Regime Tributário — Rendering                               ║
// ║ PRODNEX ERP                                                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function formatMoney(value) {
  return money.format(Number(value) || 0);
}

export function formatPct(value, digits = 2) {
  return value == null || value === ''
    ? '-'
    : `${Number(value).toLocaleString('pt-BR', { maximumFractionDigits: digits })}%`;
}

export function formatDate(value) {
  if (!value) return '';
  const [year, month, day] = String(value).slice(0, 10).split('-');
  return `${day}/${month}/${year}`;
}

function createCell(content) {
  const cell = document.createElement('td');

  if (content instanceof Node) {
    cell.appendChild(content);
  } else {
    cell.textContent = content ?? '';
  }

  return cell;
}

function createButton(text, onClick) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'btn btn-new btn-sm';
  button.textContent = text;
  button.addEventListener('click', onClick);
  return button;
}

function describeParams(row) {
  switch (row.regime) {
    case 'SIMPLES':
    case 'SIMPLES_EXCESSO':
      return `Anexo ${row.simples_annex || '-'}` +
        (row.rbt12 ? ` · RBT12 ${formatMoney(row.rbt12)}` : ' · RBT12 pelas notas');
    case 'MEI':
      return `DAS ${formatMoney(row.mei_monthly_das)} / mês`;
    case 'PRESUMIDO':
      return `IRPJ ${formatPct(row.irpj_presumption_pct)} × ${formatPct(row.irpj_rate)} · ` +
        `CSLL ${formatPct(row.csll_presumption_pct)} × ${formatPct(row.csll_rate)} · ` +
        `PIS ${formatPct(row.pis_rate)} · COFINS ${formatPct(row.cofins_rate)}`;
    case 'REAL':
      return `Margem ${formatPct(row.estimated_profit_margin_pct)} · ` +
        `PIS ${formatPct(row.pis_rate)} · COFINS ${formatPct(row.cofins_rate)}`;
    default:
      return '';
  }
}

export function renderTable(tbody, rows, { onEdit, onToggle }) {
  tbody.innerHTML = '';

  if (!rows.length) {
    const row = document.createElement('tr');
    const cell = createCell('Nenhum regime cadastrado. Clique em "+ Novo Regime".');
    cell.colSpan = 7;
    row.appendChild(cell);
    tbody.appendChild(row);
    return;
  }

  const fragment = document.createDocumentFragment();

  rows.forEach((item) => {
    const row = document.createElement('tr');

    const badge = document.createElement('span');
    badge.className = `tr-badge${item.is_active ? '' : ' tr-badge--off'}`;
    badge.textContent = item.is_active ? 'Sim' : 'Não';

    const actions = document.createElement('td');
    actions.className = 'btn-inline btn-gap-3';
    actions.append(
      createButton('✏️', () => onEdit(item)),
      createButton(item.is_active ? 'Desativar' : 'Ativar', () => onToggle(item)),
    );

    const validity = `${formatDate(item.valid_from)} até ${item.valid_to ? formatDate(item.valid_to) : 'atual'}`;

    row.append(
      createCell(item.tax_regime_id),
      createCell(item.regime_label),
      createCell(item.crt),
      createCell(validity),
      createCell(describeParams(item)),
      createCell(badge),
      actions,
    );

    fragment.appendChild(row);
  });

  tbody.appendChild(fragment);
}

export function renderBrackets(tbody, annex, rbt12) {
  tbody.innerHTML = '';
  if (!annex?.brackets) return;

  const revenue = Number(rbt12) || 0;
  const currentIndex = revenue > 0
    ? annex.brackets.findIndex((bracket) => revenue <= bracket.limit)
    : -1;

  annex.brackets.forEach((bracket, index) => {
    const row = document.createElement('tr');
    const effectiveAtTop = ((bracket.limit * bracket.rate / 100) - bracket.deduction) / bracket.limit * 100;

    if (index === currentIndex) row.classList.add('is-current');

    row.append(
      createCell(`${index + 1}ª`),
      createCell(formatMoney(bracket.limit)),
      createCell(formatPct(bracket.rate)),
      createCell(formatMoney(bracket.deduction)),
      createCell(formatPct(effectiveAtTop)),
    );

    tbody.appendChild(row);
  });
}
