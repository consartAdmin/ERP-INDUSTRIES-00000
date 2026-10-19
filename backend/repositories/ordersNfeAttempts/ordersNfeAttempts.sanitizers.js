// ╔══════════════════════════════════════════════════════════════════════╗
// ║ ordersNfeAttempts.sanitizers.js — Validação de entrada               ║
// ║ Inteiros positivos e paginação                                       ║
// ╚══════════════════════════════════════════════════════════════════════╝


export function positiveBigInt(value, field) {
    const normalized = String(value ?? '').trim();
    if (!/^\d+$/.test(normalized) || BigInt(normalized) <= 0n) {
        const error = new Error(`${field} deve ser um inteiro positivo.`);
        error.status = 400;
        throw error;
    }
    return normalized;
}

export function positiveInteger(value, field) {
    const number = Number(value);
    if (!Number.isInteger(number) || number <= 0) {
        const error = new Error(`${field} deve ser um inteiro positivo.`);
        error.status = 400;
        throw error;
    }
    return number;
}

export function pageSize(value, fallback = 50, maximum = 200) {
    const number = Number(value);
    if (!Number.isInteger(number) || number <= 0) return fallback;
    return Math.min(number, maximum);
}

export function offsetValue(value) {
    const number = Number(value);
    return Number.isInteger(number) && number >= 0 ? number : 0;
}
