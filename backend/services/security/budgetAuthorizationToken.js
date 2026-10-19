// ╔══════════════════════════════════════════════════════════════════════╗
// ║ budgetAuthorizationToken.js — Autorizações do módulo de Orçamentos ║
// ║ CONSART ERP | Node.js ESM | HMAC-SHA256                             ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import crypto from 'node:crypto';

export const BUDGET_AUTHORIZATION_TOKEN_TYPE = Object.freeze({
  STOCK_OVERRIDE: 'budget_stock_override',
});

const DEFAULT_TTL_MINUTES = 15;
const MAX_TTL_MINUTES = 24 * 60;

function cleanString(value, maxLength = 500) {
  return String(value ?? '').trim().slice(0, maxLength);
}

function normalizePositiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function normalizeNullableId(value) {
  if (value === null || value === undefined || String(value).trim() === '') {
    return null;
  }

  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

function normalizeTtlMinutes(value) {
  const number = Number(value ?? DEFAULT_TTL_MINUTES);

  if (!Number.isFinite(number) || number <= 0) {
    return DEFAULT_TTL_MINUTES;
  }

  return Math.min(number, MAX_TTL_MINUTES);
}

function getSigningSecret() {
  const secret = cleanString(
    process.env.BUDGET_STOCK_OVERRIDE_SECRET,
    4096,
  );

  if (!secret) {
    const error = new Error(
      'BUDGET_STOCK_OVERRIDE_SECRET não configurada no ambiente.',
    );
    error.code = 'BUDGET_AUTHORIZATION_SECRET_NOT_CONFIGURED';
    error.status = 500;
    throw error;
  }

  if (Buffer.byteLength(secret, 'utf8') < 32) {
    const error = new Error(
      'BUDGET_STOCK_OVERRIDE_SECRET deve possuir pelo menos 32 bytes.',
    );
    error.code = 'BUDGET_AUTHORIZATION_SECRET_TOO_SHORT';
    error.status = 500;
    throw error;
  }

  return secret;
}

function hmac(data) {
  return crypto
    .createHmac('sha256', getSigningSecret())
    .update(data)
    .digest('base64url');
}

function constantTimeEqual(left, right) {
  const leftDigest = crypto
    .createHash('sha256')
    .update(String(left ?? ''), 'utf8')
    .digest();

  const rightDigest = crypto
    .createHash('sha256')
    .update(String(right ?? ''), 'utf8')
    .digest();

  return crypto.timingSafeEqual(leftDigest, rightDigest);
}

function tokenError(error, details = {}) {
  return {
    ok: false,
    error,
    payload: null,
    ...details,
  };
}

/**
 * Compara a chave informada com BUDGET_STOCK_OVERRIDE_KEY.
 * A chave nunca é incluída no token nem retornada ao chamador.
 */
export function validateBudgetStockOverrideKey(inputKey) {
  const expectedKey = cleanString(
    process.env.BUDGET_STOCK_OVERRIDE_KEY,
    500,
  );

  if (!expectedKey) {
    return tokenError('BUDGET_STOCK_OVERRIDE_KEY_NOT_CONFIGURED');
  }

  const informedKey = cleanString(inputKey, 500);

  if (!informedKey || !constantTimeEqual(informedKey, expectedKey)) {
    return tokenError('INVALID_KEY');
  }

  return { ok: true, error: null };
}

/**
 * Emite um token exclusivamente para liberar falta de estoque.
 */
export function issueBudgetStockOverrideToken({
  userId,
  sku,
  description = null,
  requestedQty,
  availableQty = 0,
  lotId = null,
  reason = 'Liberação manual de estoque',
  ttlMinutes = process.env.BUDGET_STOCK_OVERRIDE_TTL_MINUTES,
  now = Date.now(),
} = {}) {
  const normalizedUserId = normalizeNullableId(userId);
  const normalizedSku = cleanString(sku, 100);
  const normalizedRequestedQty = normalizePositiveNumber(requestedQty);
  const normalizedAvailableQty = Number(availableQty);
  const issuedAt = Number(now);

  if (!normalizedUserId) {
    throw Object.assign(new Error('Usuário inválido para autorização.'), {
      code: 'INVALID_AUTHORIZATION_USER',
      status: 400,
    });
  }

  if (!normalizedSku) {
    throw Object.assign(new Error('SKU obrigatório para autorização.'), {
      code: 'INVALID_AUTHORIZATION_SKU',
      status: 400,
    });
  }

  if (!normalizedRequestedQty) {
    throw Object.assign(new Error('Quantidade solicitada inválida.'), {
      code: 'INVALID_AUTHORIZATION_QUANTITY',
      status: 400,
    });
  }

  if (!Number.isFinite(issuedAt) || issuedAt <= 0) {
    throw Object.assign(new Error('Data de emissão inválida.'), {
      code: 'INVALID_AUTHORIZATION_ISSUED_AT',
      status: 400,
    });
  }

  const lifetimeMinutes = normalizeTtlMinutes(ttlMinutes);
  const payload = {
    type: BUDGET_AUTHORIZATION_TOKEN_TYPE.STOCK_OVERRIDE,
    issuer: 'consart-erp',
    token_id: crypto.randomUUID(),
    user_id: normalizedUserId,
    sku: normalizedSku,
    description: cleanString(description, 300) || null,
    requested_qty: normalizedRequestedQty,
    available_qty: Number.isFinite(normalizedAvailableQty)
      ? normalizedAvailableQty
      : 0,
    lot_id: normalizeNullableId(lotId),
    reason: cleanString(reason, 300) || 'Liberação manual de estoque',
    issued_at: issuedAt,
    expires_at: issuedAt + lifetimeMinutes * 60 * 1000,
  };

  const data = Buffer
    .from(JSON.stringify(payload), 'utf8')
    .toString('base64url');

  return {
    token: `${data}.${hmac(data)}`,
    payload,
    expiresInMinutes: lifetimeMinutes,
  };
}

/**
 * Valida assinatura, tipo, validade e vínculo do token com o item.
 */
export function verifyBudgetStockOverrideToken(token, {
  userId = null,
  sku = null,
  lotId = null,
  requestedQty = null,
  now = Date.now(),
} = {}) {
  try {
    const raw = cleanString(token, 10000);
    const parts = raw.split('.');

    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      return tokenError('INVALID_TOKEN_FORMAT');
    }

    const [data, signature] = parts;
    const expectedSignature = hmac(data);

    const signatureBuffer = Buffer.from(signature, 'utf8');
    const expectedBuffer = Buffer.from(expectedSignature, 'utf8');

    if (
      signatureBuffer.length !== expectedBuffer.length ||
      !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
    ) {
      return tokenError('INVALID_TOKEN_SIGNATURE');
    }

    let payload;

    try {
      payload = JSON.parse(
        Buffer.from(data, 'base64url').toString('utf8'),
      );
    } catch {
      return tokenError('INVALID_TOKEN_PAYLOAD');
    }

    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return tokenError('INVALID_TOKEN_PAYLOAD');
    }

    if (payload.type !== BUDGET_AUTHORIZATION_TOKEN_TYPE.STOCK_OVERRIDE) {
      return tokenError('INVALID_TOKEN_TYPE');
    }

    if (payload.issuer !== 'consart-erp') {
      return tokenError('INVALID_TOKEN_ISSUER');
    }

    const issuedAt = Number(payload.issued_at);
    const expiresAt = Number(payload.expires_at);
    const currentTime = Number(now);

    if (
      !Number.isFinite(issuedAt) ||
      !Number.isFinite(expiresAt) ||
      !Number.isFinite(currentTime) ||
      issuedAt <= 0 ||
      expiresAt <= issuedAt
    ) {
      return tokenError('INVALID_TOKEN_DATES');
    }

    if (issuedAt > currentTime + 60_000) {
      return tokenError('TOKEN_ISSUED_IN_FUTURE');
    }

    if (expiresAt <= currentTime) {
      return tokenError('TOKEN_EXPIRED', { expiresAt });
    }

    const expectedUserId = normalizeNullableId(userId);
    if (
      expectedUserId !== null &&
      normalizeNullableId(payload.user_id) !== expectedUserId
    ) {
      return tokenError('TOKEN_USER_MISMATCH');
    }

    const expectedSku = cleanString(sku, 100);
    if (expectedSku && cleanString(payload.sku, 100) !== expectedSku) {
      return tokenError('TOKEN_SKU_MISMATCH');
    }

    if (normalizeNullableId(payload.lot_id) !== normalizeNullableId(lotId)) {
      return tokenError('TOKEN_LOT_MISMATCH');
    }

    const expectedQty = normalizePositiveNumber(requestedQty);
    const authorizedQty = normalizePositiveNumber(payload.requested_qty);

    if (!authorizedQty) {
      return tokenError('INVALID_TOKEN_QUANTITY');
    }

    if (expectedQty !== null && expectedQty > authorizedQty) {
      return tokenError('TOKEN_QTY_EXCEEDED', {
        authorizedQty,
        requestedQty: expectedQty,
      });
    }

    return {
      ok: true,
      error: null,
      payload,
      expiresAt,
    };
  } catch (error) {
    return tokenError(
      error?.code || 'TOKEN_VERIFY_ERROR',
      { message: error?.message || String(error) },
    );
  }
}

/**
 * Adaptador para objetos de item usados no controller e no budgetsApi.
 */
export function validateBudgetStockOverrideForItem(item, userId, options = {}) {
  return verifyBudgetStockOverrideToken(item?.override_token, {
    userId,
    sku: item?.sku ?? item?.product_code,
    lotId: item?.lot_id ?? null,
    requestedQty: item?.quantity,
    now: options.now,
  });
}

// Aliases de migração para reduzir alterações nos chamadores atuais.
export const signStockOverrideToken = issueBudgetStockOverrideToken;
export const verifyStockOverrideToken = verifyBudgetStockOverrideToken;

export default {
  BUDGET_AUTHORIZATION_TOKEN_TYPE,
  validateBudgetStockOverrideKey,
  issueBudgetStockOverrideToken,
  verifyBudgetStockOverrideToken,
  validateBudgetStockOverrideForItem,
  signStockOverrideToken,
  verifyStockOverrideToken,
};
