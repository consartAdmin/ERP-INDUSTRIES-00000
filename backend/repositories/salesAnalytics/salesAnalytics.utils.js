// ╔════════════════════════════════════════════════════════════════════╗
// ║ salesAnalytics.utils.js — Helpers numéricos                        ║
// ╚════════════════════════════════════════════════════════════════════╝

export function toNumber(value) {
    const number =
        Number(value);

    return Number.isFinite(number)
        ? number
        : 0;
}

