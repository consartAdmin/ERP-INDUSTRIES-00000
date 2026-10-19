// ╔════════════════════════════════════════════════════════════════════╗
// ║ customers.sanitizers.js — Normalização de payloads (create/update) ║
// ╚════════════════════════════════════════════════════════════════════╝

import {
  FIELDS,
  STRING_FIELDS,
  DELIVERY_FIELDS,
} from './customers.constants.js';
import {
  toNumOrNull,
  trimOrNull,
  onlyDigits,
  asBoolOrNull,
  normalizeCustomerType,
} from './customers.utils.js';

const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

/**
 * Normaliza um único campo de customers (usado por create e update).
 */
function sanitizeField(k, value) {
  let v = value;

  // Tipo de pessoa
  if (k === 'customer_type') {
    v = normalizeCustomerType(v);
  }

  // Strings
  if (STRING_FIELDS.includes(k)) {
    v = trimOrNull(v);
  }

  // CPF / CNPJ
  if (k === 'tax_id') {
    v = onlyDigits(v);
  }

  // Segmento
  if (k === 'segment_id') {
    v = toNumOrNull(v);
  }

  // Padrões financeiros (FKs) — vazio/0 → null
  if (
    k === 'default_chart_account_id' ||
    k === 'default_cash_category_id' ||
    k === 'default_cash_subcategory_id'
  ) {
    v = toNumOrNull(v) || null;
  }

  // Ativo
  if (k === 'is_active') {
    v = asBoolOrNull(v);
  }

  if (k === 'state' && v) {
    v = String(v)
      .trim()
      .toUpperCase()
      .slice(0, 2);
  }

  if (k === 'postal_code' && v) {
    v = onlyDigits(v)?.slice(0, 8) ?? null;
  }

  return v;
}

/* ──────────────────────────────────────────────────────────
   Sanitização — CREATE
────────────────────────────────────────────────────────── */

export function sanitizeCreate(input = {}) {
  const out = {};

  for (const k of FIELDS) {
    out[k] = sanitizeField(k, input[k]) ?? null;
  }

  if (!out.customer_type) {
    out.customer_type = 'J';
  }

  if (out.is_active == null) {
    out.is_active = true;
  }

  // Pessoa Física
  if (out.customer_type === 'F') {
    out.state_registration = null;
    out.municipal_registration = null;

    if (!out.legal_name && out.trade_name) {
      out.legal_name = out.trade_name;
    }

    if (!out.trade_name && out.legal_name) {
      out.trade_name = out.legal_name;
    }
  }

  return out;
}

/* ──────────────────────────────────────────────────────────
   Sanitização — UPDATE
────────────────────────────────────────────────────────── */

export function sanitizeUpdate(input = {}) {
  const out = {};

  for (const k of Object.keys(input || {})) {
    if (!FIELDS.includes(k)) continue;

    out[k] = sanitizeField(k, input[k]);
  }

  // Pessoa Física
  if (out.customer_type === 'F') {
    out.state_registration = null;
    out.municipal_registration = null;

    if (hasOwn(out, 'trade_name') && !out.legal_name) {
      out.legal_name = out.trade_name;
    }

    if (hasOwn(out, 'legal_name') && !out.trade_name) {
      out.trade_name = out.legal_name;
    }
  }

  return out;
}

/* ──────────────────────────────────────────────────────────
   Sanitização — ENDEREÇO DE ENTREGA
────────────────────────────────────────────────────────── */

export function hasDeliveryAddressPayload(input = {}) {
  return DELIVERY_FIELDS.some((field) => hasOwn(input, field));
}

export function sanitizeDeliveryAddress(input = {}) {
  const out = {};

  for (const field of DELIVERY_FIELDS) {
    if (!hasOwn(input, field)) continue;

    if (field === 'customer_ad_active') {
      const active = asBoolOrNull(input[field]);

      if (active == null) {
        throw new Error('customer_ad_active must be boolean');
      }

      out[field] = active;
      continue;
    }

    let value = trimOrNull(input[field]);

    if (field === 'customer_ad_state' && value) {
      value = value.toUpperCase();

      if (!/^[A-Z]{2}$/.test(value)) {
        throw new Error('customer_ad_state must contain 2 letters');
      }
    }

    out[field] = value;
  }

  return out;
}
