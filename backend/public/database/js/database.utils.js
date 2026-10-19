// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: backend/public/database/js/database.utils.js                  ║
// ║ MODULE: Database Viewer / Editor                                    ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { state } from './database.state.js';

export function formatValue(value) {
    if (value === null || value === undefined) return '';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
}

export function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

export function getPkObject(row) {
    const out = {};

    for (const col of state.primaryKey) {
        out[col] = row[col];
    }

    return out;
}

// Mapa coluna → FK (apenas FKs de coluna única ou a 1ª coluna das compostas)
export function getFkByColumn() {
    const map = new Map();

    for (const fk of state.structure?.foreignKeys || []) {
        fk.columns.forEach((col, i) => {
            map.set(col, { ...fk, refColumn: fk.refColumns[i] });
        });
    }

    return map;
}

export function getColumnKeys(columnName) {
    const isPk = state.primaryKey.includes(columnName);
    const fk = getFkByColumn().get(columnName);

    return { isPk, fk };
}

export function describeFk(fk) {
    return `${fk.refTable}.${fk.refColumn ?? fk.refColumns.join(', ')}`;
}
