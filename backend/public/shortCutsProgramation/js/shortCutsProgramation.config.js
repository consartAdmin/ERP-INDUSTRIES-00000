// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: shortCutsProgramation.config.js                               ║
// ║ MODULE: Programming Shortcuts — Configuration                       ║
// ║ DESCRIPTION: URL base e rotas utilizadas pelo módulo                ║
// ║ PRODNEX ERP                                                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

export const API_BASE =
    (typeof window !== 'undefined' && window.apiBase)
    || window.location.origin;

export const ROUTES = Object.freeze({
    base: `${API_BASE}/api/shortcuts-programation`,
    byId: (id) =>
        `${API_BASE}/api/shortcuts-programation/${encodeURIComponent(id)}`,
    restore: (id) =>
        `${API_BASE}/api/shortcuts-programation/${encodeURIComponent(id)}/restore`,
    categories: `${API_BASE}/api/shortcuts-programation/categories`,
    subcategories: (categoryId = '') =>
        `${API_BASE}/api/shortcuts-programation/subcategories?category_id=${encodeURIComponent(categoryId)}`,
});
