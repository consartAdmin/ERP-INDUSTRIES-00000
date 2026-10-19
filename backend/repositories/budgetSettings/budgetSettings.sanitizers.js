// ╔══════════════════════════════════════════════════════════════════════╗
// ║ budgetSettings.sanitizers.js — Normalização / validação de entrada   ║
// ║ normalizeMode / resolveMode / resolveMaxDiscount / resolveBoolean    ║
// ╚══════════════════════════════════════════════════════════════════════╝

import {
  OUT_OF_STOCK_MODES,
  MAX_DISCOUNT_PERCENT_RANGE,
  UPDATED_BY_MAX_LENGTH,
  DEFAULTS,
} from './budgetSettings.catalog.js';
import { VALID_MODES } from './budgetSettings.constants.js';
import { httpError } from './budgetSettings.utils.js';

export function normalizeMode(settings = {}) {
  const mode = String(settings.out_of_stock_mode || '')
    .trim()
    .toUpperCase();

  if (VALID_MODES.has(mode)) return mode;

  // Compatibilidade com registros antigos que ainda não tinham o modo.
  return settings.allow_out_of_stock === true ? 'PASSWORD' : DEFAULTS.out_of_stock_mode;
}

// Resolve o modo a gravar: valor explícito > flag legada > valor atual.
export function resolveMode(settings, current) {
  const raw = settings.out_of_stock_mode;

  if (raw !== undefined && raw !== null && String(raw).trim() !== '') {
    const mode = String(raw).trim().toUpperCase();
    if (!VALID_MODES.has(mode)) {
      throw httpError(
        `Modo de estoque inválido. Use: ${OUT_OF_STOCK_MODES.join(', ')}.`,
        'INVALID_OUT_OF_STOCK_MODE',
      );
    }
    return mode;
  }

  if (typeof settings.allow_out_of_stock === 'boolean') {
    return normalizeMode({ allow_out_of_stock: settings.allow_out_of_stock });
  }

  return current.out_of_stock_mode;
}

export function resolveMaxDiscount(settings, current) {
  const value = settings.max_discount_percent ?? current.max_discount_percent;
  const maxDiscount = Number(value);
  const { min, max } = MAX_DISCOUNT_PERCENT_RANGE;

  if (value === '' || !Number.isFinite(maxDiscount) || maxDiscount < min || maxDiscount > max) {
    throw httpError(
      `O desconto máximo deve estar entre ${min}% e ${max}%.`,
      'INVALID_MAX_DISCOUNT_PERCENT',
    );
  }

  // numeric(5,2)
  return Math.round(maxDiscount * 100) / 100;
}

export function resolveBoolean(settings, current, key) {
  return typeof settings[key] === 'boolean' ? settings[key] : current[key];
}

export function normalizeUpdatedBy(updatedBy) {
  if (updatedBy === undefined || updatedBy === null) return null;
  const value = String(updatedBy).trim();
  return value ? value.slice(0, UPDATED_BY_MAX_LENGTH) : null;
}
