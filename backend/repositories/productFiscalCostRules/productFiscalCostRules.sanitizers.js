// ╔══════════════════════════════════════════════════════════════════════╗
// ║ productFiscalCostRules.sanitizers.js — helpers de normalização       ║
// ║ clean, números, percentuais, CST, validações e normalize()           ║
// ╚══════════════════════════════════════════════════════════════════════╝

import PRODUCT_FISCAL_COST_RULES_SCHEMA from './productFiscalCostRules.catalog.js';

/* ========================================================================== */
/* Helpers                                                                    */
/* ========================================================================== */

export function clean(value) {
  if (value == null) return null;

  const text = String(value).trim();
  return text === '' ? null : text;
}

export function toNullableNumber(value) {
  if (value === '' || value == null) {
    return null;
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    return null;
  }

  return number;
}

export function toBoolean(value, defaultValue = true) {
  if (value == null || value === '') {
    return defaultValue;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value !== 0;
  }

  const normalized = String(value).trim().toLowerCase();

  if (
    normalized === 'true' ||
    normalized === '1' ||
    normalized === 'yes' ||
    normalized === 'sim' ||
    normalized === 's'
  ) {
    return true;
  }

  if (
    normalized === 'false' ||
    normalized === '0' ||
    normalized === 'no' ||
    normalized === 'não' ||
    normalized === 'nao' ||
    normalized === 'n'
  ) {
    return false;
  }

  return defaultValue;
}

export function round(value, decimals = 2) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return 0;
  }

  const factor = 10 ** decimals;
  return Math.round((number + Number.EPSILON) * factor) / factor;
}

export function normalizePercent(value, fallback = 0) {
  const number = toNullableNumber(value);
  return number == null ? fallback : number;
}

export function normalizeCalculationQuantity(value) {
  const quantity = toNullableNumber(value);

  if (quantity == null || quantity <= 0) {
    return 1;
  }

  return quantity;
}

export function normalizeUnitCost(value, fallback = null) {
  const direct = toNullableNumber(value);

  if (direct != null && direct >= 0) {
    return direct;
  }

  const fallbackValue = toNullableNumber(fallback);

  if (fallbackValue != null && fallbackValue >= 0) {
    return fallbackValue;
  }

  return null;
}

export function normalizeCst(value) {
  const raw = clean(value);
  if (!raw) return null;

  const digits = raw.replace(/\D+/g, '');
  if (!digits) return raw.toUpperCase();

  return digits.length >= 2
    ? digits.padStart(2, '0')
    : digits.padStart(2, '0');
}

export function assertPrepared(prepared) {
  if (prepared?.valid) return prepared.data;

  const message = (prepared?.errors || [])
    .map((error) => error.message)
    .filter(Boolean)
    .join(' ');

  throw new Error(
    message || 'Payload da regra de custo fiscal inválido.',
  );
}

export function assertReference(rule = {}) {
  const hasReference =
    PRODUCT_FISCAL_COST_RULES_SCHEMA.requiredReference
      .some((column) => {
        const value = rule[column];
        return value != null && String(value).trim() !== '';
      });

  if (!hasReference) {
    throw new Error(
      'Informe product_code, fiscal_classification_id ou fiscal_profile_id.',
    );
  }
}

/* ========================================================================== */
/* Internal normalize                                                         */
/* ========================================================================== */

export function normalize(input = {}) {
  return {
    product_code: clean(input.product_code),

    fiscal_classification_id: toNullableNumber(
      input.fiscal_classification_id,
    ),

    fiscal_profile_id: toNullableNumber(
      input.fiscal_profile_id,
    ),

    price_id: toNullableNumber(input.price_id),

    inbound_cst: clean(input.inbound_cst),

    icms_base_pct: toNullableNumber(
      input.icms_base_pct,
    ),

    icms_rate: toNullableNumber(
      input.icms_rate,
    ),

    mva_pct: toNullableNumber(
      input.mva_pct,
    ),

    icms_st_base_pct: toNullableNumber(
      input.icms_st_base_pct,
    ),

    icms_st_rate: toNullableNumber(
      input.icms_st_rate,
    ),

    icms_st_ret_base_pct: toNullableNumber(
      input.icms_st_ret_base_pct,
    ),

    icms_st_ret_rate: toNullableNumber(
      input.icms_st_ret_rate,
    ),

    ipi_rate: toNullableNumber(
      input.ipi_rate,
    ),

    pis_rate: toNullableNumber(
      input.pis_rate,
    ),

    cofins_rate: toNullableNumber(
      input.cofins_rate,
    ),

    calculation_mode:
      clean(input.calculation_mode) ||
      'PERCENTUAL',

    notes: clean(input.notes),

    is_active: toBoolean(
      input.is_active,
      true,
    ),

    user_id: toNullableNumber(
      input.user_id,
    ),
  };
}
