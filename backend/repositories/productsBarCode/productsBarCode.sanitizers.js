// ╔══════════════════════════════════════════════════════════════════════╗
// ║ productsBarCode.sanitizers.js — normalização / validação de payload  ║
// ║ Barcode, tipos numéricos, boolean e payload de escrita               ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { PRODUCTS_BAR_CODE_TYPES, prepareProductsBarCodeInsert, prepareProductsBarCodeUpdate } from './productsBarCode.catalog.js';

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */
export function normalizeBarcode(raw) {
  const value = String(raw ?? '').trim();
  if (!value) return '';
  return value.replace(/\D+/g, '');
}

export function detectBarcodeType(raw) {
  const digits = normalizeBarcode(raw);

  if (/^\d{13}$/.test(digits)) return 'GTIN13';
  if (/^\d{14}$/.test(digits)) return 'GTIN14';

  return 'OTHER';
}

function toNumberOrNull(value) {
  if (value === '' || value === null || value === undefined) return null;

  const number = Number(String(value).replace(',', '.'));
  return Number.isFinite(number) ? number : null;
}

export function toPositiveIntegerOrNull(value) {
  const number = toNumberOrNull(value);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

export function toBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;

  const normalized = String(value).trim().toLowerCase();

  if (['true', '1', 'yes', 'sim', 's', 'on'].includes(normalized)) return true;
  if (['false', '0', 'no', 'nao', 'não', 'n', 'off'].includes(normalized)) return false;

  return fallback;
}

export function validationError(errors) {
  const error = new Error(
    errors.map(({ message }) => message).filter(Boolean).join('; ') ||
    'Invalid productsBarCode payload'
  );

  error.status = 400;
  error.code = 'INVALID_PRODUCTS_BARCODE_PAYLOAD';
  error.details = errors;
  return error;
}

export function normalizeWritePayload(payload = {}, { insert = false } = {}) {
  const prepared = insert
    ? prepareProductsBarCodeInsert(payload)
    : prepareProductsBarCodeUpdate(payload);

  if (!prepared.valid) throw validationError(prepared.errors);

  const data = { ...prepared.data };

  if (Object.prototype.hasOwnProperty.call(data, 'barcode')) {
    data.barcode = normalizeBarcode(data.barcode);
    if (!data.barcode) {
      throw validationError([{ field: 'barcode', message: 'barcode is required' }]);
    }
    data.barcode_type = detectBarcodeType(data.barcode);
  }

  if (Object.prototype.hasOwnProperty.call(data, 'barcode_type') && data.barcode_type) {
    data.barcode_type = String(data.barcode_type).trim().toUpperCase();
    if (!PRODUCTS_BAR_CODE_TYPES.includes(data.barcode_type)) {
      throw validationError([
        {
          field: 'barcode_type',
          message: `barcode_type must be one of: ${PRODUCTS_BAR_CODE_TYPES.join(', ')}`,
        },
      ]);
    }
  }

  for (const field of ['product_unit_id', 'unit_id']) {
    if (!Object.prototype.hasOwnProperty.call(data, field)) continue;
    data[field] = toPositiveIntegerOrNull(data[field]);
  }

  for (const field of ['fator', 'width_cm', 'length_cm', 'height_cm', 'weight_kg']) {
    if (!Object.prototype.hasOwnProperty.call(data, field)) continue;
    data[field] = toNumberOrNull(data[field]);
  }

  if (Object.prototype.hasOwnProperty.call(data, 'is_active')) {
    data.is_active = toBoolean(data.is_active, insert ? true : null);
  }

  if (Object.prototype.hasOwnProperty.call(data, 'standard')) {
    data.standard = toBoolean(data.standard, insert ? false : null);
  }

  return data;
}
