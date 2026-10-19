// ╔══════════════════════════════════════════════════════════════════════╗
// ║ products.sanitizers.js — validação / normalização de entrada         ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { ProductsApiError } from './products.utils.js';

export function requiredProductCode(value) {
    const code = String(value ?? '').trim();
    if (!code) {
        throw new ProductsApiError('product_code é obrigatório.', {
            code: 'INVALID_PRODUCT_CODE',
            status: 400,
        });
    }
    return code;
}

export function positiveInteger(value, fallback = null) {
    if (value === undefined || value === null || value === '') return fallback;
    const number = Number(value);
    return Number.isInteger(number) && number > 0 ? number : fallback;
}

function normalizeNumber(value) {
    if (value === undefined || value === null || value === '') return value;
    if (typeof value === 'number') return Number.isFinite(value) ? value : value;

    const text = String(value).trim();
    if (!text) return value;

    const normalized = text.includes(',')
        ? text.replace(/\./g, '').replace(',', '.')
        : text;

    const number = Number(normalized);
    return Number.isFinite(number) ? number : value;
}

export function normalizeInput(payload = {}) {
    return {
        ...payload,
        ...(Object.prototype.hasOwnProperty.call(payload, 'cost_price')
            ? { cost_price: normalizeNumber(payload.cost_price) }
            : {}),
    };
}
