// ╔══════════════════════════════════════════════════════════════════════╗
// ║ productsFiscalV2.sanitizers.js — validação de entrada                ║
// ║ badRequest, boolean, paginação e payload do upsert                   ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { validateProductFiscalPayload } from './productsFiscalV2.catalog.js';

export function badRequest(message, errors = []) {
  return Object.assign(new Error(message), { status: 400, errors });
}

export function parseBoolean(value, fieldName) {
  if (value === true || value === false) return value;
  if (value === 'true' || value === '1' || value === 1) return true;
  if (value === 'false' || value === '0' || value === 0) return false;
  throw badRequest(`${fieldName} deve ser booleano.`);
}

export function normalizePagination(limit, offset, defaultLimit) {
  const parsedLimit = Number.parseInt(limit, 10);
  const parsedOffset = Number.parseInt(offset, 10);

  return {
    limit: Number.isFinite(parsedLimit)
      ? Math.min(Math.max(parsedLimit, 1), 500)
      : defaultLimit,
    offset: Number.isFinite(parsedOffset)
      ? Math.max(parsedOffset, 0)
      : 0,
  };
}

// Valida o payload do upsert contra o catálogo (campos obrigatórios e
// check constraints). extra_payload nulo é permitido aqui: no upsert ele
// significa "manter o atual" ou "usar o padrão '{}'".
export function assertValidUpsertPayload(payload = {}) {
  const productCode = String(payload?.product_code ?? '').trim();

  const data = {
    product_code: productCode,
    fiscal_classification_id: payload?.fiscal_classification_id,
  };

  if (payload?.extra_payload !== undefined && payload.extra_payload !== null) {
    data.extra_payload = payload.extra_payload;
  }

  const validation = validateProductFiscalPayload(data);

  if (!validation.valid) {
    throw badRequest('Payload de vínculo fiscal inválido.', validation.errors);
  }

  const fiscalClassificationId = Number(data.fiscal_classification_id);
  if (!Number.isInteger(fiscalClassificationId) || fiscalClassificationId <= 0) {
    throw badRequest('fiscal_classification_id deve ser um inteiro maior que zero.', [
      {
        field: 'fiscal_classification_id',
        message: 'fiscal_classification_id deve ser um inteiro maior que zero.',
      },
    ]);
  }

  return {
    ...payload,
    product_code: productCode,
    fiscal_classification_id: fiscalClassificationId,
  };
}
