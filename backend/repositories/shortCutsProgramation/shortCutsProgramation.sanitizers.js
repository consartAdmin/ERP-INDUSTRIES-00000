// ╔════════════════════════════════════════════════════════════════════╗
// ║ shortCutsProgramation.sanitizers.js — Normalização de entrada      ║
// ║ Atalhos, categorias e subcategorias                                ║
// ╚════════════════════════════════════════════════════════════════════╝

export const toStrOrNull = (v) => (v === '' || v == null ? null : String(v));

export const toBool = (v, def = true) => {
    if (v === '' || v == null) return def;
    if (typeof v === 'boolean') return v;
    return ['true', '1', 'yes', 'y', 'sim', 's'].includes(String(v).toLowerCase());
};

export const toInt = (v, def = 0) => {
    const n = Number.parseInt(v, 10);
    return Number.isFinite(n) ? n : def;
};

export const toBigIntOrNull = (v) => {
    if (v === '' || v == null) return null;
    const n = Number.parseInt(v, 10);
    return Number.isFinite(n) && n > 0 ? n : null;
};

export function normalizePayload(body = {}) {
    return {
        category_id: toBigIntOrNull(body.category_id),
        subcategory_id: toBigIntOrNull(body.subcategory_id),

        category: toStrOrNull(body.category),
        subcategory: toStrOrNull(body.subcategory),

        title: toStrOrNull(body.title),
        shortcut_key: toStrOrNull(body.shortcut_key),
        shortcut_type: toStrOrNull(body.shortcut_type),
        language: toStrOrNull(body.language),
        description: toStrOrNull(body.description),
        code: toStrOrNull(body.code),
        code_template: toStrOrNull(body.code_template),
        example: toStrOrNull(body.example),
        observations: toStrOrNull(body.observations),
        tags: toStrOrNull(body.tags),
        difficulty: toInt(body.difficulty, 1),
        favorite: toBool(body.favorite, false),
        active: toBool(body.active, true),
        sort_order: toInt(body.sort_order, 0),
    };
}

export function normalizeCategoryPayload(body = {}) {
    return {
        name: toStrOrNull(body.name),
        description: toStrOrNull(body.description),
        icon: toStrOrNull(body.icon),
        color: toStrOrNull(body.color),
        sort_order: toInt(body.sort_order, 0),
        active: toBool(body.active, true),
    };
}

export function normalizeSubCategoryPayload(body = {}) {
    return {
        category_id: toBigIntOrNull(body.category_id),
        name: toStrOrNull(body.name),
        description: toStrOrNull(body.description),
        sort_order: toInt(body.sort_order, 0),
        active: toBool(body.active, true),
    };
}
