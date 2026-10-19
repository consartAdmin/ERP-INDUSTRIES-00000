// ╔══════════════════════════════════════════════════════════════════════╗
// ║ appFeatures.sanitizers.js — normalização de códigos e scopeId        ║
// ╚══════════════════════════════════════════════════════════════════════╝

/* ==========================================================================
   Normalizers
   ========================================================================== */

export function normalizeCode(value, fieldName) {
    const normalized = String(value ?? '').trim().toUpperCase();

    if (!normalized) {
        const error = new Error(`${fieldName} é obrigatório.`);
        error.code = 'VALIDATION_ERROR';
        throw error;
    }

    return normalized;
}

export function normalizeScopeId(value) {
    const normalized = Number(value);

    if (!Number.isSafeInteger(normalized) || normalized <= 0) {
        const error = new Error('scopeId deve ser um inteiro positivo.');
        error.code = 'VALIDATION_ERROR';
        throw error;
    }

    return normalized;
}
