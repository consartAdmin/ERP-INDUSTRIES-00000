// ╔══════════════════════════════════════════════════════════════════════╗
// ║ budgetsNfeAttempts.sanitizers.js — validação de entrada              ║
// ║ toId / toJsonObject / normalizeValue / pickWritable                  ║
// ╚══════════════════════════════════════════════════════════════════════╝

import {
  JSON_FIELDS,
  MONEY_FIELDS,
} from './budgetsNfeAttempts.constants.js';

export function toId(value, name = 'id', nullable = false) {
    if (nullable && (value === null || value === undefined || value === '')) return null;

    const id = Number(value);

    if (!Number.isSafeInteger(id) || id <= 0) {
        const error = new Error(`${name} inválido.`);
        error.status = 400;
        error.code = 'INVALID_ID';
        throw error;
    }

    return id;
}

export function toJsonObject(value) {
    if (value == null || value === '') return {};

    if (typeof value === 'string') {
        let parsed;

        try {
            parsed = JSON.parse(value);
        } catch {
            const error = new Error('O campo JSON contém JSON inválido.');
            error.status = 400;
            error.code = 'INVALID_JSON';
            throw error;
        }

        if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
            const error = new Error('O campo JSON deve ser um objeto.');
            error.status = 400;
            error.code = 'INVALID_JSON_OBJECT';
            throw error;
        }

        return parsed;
    }

    if (Array.isArray(value) || typeof value !== 'object') {
        const error = new Error('O campo JSON deve ser um objeto.');
        error.status = 400;
        error.code = 'INVALID_JSON_OBJECT';
        throw error;
    }

    return value;
}

export function normalizeValue(column, value) {
    if (JSON_FIELDS.has(column)) return toJsonObject(value);

    if (MONEY_FIELDS.has(column)) {
        if (value === null || value === undefined || value === '') return null;

        const number = Number(value);

        if (!Number.isFinite(number)) {
            const error = new Error(`${column} inválido.`);
            error.status = 400;
            error.code = 'INVALID_NUMBER';
            throw error;
        }

        return number;
    }

    return value === '' ? null : value;
}

export function pickWritable(source = {}, columns = []) {
    const out = {};

    for (const column of columns) {
        if (Object.prototype.hasOwnProperty.call(source, column)) {
            out[column] = normalizeValue(column, source[column]);
        }
    }

    return out;
}
