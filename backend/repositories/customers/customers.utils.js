// ╔════════════════════════════════════════════════════════════════════╗
// ║ customers.utils.js — Helpers puros (sem acesso ao banco)           ║
// ╚════════════════════════════════════════════════════════════════════╝

import { CUSTOMER_ORDER_EXPRESSIONS } from './customers.constants.js';

export const isFiniteNum = (v) => Number.isFinite(Number(v));
export const toNumOrNull = (v) => (isFiniteNum(v) ? Number(v) : null);
export const trimOrNull = (v) => (v ?? '').toString().trim() || null;
export const onlyDigits = (v) => (v ?? '').toString().replace(/\D+/g, '') || null;

export function resolveCustomerOrder(orderBy, order) {
  const key = String(orderBy ?? '').trim();

  return {
    expression:
      CUSTOMER_ORDER_EXPRESSIONS[key] ??
      CUSTOMER_ORDER_EXPRESSIONS.trade_name,
    direction: String(order ?? '').trim().toLowerCase() === 'desc'
      ? 'DESC'
      : 'ASC',
  };
}

export function asBoolOrNull(v) {
  if (typeof v === 'boolean') return v;
  if (v === 'true' || v === '1' || v === 1) return true;
  if (v === 'false' || v === '0' || v === 0) return false;
  return null;
}

export function normalizeCustomerType(value) {
  const v = String(value ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase();

  if (
    v === 'F' ||
    v === 'PF' ||
    v === 'FISICA' ||
    v === 'PESSOA FISICA'
  ) {
    return 'F';
  }

  return 'J';
}
