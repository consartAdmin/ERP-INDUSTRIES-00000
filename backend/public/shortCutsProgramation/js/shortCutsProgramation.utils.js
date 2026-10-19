// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: shortCutsProgramation.utils.js                                ║
// ║ MODULE: Programming Shortcuts — Utilities                           ║
// ║ DESCRIPTION: Funções auxiliares reutilizáveis do módulo             ║
// ║ PRODNEX ERP                                                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

export const $ = (selector) => document.querySelector(selector);

export function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

export function asRows(data) {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.rows)) return data.rows;
    if (Array.isArray(data?.data)) return data.data;
    if (Array.isArray(data?.items)) return data.items;
    return [];
}

export function selectedText(selectElement) {
    const option = selectElement?.selectedOptions?.[0];
    if (!option || !option.value) return null;
    return option.textContent.trim();
}

export function showError(error, context = 'shortCutsProgramation') {
    console.error(`[${context}]`, error);
    alert(error?.message || 'Ocorreu um erro inesperado.');
}
