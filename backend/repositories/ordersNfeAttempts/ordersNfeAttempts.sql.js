// ╔══════════════════════════════════════════════════════════════════════╗
// ║ ordersNfeAttempts.sql.js — Builders SQL                              ║
// ║ INSERT / UPDATE a partir das colunas permitidas                      ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { ATTEMPT_UPDATE, ATTEMPT_JSON } from './ordersNfeAttempts.constants.js';
import { serializeValue } from './ordersNfeAttempts.utils.js';

export function buildInsert(data, allowedColumns, jsonColumns, extra = {}) {
    const source = { ...data, ...extra };
    const columns = Object.keys(source).filter(
        (column) => allowedColumns.has(column) && source[column] !== undefined,
    );

    if (columns.length === 0) {
        throw new Error('Nenhum campo válido foi informado para inserção.');
    }

    return {
        columns,
        names: columns.map((column) => `"${column}"`).join(', '),
        placeholders: columns.map((_, index) => `$${index + 1}`).join(', '),
        values: columns.map((column) => serializeValue(
            column,
            source[column],
            jsonColumns,
        )),
    };
}

export function buildUpdate(data) {
    const columns = Object.keys(data).filter(
        (column) => ATTEMPT_UPDATE.has(column) && data[column] !== undefined,
    );

    return {
        columns,
        setClause: columns
            .map((column, index) => `"${column}" = $${index + 1}`)
            .join(', '),
        values: columns.map((column) => serializeValue(
            column,
            data[column],
            ATTEMPT_JSON,
        )),
    };
}
