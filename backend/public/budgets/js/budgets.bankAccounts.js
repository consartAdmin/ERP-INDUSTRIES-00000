// ╔══════════════════════════════════════════════════════════════════════╗
// ║ budgets.bankAccounts.js — Contas bancárias para os pagamentos       ║
// ║ PRODNEX ERP | Frontend (ESM)                                        ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { authHeaders, fetchSafe, handleAuthFail } from './budgets.infra.js';

const PROVIDER_LABELS = Object.freeze({
  ASAAS: 'Asaas (integrado)',
  MANUAL: 'Outro banco (boleto manual)',
  OTHER_API: 'Outro banco (API)',
  NO_INTEGRATION: 'Sem integração',
});

let cache = null;

function apiBase() {
  return (window.apiBase || window.API_BASE || window.location.origin)
    .replace(/\/$/, '');
}

function normalizeProvider(value, fallback = 'NO_INTEGRATION') {
  const provider = String(value || fallback).trim().toUpperCase();
  return PROVIDER_LABELS[provider] ? provider : fallback;
}

function normalizeAccount(row = {}) {
  return {
    id: row.id ?? row.bank_account_id ?? null,
    name: String(row.name ?? row.account_name ?? '').trim(),
    bank_name: String(row.bank_name ?? '').trim(),
    agency: String(row.agency ?? '').trim(),
    account_number: String(row.account_number ?? '').trim(),
    account_digit: String(row.account_digit ?? '').trim(),
    integration_provider: normalizeProvider(row.integration_provider),
    boleto_mode: String(row.boleto_mode || 'NONE').trim().toUpperCase(),
    is_default: Boolean(row.is_default),
    is_active: row.is_active !== false,
  };
}

export async function loadActiveBankAccounts(force = false) {
  if (!force && Array.isArray(cache)) return cache;

  const out = await fetchSafe(`${apiBase()}/api/bank-accounts?active=true`, {
    method: 'GET',
    headers: authHeaders(),
  });

  if (!out.ok) {
    if (handleAuthFail(out.status, out.text)) return [];
    throw new Error(
      out?.json?.message || out?.text ||
      'Falha ao carregar as contas bancárias.'
    );
  }

  const json = out.json || {};
  const rows = json.data || json.rows || json.items || (Array.isArray(json) ? json : []);

  cache = (Array.isArray(rows) ? rows : [])
    .map(normalizeAccount)
    .filter((row) => row.id != null && row.is_active)
    .sort((a, b) => {
      if (a.is_default !== b.is_default) return a.is_default ? -1 : 1;
      return `${a.bank_name} ${a.name}`.localeCompare(
        `${b.bank_name} ${b.name}`,
        'pt-BR'
      );
    });

  return cache;
}

export function getBankAccounts() {
  return Array.isArray(cache) ? cache : [];
}

export function findBankAccount(id) {
  const normalizedId = String(id ?? '').trim();
  if (!normalizedId) return null;
  return getBankAccounts().find((row) => String(row.id) === normalizedId) || null;
}

export function findDefaultBankAccount(provider = null) {
  const normalizedProvider = provider ? normalizeProvider(provider) : null;
  const rows = normalizedProvider
    ? getBankAccounts().filter((row) => row.integration_provider === normalizedProvider)
    : getBankAccounts();
  return rows.find((row) => row.is_default) || rows[0] || null;
}

export function getProviderLabel(provider) {
  return PROVIDER_LABELS[normalizeProvider(provider)] || PROVIDER_LABELS.NO_INTEGRATION;
}

export function getBankAccountLabel(account) {
  if (!account) return '';
  const number = [account.account_number, account.account_digit]
    .filter(Boolean)
    .join('-');
  const details = [account.bank_name, account.agency && `Ag. ${account.agency}`, number]
    .filter(Boolean)
    .join(' • ');
  return [account.is_default ? '★' : '', account.name, details && `— ${details}`]
    .filter(Boolean)
    .join(' ');
}

export function clearBankAccountsCache() {
  cache = null;
}

export default {
  loadActiveBankAccounts,
  getBankAccounts,
  findBankAccount,
  findDefaultBankAccount,
  getProviderLabel,
  getBankAccountLabel,
  clearBankAccountsCache,
};
