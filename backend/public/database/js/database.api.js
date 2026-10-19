// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: backend/public/database/js/database.api.js                    ║
// ║ MODULE: Database Viewer / Editor                                    ║
// ║ 🔐 apiFetch envia o JWT (rotas exigem perfil administrador)          ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { apiFetch } from '/public/includes/js/apiFetch.js';
import { API } from './database.config.js';

async function apiGet(url) {
    const json = await apiFetch(url);

    if (json?.success === false) {
        throw new Error(json.message || 'Erro na API.');
    }

    return json?.data;
}

async function apiSend(url, method, body) {
    const json = await apiFetch(url, {
        method,
        body: JSON.stringify(body),
    });

    if (json?.success === false) {
        throw new Error(json.message || 'Erro na API.');
    }

    return json?.data;
}

const tableUrl = (table) => `${API}/tables/${encodeURIComponent(table)}`;
const withSchema = (schema) => `?schema=${encodeURIComponent(schema)}`;

export function fetchTables(schema) {
    return apiGet(`${API}/tables${withSchema(schema)}`);
}

export function fetchRows(table, { schema, page, limit, search }) {
    const params = new URLSearchParams({
        schema,
        page: String(page),
        limit: String(limit),
        search,
    });

    return apiGet(`${tableUrl(table)}/rows?${params}`);
}

export function fetchColumns(schema, table) {
    return apiGet(`${tableUrl(table)}/columns${withSchema(schema)}`);
}

export function createRow(schema, table, data) {
    return apiSend(`${tableUrl(table)}/rows${withSchema(schema)}`, 'POST', { data });
}

export function updateRow(schema, table, pk, data) {
    return apiSend(`${tableUrl(table)}/rows${withSchema(schema)}`, 'PUT', { pk, data });
}

export function deleteRow(schema, table, pk) {
    return apiSend(`${tableUrl(table)}/rows${withSchema(schema)}`, 'DELETE', { pk });
}

// ─── Estrutura (DDL) ────────────────────────────────────────────────

export function fetchStructure(schema, table) {
    return apiGet(`${tableUrl(table)}/structure${withSchema(schema)}`);
}

export function previewStructureChange(schema, table, operation) {
    return apiSend(`${tableUrl(table)}/structure/preview${withSchema(schema)}`, 'POST', { operation });
}

export function applyStructureChange(schema, table, operation) {
    return apiSend(`${tableUrl(table)}/structure/apply${withSchema(schema)}`, 'POST', { operation });
}
