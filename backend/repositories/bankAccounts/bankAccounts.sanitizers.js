// ╔════════════════════════════════════════════════════════════════════╗
// ║ bankAccounts.sanitizers.js — Validação/normalização de entrada     ║
// ╚════════════════════════════════════════════════════════════════════╝

import { PROVIDERS, BOLETO_MODES } from './bankAccounts.constants.js';

export function positiveId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export function optionalText(value, maxLength) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text ? text.slice(0, maxLength) : null;
}

export function enumValue(value, allowed, fallback, label) {
  const normalized = String(value || fallback).trim().toUpperCase();
  if (!allowed.has(normalized)) {
    throw Object.assign(new Error(`${label} inválido.`), { statusCode: 400 });
  }
  return normalized;
}

export function normalizedPayload(data, current = {}) {
  const bankId = data.bank_id === undefined ? positiveId(current.bank_id) : positiveId(data.bank_id);
  const name = data.name === undefined ? current.name : optionalText(data.name, 150);
  if (!bankId) throw Object.assign(new Error('Selecione um banco.'), { statusCode: 400 });
  if (!name) throw Object.assign(new Error('Informe o nome da conta bancária.'), { statusCode: 400 });

  return {
    bankId,
    name,
    agency: data.agency === undefined ? current.agency ?? null : optionalText(data.agency, 30),
    accountNumber: data.account_number === undefined ? current.account_number ?? null : optionalText(data.account_number, 50),
    accountDigit: data.account_digit === undefined ? current.account_digit ?? null : optionalText(data.account_digit, 10),
    provider: enumValue(data.integration_provider ?? current.integration_provider, PROVIDERS, 'MANUAL', 'Provedor'),
    boletoMode: enumValue(data.boleto_mode ?? current.boleto_mode, BOLETO_MODES, 'MANUAL', 'Modo do boleto'),
    isDefault: data.is_default === undefined ? Boolean(current.is_default) : Boolean(data.is_default),
    isActive: data.is_active === undefined ? current.is_active !== false : Boolean(data.is_active),
  };
}
