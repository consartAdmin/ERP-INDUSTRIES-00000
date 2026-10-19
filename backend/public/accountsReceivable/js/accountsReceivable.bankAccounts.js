// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ accountsReceivable.bankAccounts.js — Contas bancárias                   ║
// ║ Carrega public."bankAccounts" (uma única requisição) em:                 ║
// ║  • #filterBankAccount    → filtro "Conta Bancária"                        ║
// ║  • #arCashAccountId      → "Conta Caixa" do cadastro                      ║
// ║  • #receive_conta_caixa  → "Conta Caixa" do recebimento                   ║
// ╚══════════════════════════════════════════════════════════════════════════╝

'use strict';

import { listBankAccounts } from './accountsReceivable.api.js';
import { $ } from './accountsReceivable.utils.js';

const FILTER_SELECTOR = '#filterBankAccount';

// Selects de formulário: contas inativas aparecem desabilitadas,
// para que títulos antigos continuem exibindo (e preservando) o banco.
const FORM_SELECTS = [
  { selector: '#arCashAccountId', placeholder: 'Selecione...' },
  { selector: '#receive_conta_caixa', placeholder: 'Selecione...' },
];

function rowsFrom(response) {
  if (Array.isArray(response)) return response;

  for (const key of ['items', 'rows', 'data', 'bankAccounts']) {
    if (Array.isArray(response?.[key])) return response[key];
  }

  return [];
}

function validRows(rows) {
  // A API já entrega as ativas primeiro e em ordem alfabética.
  return rows.filter(
    (row) => row && row.id != null && String(row.name ?? '').trim()
  );
}

function optionLabel(row) {
  const name = String(row.name ?? '').trim();

  return row.is_active === false
    ? `${name} (inativa)`
    : name;
}

function keepSelection(select, selectedValue) {
  const stillExists = Array.from(select.options)
    .some((option) => option.value === selectedValue);

  select.value = stillExists ? selectedValue : '';
}

/* --------------------------------------------------------------------------
   Filtro "Conta Bancária"
-------------------------------------------------------------------------- */

function filterFixedOptions() {
  return [
    new Option('Todas', ''),
    new Option('Sem banco', 'NONE'),
  ];
}

function fillFilterSelect(select, rows) {
  if (!select) return;

  const selectedValue = String(select.value ?? '');

  select.replaceChildren(...filterFixedOptions());

  for (const row of rows) {
    select.add(new Option(optionLabel(row), String(row.id)));
  }

  keepSelection(select, selectedValue);
}

/* --------------------------------------------------------------------------
   "Conta Caixa" (cadastro e recebimento)
-------------------------------------------------------------------------- */

function fillFormSelect(select, rows, placeholder) {
  if (!select) return;

  const selectedValue = String(select.value ?? '');

  select.replaceChildren(new Option(placeholder, ''));

  for (const row of rows) {
    const option = new Option(optionLabel(row), String(row.id));

    // Não permite escolher conta inativa, mas mantém a opção
    // para exibir o valor de títulos antigos.
    option.disabled = row.is_active === false;

    if (row.is_default && row.is_active !== false) {
      option.textContent = `${option.textContent} ★`;
      option.title = 'Conta padrão';
    }

    select.add(option);
  }

  keepSelection(select, selectedValue);
}

/* --------------------------------------------------------------------------
   Inicialização
-------------------------------------------------------------------------- */

function showLoadError() {
  const filter = $(FILTER_SELECTOR);

  if (filter) {
    // "Todas" e "Sem banco" continuam funcionando mesmo com erro na API.
    filter.replaceChildren(...filterFixedOptions());
    filter.title = 'Não foi possível carregar as contas bancárias.';
  }

  for (const { selector } of FORM_SELECTS) {
    const select = $(selector);

    if (select) {
      select.replaceChildren(new Option('Erro ao carregar contas', ''));
    }
  }
}

export async function initBankAccountSelects() {
  let rows;

  try {
    rows = validRows(rowsFrom(await listBankAccounts()));
  } catch (error) {
    showLoadError();
    throw error;
  }

  fillFilterSelect($(FILTER_SELECTOR), rows);

  for (const { selector, placeholder } of FORM_SELECTS) {
    fillFormSelect($(selector), rows, placeholder);
  }
}

// Compatibilidade com o nome usado anteriormente no init.
export const initBankAccountFilter = initBankAccountSelects;
