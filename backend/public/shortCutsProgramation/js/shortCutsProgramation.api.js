// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: shortCutsProgramation.api.js                                  ║
// ║ MODULE: Programming Shortcuts — API                                 ║
// ║ DESCRIPTION: Comunicação HTTP com a API de atalhos                  ║
// ║ PRODNEX ERP                                                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { ROUTES } from './shortCutsProgramation.config.js';

export async function api(url, options = {}) {
    const response = await fetch(url, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(options.headers || {}),
        },
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || data.ok === false) {
        throw new Error(data.error || `HTTP ${response.status}`);
    }

    return data;
}

export const shortcutsApi = Object.freeze({
    list: (query) => api(`${ROUTES.base}?${query}`),
    create: (payload) => api(ROUTES.base, {
        method: 'POST',
        body: JSON.stringify(payload),
    }),
    update: (id, payload) => api(ROUTES.byId(id), {
        method: 'PUT',
        body: JSON.stringify(payload),
    }),
    deactivate: (id) => api(ROUTES.byId(id), { method: 'DELETE' }),
    restore: (id) => api(ROUTES.restore(id), { method: 'PATCH' }),
    categories: () => api(ROUTES.categories),
    subcategories: (categoryId) => api(ROUTES.subcategories(categoryId)),
});
