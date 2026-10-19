// ╔══════════════════════════════════════════════════════════════════════╗
// ║ cashMoviments.bankAccounts.js — Contas bancárias do Caixa          ║
// ║ PRODNEX ERP | Selects dinâmicos (/api/bank-accounts)                ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

const API_BASE = String(
  window.API_BASE ||
  window.apiBase ||
  window.location.origin
).replace(/\/$/, '');

const BANK_ACCOUNTS_ENDPOINT =
  `${API_BASE}/api/bank-accounts?active=true`;

const SELECT_IDS = Object.freeze({
  filter: '#filtroConta',
  create: '#contaCaixa',
  edit: '#edit_contaCaixa',
});

let bankAccountsCache = [];

/**
 * Converte diferentes formatos de resposta da API em array.
 */
function normalizeRows(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.rows)) return payload.rows;

  return [];
}

/**
 * Reduz a linha da API ao que os selects do Caixa precisam.
 */
function normalizeAccount(row = {}) {
  const id = Number.parseInt(row?.id, 10);

  return {
    id: Number.isInteger(id) && id > 0 ? id : null,
    name: String(row?.name ?? '').trim(),
    bank_name: String(row?.bank_name ?? '').trim(),
    is_default: Boolean(row?.is_default),
    is_active: row?.is_active !== false,
  };
}

/**
 * Renderiza as contas bancárias dentro de um select.
 */
export function populateBankAccountSelect(
  select,
  rows,
  {
    selectedValue = null,
    placeholder = 'Selecione...',
    placeholderDisabled = false,
  } = {}
) {
  if (!select) return;

  const previousValue =
    selectedValue !== null && selectedValue !== undefined
      ? String(selectedValue)
      : String(select.value || '');

  select.replaceChildren();

  const placeholderOption = document.createElement('option');
  placeholderOption.value = '';
  placeholderOption.textContent = placeholder;
  placeholderOption.disabled = placeholderDisabled;
  placeholderOption.selected = !previousValue;

  select.appendChild(placeholderOption);

  rows.forEach((row) => {
    if (!row.id || !row.name) return;

    const option = document.createElement('option');
    option.value = String(row.id);
    option.textContent = row.name;
    option.dataset.accountName = row.name;
    option.dataset.bankName = row.bank_name;

    if (String(row.id) === previousValue) {
      option.selected = true;
    }

    select.appendChild(option);
  });

  select.disabled = false;
}

/**
 * Busca no backend somente as contas bancárias ativas.
 */
export async function fetchBankAccounts({ force = false } = {}) {
  if (!force && bankAccountsCache.length) {
    return bankAccountsCache;
  }

  const response = await fetch(BANK_ACCOUNTS_ENDPOINT, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
    credentials: 'same-origin',
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok || payload?.ok === false) {
    throw new Error(
      payload?.message ||
      `Erro HTTP ${response.status} ao carregar contas bancárias.`
    );
  }

  bankAccountsCache = normalizeRows(payload)
    .map(normalizeAccount)
    .filter((row) => row.id && row.name && row.is_active)
    .sort((a, b) => {
      if (a.is_default !== b.is_default) return a.is_default ? -1 : 1;

      return a.name.localeCompare(
        b.name,
        'pt-BR',
        { sensitivity: 'base' }
      );
    });

  return bankAccountsCache;
}

/**
 * Carrega os selects de filtro, cadastro e edição.
 */
export async function loadBankAccountSelects({
  selectedFilterId = null,
  selectedCreateId = null,
  selectedEditId = null,
  force = false,
} = {}) {
  const filterSelect = document.querySelector(SELECT_IDS.filter);
  const createSelect = document.querySelector(SELECT_IDS.create);
  const editSelect = document.querySelector(SELECT_IDS.edit);

  const selects = [filterSelect, createSelect, editSelect];

  selects.forEach((select) => {
    if (!select) return;

    const previousValue = String(select.value || '');

    select.disabled = true;
    select.replaceChildren();

    const option = document.createElement('option');
    option.value = previousValue;
    option.textContent = 'Carregando...';
    option.selected = true;

    select.appendChild(option);
  });

  try {
    const rows = await fetchBankAccounts({ force });

    populateBankAccountSelect(filterSelect, rows, {
      selectedValue: selectedFilterId,
      placeholder: 'Todas',
    });

    populateBankAccountSelect(createSelect, rows, {
      selectedValue: selectedCreateId,
      placeholderDisabled: true,
    });

    populateBankAccountSelect(editSelect, rows, {
      selectedValue: selectedEditId,
    });

    return rows;
  } catch (error) {
    console.error(
      '[cashMoviments.bankAccounts] Erro ao carregar contas:',
      error
    );

    selects.forEach((select) => {
      if (!select) return;

      select.disabled = false;
      select.replaceChildren();

      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'Erro ao carregar';
      option.selected = true;

      select.appendChild(option);
    });

    return [];
  }
}

/**
 * Contas já carregadas (sem nova requisição).
 */
export function getBankAccounts() {
  return bankAccountsCache;
}

/**
 * Localiza uma conta pelo id.
 */
export function findBankAccount(id) {
  const normalizedId = String(id ?? '').trim();
  if (!normalizedId) return null;

  return bankAccountsCache.find(
    (row) => String(row.id) === normalizedId
  ) || null;
}

/**
 * Localiza uma conta pelo nome (texto gravado em cash_account).
 */
export function findBankAccountByName(name) {
  const normalizedName = String(name ?? '').trim().toLowerCase();
  if (!normalizedName) return null;

  return bankAccountsCache.find(
    (row) => row.name.toLowerCase() === normalizedName
  ) || null;
}

export function clearBankAccountsCache() {
  bankAccountsCache = [];
}

export default {
  fetchBankAccounts,
  loadBankAccountSelects,
  populateBankAccountSelect,
  getBankAccounts,
  findBankAccount,
  findBankAccountByName,
  clearBankAccountsCache,
};
